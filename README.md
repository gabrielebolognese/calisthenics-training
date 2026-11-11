# calisthenics-training

A personal, offline-first PWA that runs one specific 24-week calisthenics strength plan on an iPhone. It shows exactly what to do today, times every hold and rest, logs every set, and computes the next session from the logs using the plan's progression rules. It is built for a single user: no accounts, no analytics, and all data lives on the phone in IndexedDB, with an optional copy in a private Supabase backup. It is not a general-purpose fitness app, but the plan is encoded as data, so the code is a worked example of a rule-driven training engine.

**App:** https://gabrielebolognese.github.io/calisthenics-training/ (on iPhone: open in Safari, Share, Add to Home Screen).

## Features

**Plan and cycle engine**
- The plan runs by day numbers 1 to 7 (Push A, Pull A, off, Push B, Pull B, Skill, off), not weekdays, across 3 blocks of 8 weeks. "Today" is the next uncompleted cycle day, with at most one cycle day per calendar date.
- Weeks 8, 16 and 24 are deload and test weeks. An early deload week can be inserted and the cycle resumes where it paused.
- The engine is a set of pure functions that replay the full log on every load, so editing a past set recomputes everything after it. Position, test results and progression state are derived, never stored.
- Per-exercise progression rules (double progression, hold seconds, EMOM rounds, total-reps targets, level switches, load steps), judged per line: a line progresses only when every set was clean and the effort rating was not "Hard".
- Alerts on the Today screen: weekly check-in, "Deload recommended", "Back after a break" (restart at 80% after 14 or more days off), no-transition muscle-up attempts unlocked, test week done, and an end-of-cycle summary with "start next cycle".
- Optional grease-the-groove (GTG) tracking on Day 3 and Day 6.

**Session player**
- A pure reducer over timestamps, saved to IndexedDB on every change, so a reload or an app kill resumes the exact step with the right remaining time.
- Step types for warm-up, holds, reps, EMOM, total reps, max holds, AMRAP tests, practice and yes/no attempts, with automatic countdowns and rests.
- Beeps and spoken voice cues, with two modes for mixing with music ("Duck briefly" and "Mix").
- Keeps the screen on during a session (Wake Lock API, with NoSleep.js as a fallback).
- "Finish early" and "Stop exercise (pain)" options.

**Screens**
- **Today**: the current block, week and day, the session preview with exact numbers, the week strip and banners.
- **Statistics**: time trained, sessions, best streak, total clean reps, total hold time, minutes per plan week, bodyweight by week, and a per-exercise detail view with hand-drawn SVG charts.
- **Logs**: past sessions with editable sets, and test results per goal against the target.
- **Settings**: sound, training equipment and options (smallest plate, flag sides, ab wheel, bands, home pull-up bar, extra archer set, GTG), plan position correction, screen-lock test, cloud backup, data export/import/reset.
- **Onboarding**: week 0 baselines, preloaded from the plan and editable.

**Data and backup**
- IndexedDB through Dexie; persistent storage is requested on first launch.
- Export and import of the full data as a JSON file.
- Optional automatic cloud backup to a Supabase project through three token-checked Postgres functions. The server keeps the 20 newest snapshots and refuses a snapshot with fewer sessions than the latest unless confirmed. Restore from any stored snapshot.

**PWA**
- Everything is precached by the service worker and works offline. A new version installs on its own, but never while a session is running.

## Getting started

### Prerequisites

- Node.js 22 (the version used by the CI workflow) and npm.
- Git.

### Download

```
git clone https://github.com/gabrielebolognese/calisthenics-training.git
cd calisthenics-training
```

### Install

```
npm install
```

### Configuration

There are no environment variables and no `.env` file. The app runs fully without any configuration.

Cloud backup is optional and needs two public values in `src/cloud/config.ts`: `SUPABASE_URL` and `SUPABASE_KEY` (the project URL and the publishable key). Both are empty in the repository, so the app reports that it is not connected to a Supabase project until they are filled in. The one-time Supabase setup, which consists of pasting `supabase/setup.sql` into the Supabase SQL Editor, is described in [DEPLOY.md](DEPLOY.md). The backup token itself is entered in the app under Settings, Cloud backup, and is stored only on the device.

### Run in development

```
npm run dev
```

