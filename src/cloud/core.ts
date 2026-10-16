// Cloud backup client (DECISIONS A12–A17): sends snapshots to /api/backup, keeps the status, retries.
// IndexedDB stays the only store the app reads from; the cloud is a copy.
import { parseSnapshot, snapshotData, type Snapshot } from '../db/exportImport';

export type CloudStatus =
  | 'off' // no token
  | 'idle' // token saved, nothing sent yet
  | 'ok'
  | 'offline' // no connection: retrying
  | 'error' // server error: retrying
  | 'auth' // token rejected
  | 'fewer' // the cloud has more sessions than this phone: waiting for a confirm
  | 'setup'; // no backup server here, or it isn't configured

export interface CloudState {
  status: CloudStatus;
  /** When the snapshot last backed up (or restored) was made, in ms. */
  lastAt?: number;
  lastSessions?: number;
  /** Hash of that snapshot's data. Local data with another hash has changes not backed up yet. */
  lastHash?: string;
  restored?: boolean;
  /** For 'fewer'. */
  cloudSessions?: number;
  localSessions?: number;
  message?: string;
}

export interface CloudView extends CloudState {
  loaded: boolean;
  busy: boolean;
  hasToken: boolean;
  token: string | null;
}

export interface SnapshotInfo {
  key: string;
  at: string;
  sessions: number | null;
  latest: boolean;
}

export interface CloudDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  load(): Promise<{ token: string | null; state: CloudState | null }>;
  saveToken(token: string | null): Promise<void>;
  saveState(state: CloudState): Promise<void>;
  /** The phone's data, or null while it has none (before onboarding): an empty phone is never backed up. */
  local(): Promise<Snapshot | null>;
  replace(s: Snapshot): Promise<void>;
  later(fn: () => void, ms: number): () => void;
}

type ErrorKind = 'offline' | 'auth' | 'fewer' | 'none' | 'setup' | 'server';

export class CloudError extends Error {
  kind: ErrorKind;
  cloud?: number;
  incoming?: number;

  constructor(kind: ErrorKind, message: string, counts?: { cloud?: number; incoming?: number }) {
    super(message);
    this.kind = kind;
    this.cloud = counts?.cloud;
    this.incoming = counts?.incoming;
  }
}

const API = '/api/backup';
const RETRY_FIRST = 30_000;
const RETRY_MAX = 10 * 60_000;

/** SHA-256 where available (HTTPS, localhost); FNV-1a on a plain-HTTP dev address. Only used to spot changes. */
export async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return `fnv-${h.toString(16)}`;
}

export class Cloud {
  private deps: CloudDeps;
  private token: string | null = null;
  private state: CloudState = { status: 'off' };
  private view: CloudView = { status: 'off', loaded: false, busy: false, hasToken: false, token: null };
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private busy = false;
  private retryDelay = 0;
  private cancelRetry: (() => void) | null = null;

  constructor(deps: CloudDeps) {
    this.deps = deps;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    void this.init();
    return () => this.listeners.delete(fn);
  };

  getView = (): CloudView => this.view;

  init(): Promise<void> {
    this.loading ??= this.deps.load().then(({ token, state }) => {
      this.token = token;
      this.state = token ? (state ?? { status: 'idle' }) : { ...state, status: 'off' };
      this.loaded = true;
      this.emit();
    });
    return this.loading;
  }

  async setToken(raw: string): Promise<void> {
    await this.init();
    const token = raw.trim() || null;
    this.token = token;
    await this.deps.saveToken(token);
    this.stopRetry();
    await this.save({ ...this.state, status: token ? 'idle' : 'off', message: undefined, cloudSessions: undefined, localSessions: undefined });
  }

  /** After a session, a check-in, on open: only sends when the data changed since the last backup [A16]. */
  auto = (): Promise<void> => this.backup(false, false);
  backupNow = (): Promise<void> => this.backup(true, false);
  /** Sends this phone's data even if the cloud has more sessions (the explicit confirm, A13). */
  replaceCloud = (): Promise<void> => this.backup(true, true);

  async list(): Promise<SnapshotInfo[]> {
    await this.init();
    const res = await this.call(`${API}/list`);
    const body = (await res.json()) as { latest: string | null; snapshots: { key: string; at: string; sessions: number | null }[] };
    return body.snapshots.map((s) => ({ key: s.key, at: s.at, sessions: s.sessions, latest: s.key === body.latest }));
  }

