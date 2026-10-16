import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { list, onRequest, type Env, type KV } from '../../../functions/api/backup';
import type { Snapshot } from '../../db/exportImport';
import { Cloud, type CloudState } from '../core';

/** In-memory Workers KV. Lists come in pages of 7 so pagination gets exercised. */
class FakeKV implements KV {
  m = new Map<string, { value: string; metadata: unknown }>();
  async get(key: string) {
    return this.m.get(key)?.value ?? null;
  }
  async getWithMetadata<M>(key: string) {
    const e = this.m.get(key);
    return { value: e?.value ?? null, metadata: (e?.metadata ?? null) as M | null };
  }
  async put(key: string, value: string, options?: { metadata?: unknown }) {
    this.m.set(key, { value, metadata: options?.metadata ?? null });
  }
  async delete(key: string) {
    this.m.delete(key);
  }
  async list<M>({ prefix = '', cursor }: { prefix?: string; cursor?: string } = {}) {
    const names = [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = Number(cursor ?? 0);
    const end = start + 7;
    return {
      keys: names.slice(start, end).map((name) => ({ name, metadata: this.m.get(name)!.metadata as M })),
      list_complete: end >= names.length,
      cursor: end >= names.length ? undefined : String(end),
    };
  }
}

const TOKEN = 'test-token-0123456789abcdef';

function server(env: Env) {
  return async (url: string, init: RequestInit = {}): Promise<Response> => {
    const request = new Request(new URL(url, 'https://app.test'), init);
    return new URL(request.url).pathname === '/api/backup/list' ? list({ request, env }) : onRequest({ request, env });
  };
}

const snap = (sessions: number, schemaVersion = 2): Snapshot =>
  ({
    format: 'calisthenics-backup',
    schemaVersion,
    exportedAt: new Date().toISOString(),
    kv: [{ key: 'baselines', value: { startDate: '2026-10-01' } }],
    sessions: Array.from({ length: sessions }, (_, i) => ({ id: `s${i}`, date: '2026-10-01', lines: [] })),
    checkins: [],
    events: [],
    gtg: [],
  }) as unknown as Snapshot;

const auth = (token = TOKEN) => ({ Authorization: `Bearer ${token}` });
const put = (f: ReturnType<typeof server>, body: unknown, q = '', token = TOKEN) =>
  f(`/api/backup${q}`, { method: 'PUT', headers: auth(token), body: typeof body === 'string' ? body : JSON.stringify(body) });
const getList = async (f: ReturnType<typeof server>) =>
  (await (await f('/api/backup/list', { headers: auth() })).json()) as { latest: string | null; snapshots: { key: string; sessions: number }[] };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());
const tick = () => vi.setSystemTime(Date.now() + 1000);

