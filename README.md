# calisthenics-training

A personal PWA that runs one calisthenics plan on an iPhone: it shows exactly what to do today, times every hold and rest, logs every set, and computes the next session from the logs. One user, no accounts, no backend, works offline.

**App:** https://gabrielebolognese.github.io/calisthenics-training/ (open in Safari → Share → Add to Home Screen)

- `BRIEF.md`: what the app must do.
- `PLAN_SPEC.md`: the training plan, extracted into a structure the code follows.
- `DECISIONS.md`: every gap the plan left open, and what was chosen.
- `IPHONE_CHECKLIST.md`: manual tests to run on the phone.

## Code

```
src/plan/     the plan as data: exercises, sessions, progression lines, abs, tests, GTG
src/engine/   pure functions: cycle walk, progression fold, prescriptions, deload, alerts, player steps
src/player/   the session player: state machine, timers, beeps, voice, wake lock
src/db/       IndexedDB (Dexie), export/import
src/screens/  Today, Progress, Log, Settings, Onboarding
```

The engine replays the full log every time, so editing a past set recomputes everything after it. Entry point: `computeToday(input, now)` in `src/engine/index.ts`. The player is a pure reducer over timestamps (`src/player/machine.ts`), saved to IndexedDB on every change, so a reload resumes the exact step.

## Run

```
npm install
npm test          # engine and player tests (Vitest)
npm run typecheck
npm run dev       # http://localhost:5173/calisthenics-training/  (add ?dev=1 for 10x timers and fake dates)
npm run build
```

Every push to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Status

1. Spec and decisions: done
2. Plan data, engine, tests: done
3. Session player: done
4. Today, Log, Progress, Settings screens: done
5. PWA and deploy: done; on-device checks in `IPHONE_CHECKLIST.md`
