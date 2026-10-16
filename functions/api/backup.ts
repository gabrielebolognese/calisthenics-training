// Cloud backup API: a Cloudflare Pages Function with the KV binding BACKUPS (DECISIONS A12–A14).
//   PUT /api/backup        stores the snapshot as "snap:<ISO time>" and as "latest", keeps the 20 newest
//   GET /api/backup        the latest snapshot, or ?key=snap:… for an older one
//   GET /api/backup/list   every snapshot key with its session count (functions/api/backup/list.ts)
// Every request needs "Authorization: Bearer <BACKUP_TOKEN>".

/** The slice of the Workers KV API used here. */
export interface KV {
  get(key: string, type: 'text'): Promise<string | null>;
  getWithMetadata<M>(key: string, type: 'text'): Promise<{ value: string | null; metadata: M | null }>;
  put(key: string, value: string, options?: { metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list<M>(options?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string; metadata?: M }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env {
  BACKUPS?: KV;
  BACKUP_TOKEN?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
}

export interface SnapMeta {
  at: string;
  sessions: number;
  schemaVersion: number;
  bytes: number;
}

type LatestMeta = SnapMeta & { key: string };

const FORMAT = 'calisthenics-backup';
const KEEP = 20;
const MAX_BYTES = 5_000_000;
const MIN_TOKEN = 16;
const LATEST = 'latest';
const PREFIX = 'snap:';
const KEY_RE = /^snap:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const fail = (status: number, error: string, message: string, more: object = {}, extra: Record<string, string> = {}) =>
  json({ error, message, ...more }, status, extra);

export async function onRequest({ request, env }: Ctx): Promise<Response> {
  const denied = await guard(request, env);
  if (denied) return denied;
  if (request.method === 'GET') return read(request, env.BACKUPS!);
  if (request.method === 'PUT') return write(request, env.BACKUPS!);
  return fail(405, 'method', 'Use GET or PUT.', {}, { Allow: 'GET, PUT' });
}

/** GET /api/backup/list: newest first. */
export async function list({ request, env }: Ctx): Promise<Response> {
  const denied = await guard(request, env);
  if (denied) return denied;
  if (request.method !== 'GET') return fail(405, 'method', 'Use GET.', {}, { Allow: 'GET' });
  const kv = env.BACKUPS!;
  const [snaps, latest] = await Promise.all([keys<SnapMeta>(kv, PREFIX), keys<LatestMeta>(kv, LATEST)]);
  return json({
    latest: latest.find((k) => k.name === LATEST)?.metadata?.key ?? null,
    snapshots: snaps
      .map((k) => ({ key: k.name, at: k.metadata?.at ?? k.name.slice(PREFIX.length), sessions: k.metadata?.sessions ?? null, schemaVersion: k.metadata?.schemaVersion ?? null, bytes: k.metadata?.bytes ?? null }))
      .reverse(),
  });
}

/** Missing setup first (so a half-configured deploy says what is missing), then the token. */
async function guard(request: Request, env: Env): Promise<Response | null> {
  if (!env.BACKUPS) return fail(503, 'setup', 'The KV binding BACKUPS is missing.');
  const want = env.BACKUP_TOKEN ?? '';
  if (want.length < MIN_TOKEN) return fail(503, 'setup', `BACKUP_TOKEN is not set, or shorter than ${MIN_TOKEN} characters.`);
  const got = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('Authorization') ?? '')?.[1] ?? '';
  if (!(await same(got, want))) return fail(401, 'auth', 'Wrong or missing token.', {}, { 'WWW-Authenticate': 'Bearer' });
  return null;
}

/** Constant-time comparison: hash both, then compare every byte. */
async function same(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i]! ^ v[i]!;
  return diff === 0;
}

async function read(request: Request, kv: KV): Promise<Response> {
  const key = new URL(request.url).searchParams.get('key') ?? LATEST;
  if (key !== LATEST && !KEY_RE.test(key)) return fail(400, 'key', 'Unknown snapshot key.');
  const value = await kv.get(key, 'text');
  if (value === null) return fail(404, 'none', key === LATEST ? 'No backup yet.' : 'That snapshot is gone.');
  return new Response(value, { headers: HEADERS });
}

async function write(request: Request, kv: KV): Promise<Response> {
  const tooBig = () => fail(413, 'size', `A snapshot can be at most ${MAX_BYTES / 1e6} MB.`);
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BYTES) return tooBig();
  const text = await request.text();
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_BYTES) return tooBig();

  let snap: { format?: unknown; schemaVersion?: unknown; sessions?: unknown } | null;
  try {
    snap = JSON.parse(text);
  } catch {
    return fail(400, 'format', 'The body is not JSON.');
  }
  if (snap?.format !== FORMAT || !Array.isArray(snap.sessions) || !Number.isInteger(snap.schemaVersion)) {
    return fail(400, 'format', 'The body is not a Calisthenics snapshot.');
  }

  // Never replace "latest" with fewer sessions unless the app asked for it explicitly [A13].
  const sessions = snap.sessions.length;
  const latest = (await kv.getWithMetadata<LatestMeta>(LATEST, 'text')).metadata;
  const confirmed = new URL(request.url).searchParams.get('confirm') === 'fewer';
  if (latest && sessions < latest.sessions && !confirmed) {
    return fail(409, 'fewer', `The latest backup has ${latest.sessions} sessions, this one has ${sessions}.`, {
      cloud: latest.sessions,
      incoming: sessions,
      latest: latest.key,
    });
  }

  const at = new Date().toISOString();
  const key = PREFIX + at;
  const meta: SnapMeta = { at, sessions, schemaVersion: snap.schemaVersion as number, bytes };
  await kv.put(key, text, { metadata: meta });
  await kv.put(LATEST, text, { metadata: { ...meta, key } satisfies LatestMeta });
  await prune(kv, key);
  return json({ key, ...meta }, 201);
}

/** Keeps the KEEP newest snapshots. The new key is added by hand because KV listings can lag behind a write. */
async function prune(kv: KV, added: string): Promise<void> {
  const names = new Set((await keys(kv, PREFIX)).map((k) => k.name));
  names.add(added);
  const old = [...names].sort().slice(0, -KEEP);
  await Promise.all(old.map((k) => kv.delete(k)));
}

/** Every key with this prefix, oldest first (ISO times sort as text). */
async function keys<M>(kv: KV, prefix: string): Promise<{ name: string; metadata?: M }[]> {
  const out: { name: string; metadata?: M }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await kv.list<M>({ prefix, cursor });
    out.push(...page.keys);
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