  /** Replaces everything on the phone with the snapshot (the latest when no key). Returns its session count. */
  async restore(key?: string): Promise<number> {
    await this.init();
    const res = await this.call(key ? `${API}?key=${encodeURIComponent(key)}` : API);
    const snap = parseSnapshot(await res.text());
    return this.serial(async () => {
      await this.deps.replace(snap);
      this.stopRetry();
      // Hash what the phone now holds: the database can return rows in another order than the file had.
      const now = await this.deps.local();
      await this.save({
        status: 'ok',
        lastAt: Date.parse(snap.exportedAt) || undefined,
        lastSessions: snap.sessions.length,
        lastHash: await digest(snapshotData(now ?? snap)),
        restored: true,
      });
      return snap.sessions.length;
    });
  }

  /** One at a time, in order; never rejects (the result is in the status). */
  private backup(manual: boolean, force: boolean): Promise<void> {
    return this.serial(async () => {
      try {
        await this.init();
        await this.run(manual, force);
      } catch (e) {
        await this.save({ ...this.state, status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async run(manual: boolean, force: boolean): Promise<void> {
    if (!this.token) return;
    const snap = await this.deps.local();
    if (!snap) return;
    const hash = await digest(snapshotData(snap));
    if (!manual && hash === this.state.lastHash) {
      if (this.state.status !== 'ok') await this.save({ ...this.state, status: 'ok', message: undefined });
      return;
    }

    this.setBusy(true);
    try {
      const res = await this.call(force ? `${API}?confirm=fewer` : API, { method: 'PUT', body: JSON.stringify(snap) });
      const r = (await res.json()) as { at: string; sessions: number };
      this.stopRetry();
      await this.save({ status: 'ok', lastAt: Date.parse(r.at), lastSessions: r.sessions, lastHash: hash });
    } catch (e) {
      const err = e instanceof CloudError ? e : new CloudError('server', e instanceof Error ? e.message : String(e));
      const base: CloudState = { ...this.state, message: err.message, cloudSessions: undefined, localSessions: undefined };
      if (err.kind === 'fewer') {
        await this.save({ ...base, status: 'fewer', cloudSessions: err.cloud, localSessions: err.incoming });
      } else if (err.kind === 'auth' || err.kind === 'setup') {
        await this.save({ ...base, status: err.kind });
      } else {
        // Offline or a server hiccup: try again by itself, quietly [A17].
        await this.save({ ...base, status: err.kind === 'offline' ? 'offline' : 'error' });
        this.retry();
      }
    } finally {
      this.setBusy(false);
    }
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.token) throw new CloudError('auth', 'No backup token.');
    let res: Response;
    try {
      res = await this.deps.fetch(path, {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${this.token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch {
      throw new CloudError('offline', 'No connection.');
    }
    // An HTML page instead of JSON: this address has no backup API (old host, plain dev server).
    if (!(res.headers.get('Content-Type') ?? '').includes('application/json')) {
      if (res.status >= 500) throw new CloudError('server', `Server error ${res.status}.`);
      throw new CloudError('setup', 'There is no backup server at this address.');
    }
    if (res.ok) return res;
    const body = (await res.json().catch(() => ({}))) as { message?: string; cloud?: number; incoming?: number };
    const message = body.message ?? `Server error ${res.status}.`;
    if (res.status === 401) throw new CloudError('auth', 'The server rejected this token.');
    if (res.status === 409) throw new CloudError('fewer', message, body);
    if (res.status === 404) throw new CloudError('none', message);
    if (res.status === 503) throw new CloudError('setup', message);
    throw new CloudError('server', message);
  }

  private retry(): void {
    this.cancelRetry?.();
    this.retryDelay = Math.min(RETRY_MAX, this.retryDelay ? this.retryDelay * 2 : RETRY_FIRST);
    this.cancelRetry = this.deps.later(() => {
      this.cancelRetry = null;
      void this.auto();
    }, this.retryDelay);
  }

  private stopRetry(): void {
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.retryDelay = 0;
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.emit();
  }

  private async save(state: CloudState): Promise<void> {
    this.state = state;
    this.emit();
    await this.deps.saveState(state);
  }

  private emit(): void {
    this.view = { ...this.state, loaded: this.loaded, busy: this.busy, hasToken: this.token !== null, token: this.token };
    for (const fn of this.listeners) fn();
  }
}
