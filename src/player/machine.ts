// The session player as a pure state machine (brief §7, §8). Every timer is a timestamp, so the
// state can be saved after each change and resumed after a reload with the right remaining time.
import type { LocalDate } from '../engine/dates';
import type { SessionPrescription } from '../engine/prescribe';
import type { SessionOptions } from '../engine/rules';
import type { Step, WorkStep } from '../engine/steps';
import type { BarHeight, Effort, EndedBy, LineResult, SessionLog, SetResult } from '../engine/types';

/** "Get in position" countdowns. */
export const READY_HOLD = 5;
export const READY_STOPWATCH = 3;
export const READY_EMOM = 5;
export const ADD_REST = 15;
/** An expiry older than this happened while the app was away: the next phase starts now, not back then. */
const LATE_MS = 2000;

export type Question = 'barHeight' | 'endedBy' | 'effort';

export type Phase =
  | { k: 'warmup'; item: number; endsAt: number }
  | { k: 'rest'; endsAt: number }
  | { k: 'ready'; endsAt: number }
  | { k: 'hold'; startedAt: number; endsAt: number }
  | { k: 'reps' }
  | { k: 'adjust'; reps: number; clean: boolean }
  | { k: 'emom'; startedAt: number; missed: number[] }
  | { k: 'total'; sets: SetResult[]; value: number }
  | { k: 'totalRest'; sets: SetResult[]; value: number; endsAt: number }
  | { k: 'stopwatch'; startedAt: number }
  | { k: 'count'; value: number }
  | { k: 'practice'; startedAt: number; endsAt: number }
  | { k: 'attempt'; i: number; results: boolean[] }
  | { k: 'attemptRest'; i: number; results: boolean[]; endsAt: number }
  | { k: 'ask'; queue: Question[] }
  | { k: 'done' };

export interface LiveSession {
  id: string;
  key: string;
  date: LocalDate;
  startedAt: number;
  prescription: SessionPrescription;
  steps: Step[];
  /** Index of the last work step of each line. */
  lastOfLine: number[];
  index: number;
  phase: Phase;
  results: LineResult[];
  /** Dev mode runs timers faster; logged seconds stay real. */
  speed: number;
  options: SessionOptions;
  finished: boolean;
  finishedEarly: boolean;
}

export type Action =
  | { type: 'tick' }
  | { type: 'skip' }
  | { type: 'skipWarmup' }
  | { type: 'addRest' }
  | { type: 'done' }
  | { type: 'less' }
  | { type: 'adjust'; reps?: number; clean?: boolean }
  | { type: 'back' }
  | { type: 'confirm' }
  | { type: 'stop' }
  | { type: 'missed' }
  | { type: 'partial' }
  | { type: 'count'; value: number }
  | { type: 'answer'; q: 'effort'; value: Effort }
  | { type: 'answer'; q: 'barHeight'; value: BarHeight }
  | { type: 'answer'; q: 'endedBy'; value: EndedBy }
  | { type: 'attempt'; ok: boolean }
  | { type: 'endLine' }
  | { type: 'pain' }
  | { type: 'finishEarly' };

const isWork = (s: Step): s is WorkStep => s.kind !== 'rest' && s.kind !== 'warmup';
const ms = (s: LiveSession, seconds: number) => (seconds * 1000) / s.speed;
const realSeconds = (s: LiveSession, elapsedMs: number) => Math.max(0, Math.floor((elapsedMs * s.speed) / 1000));

export function startSession(a: {
  id: string;
  key: string;
  date: LocalDate;
  prescription: SessionPrescription;
  steps: Step[];
  now: number;
  speed?: number;
  options?: SessionOptions;
}): LiveSession {
  const lastOfLine: number[] = [];
  a.steps.forEach((st, i) => {
    if (isWork(st)) lastOfLine[st.lineIndex] = i;
  });
  const s: LiveSession = {
    id: a.id,
    key: a.key,
    date: a.date,
    startedAt: a.now,
    prescription: a.prescription,
    steps: a.steps,
    lastOfLine,
    index: 0,
    phase: { k: 'done' },
    results: a.prescription.lines.map((l) => ({ line: l.line, status: 'skipped', sets: [] })),
    speed: a.speed ?? 1,
    options: a.options ?? {},
    finished: false,
    finishedEarly: false,
  };
  return enter(s, 0, a.now);
}

export const currentStep = (s: LiveSession): Step | undefined => s.steps[s.index];