describe('backup function', () => {
  it('rejects a missing or wrong token, and says what setup is missing', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    expect((await f('/api/backup')).status).toBe(401);
    expect((await f('/api/backup', { headers: auth('wrong-token-wrong-token') })).status).toBe(401);
    expect((await f('/api/backup', { headers: { Authorization: TOKEN } })).status).toBe(401);
    expect((await put(f, snap(1), '', 'nope')).status).toBe(401);

    expect((await server({ BACKUPS: new FakeKV() })('/api/backup', { headers: auth() })).status).toBe(503);
    expect((await server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: 'short' })('/api/backup', { headers: auth('short') })).status).toBe(503);
    const noKv = await server({ BACKUP_TOKEN: TOKEN })('/api/backup', { headers: auth() });
    expect(noKv.status).toBe(503);
    expect(((await noKv.json()) as { message: string }).message).toMatch(/BACKUPS/);
  });

  it('stores a snapshot as snap:<time> and as latest, and reads either back', async () => {
    const kv = new FakeKV();
    const f = server({ BACKUPS: kv, BACKUP_TOKEN: TOKEN });
    expect((await f('/api/backup', { headers: auth() })).status).toBe(404);

    const body = JSON.stringify(snap(3));
    const res = await put(f, body);
    expect(res.status).toBe(201);
    const r = (await res.json()) as { key: string; sessions: number; schemaVersion: number };
    expect(r).toMatchObject({ key: 'snap:2026-10-16T10:00:00.000Z', sessions: 3, schemaVersion: 2 });

    const latest = await f('/api/backup', { headers: auth() });
    expect(latest.headers.get('Content-Type')).toMatch(/application\/json/);
    expect(latest.headers.get('Cache-Control')).toBe('no-store');
    expect(await latest.text()).toBe(body);
    expect(await (await f(`/api/backup?key=${encodeURIComponent(r.key)}`, { headers: auth() })).text()).toBe(body);
    expect((await f('/api/backup?key=settings', { headers: auth() })).status).toBe(400);
    expect((await f('/api/backup?key=snap:2020-01-01T00:00:00.000Z', { headers: auth() })).status).toBe(404);

    tick();
    await put(f, snap(4));
    const l = await getList(f);
    expect(l.snapshots.map((s) => [s.key, s.sessions])).toEqual([
      ['snap:2026-10-16T10:00:01.000Z', 4],
      ['snap:2026-10-16T10:00:00.000Z', 3],
    ]);
    expect(l.latest).toBe('snap:2026-10-16T10:00:01.000Z');
  });

  it('refuses to replace latest with fewer sessions unless confirmed, and stores nothing when it refuses', async () => {
    const kv = new FakeKV();
    const f = server({ BACKUPS: kv, BACKUP_TOKEN: TOKEN });
    await put(f, snap(5));
    tick();
    const res = await put(f, snap(2));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'fewer', cloud: 5, incoming: 2 });
    expect((await getList(f)).snapshots).toHaveLength(1);
    expect(JSON.parse((await kv.get('latest'))!).sessions).toHaveLength(5);

    expect((await put(f, snap(5))).status).toBe(201); // the same count is fine
    tick();
    expect((await put(f, snap(2), '?confirm=fewer')).status).toBe(201);
    expect(JSON.parse((await kv.get('latest'))!).sessions).toHaveLength(2);
    expect((await getList(f)).snapshots.map((s) => s.sessions)).toEqual([2, 5, 5]);
  });

  it('keeps the 20 newest snapshots', async () => {
    const kv = new FakeKV();
    const f = server({ BACKUPS: kv, BACKUP_TOKEN: TOKEN });
    for (let i = 0; i < 23; i++) {
      tick();
      expect((await put(f, snap(i))).status).toBe(201);
    }
    const l = await getList(f);
    expect(l.snapshots).toHaveLength(20);
    expect(l.snapshots[0]!.sessions).toBe(22);
    expect(l.snapshots.at(-1)!.sessions).toBe(3);
    expect(l.latest).toBe(l.snapshots[0]!.key);
    expect([...kv.m.keys()].filter((k) => !k.startsWith('snap:'))).toEqual(['latest']);
  });

  it('rejects bodies that are not snapshots, too large, or the wrong method', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    expect((await put(f, 'not json')).status).toBe(400);
    expect((await put(f, { format: 'other', schemaVersion: 2, sessions: [] })).status).toBe(400);
    expect((await put(f, { format: 'calisthenics-backup', sessions: [] })).status).toBe(400);
    expect((await put(f, { ...snap(1), pad: 'x'.repeat(5_000_001) })).status).toBe(413);
    expect((await f('/api/backup', { method: 'POST', headers: auth(), body: '{}' })).status).toBe(405);
    expect((await f('/api/backup/list', { method: 'DELETE', headers: auth() })).status).toBe(405);
  });
});

