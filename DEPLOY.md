# Deploy and cloud backup

## The app

The app lives on GitHub Pages: **https://gabrielebolognese.github.io/calisthenics-training/**. Every push to `main` runs the tests, then builds and deploys the app (`.github/workflows/deploy.yml`). There's nothing to set up.

## Cloud backup: one-time Supabase setup (about 5 minutes)

The backups live in a free Supabase project. Supabase runs a Postgres database for you, and the app reaches it over HTTPS. There are no commands to run and no secrets to type: you paste one SQL file, and it hands you the token.

### 1. Create the project

1. Go to https://supabase.com → **Start your project**, and sign in with GitHub.
2. Click **New project** and fill in:
   - Name: `calisthenics`
   - Database password: click **Generate a password**. You won't need it for the app, but keep it in your password manager.
   - Region: the closest to you, for example Central EU (Frankfurt).
   - Plan: Free.
3. Click **Create new project**, then wait a minute or two until the dashboard says it's ready.

### 2. Run the setup script and copy your token

1. Open `supabase/setup.sql` from this repo. On GitHub: open the file → **Raw** → select all → copy.
2. In Supabase, open **SQL Editor** in the left menu, then **New query**. Paste the script and click **Run**. If Supabase warns that the query has destructive operations, confirm and run it anyway: it only creates the backup tables and functions.
3. The result is one row, `backup_token`, with 64 characters. That's your backup token. Copy it into your password manager now, because it's shown only this once. Supabase stores only a hash of it.

You can run the script again at any time. It keeps your backups and your token, and just says "Already set up".

### 3. Connect the app

In Supabase, go to **Project Settings → API Keys** (sometimes listed under Data API) and copy two values:

- the **Project URL**, like `https://abcdefgh.supabase.co`
- the **publishable key** (`sb_publishable_…`). On older projects it's the **anon public** key instead (a long string starting with `eyJ`).

Both are meant to be public. The database only answers to your backup token, and the app's tables can't be reached with the key alone. Send me the two values, or put them in `src/cloud/config.ts` and push. Either way, the app redeploys with them.

### 4. On the iPhone

Go to **Settings → Cloud backup**, paste the token, and tap **Save token**. The dot turns green and says "Up to date".

## If something's wrong

| The app says | Fix |
|---|---|
| "The app isn't connected to a Supabase project yet." | Step 3 isn't done: `src/cloud/config.ts` is still empty. |
| "The backup functions are missing…" | Run `supabase/setup.sql` (step 2). |
| "Token rejected" | The token on the phone isn't the one from step 2. |
| "Couldn't back up… It retries by itself." after a long break | Supabase pauses free projects after a week without activity. In the Supabase dashboard, open the project and click **Restore project**. Nothing is lost: the phone keeps everything and backs up again once the project is back. |

**Lost the token?** In the SQL Editor, run `select cali.new_token();`. That makes a new token and the old one stops working. Paste the new one on the phone.

## How the backup works

The script creates three functions, all of which check the token first:

| Function | Does |
|---|---|
| `backup_put(p_token, p_snapshot, p_confirm_fewer)` | Stores the snapshot as `snap:<server time>` and keeps the 20 newest. If the latest backup has more sessions, it answers `{ error: 'fewer' }` and stores nothing, unless `p_confirm_fewer` is true. |
| `backup_get(p_token, p_key)` | `{ snapshot }`: the latest, or the one with this key. |
| `backup_list(p_token)` | `{ latest, snapshots: [{ key, at, sessions, schemaVersion, bytes }] }`, newest first. |

The app calls them as `POST <Project URL>/rest/v1/rpc/<function>`. The tables live in a schema called `cali`, which the public API can't see. The tests (`src/cloud/__tests__/backup.test.ts`) run this same `setup.sql` in PGlite, a real Postgres in Node. The rules are in DECISIONS.md, A12–A21.
