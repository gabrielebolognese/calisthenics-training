-- Cloud backup for the Calisthenics app (DEPLOY.md, DECISIONS A12–A14).
-- Paste all of this into Supabase → SQL Editor → Run. On the first run the result is your backup token.
-- Safe to run again: it keeps your backups and your token.

create schema if not exists cali;

-- The cali schema is not exposed by the Data API: only the three public functions below can reach it.
create table if not exists cali.backups (
  key text primary key,
  at timestamptz not null,
  sessions integer not null,
  schema_version integer not null,
  bytes integer not null,
  snapshot json not null -- json, not jsonb: kept exactly as the app sent it
);
create index if not exists backups_at on cali.backups (at desc);

-- Only a SHA-256 of the token is stored.
create table if not exists cali.config (
  id integer primary key default 1 check (id = 1),
  token_hash text not null
);

alter table cali.backups enable row level security;
alter table cali.config enable row level security;
revoke all on schema cali from public, anon, authenticated;
revoke all on all tables in schema cali from public, anon, authenticated;

create or replace function cali.token_ok(p_token text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from cali.config
    where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  );
$$;

/** A new random token (two v4 UUIDs: 244 random bits). Replaces the old one. */
create or replace function cali.new_token() returns text
language plpgsql volatile set search_path = '' as $$
declare
  t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into cali.config (id, token_hash) values (1, encode(sha256(convert_to(t, 'UTF8')), 'hex'))
  on conflict (id) do update set token_hash = excluded.token_hash;
  return t;
end;
$$;

create or replace function cali.iso(t timestamptz) returns text
language sql stable set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

-- Stores a snapshot and keeps the 20 newest. Refuses one with fewer sessions than the latest backup
-- unless p_confirm_fewer is true, and stores nothing when it refuses [A13].
create or replace function public.backup_put(p_token text, p_snapshot json, p_confirm_fewer boolean default false)
returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_at timestamptz := clock_timestamp();
  v_key text;
  v_sessions integer;
  v_version integer;
  v_bytes integer;
  v_latest record;
begin
  if not cali.token_ok(p_token) then
    return json_build_object('error', 'auth', 'message', 'Wrong or missing token.');
  end if;
  if p_snapshot is null
    or json_typeof(p_snapshot) <> 'object'
    or p_snapshot ->> 'format' is distinct from 'calisthenics-backup'
    or json_typeof(p_snapshot -> 'sessions') is distinct from 'array'
    or coalesce(p_snapshot ->> 'schemaVersion', '') !~ '^[0-9]{1,6}$' then
    return json_build_object('error', 'format', 'message', 'This is not a Calisthenics snapshot.');
  end if;
  v_bytes := octet_length(p_snapshot::text);
  if v_bytes > 5000000 then
    return json_build_object('error', 'size', 'message', 'A snapshot can be at most 5 MB.');
  end if;
  v_sessions := json_array_length(p_snapshot -> 'sessions');
  v_version := (p_snapshot ->> 'schemaVersion')::integer;

  select key, sessions into v_latest from cali.backups order by at desc limit 1;
  if found and v_sessions < v_latest.sessions and not coalesce(p_confirm_fewer, false) then
    return json_build_object(
      'error', 'fewer',
      'message', format('The latest backup has %s sessions, this one has %s.', v_latest.sessions, v_sessions),
      'cloud', v_latest.sessions,
      'incoming', v_sessions,
      'latest', v_latest.key
    );
  end if;

  v_key := 'snap:' || to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  insert into cali.backups (key, at, sessions, schema_version, bytes, snapshot)
  values (v_key, v_at, v_sessions, v_version, v_bytes, p_snapshot);
  delete from cali.backups where key not in (select key from cali.backups order by at desc limit 20);

  return json_build_object('key', v_key, 'at', cali.iso(v_at), 'sessions', v_sessions, 'schemaVersion', v_version, 'bytes', v_bytes);
end;
$$;

-- The latest snapshot, or the one with this key: { snapshot } or { error }.
create or replace function public.backup_get(p_token text, p_key text default null)
returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  v json;
begin
  if not cali.token_ok(p_token) then
    return json_build_object('error', 'auth', 'message', 'Wrong or missing token.');
  end if;
  if p_key is null then
    select snapshot into v from cali.backups order by at desc limit 1;
  else
    select snapshot into v from cali.backups where key = p_key;
  end if;
  if v is null then
    return json_build_object('error', 'none', 'message', case when p_key is null then 'No backup yet.' else 'That snapshot is gone.' end);
  end if;
  return json_build_object('snapshot', v);
end;
$$;

-- Every snapshot without its contents, newest first.
create or replace function public.backup_list(p_token text)
returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  if not cali.token_ok(p_token) then
    return json_build_object('error', 'auth', 'message', 'Wrong or missing token.');
  end if;
  return json_build_object(
    'latest', (select key from cali.backups order by at desc limit 1),
    'snapshots', coalesce(
      (select json_agg(json_build_object('key', key, 'at', cali.iso(at), 'sessions', sessions, 'schemaVersion', schema_version, 'bytes', bytes) order by at desc)
       from cali.backups),
      '[]'::json
    )
  );
end;
$$;

revoke all on function cali.token_ok(text), cali.new_token(), cali.iso(timestamptz) from public, anon, authenticated;
revoke all on function public.backup_put(text, json, boolean), public.backup_get(text, text), public.backup_list(text) from public;
grant execute on function public.backup_put(text, json, boolean), public.backup_get(text, text), public.backup_list(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- First run: your new token. Later runs leave it alone.
select case
  when exists (select 1 from cali.config) then 'Already set up: your token is unchanged. For a new one, run: select cali.new_token();'
  else cali.new_token()
end as backup_token;
