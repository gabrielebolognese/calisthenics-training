// Statistics: streak, time trained and lifetime totals per exercise [A06–A09].
// Pure, like the rest of the engine: everything is recomputed from the logs.
import { EXERCISES } from '../plan/exercises';
import { LINES } from '../plan/progression';
import type { ExerciseId, LineId } from '../plan/types';
import { addDays, type LocalDate } from './dates';
import type { Today } from './index';
import { makeCtx } from './prescribe';
import type { EngineInput, LineResult, SessionLog } from './types';

/** Longest session counted; anything longer was left open in the background [A07]. */
export const MAX_SESSION_MS = 3 * 3_600_000;

export function sessionMs(s: SessionLog): number {
  return Math.min(MAX_SESSION_MS, Math.max(0, s.finishedAt - s.startedAt));
}

// ---------- Streak ----------

export interface Streak {
  /** Plan days kept in a row, ending today or yesterday. */
  current: number;
  best: number;
  /** Today already counts: its session is done, or it is a rest day. */
  today: boolean;
}

/**
 * A day is kept when the plan's day for that date was done: the session, or the rest day.
 * A training day not done on its date breaks the streak [A06].
 */
export function streak(t: Pick<Today, 'walk' | 'date'>): Streak {
  const w = t.walk;
  const kept = new Set(w.done.map((d) => d.date!));
  if (w.status === 'due' && w.current.kind === 'off') kept.add(t.date);

  const today = kept.has(t.date);
  let current = 0;
  for (let d = today ? t.date : addDays(t.date, -1); kept.has(d); d = addDays(d, -1)) current++;

  let best = 0;
  let run = 0;
  let prev: LocalDate | null = null;
  for (const d of [...kept].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), today };
}

// ---------- Exercise totals ----------

export type TotalUnit = 'reps' | 'seconds' | 'attempts';

export interface ExercisePoint {
  sessionId: string;
  date: LocalDate;
  /** This session's amount. */
  value: number;
  cumulative: number;
}

export interface ExerciseTotal {
  key: string;
  exercise: ExerciseId;
  name: string;
  unit: TotalUnit;
  /** Clean reps (both sides), seconds held, or clean attempts. */
  total: number;
  /** Attempts made (attempt lines only). */
  attempts: number;
  sessions: number;
  /** Best single set: reps (per side where the plan counts per side) or seconds. */
  best: number;
  bestPerSide: boolean;
  /** Heaviest added load in a clean set, kg. 0 when never loaded. */
  maxLoad: number;
  last: LocalDate;
  points: ExercisePoint[];
}

interface LineInfo {
  exercise: ExerciseId;
  perSide: boolean;
}

function unitOf(exercise: ExerciseId): TotalUnit {
  const type = EXERCISES[exercise].type;
  if (type === 'attempts') return 'attempts';
  if (type === 'hold' || type === 'perLegHold' || type === 'practice') return 'seconds';
  return 'reps';
}

/** One line's contribution: amount, best set, heaviest clean load [A08]. */
function measure(r: LineResult, unit: TotalUnit, perSide: boolean): { value: number; best: number; load: number; attempts: number } {
  if (unit === 'attempts') {
    const a = r.attempts ?? [];
    return { value: a.filter(Boolean).length, best: 0, load: 0, attempts: a.length };
  }
  let value = 0;
  let best = 0;
  let load = 0;
  for (const s of r.sets) {
    if (unit === 'seconds') {
      // A hold cut short still happened: count the seconds actually held.
      value += s.seconds ?? 0;
      if (s.clean) best = Math.max(best, s.seconds ?? 0);
    } else if (s.clean) {
      // Partial or assisted reps are "logged, not counted" (PDF p.2).
      const reps = s.reps ?? 0;
      value += perSide && !s.side ? reps * 2 : reps;
      best = Math.max(best, reps);
      if (reps > 0) load = Math.max(load, s.load ?? 0);
    }
  }
  return { value, best, load, attempts: 0 };
}

