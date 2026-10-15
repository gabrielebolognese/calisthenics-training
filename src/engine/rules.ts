import type { DayKind } from '../plan/blocks';
import type { ExerciseId, LineId } from '../plan/types';
import type { Baselines, Outcome, Position, SessionLog, Settings, Target } from './types';

// ---------- Line definitions ----------

export interface SessionOptions {
  /** Day 6 light planche variant for this session [D32]. */
  plancheLight?: 'oneLeg' | 'advTuck';
}

export type StateMap = Record<LineId, unknown>;

export interface LineCtx {
  pos: Position;
  block: number;
  blockWeek: number;
  dayKind: DayKind;
  weekSeq: number;
  settings: Settings;
  baselines: Baselines;
  states: StateMap;
  /** Targets already built earlier in the same session (flag balance sets read these). */
  prior: Partial<Record<LineId, Target>>;
  options: SessionOptions;
  /** Set count override from the session slot (handstand: 4 on Day 1, 3 on Day 4). */
  slotSets?: number;
}

/** Latest test values used to rebase a new cycle [D56]. */
export interface Rebase {
  latest: { hspu: number; muscleUp: number; handstand: number; frontLever: number };
  week0: Baselines;
}

export interface LineDef<S = any> {
  id: LineId;
  /** Has a progression rule: counts for the effort rating and the performance-drop trigger. */
  progressive: boolean;
  init(b: Baselines, s: Settings): S;
  /** null: nothing to do today for this line. */
  target(state: S, ctx: LineCtx): Target | null;
  /** Runs before a session is prescribed or folded (handstand week rollover). */
  beforeSession?(state: S, ctx: LineCtx): S;
  /** Runs for every line in a session, progressing or not. */
  advance?(state: S, o: Outcome, ctx: LineCtx): S;
  /** Runs for every line after each session (cross-line effects such as the handstand max). */
  observe?(state: S, session: SessionLog, ctx: LineCtx): S;
  scale80?(state: S, settings: Settings): S;
  rebase?(state: S, r: Rebase, settings: Settings): S;
}

// ---------- Small helpers ----------

export const round5 = (x: number) => Math.round(x / 5) * 5;
export const scaleCount = (n: number) => Math.max(1, Math.round(n * 0.8));
export const floorTo = (x: number, step: number) => Math.max(0, Math.floor(x / step + 1e-9) * step);
export const repeat = <T,>(n: number, v: T): T[] => Array.from({ length: n }, () => v);
export const progressedOk = (o: Outcome) => o.prescription.progresses && o.success;

/**
 * Double progression [D02]: add one rep to the leftmost set with the fewest reps,
 * so 4x2 → [3,2,2,2] → [3,3,2,2] → … → 4x3. Returns null when every set is at the top.
 */
export function dpNext(reps: readonly number[], top: number): number[] | null {
  const min = Math.min(...reps);
  if (min >= top) return null;
  const next = [...reps];
  next[reps.indexOf(min)] = min + 1;
  return next;
}

// ---------- Staged lines (double progression, timed holds, fixed, with variations) ----------

export type StageRule =
  | {
      type: 'dp';
      start: number[];
      top: number;
      perSide?: boolean;
      load?: { start: number; step: number | 'plate' };
      /** addLoad: back to start with more load. addSet: append a set (HSPU Block 1). Default: hold. */
      onTop?: 'addLoad' | { addSet: number; maxSets: number };
    }
  | {
      type: 'time';
      sets: number;
      start: number;
      cap: number;
      step?: number;
      bilateral?: 'leg';
      /** restart: back to start (band-assisted straddle with a lighter band). Default: hold. */
      onTop?: 'restart';
    }
  | { type: 'fixed'; target: Omit<Target, 'exercise'> };

export interface StageDef {
  exercise: ExerciseId;
  name?: string;
  rule: StageRule;
  /** When to move to the next stage: after a successful session at the top, or after a clean session rated Easy. */
  next?: 'top' | 'easy';
  note?: string;
}

export interface StagedState {
  stage: number;
  reps?: number[];
  seconds?: number;
  load?: number;
  /** Sticky: the last stage succeeded at its top (also the planche switch trigger). */
  reached: boolean;
  restarts: number;
}

const TOP_NOTE = 'Top of the plan: keep these numbers';

