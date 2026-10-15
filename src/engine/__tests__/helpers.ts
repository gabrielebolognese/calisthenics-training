import { WEEK0 } from '../../plan/targets';
import { addDays, type LocalDate } from '../dates';
import { computeToday, type Today } from '../index';
import type { SessionOptions } from '../rules';
import type {
  Baselines,
  Effort,
  EngineInput,
  LinePrescription,
  LineResult,
  SessionLog,
  Settings,
  SetResult,
  TimelineDay,
} from '../types';

/** A Monday. */
export const START: LocalDate = '2026-10-19';

export function noon(d: LocalDate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day, 12).getTime();
}

export const DEFAULT_SETTINGS: Settings = {
  plateIncrement: 5,
  flagSides: 'one',
  abWheel: false,
  bands: true,
  homeBar: true,
  gtg: false,
  archerAssistedSet: false,
};

export function makeInput(o: { settings?: Partial<Settings>; baselines?: Partial<Baselines> } = {}): EngineInput {
  return {
    baselines: { startDate: START, ...WEEK0, ...o.baselines },
    settings: { ...DEFAULT_SETTINGS, ...o.settings },
    sessions: [],
    checkins: [],
    events: [],
  };
}

export interface PerfectOpts {
  effort?: Effort;
  /** Max hold seconds per exercise (default: handstand 55, others 5). */
  maxSeconds?: number;
  amrapReps?: number;
}

/** A result that meets the prescription exactly, every set clean. */
export function perfect(p: LinePrescription, o: PerfectOpts = {}): LineResult {
  const sets: SetResult[] = [];
  switch (p.kind) {
    case 'reps':
      p.reps!.forEach((reps, i) => sets.push({ set: i, reps, load: p.load, clean: true }));
      break;
    case 'hold':
      p.seconds!.forEach((seconds, i) => {
        if (p.bilateral) {
          sets.push({ set: i, side: 'L', seconds, clean: true }, { set: i, side: 'R', seconds, clean: true });
        } else sets.push({ set: i, side: p.side, seconds, clean: true });
      });
      break;
    case 'emom':
      for (let i = 0; i < p.emom!.rounds; i++) sets.push({ set: i, reps: p.emom!.reps, clean: true });
      break;
    case 'total': {
      let left = p.total!.target;
      for (let i = 0; left > 0; i++) {
        const reps = Math.min(6, left);
        sets.push({ set: i, reps, clean: true });
        left -= reps;
      }
      break;
    }
    case 'practice':
      sets.push({ set: 0, seconds: p.practiceMinutes! * 60, clean: true });
      break;
    case 'maxHold':
      sets.push({ set: 0, seconds: o.maxSeconds ?? (p.exercise === 'handstand' ? 55 : 5), clean: true });
      break;
    case 'amrap':
      sets.push({ set: 0, reps: o.amrapReps ?? 5, clean: true });
      break;
    case 'attempts':
      return { line: p.line, status: 'complete', sets: [], attempts: Array.from({ length: p.attempts! }, () => false) };
  }
  return {
    line: p.line,
    status: 'complete',
    sets,
    effort: p.askEffort ? (o.effort ?? 'right') : undefined,
    barHeight: p.askBarHeight ? 'chest' : undefined,
    endedBy: p.askEndedBy ? 'balance' : undefined,
  };
}

/** The first set falls one rep (or one second) short and is not clean. */
export function failed(p: LinePrescription): LineResult {
  const r = perfect(p);
  if (r.sets[0]) {
    const s = r.sets[0];
    r.sets[0] = { ...s, clean: false, reps: s.reps !== undefined ? s.reps - 1 : undefined, seconds: s.seconds !== undefined ? s.seconds - 1 : undefined };
  }
  return r;
}

export type Policy = (p: LinePrescription, day: TimelineDay, date: LocalDate) => LineResult | 'perfect' | 'skip';

export const allPerfect: Policy = () => 'perfect';

/** Trains today's session if one is due, using the policy for each line. */
export function trainOn(
  input: EngineInput,
  date: LocalDate,
  policy: Policy = allPerfect,
  options: SessionOptions = {},
  perfectOpts: PerfectOpts = {},
): SessionLog | null {
  const t = computeToday(input, noon(date), options);
  if (t.walk.status !== 'due' || t.walk.current.kind === 'off') return null;
  const lines = t.prescription.lines.map((p): LineResult => {
    const r = policy(p, t.walk.current, date);
    if (r === 'perfect') return perfect(p, perfectOpts);
    if (r === 'skip') return { line: p.line, status: 'skipped', sets: [] };
    return r;
  });
  if (options.plancheLight) {
    const pl = lines.find((l) => l.line === 'plancheLight');
    if (pl) pl.variant = options.plancheLight;
  }
  const s: SessionLog = {
    id: `s${input.sessions.length + 1}`,
    key: t.walk.current.key,
    date,
    startedAt: noon(date),
    finishedAt: noon(date) + 3_600_000,
    lines,
  };
  input.sessions.push(s);
  return s;
}

/** Runs n calendar days from `from`, training whenever a session is due. Returns the next date. */
export function runDays(input: EngineInput, from: LocalDate, n: number, policy: Policy = allPerfect, perfectOpts: PerfectOpts = {}): LocalDate {
  for (let i = 0; i < n; i++) trainOn(input, addDays(from, i), policy, {}, perfectOpts);
  return addDays(from, n);
}

export function todayAt(input: EngineInput, date: LocalDate, options: SessionOptions = {}): Today {
  return computeToday(input, noon(date), options);
}

export function line(t: Today, id: LinePrescription['line']): LinePrescription | undefined {
  return t.prescription.lines.find((l) => l.line === id);
}

/** Trains every due day for n weeks, recording each training day's Today under "week-day". */
export function simulate(
  input: EngineInput,
  weeks: number,
  policy: Policy = allPerfect,
  perfectOpts: PerfectOpts = {},
  from: LocalDate = START,
): { days: Map<string, Today>; end: LocalDate } {
  const days = new Map<string, Today>();
  let date = from;
  for (let i = 0; i < weeks * 7; i++) {
    const t = todayAt(input, date);
    const c = t.walk.current;
    if (t.walk.status === 'due' && c.kind !== 'off') days.set(`${c.pos.inserted ? `x${c.pos.inserted}` : c.pos.week}-${c.pos.day}`, t);
    trainOn(input, date, policy, {}, perfectOpts);
    date = addDays(date, 1);
  }
  return { days, end: date };
}

/** The prescription a given line would get on the next day of the given number. */
export function nextDay(input: EngineInput, from: LocalDate, day: number, policy: Policy = allPerfect): { t: Today; date: LocalDate } {
  for (let i = 0; i < 60; i++) {
    const date = addDays(from, i);
    const t = todayAt(input, date);
    if (t.walk.status === 'due' && t.walk.current.pos.day === day) return { t, date };
    trainOn(input, date, policy);
  }
  throw new Error(`Day ${day} not reached`);
}