describe('cloud client', () => {
  function phone(fetch: (url: string, init: RequestInit) => Promise<Response>, opts: { token?: string | null; sessions?: number | null } = {}) {
    const p = {
      local: opts.sessions === null ? null : snap(opts.sessions ?? 3),
      saved: { token: opts.token === undefined ? TOKEN : opts.token, state: null as CloudState | null },
      calls: [] as string[],
      timers: [] as { fn: () => void; ms: number }[],
      cloud: null as unknown as Cloud,
    };
    p.cloud = new Cloud({
      fetch: async (url, init) => {
        p.calls.push(`${init.method ?? 'GET'} ${url}`);
        return fetch(url, init);
      },
      load: async () => ({ token: p.saved.token, state: p.saved.state }),
      saveToken: async (t) => {
        p.saved.token = t;
      },
      saveState: async (s) => {
        p.saved.state = s;
      },
      local: async () => p.local && { ...p.local, exportedAt: new Date().toISOString() },
      // Like IndexedDB, hand rows back in key order, not in the order they were written.
      replace: async (s) => {
        p.local = { ...s, sessions: [...s.sessions].reverse() };
      },
      later: (fn, ms) => {
        const t = { fn, ms };
        p.timers.push(t);
        return () => p.timers.splice(p.timers.indexOf(t), 1);
      },
    });
    return p;
  }
  const puts = (p: { calls: string[] }) => p.calls.filter((c) => c.startsWith('PUT')).length;

  it('backs up, then sends again only when the data changed', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    const p = phone(f);
    await p.cloud.auto();
    expect(puts(p)).toBe(1);
    expect(p.cloud.getView()).toMatchObject({ status: 'ok', lastSessions: 3, hasToken: true, busy: false });
    expect(p.saved.state?.lastAt).toBe(Date.parse('2026-10-16T10:00:00.000Z'));

    tick();
    await p.cloud.auto(); // reopening the app with nothing new
    expect(puts(p)).toBe(1);

    p.local = snap(4);
    await p.cloud.auto();
    expect(puts(p)).toBe(2);
    await p.cloud.backupNow(); // the button always sends
    expect(puts(p)).toBe(3);
  });

  it('never backs up an empty phone, and does nothing without a token', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    const empty = phone(f, { sessions: null });
    await empty.cloud.auto();
    await empty.cloud.backupNow();
    expect(empty.calls).toEqual([]);

    const off = phone(f, { token: null });
    await off.cloud.auto();
    expect(off.calls).toEqual([]);
    expect(off.cloud.getView()).toMatchObject({ status: 'off', hasToken: false, loaded: true });
  });

  it('pauses instead of replacing a backup that has more sessions, until you confirm', async () => {
    const kv = new FakeKV();
    const f = server({ BACKUPS: kv, BACKUP_TOKEN: TOKEN });
    await put(f, snap(30));
    tick();

    const p = phone(f, { sessions: 2 });
    await p.cloud.auto();
    expect(p.cloud.getView()).toMatchObject({ status: 'fewer', cloudSessions: 30, localSessions: 2 });
    expect(JSON.parse((await kv.get('latest'))!).sessions).toHaveLength(30);
    expect(p.timers).toHaveLength(0);

    await p.cloud.replaceCloud();
    expect(p.cloud.getView()).toMatchObject({ status: 'ok', lastSessions: 2 });
    expect(JSON.parse((await kv.get('latest'))!).sessions).toHaveLength(2);
    expect((await getList(f)).snapshots.map((s) => s.sessions)).toEqual([2, 30]);
  });

  it('retries quietly after a network failure', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    let online = false;
    const p = phone((url, init) => (online ? f(url, init) : Promise.reject(new TypeError('Load failed'))));
    await p.cloud.auto();
    expect(p.cloud.getView().status).toBe('offline');
    expect(p.timers.map((t) => t.ms)).toEqual([30_000]);

    p.timers.pop()!.fn(); // the retry fires while still offline: the wait doubles
    await vi.waitFor(() => expect(p.timers.map((t) => t.ms)).toEqual([60_000]));

    online = true;
    p.timers.pop()!.fn();
    await vi.waitFor(() => expect(p.cloud.getView().status).toBe('ok'));
    expect(p.timers).toHaveLength(0);
  });

  it('reports a rejected token and an address without the API', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    const wrong = phone(f, { token: 'some-other-token-123456' });
    await wrong.cloud.auto();
    expect(wrong.cloud.getView().status).toBe('auth');
    expect(wrong.timers).toHaveLength(0);

    const html = phone(async () => new Response('<!doctype html>', { status: 404, headers: { 'Content-Type': 'text/html' } }));
    await html.cloud.auto();
    expect(html.cloud.getView()).toMatchObject({ status: 'setup', message: 'There is no backup server at this address.' });

    const fresh = phone(f, { token: null });
    await fresh.cloud.setToken(`  ${TOKEN}  `);
    expect(fresh.saved.token).toBe(TOKEN);
    await fresh.cloud.auto();
    expect(fresh.cloud.getView().status).toBe('ok');
  });

  it('restores the latest or an older snapshot onto the phone, without sending it straight back', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    await put(f, snap(10));
    tick();
    await put(f, snap(12));

    const p = phone(f, { sessions: null });
    const found = await p.cloud.list();
    expect(found.map((s) => [s.sessions, s.latest])).toEqual([
      [12, true],
      [10, false],
    ]);
    expect(await p.cloud.restore()).toBe(12);
    expect(p.local!.sessions).toHaveLength(12);
    expect(p.cloud.getView()).toMatchObject({ status: 'ok', restored: true, lastSessions: 12 });
    await p.cloud.auto();
    expect(puts(p)).toBe(0);

    expect(await p.cloud.restore(found[1]!.key)).toBe(10);
    expect(p.local!.sessions).toHaveLength(10);
  });

  it('refuses a snapshot from a newer version of the app', async () => {
    const f = server({ BACKUPS: new FakeKV(), BACKUP_TOKEN: TOKEN });
    await put(f, snap(4, 99));
    const p = phone(f, { sessions: 1 });
    await expect(p.cloud.restore()).rejects.toThrow(/newer version/);
    expect(p.local!.sessions).toHaveLength(1);
  });
});
