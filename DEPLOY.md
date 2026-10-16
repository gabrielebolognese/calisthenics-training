# Deploy

The app runs on **Cloudflare Pages**. Cloudflare serves the static app and runs one Pages Function, `functions/api/backup.ts`, which stores backups in a KV namespace. Once this is set up, every push to `main` builds, tests and deploys on its own. The free plan is enough.

The setup below is done once, in the Cloudflare dashboard, and takes about 10 minutes. Dashboard labels move around now and then, so if a name below doesn't match exactly, look for the closest one.

## 1. Make a backup token

The token is the only key to your backups: anyone who has it can read them and write over them. Make a long random one. In PowerShell:

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString('x2') })
```

That prints 64 characters. Save them in your password manager (for example the Passwords app, as "Calisthenics backup"), because you'll paste the token into the app. The server refuses tokens shorter than 16 characters.

## 2. Create the Pages project

1. Log in at https://dash.cloudflare.com, or make a free account first.
2. **Workers & Pages → Create → Pages → Import an existing Git repository**. Connect GitHub, allow Cloudflare access to `gabrielebolognese/calisthenics-training`, and pick it.
3. Fill in the build settings:
   - Project name: `calisthenics-training`. The app will live at `https://calisthenics-training.pages.dev`. If the name is taken, Cloudflare adds a suffix; use whatever address it shows.
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `npm test && npm run build`. A failing test stops the deploy, as it did on GitHub.
   - Build output directory: `dist`
   - Root directory: leave it empty.
4. **Save and Deploy**. The app works after this first deploy, but its Cloud backup says "Server not set up" until you finish steps 3–5.

Node 22 comes from `.node-version`, and Cloudflare finds the `functions/` folder on its own.

## 3. Create the KV namespace and bind it

1. **Storage & databases → KV → Create**. Name it `calisthenics-backups`.
2. **Workers & Pages → calisthenics-training → Settings → Bindings → Add → KV namespace**.
   - Variable name: `BACKUPS`. It must be exactly this.
   - KV namespace: `calisthenics-backups`
   - Save it for the **Production** environment.

## 4. Add the token as a secret

In **Settings → Variables and Secrets → Add**, choose type **Secret**, name it `BACKUP_TOKEN`, and paste the token from step 1 as the value. Save.

## 5. Redeploy

Bindings and secrets only reach new deployments. Go to **Deployments**, open the menu (⋯) on the latest one, and choose **Retry deployment**.

## 6. Check it

Open the address in Safari, then **Settings (gear) → Cloud backup**. Paste the token and tap **Save token**. The dot turns green and says "Up to date".

If it says:

- "Server not set up: The KV binding BACKUPS is missing." → step 3, then step 5.
- "Server not set up: BACKUP_TOKEN is not set…" → step 4, then step 5.
- "Token rejected" → the token in the app and the secret on Cloudflare don't match.

## Moving your data from GitHub Pages

Each web address has its own storage on the iPhone, so what's in the old app (github.io) doesn't show up at the new address by itself. Move it once:

1. Open the **old** app from its home screen icon. Close it fully and open it again, so it updates to the last GitHub build. That build has the new export.
2. In the old app, go to **Settings → Export backup file**. In the share sheet, tap **Save to Files** and choose iCloud Drive.
3. In Safari, open the new address, then **Share → Add to Home Screen**.
4. Open the new app. On the first screen, tap **Import a backup file instead** and pick the file from iCloud Drive. Today and Logs show your data again.
5. **Settings → Cloud backup**: paste the token and tap **Save token**. The first backup goes up right away.
6. Once the new app shows everything, delete the old icon. Then go to the GitHub repo's **Settings → Pages** and unpublish the old site.

## Local development

```
npm run build
npx wrangler pages dev dist --kv BACKUPS     # the app and the backup API on http://127.0.0.1:8788, with a local KV
npm run dev                                   # optional: Vite on http://localhost:5173, sends /api to the server above
```

`wrangler pages dev` reads the token from a git-ignored `.dev.vars` file in the project folder, containing one line: `BACKUP_TOKEN=any-local-token-at-least-16-chars`. Wrangler isn't a project dependency; `npx` fetches it when you run it (tested with 4.147.0).

## The backup API

Every request needs `Authorization: Bearer <BACKUP_TOKEN>`.

| Request | Answer |
|---|---|
| `PUT /api/backup` with a snapshot as the body | Stores it as `snap:<ISO time>`, copies it to `latest`, and deletes all but the 20 newest snapshots. If `latest` has more sessions, it answers `409` and stores nothing; `?confirm=fewer` overrides that. |
| `GET /api/backup` | The `latest` snapshot. `?key=snap:…` returns an older one. |
| `GET /api/backup/list` | `{ latest, snapshots: [{ key, at, sessions, schemaVersion, bytes }] }`, newest first. |

Each snapshot's session count is stored as KV metadata, so the list never reads the snapshots themselves. The rules are in DECISIONS.md, A12–A21.

Each backup costs Cloudflare 1 read, 2 writes, 1 list and at most 1 delete. The free plan allows 1,000 writes a day.
