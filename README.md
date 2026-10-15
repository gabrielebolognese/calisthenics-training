# calisthenics-training

A personal PWA that runs one calisthenics plan on an iPhone: it shows exactly what to do today, times every hold and rest, logs every set, and computes the next session from the logs. One user, no accounts, no backend, works offline.

- `BRIEF.md`: what the app must do.
- `PLAN_SPEC.md`: the training plan, extracted into a structure the code follows.
- `DECISIONS.md`: every gap the plan left open, and what was chosen.

## Code

```
src/plan/     the plan as data: exercises, sessions, progression lines, abs, tests, GTG
src/engine/   pure functions: cycle walk, progression fold, prescriptions, deload, alerts, player steps
```

The engine replays the full log every time, so editing a past set recomputes everything after it. Entry point: `computeToday(input, now)` in `src/engine/index.ts`.

## Run

```
npm install
npm test          # engine unit tests (Vitest)
npm run typecheck
npm run dev
```

## Status

1. Spec and decisions: done
2. Plan data, engine, tests: done
3. Session player: next
4. Today, Log, Progress, Settings screens
5. PWA and deploy (GitHub Pages)