Vite serves the app under the configured base path, `/calisthenics-training/` (for example `http://localhost:5173/calisthenics-training/`). Add `?dev=1` to the URL for dev mode: timers run 10x faster, dates can be faked and the plan position can be jumped.

## Build and deploy

```
npm run build
```

This type-checks the project and writes the static site, including the service worker and web manifest, to `dist/`. `npm run preview` serves that build locally.

Deployment is automatic: every push to `main` (or a manual run) triggers `.github/workflows/deploy.yml`, which runs `npm ci`, `npm test` and `npm run build`, then publishes `dist/` to GitHub Pages. The Vite `base` in `vite.config.ts` is set to `/calisthenics-training/` to match the Pages URL; change it if you host a fork under a different path.

To install the app on an iPhone, open the deployed URL in Safari, tap Share, then Add to Home Screen. It then launches as a standalone app named "Train".

## Usage

1. On first launch, confirm or edit the week 0 baselines on the onboarding screen.
2. The Today screen shows the current session. Tap start and follow the player: it counts down, times holds and rests, and asks for reps, a clean/not clean mark and an effort rating where the progression rules need them.
3. When the session ends, a summary is saved and the next session is computed from the log.
4. Use Logs to review or correct past sets, and Statistics to follow totals and per-exercise progress.
5. Use Settings (the gear icon) for sound, equipment, plan position, backup and data export/import.

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server. |
| `npm run build` | Type-checks with `tsc --noEmit`, then builds to `dist/`. |
| `npm run preview` | Serves the production build locally. |
| `npm run typecheck` | Runs `tsc --noEmit` only. |
| `npm test` | Runs the Vitest suite once: engine, player state machine and cloud backup tests. |
| `npm run test:watch` | Runs Vitest in watch mode. |

The backup tests run `supabase/setup.sql` in PGlite (Postgres in Node), so no Supabase account is needed to run them.

## Project structure

```
src/plan/      the plan as data: exercises, sessions, progression lines, abs, tests, GTG, warm-up
src/engine/    pure functions: cycle walk, progression, prescriptions, deload, alerts, player steps, stats
src/player/    the session player: state machine, timers, beeps, voice, wake lock
src/db/        IndexedDB schema and repository (Dexie), JSON export/import
src/cloud/     cloud backup client: config, auto backup, retries, restore
src/screens/   Today, Statistics, Logs, Settings, Onboarding, Summary, Backup
src/ui/        shared components: header, tab bar, sheets, tiles, SVG charts
src/app/       shared app context, clock and dev mode
supabase/      setup.sql: the backup tables and functions
public/        PWA icons
.github/       GitHub Pages deploy workflow
```

Main entry points: `computeToday(input, now)` in `src/engine/index.ts` and the player reducer in `src/player/machine.ts`.

## Tech stack

- TypeScript, React 19, Vite 8
- Dexie (IndexedDB) for storage
- vite-plugin-pwa (Workbox) for the service worker and manifest
- NoSleep.js alongside the Wake Lock API
- Plain CSS and hand-drawn SVG charts, no UI or chart library
- Vitest for tests, PGlite to run the backup SQL in tests
- Supabase (Postgres functions over its REST API) for the optional backup
- GitHub Actions and GitHub Pages for deployment

## Further documentation

- [BRIEF.md](BRIEF.md): the original brief, describing what the app must do.
- [PLAN_SPEC.md](PLAN_SPEC.md): the training plan, extracted into the structure the code follows.
- [DECISIONS.md](DECISIONS.md): every gap the plan or brief left open and what was chosen, including the later redesign and cloud backup decisions.
- [DEPLOY.md](DEPLOY.md): deployment, the one-time Supabase setup and how the backup works.
- [IPHONE_CHECKLIST.md](IPHONE_CHECKLIST.md): manual tests to run on the phone.

## Status

A personal tool, feature-complete for its purpose (version 0.1.0): spec, plan data, engine, session player, screens, PWA, deploy and cloud backup are all built. The remaining items are the on-device checks in `IPHONE_CHECKLIST.md` and connecting a Supabase project in `src/cloud/config.ts` for cloud backup. The training content is one person's plan; the source PDF is intentionally not in the repository, and `PLAN_SPEC.md` is its in-repo extraction.
