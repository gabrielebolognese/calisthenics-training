import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import setupSql from '../../../supabase/setup.sql?raw';
import type { Snapshot } from '../../db/exportImport';
import { Cloud, type CloudState } from '../core';

// supabase/setup.sql runs in PGlite (real Postgres). `rpc` stands in for Supabase's Data API:
// POST /rest/v1/rpc/<fn> with named JSON arguments, run as the public `anon` role.
const URL_ = 'https://test.supabase.co';
const KEY = 'sb_publishable_test';
const TYPES: Record<string, string> = { p_token: 'text', p_key: 'text', p_snapshot: 'json', p_confirm_fewer: 'boolean' };

let pg: PGlite;
let TOKEN: string;

async function as<T>(role: 'anon', fn: () => Promise<T>): Promise<T> {
  await pg.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await pg.exec('reset role');
  }
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function rpc(url: string, init: RequestInit): Promise<Response> {
  const m = /^https:\/\/test\.supabase\.co\/rest\/v1\/rpc\/(\w+)$/.exec(url);
  if (init.method !== 'POST' || !m) return reply({ message: 'Not found' }, 404);
  if ((init.headers as Record<string, string>).apikey !== KEY) return reply({ message: 'Invalid API key' }, 401);
  const args = JSON.parse(init.body as string) as Record<string, unknown>;
  const names = Object.keys(args);
  const sql = `select public.${m[1]}(${names.map((n, i) => `${n} => $${i + 1}::${TYPES[n]}`).join(', ')}) as r`;
  const params = names.map((n) => (TYPES[n] === 'json' ? JSON.stringify(args[n]) : args[n]));
  try {
    const r = await as('anon', () => pg.query<{ r: unknown }>(sql, params));
    return reply(r.rows[0]!.r);
  } catch (e) {
    const message = (e as Error).message;
    return /does not exist/.test(message) ? reply({ code: 'PGRST202', message }, 404) : reply({ message }, 400);
  }
}

const call = async (fn: string, args: Record<string, unknown>) =>
  (await (await rpc(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY }, body: JSON.stringify(args) })).json()) as Record<
    string,
    unknown
  >;
const put = (snapshot: unknown, extra: Record<string, unknown> = {}, token = TOKEN) => call('backup_put', { p_token: token, p_snapshot: snapshot, ...extra });
const list = async () => (await call('backup_list', { p_token: TOKEN })) as { latest: string | null; snapshots: { key: string; at: string; sessions: number }[] };

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

beforeAll(async () => {
  pg = await PGlite.create();
  // What a Supabase project already has: the API roles, allowed into the public schema.
  await pg.exec('create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;');
  const out = await pg.exec(setupSql);
  TOKEN = out.at(-1)!.rows[0]!.backup_token as string;
});
afterAll(() => pg.close());
beforeEach(() => pg.exec('delete from cali.backups'));