function enter(s: LiveSession, i: number, t0: number): LiveSession {
  if (i >= s.steps.length) return { ...s, index: s.steps.length, phase: { k: 'done' }, finished: true };
  const st = s.steps[i]!;
  const at = (phase: Phase): LiveSession => ({ ...s, index: i, phase });
  switch (st.kind) {
    case 'warmup':
      return at({ k: 'warmup', item: 0, endsAt: t0 + ms(s, st.items[0]!.seconds) });
    case 'rest':
      return at({ k: 'rest', endsAt: t0 + ms(s, st.seconds) });
    case 'hold':
      return at({ k: 'ready', endsAt: t0 + ms(s, READY_HOLD) });
    case 'maxHold':
      return at({ k: 'ready', endsAt: t0 + ms(s, READY_STOPWATCH) });
    case 'emom':
      return at({ k: 'ready', endsAt: t0 + ms(s, READY_EMOM) });
    case 'reps':
      return at({ k: 'reps' });
    case 'totalReps':
      return at({ k: 'total', sets: [], value: Math.max(1, Math.round(st.total / (st.lastSetsUsed ?? 8))) });
    case 'amrap':
      return at({ k: 'count', value: 0 });
    case 'practice':
      return at({ k: 'practice', startedAt: t0, endsAt: t0 + ms(s, st.minutes * 60) });
    case 'attempts':
      return at({ k: 'attempt', i: 0, results: [] });
  }
}

function withLine(s: LiveSession, li: number, f: (r: LineResult) => LineResult): LiveSession {
  const results = [...s.results];
  results[li] = f(results[li]!);
  return { ...s, results };
}

/** Logs a set. A line with any set is "in progress" (stoppedEarly) until it completes. */
function record(s: LiveSession, li: number, set: SetResult): LiveSession {
  return withLine(s, li, (r) => ({ ...r, status: r.status === 'skipped' ? 'stoppedEarly' : r.status, sets: [...r.sets, set] }));
}

/** Marks the line complete and moves past its last step. */
function completeLine(s: LiveSession, li: number, t0: number): LiveSession {
  const next = withLine(s, li, (r) => (r.status === 'pain' ? r : { ...r, status: 'complete' }));
  return enter(next, s.lastOfLine[li]! + 1, t0);
}

function questionsFor(st: WorkStep): Question[] {
  const q: Question[] = [];
  if (st.kind === 'reps' && st.askBarHeight) q.push('barHeight');
  if (st.kind === 'maxHold' && st.askEndedBy) q.push('endedBy');
  if ((st.kind === 'reps' || st.kind === 'emom' || st.kind === 'totalReps') && st.askEffort) q.push('effort');
  return q;
}

/** After a work step ends normally: ask the line's questions on its last step, otherwise move on. */
function finishWork(s: LiveSession, t0: number): LiveSession {
  const st = s.steps[s.index] as WorkStep;
  if (s.lastOfLine[st.lineIndex] !== s.index) return enter(s, s.index + 1, t0);
  const queue = questionsFor(st);
  if (queue.length) return { ...s, phase: { k: 'ask', queue } };
  return completeLine(s, st.lineIndex, t0);
}

/** The line the current step belongs to (for rests: the line being rested between, or the next one). */
export function currentLine(s: LiveSession): number | undefined {
  const st = s.steps[s.index];
  if (!st) return undefined;
  if (isWork(st)) return st.lineIndex;
  if (st.kind === 'rest' && st.reason !== 'exercise') {
    for (let i = s.index - 1; i >= 0; i--) {
      const p = s.steps[i]!;
      if (isWork(p)) return p.lineIndex;
    }
  }
  for (let i = s.index + 1; i < s.steps.length; i++) {
    const n = s.steps[i]!;
    if (isWork(n)) return n.lineIndex;
  }
  return undefined;
}

function emomResults(st: Extract<WorkStep, { kind: 'emom' }>, upTo: number, missed: number[]): SetResult[] {
  return Array.from({ length: upTo }, (_, i) =>
    missed.includes(i) ? { set: i, reps: 0, clean: false } : { set: i, reps: st.reps, clean: true },
  );
}

/** Advances timers that have run out. Loops so a resume after a long absence catches up. */
export function tick(s0: LiveSession, now: number): LiveSession {
  let s = s0;
  for (let guard = 0; guard < 1000 && !s.finished; guard++) {
    const next = tickOnce(s, now);
    if (next === s) return s;
    s = next;
  }
  return s;
}

