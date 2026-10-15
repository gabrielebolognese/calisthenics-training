// Engine entry point: everything Today needs, computed purely from the stored data and a clock.
import { GTG_DAYS, GTG_ROWS, gtgReps } from '../plan/gtg';
import { computeAlerts, type Alert } from './alerts';
import { walk, weekStrip, type WalkResult } from './cycle';
import { localDate, type LocalDate } from './dates';
import { deriveFacts } from './facts';
import { prescribeDay, runBeforeSession, type SessionPrescription } from './prescribe';
import { fold, type FoldResult } from './progression';
import { extractTests, latestTest, type TestPoint } from './results';
import type { SessionOptions, StateMap } from './rules';
import { buildSteps, estimateSeconds, type Step } from './steps';
import type { EngineInput } from './types';

export interface Gtg {
  rows: number;
  /** null: no bar at home, HSPU only (p.12). */
  muReps: number | null;
  hspuReps: number;
}

export interface Today {
  date: LocalDate;
  walk: WalkResult;
  strip: ReturnType<typeof weekStrip>;
  fold: FoldResult;
  /** Line states as of the current day (week rollover applied). */
  states: StateMap;
  facts: ReturnType<typeof deriveFacts>;
  prescription: SessionPrescription;
  steps: Step[];
  estimatedMinutes: number;
  alerts: Alert[];
  tests: TestPoint[];
  gtg: Gtg | null;
}

export function computeToday(input: EngineInput, now: number, options: SessionOptions = {}): Today {
  const date = localDate(now);
  const w = walk(input, date);
  const f = fold(input, w.done, now);
  const states = runBeforeSession(f.states, w.current, input);
  const facts = deriveFacts(states);
  const prescription = prescribeDay(w.current, states, input, options);
  const steps = buildSteps(prescription);
  const tests = extractTests(w.done, input.baselines);

  const gtgDay =
    input.settings.gtg && w.current.weekKind === 'loading' && GTG_DAYS.includes(w.current.pos.day) && w.status === 'due';
  const gtg: Gtg | null = gtgDay
    ? {
        rows: GTG_ROWS,
        muReps: input.settings.homeBar ? gtgReps(latestTest(tests, 'muscleUp')) : null,
        hspuReps: gtgReps(latestTest(tests, 'hspu')),
      }
    : null;

  return {
    date,
    walk: w,
    strip: weekStrip(w),
    fold: f,
    states,
    facts,
    prescription,
    steps,
    estimatedMinutes: Math.round(estimateSeconds(steps) / 60),
    alerts: computeAlerts(input, w, f, facts, date),
    tests,
    gtg,
  };
}

export { posKey } from './cycle';
export { describeTarget } from './describe';
export type * from './types';