describe('supabase/setup.sql', () => {
  it('makes a long random token, and running it again keeps it', async () => {
    expect(TOKEN).toMatch(/^[0-9a-f]{64}$/);
    const again = await pg.exec(setupSql);
    expect(again.at(-1)!.rows[0]!.backup_token).toMatch(/^Already set up/);
    expect((await put(snap(1))).sessions).toBe(1);
    const stored = await pg.query<{ token_hash: string }>('select token_hash from cali.config');
    expect(stored.rows[0]!.token_hash).not.toContain(TOKEN);
  });

  it('keeps the tables and the token out of reach of the public key', async () => {
    await expect(as('anon', () => pg.query('select * from cali.backups'))).rejects.toThrow(/permission denied/);
    await expect(as('anon', () => pg.query('select * from cali.config'))).rejects.toThrow(/permission denied/);
    await expect(as('anon', () => pg.query('select cali.new_token()'))).rejects.toThrow(/permission denied/);
    expect(await call('backup_list', { p_token: 'wrong' })).toMatchObject({ error: 'auth' });
    expect(await call('backup_get', { p_token: '' })).toMatchObject({ error: 'auth' });
    expect(await put(snap(1), {}, `${TOKEN}x`)).toMatchObject({ error: 'auth' });
    expect((await list()).snapshots).toHaveLength(0);
  });

  it('stores a snapshot and gives it back exactly, as the latest or by key', async () => {
    expect(await call('backup_get', { p_token: TOKEN })).toMatchObject({ error: 'none' });
    const first = snap(3);
    const r = await put(first);
    expect(r).toMatchObject({ sessions: 3, schemaVersion: 2 });
    expect(r.key).toMatch(/^snap:\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
    expect(Date.parse(r.at as string)).toBeGreaterThan(Date.now() - 60_000);

    expect(await call('backup_get', { p_token: TOKEN })).toEqual({ snapshot: first });
    await put(snap(4));
    expect(((await call('backup_get', { p_token: TOKEN })).snapshot as Snapshot).sessions).toHaveLength(4);
    expect(await call('backup_get', { p_token: TOKEN, p_key: r.key })).toEqual({ snapshot: first });
    expect(await call('backup_get', { p_token: TOKEN, p_key: 'snap:nope' })).toMatchObject({ error: 'none' });

    const l = await list();
    expect(l.snapshots.map((s) => s.sessions)).toEqual([4, 3]);
    expect(l.latest).toBe(l.snapshots[0]!.key);
  });

  it('refuses to replace the latest with fewer sessions unless confirmed, and stores nothing when it refuses', async () => {
    await put(snap(5));
    expect(await put(snap(2))).toMatchObject({ error: 'fewer', cloud: 5, incoming: 2 });
    expect((await list()).snapshots.map((s) => s.sessions)).toEqual([5]);

    expect((await put(snap(5))).error).toBeUndefined(); // the same count is fine
    expect((await put(snap(2), { p_confirm_fewer: true })).sessions).toBe(2);
    expect((await list()).snapshots.map((s) => s.sessions)).toEqual([2, 5, 5]);
  });

  it('keeps the 20 newest snapshots', async () => {
    for (let i = 0; i < 23; i++) expect((await put(snap(i))).sessions).toBe(i);
    const l = await list();
    expect(l.snapshots).toHaveLength(20);
    expect(l.snapshots[0]!.sessions).toBe(22);
    expect(l.snapshots.at(-1)!.sessions).toBe(3);
  });

  it('rejects anything that is not a snapshot', async () => {
    expect(await put('text')).toMatchObject({ error: 'format' });
    expect(await put({ format: 'other', schemaVersion: 2, sessions: [] })).toMatchObject({ error: 'format' });
    expect(await put({ format: 'calisthenics-backup', sessions: [] })).toMatchObject({ error: 'format' });
    expect(await put({ format: 'calisthenics-backup', schemaVersion: 2, sessions: {} })).toMatchObject({ error: 'format' });
    expect(await put({ ...snap(1), pad: 'x'.repeat(5_000_001) })).toMatchObject({ error: 'size' });
    expect((await list()).snapshots).toHaveLength(0);
  });
});

describe('cloud client', () => {
  function phone(fetch: (url: string, init: RequestInit) => Promise<Response>, opts: { token?: string | null; sessions?: number | null; url?: string } = {}) {
    const p = {
      local: opts.sessions === null ? null : snap(opts.sessions ?? 3),
      saved: { token: opts.token === undefined ? TOKEN : opts.token, state: null as CloudState | null },
      calls: [] as string[],
      timers: [] as { fn: () => void; ms: number }[],
      cloud: null as unknown as Cloud,
    };
    p.cloud = new Cloud({
      url: opts.url ?? URL_,
      key: KEY,
      fetch: async (url, init) => {
        p.calls.push(url.split('/').at(-1)!);
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
  const puts = (p: { calls: string[] }) => p.calls.filter((c) => c === 'backup_put').length;

  it('backs up, then sends again only when the data changed', async () => {
    const p = phone(rpc);
    await p.cloud.auto();
    expect(puts(p)).toBe(1);
    expect(p.cloud.getView()).toMatchObject({ status: 'ok', lastSessions: 3, hasToken: true, busy: false });
    expect(p.saved.state?.lastAt).toBe(Date.parse((await list()).snapshots[0]!.at));

    await p.cloud.auto(); // reopening the app with nothing new
    expect(puts(p)).toBe(1);

    p.local = snap(4);
    await p.cloud.auto();
    expect(puts(p)).toBe(2);
    await p.cloud.backupNow(); // the button always sends
    expect(puts(p)).toBe(3);
  });

  it('never backs up an empty phone, and does nothing without a token', async () => {
    const empty = phone(rpc, { sessions: null });
    await empty.cloud.auto();
    await empty.cloud.backupNow();
    expect(empty.calls).toEqual([]);

    const off = phone(rpc, { token: null });
    await off.cloud.auto();
    expect(off.calls).toEqual([]);
    expect(off.cloud.getView()).toMatchObject({ status: 'off', hasToken: false, loaded: true });
  });

  it('pauses instead of replacing a backup that has more sessions, until you confirm', async () => {
    await put(snap(30));
    const p = phone(rpc, { sessions: 2 });
    await p.cloud.auto();
    expect(p.cloud.getView()).toMatchObject({ status: 'fewer', cloudSessions: 30, localSessions: 2 });
    expect((await list()).snapshots.map((s) => s.sessions)).toEqual([30]);
    expect(p.timers).toHaveLength(0);

    await p.cloud.replaceCloud();
    expect(p.cloud.getView()).toMatchObject({ status: 'ok', lastSessions: 2 });
    expect((await list()).snapshots.map((s) => s.sessions)).toEqual([2, 30]);
  });

  it('retries quietly after a network failure', async () => {
    let online = false;
    const p = phone((url, init) => (online ? rpc(url, init) : Promise.reject(new TypeError('Load failed'))));
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

  it('reports a rejected token, a missing setup, and an app not connected yet', async () => {
    const wrong = phone(rpc, { token: 'some-other-token' });
    await wrong.cloud.auto();
    expect(wrong.cloud.getView().status).toBe('auth');
    expect(wrong.timers).toHaveLength(0);

    const missing = phone(async () => reply({ code: 'PGRST202', message: 'Could not find the function' }, 404));
    await missing.cloud.auto();
    expect(missing.cloud.getView()).toMatchObject({ status: 'setup', message: expect.stringMatching(/setup\.sql/) });

    const unconnected = phone(rpc, { url: '' });
    await unconnected.cloud.auto();
    expect(unconnected.calls).toEqual([]);
    expect(unconnected.cloud.getView()).toMatchObject({ status: 'setup', message: expect.stringMatching(/isn’t connected/) });

    const fresh = phone(rpc, { token: null });
    await fresh.cloud.setToken(`  ${TOKEN}  `);
    expect(fresh.saved.token).toBe(TOKEN);
    await fresh.cloud.auto();
    expect(fresh.cloud.getView().status).toBe('ok');
  });

  it('restores the latest or an older snapshot onto the phone, without sending it straight back', async () => {
    await put(snap(10));
    await put(snap(12));

    const p = phone(rpc, { sessions: null });
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
    await put(snap(4, 99));
    const p = phone(rpc, { sessions: 1 });
    await expect(p.cloud.restore()).rejects.toThrow(/newer version/);
    expect(p.local!.sessions).toHaveLength(1);
  });
});