function tickOnce(s: LiveSession, now: number): LiveSession {
  const p = s.phase;
  const st = s.steps[s.index];
  if (!st) return s;
  const due = (endsAt: number) => now >= endsAt;
  const t0 = (endsAt: number) => (now - endsAt < LATE_MS ? endsAt : now);

  switch (p.k) {
    case 'warmup': {
      if (!due(p.endsAt) || st.kind !== 'warmup') return s;
      const item = p.item + 1;
      if (item >= st.items.length) return enter(s, s.index + 1, t0(p.endsAt));
      return { ...s, phase: { k: 'warmup', item, endsAt: t0(p.endsAt) + ms(s, st.items[item]!.seconds) } };
    }
    case 'rest':
      return due(p.endsAt) ? enter(s, s.index + 1, t0(p.endsAt)) : s;
    case 'ready': {
      if (!due(p.endsAt)) return s;
      const t = t0(p.endsAt);
      if (st.kind === 'hold') return { ...s, phase: { k: 'hold', startedAt: t, endsAt: t + ms(s, st.seconds) } };
      if (st.kind === 'maxHold') return { ...s, phase: { k: 'stopwatch', startedAt: t } };
      if (st.kind === 'emom') return { ...s, phase: { k: 'emom', startedAt: t, missed: [] } };
      return s;
    }
    case 'hold': {
      if (!due(p.endsAt) || st.kind !== 'hold') return s;
      const logged = record(s, st.lineIndex, { set: st.set, side: st.side, seconds: st.seconds, clean: true });
      return finishWork(logged, t0(p.endsAt));
    }
    case 'emom': {
      if (st.kind !== 'emom') return s;
      const endsAt = p.startedAt + st.rounds * ms(s, st.intervalSec);
      if (!due(endsAt)) return s;
      let logged = s;
      for (const r of emomResults(st, st.rounds, p.missed)) logged = record(logged, st.lineIndex, r);
      return finishWork(logged, t0(endsAt));
    }
    case 'totalRest':
      return due(p.endsAt) ? { ...s, phase: { k: 'total', sets: p.sets, value: p.value } } : s;
    case 'practice': {
      if (!due(p.endsAt) || st.kind !== 'practice') return s;
      return finishWork(record(s, st.lineIndex, { set: 0, seconds: st.minutes * 60, clean: true }), t0(p.endsAt));
    }
    case 'attemptRest':
      return due(p.endsAt) ? { ...s, phase: { k: 'attempt', i: p.i, results: p.results } } : s;
    default:
      return s;
  }
}

/** EMOM round in progress (0-based), for display and the Missed button. */
export function emomRound(s: LiveSession, now: number): number {
  const st = s.steps[s.index];
  if (s.phase.k !== 'emom' || st?.kind !== 'emom') return 0;
  return Math.min(st.rounds - 1, Math.floor((now - s.phase.startedAt) / ms(s, st.intervalSec)));
}