export function stagedLine(id: LineId, stages: StageDef[], opts: { progressive?: boolean } = {}): LineDef<StagedState> {
  const startStage = (i: number): StagedState => {
    const r = stages[i]!.rule;
    if (r.type === 'dp') return { stage: i, reps: [...r.start], load: r.load?.start, reached: false, restarts: 0 };
    if (r.type === 'time') return { stage: i, seconds: r.start, reached: false, restarts: 0 };
    return { stage: i, reached: false, restarts: 0 };
  };

  return {
    id,
    progressive: opts.progressive ?? true,
    init: () => startStage(0),

    target(s) {
      const st = stages[s.stage]!;
      const r = st.rule;
      const note = s.reached ? TOP_NOTE : st.note;
      const base = { exercise: st.exercise, name: st.name, stage: s.stage, note };
      if (r.type === 'dp') {
        return { ...base, kind: 'reps', reps: [...s.reps!], perSide: r.perSide, load: s.load, rateable: true };
      }
      if (r.type === 'time') {
        const bandNote = r.onTop === 'restart' && s.restarts > 0 ? `Use a lighter band (band ${s.restarts + 1})` : note;
        return { ...base, note: bandNote, kind: 'hold', seconds: repeat(r.sets, s.seconds!), bilateral: r.bilateral, rateable: false };
      }
      return { ...base, ...r.target, rateable: st.next === 'easy' };
    },

    advance(s, o, ctx) {
      if (!progressedOk(o)) return s;
      const st = stages[s.stage]!;
      const r = st.rule;
      const hasNext = s.stage < stages.length - 1;
      if (st.next === 'easy') {
        return o.result?.effort === 'easy' && hasNext ? startStage(s.stage + 1) : s;
      }
      if (r.type === 'dp') {
        const next = dpNext(s.reps!, r.top);
        if (next) return { ...s, reps: next };
        if (st.next === 'top' && hasNext) return startStage(s.stage + 1);
        if (r.onTop === 'addLoad') {
          const step = r.load?.step === 'plate' ? ctx.settings.plateIncrement : (r.load?.step ?? 5);
          return { ...s, load: (s.load ?? 0) + step, reps: [...r.start] };
        }
        if (typeof r.onTop === 'object' && s.reps!.length < r.onTop.maxSets) {
          return { ...s, reps: [...s.reps!, r.onTop.addSet] };
        }
        return { ...s, reached: true };
      }
      if (r.type === 'time') {
        if (s.seconds! < r.cap) return { ...s, seconds: Math.min(r.cap, s.seconds! + (r.step ?? 1)) };
        if (st.next === 'top' && hasNext) return startStage(s.stage + 1);
        if (r.onTop === 'restart') return { ...s, seconds: r.start, restarts: s.restarts + 1 };
        return { ...s, reached: true };
      }
      return s;
    },

    scale80(s, settings) {
      const r = stages[s.stage]!.rule;
      if (r.type === 'dp') {
        // Loaded lines drop the load only, so the cut is not applied twice [D52].
        if (s.load !== undefined && s.load > 0) return { ...s, load: floorTo(s.load * 0.8, settings.plateIncrement) };
        return { ...s, reps: s.reps!.map(scaleCount) };
      }
      if (r.type === 'time') return { ...s, seconds: Math.max(1, Math.round(s.seconds! * 0.8)) };
      return s;
    },
  };
}

// ---------- Sequence lines ----------

export interface SeqEntry {
  kind: 'hold' | 'emom';
  sets: number;
  seconds?: number;
  reps?: number;
  intervalSec?: number;
}

export interface SeqState {
  index: number;
  /** Parameter of generated sequences (cluster seconds, EMOM reps); rebased per cycle. */
  base: number;
  reached: boolean;
}

const volume = (e: SeqEntry) => e.sets * (e.seconds ?? e.reps ?? 1);

export function seqLine(cfg: {
  id: LineId;
  exercise: ExerciseId;
  entry: (index: number, base: number) => SeqEntry | null;
  initBase?: (b: Baselines) => number;
  rebaseBase?: (r: Rebase) => number;
}): LineDef<SeqState> {
  const { entry } = cfg;
  return {
    id: cfg.id,
    progressive: true,
    init: (b) => ({ index: 0, base: cfg.initBase?.(b) ?? 0, reached: false }),

    target(s) {
      const e = entry(s.index, s.base)!;
      const note = s.reached ? TOP_NOTE : undefined;
      if (e.kind === 'hold') {
        return { exercise: cfg.exercise, kind: 'hold', seconds: repeat(e.sets, e.seconds!), rateable: false, note };
      }
      return {
        exercise: cfg.exercise,
        kind: 'emom',
        emom: { rounds: e.sets, reps: e.reps!, intervalSec: e.intervalSec ?? 60 },
        rateable: true,
        note,
      };
    },

    advance(s, o) {
      if (!progressedOk(o)) return s;
      return entry(s.index + 1, s.base) ? { ...s, index: s.index + 1 } : { ...s, reached: true };
    },

    // Snap down to the highest step whose volume is at most 80% of today's [D52].
    scale80(s) {
      const goal = 0.8 * volume(entry(s.index, s.base)!);
      let best = 0;
      for (let i = 0; i <= s.index; i++) if (volume(entry(i, s.base)!) <= goal) best = i;
      return { ...s, index: best };
    },

    rebase: cfg.rebaseBase ? (s, r) => ({ ...s, index: 0, reached: false, base: cfg.rebaseBase!(r) }) : undefined,
  };
}

// ---------- Fixed lines (practice, tests, negatives) ----------

export function fixedLine(id: LineId, t: Target | ((ctx: LineCtx) => Target | null)): LineDef<null> {
  return {
    id,
    progressive: false,
    init: () => null,
    target: (_s, ctx) => (typeof t === 'function' ? t(ctx) : { ...t }),
  };
}