export function exerciseTotals(sessions: SessionLog[], infoOf: (s: SessionLog, line: LineId) => LineInfo | null): ExerciseTotal[] {
  const totals = new Map<string, ExerciseTotal>();
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);

  for (const s of ordered) {
    const perSession = new Map<string, number>();
    for (const r of s.lines) {
      if (!r.sets.length && !r.attempts?.length) continue;
      const info = infoOf(s, r.line);
      if (!info) continue;
      // Bent-arm archers are their own thing, never mixed into the clean archer count [D17].
      const key = r.line === 'archerAssisted' ? 'archerAssisted' : info.exercise;
      const unit = unitOf(info.exercise);
      const m = measure(r, unit, info.perSide);
      const t =
        totals.get(key) ??
        ({
          key,
          exercise: info.exercise,
          name: key === 'archerAssisted' ? 'Archer HSPU, bent arm (assisted)' : EXERCISES[info.exercise].name,
          unit,
          total: 0,
          attempts: 0,
          sessions: 0,
          best: 0,
          bestPerSide: false,
          maxLoad: 0,
          last: s.date,
          points: [],
        } satisfies ExerciseTotal);
      t.total += m.value;
      t.attempts += m.attempts;
      t.best = Math.max(t.best, m.best);
      t.bestPerSide ||= info.perSide || r.sets.some((x) => x.side !== undefined && unit === 'reps');
      t.maxLoad = Math.max(t.maxLoad, m.load);
      t.last = s.date;
      totals.set(key, t);
      perSession.set(key, (perSession.get(key) ?? 0) + m.value);
    }
    for (const [key, value] of perSession) {
      const t = totals.get(key)!;
      t.sessions++;
      t.points.push({ sessionId: s.id, date: s.date, value, cumulative: t.total });
    }
  }
  return [...totals.values()];
}

// ---------- Time ----------

export interface WeekTime {
  weekSeq: number;
  label: string;
  ms: number;
  current: boolean;
}

export interface Stats {
  streak: Streak;
  totalMs: number;
  sessions: number;
  totalReps: number;
  totalHoldSeconds: number;
  weeks: WeekTime[];
  exercises: ExerciseTotal[];
}

export function computeStats(input: EngineInput, t: Today): Stats {
  const w = t.walk;
  const lineCtx = makeCtx(w.current, t.states, input);
  const infoOf = (s: SessionLog, line: LineId): LineInfo | null => {
    // The session's own prescription knows the variation done that day (dragon flag negatives vs full).
    const p = t.fold.prescriptions[s.id]?.lines.find((l) => l.line === line);
    const target = p ?? LINES[line]?.target(t.states[line], lineCtx);
    return target ? { exercise: target.exercise, perSide: !!target.perSide } : null;
  };
  const exercises = exerciseTotals(input.sessions, infoOf);

  // Plan weeks, so the chart reads like the rest of the app ("Week 3").
  const labels = new Map<number, string>();
  for (const d of [...w.done, w.current]) labels.set(d.weekSeq, d.pos.inserted ? 'DL' : `W${d.pos.week}`);
  const weekOf = (s: SessionLog) =>
    w.done.find((d) => d.session?.id === s.id)?.weekSeq ??
    w.done.filter((d) => d.date! <= s.date).at(-1)?.weekSeq ??
    w.current.weekSeq;
  const byWeek = new Map<number, number>();
  for (const s of input.sessions) byWeek.set(weekOf(s), (byWeek.get(weekOf(s)) ?? 0) + sessionMs(s));
  const weeks = [...labels.keys()]
    .sort((a, b) => a - b)
    .map((seq) => ({ weekSeq: seq, label: labels.get(seq)!, ms: byWeek.get(seq) ?? 0, current: seq === w.current.weekSeq }));

  return {
    streak: streak(t),
    totalMs: input.sessions.reduce((sum, s) => sum + sessionMs(s), 0),
    sessions: input.sessions.length,
    totalReps: exercises.filter((e) => e.unit === 'reps' && e.key !== 'archerAssisted').reduce((sum, e) => sum + e.total, 0),
    totalHoldSeconds: exercises.filter((e) => e.unit === 'seconds' && e.exercise !== 'handstandPractice').reduce((sum, e) => sum + e.total, 0),
    weeks,
    exercises,
  };
}

/** What one session added up to, for the summary screen. */
export function sessionStats(stats: Stats, s: SessionLog): { ms: number; reps: number; seconds: number } {
  let reps = 0;
  let seconds = 0;
  for (const e of stats.exercises) {
    const p = e.points.find((x) => x.sessionId === s.id);
    if (!p || e.key === 'archerAssisted' || e.exercise === 'handstandPractice') continue;
    if (e.unit === 'reps') reps += p.value;
    if (e.unit === 'seconds') seconds += p.value;
  }
  return { ms: sessionMs(s), reps, seconds };
}