export function reduce(s0: LiveSession, a: Action, now: number): LiveSession {
  const s = tick(s0, now);
  if (s.finished) return s;
  const p = s.phase;
  const st = s.steps[s.index]!;

  switch (a.type) {
    case 'tick':
      return s;

    case 'finishEarly':
      return { ...s, finished: true, finishedEarly: true, phase: { k: 'done' } };

    case 'pain': {
      const li = currentLine(s);
      if (li === undefined) return s;
      return enter(withLine(s, li, (r) => ({ ...r, status: 'pain' })), s.lastOfLine[li]! + 1, now);
    }

    case 'skipWarmup':
      return st.kind === 'warmup' ? enter(s, s.index + 1, now) : s;

    case 'skip':
      if (p.k === 'rest' || p.k === 'warmup') return p.k === 'warmup' ? tick({ ...s, phase: { ...p, endsAt: now } }, now) : enter(s, s.index + 1, now);
      if (p.k === 'totalRest') return { ...s, phase: { k: 'total', sets: p.sets, value: p.value } };
      if (p.k === 'attemptRest') return { ...s, phase: { k: 'attempt', i: p.i, results: p.results } };
      if (p.k === 'ready') return tick({ ...s, phase: { ...p, endsAt: now } }, now);
      return s;

    case 'addRest':
      if (p.k === 'rest' || p.k === 'totalRest' || p.k === 'attemptRest') {
        return { ...s, phase: { ...p, endsAt: p.endsAt + ms(s, ADD_REST) } };
      }
      return s;

    case 'done':
      if (p.k !== 'reps' || st.kind !== 'reps') return s;
      return finishWork(record(s, st.lineIndex, { set: st.set, reps: st.reps, load: st.load, clean: true }), now);

    case 'less':
      if (p.k !== 'reps' || st.kind !== 'reps') return s;
      return { ...s, phase: { k: 'adjust', reps: st.reps, clean: true } };

    case 'adjust':
      if (p.k !== 'adjust') return s;
      return { ...s, phase: { ...p, reps: Math.max(0, a.reps ?? p.reps), clean: a.clean ?? p.clean } };

    case 'back':
      return p.k === 'adjust' ? { ...s, phase: { k: 'reps' } } : s;

    case 'count':
      if (p.k === 'total' || p.k === 'count') return { ...s, phase: { ...p, value: Math.max(0, a.value) } };
      return s;

    case 'confirm': {
      if (p.k === 'adjust' && st.kind === 'reps') {
        const logged = record(s, st.lineIndex, { set: st.set, reps: p.reps, load: st.load, clean: p.clean });
        // 90 degree rule: a rep that stops at 80 degrees ends the line for the day.
        if (!p.clean && st.endOnNotClean) return completeLine(logged, st.lineIndex, now);
        return finishWork(logged, now);
      }
      if (p.k === 'total' && st.kind === 'totalReps') {
        const set: SetResult = { set: p.sets.length, reps: p.value, clean: true };
        const sets = [...p.sets, set];
        const logged = record(s, st.lineIndex, set);
        const done = sets.reduce((a2, x) => a2 + (x.reps ?? 0), 0);
        if (done >= st.total) return finishWork(logged, now);
        const value = Math.max(1, Math.min(p.value, st.total - done));
        return { ...logged, phase: { k: 'totalRest', sets, value, endsAt: now + ms(s, st.restBetween) } };
      }
      if (p.k === 'count' && st.kind === 'amrap') {
        return finishWork(record(s, st.lineIndex, { set: 0, reps: p.value, side: st.side, clean: true }), now);
      }
      return s;
    }

    case 'stop':
      if (p.k === 'hold' && st.kind === 'hold') {
        const seconds = Math.min(st.seconds, realSeconds(s, now - p.startedAt));
        return finishWork(record(s, st.lineIndex, { set: st.set, side: st.side, seconds, clean: false }), now);
      }
      if (p.k === 'stopwatch' && st.kind === 'maxHold') {
        return finishWork(record(s, st.lineIndex, { set: 0, side: st.side, seconds: realSeconds(s, now - p.startedAt), clean: true }), now);
      }
      return s;

    case 'missed': {
      if (p.k !== 'emom') return s;
      const r = emomRound(s, now);
      return p.missed.includes(r) ? s : { ...s, phase: { ...p, missed: [...p.missed, r] } };
    }

    case 'partial': {
      if (p.k !== 'emom' || st.kind !== 'emom') return s;
      const r = emomRound(s, now);
      let logged = s;
      for (const x of emomResults(st, r, p.missed)) logged = record(logged, st.lineIndex, x);
      logged = record(logged, st.lineIndex, { set: r, reps: st.reps, clean: false });
      return completeLine(logged, st.lineIndex, now);
    }

    case 'answer': {
      if (p.k !== 'ask') return s;
      const li = (st as WorkStep).lineIndex;
      const answered = withLine(s, li, (r) => ({ ...r, [a.q]: a.value }));
      const queue = p.queue.filter((q) => q !== a.q);
      return queue.length ? { ...answered, phase: { k: 'ask', queue } } : completeLine(answered, li, now);
    }

    case 'attempt': {
      if (p.k !== 'attempt' || st.kind !== 'attempts') return s;
      const results = [...p.results, a.ok];
      const logged = withLine(s, st.lineIndex, (r) => ({ ...r, status: r.status === 'skipped' ? 'stoppedEarly' : r.status, attempts: results }));
      if (results.length >= st.count) return finishWork(logged, now);
      return { ...logged, phase: { k: 'attemptRest', i: results.length, results, endsAt: now + ms(s, st.restBetween) } };
    }

    case 'endLine': {
      const li = currentLine(s);
      if (li === undefined) return s;
      let next = s;
      if (p.k === 'practice' && st.kind === 'practice') {
        next = record(s, li, { set: 0, seconds: realSeconds(s, now - p.startedAt), clean: true });
      }
      return completeLine(next, li, now);
    }
  }
}

export function toSessionLog(s: LiveSession, now: number): SessionLog {
  return {
    id: s.id,
    key: s.key,
    date: s.date,
    startedAt: s.startedAt,
    finishedAt: now,
    finishedEarly: s.finishedEarly || undefined,
    lines: s.results,
  };
}

/** Time left in the current timed phase, in real milliseconds (null when nothing is counting down). */
export function remainingMs(s: LiveSession, now: number): number | null {
  const p = s.phase;
  const st = s.steps[s.index];
  const left = (endsAt: number) => Math.max(0, (endsAt - now) * s.speed);
  switch (p.k) {
    case 'warmup':
    case 'rest':
    case 'ready':
    case 'hold':
    case 'totalRest':
    case 'practice':
    case 'attemptRest':
      return left(p.endsAt);
    case 'emom': {
      if (st?.kind !== 'emom') return null;
      const interval = ms(s, st.intervalSec);
      const r = emomRound(s, now);
      return left(p.startedAt + (r + 1) * interval);
    }
    default:
      return null;
  }
}

/** Seconds since the stopwatch started (max holds), real time. */
export function elapsedMs(s: LiveSession, now: number): number {
  return s.phase.k === 'stopwatch' ? Math.max(0, (now - s.phase.startedAt) * s.speed) : 0;
}
