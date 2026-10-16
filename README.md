# calisthenics-training

A personal PWA that runs one calisthenics plan on an iPhone: it shows exactly what to do today, times every hold and rest, logs every set, and computes the next session from the logs. One user, no accounts, works offline. The data lives on the phone (IndexedDB), with an automatic copy in a private cloud backup.

**App:** https://calisthenics-training.pages.dev (Cloudflare Pages; open it in Safari → Share → Add to Home Screen). If Cloudflare gave the project another address, that one. Setup: `DEPLOY.md`.

- `BRIEF.md`: what the app must do.
- `PLAN_SPEC.md`: the training plan, extracted into a structure the code follows.
- `DECISIONS.md`: every gap the plan left open, and what was chosen.
- `IPHONE_CHECKLIST.md`: manual tests to run on the phone.
- `DEPLOY.md`: Cloudflare setup, moving from GitHub Pages, the backup API.

## Code

```
src/plan/     the plan as data: exercises, sessions, progression lines, abs, tests, GTG
src/engine/   pure functions: cycle walk, progression fold, prescriptions, deload, alerts, player steps, stats
src/player/   the session player: state machine, timers, beeps, voice, wake lock
src/db/       IndexedDB (Dexie), snapshots: export/import
src/cloud/    cloud backup client: auto backup, retries, restore
src/screens/  Today, Statistics, Logs, Settings (behind the gear), Onboarding, Backup
functions/    the Cloudflare Pages Function behind /api/backup (KV binding BACKUPS)
```

The engine replays the full log every time, so editing a past set recomputes everything after it. Entry point: `computeToday(input, now)` in `src/engine/index.ts`. The player is a pure reducer over timestamps (`src/player/machine.ts`), saved to IndexedDB on every change, so a reload resumes the exact step.

## Run

```
npm install
npm test          # engine, player and backup tests (Vitest)
npm run typecheck
npm run dev       # http://localhost:5173/  (add ?dev=1 for 10x timers and fake dates)
npm run build
```

Every push to `main` runs the tests and deploys to Cloudflare Pages. To run the backup API locally, see `DEPLOY.md`.

## Status

1. Spec and decisions: done
2. Plan data, engine, tests: done
3. Session player: done
4. Today, Log, Progress, Settings screens: done (redesigned on 2026-10-15 as Today, Statistics, Logs; see DECISIONS A06–A11)
5. PWA and deploy: done; on-device checks in `IPHONE_CHECKLIST.md`
6. Cloud backup and the move to Cloudflare Pages: built on 2026-10-16 (DECISIONS A12–A21); needs the one-time Cloudflare setup in `DEPLOY.md`
