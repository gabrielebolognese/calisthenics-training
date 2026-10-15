// Every progression line from PLAN_SPEC §7.4. Rule ids from the spec are in the comments.
import { EXERCISES } from './exercises';
import { ABS_LINES } from './abs';
import { TEST_LINES } from './tests';
import type { ExerciseId, LineId } from './types';
import {
  dpNext,
  fixedLine,
  floorTo,
  progressedOk,
  repeat,
  round5,
  seqLine,
  stagedLine,
  type LineDef,
  type SeqEntry,
  type StagedState,
} from '../engine/rules';
import type { BarHeight, EndedBy, Target } from '../engine/types';

// ---------- H1: handstand working sets (PCT + weekly TIME) ----------

export interface HandstandState {
  work: number;
  /** The max currently used as the 65% base. */
  baseMax: number;
  /** Week being accumulated for the weekly +5 s. */
  weekSeq: number | null;
  weekClean: boolean;
  weekHadSets: boolean;
  /** round5(65% of a new higher max), applied at the next week rollover [D30]. */
  pendingBase: number;
  lastEndedBy?: EndedBy;
}

const handstand: LineDef<HandstandState> = {
  id: 'handstand',
  progressive: true,
  init: (b) => ({
    work: round5(0.65 * b.handstand),
    baseMax: b.handstand,
    weekSeq: null,
    weekClean: true,
    weekHadSets: false,
    pendingBase: 0,
  }),
  // "+5 s per set per week while every set stays clean" [D29]; a new higher max never lowers the time [D30].
  beforeSession(s, ctx) {
    if (s.weekSeq === null) return { ...s, weekSeq: ctx.weekSeq };
    if (ctx.weekSeq <= s.weekSeq) return s;
    const inc = s.weekHadSets && s.weekClean ? 5 : 0;
    return {
      ...s,
      work: Math.max(s.work + inc, s.pendingBase),
      weekSeq: ctx.weekSeq,
      weekClean: true,
      weekHadSets: false,
      pendingBase: 0,
    };
  },
  target: (s, ctx) => ({ exercise: 'handstand', kind: 'hold', seconds: repeat(ctx.slotSets ?? 4, s.work), rateable: false }),
  advance(s, o) {
    if (!o.prescription.progresses) return s;
    return { ...s, weekHadSets: true, weekClean: s.weekClean && o.success };
  },
  // The Day 4 max and the test max reset the base (H1-max), and record what ended the hold [D31].
  observe(s, session) {
    const r = session.lines.find((l) => l.line === 'handstandMax' || l.line === 'testHandstand');
    if (!r || r.status === 'skipped' || r.sets.length === 0) return s;
    const max = Math.max(...r.sets.map((x) => x.seconds ?? 0));
    const next = { ...s, lastEndedBy: r.endedBy ?? s.lastEndedBy };
    if (max <= s.baseMax) return next;
    return { ...next, baseMax: max, pendingBase: Math.max(s.pendingBase, round5(0.65 * max)) };
  },
  scale80: (s) => ({ ...s, work: Math.max(5, round5(s.work * 0.8)) }),
  rebase: (s, r) => ({
    ...s,
    work: round5(0.65 * r.latest.handstand),
    baseMax: r.latest.handstand,
    pendingBase: 0,
    weekClean: true,
    weekHadSets: false,
  }),
};

// ---------- W1: weighted muscle-up load ladder ----------

export interface WeightedMuState {
  load: number;
  /** Index into 4x2, 4x3, 4x4. */
  idx: number;
  /** Unlock half (b): a clean set of 3+ at +10 kg or more [D36]. */
  unlockMet: boolean;
}

const WMU_REPS = [2, 3, 4];

const weightedMu: LineDef<WeightedMuState> = {
  id: 'weightedMu',
  progressive: true,
  init: () => ({ load: 5, idx: 0, unlockMet: false }),
  target: (s) => ({ exercise: 'weightedMu', kind: 'reps', reps: repeat(4, WMU_REPS[s.idx]!), load: s.load, rateable: true }),
  advance(s, o, ctx) {
    let next = s;
    const load = o.prescription.load ?? 0;
    if (!s.unlockMet && o.result?.sets.some((x) => x.clean && (x.reps ?? 0) >= 3 && (x.load ?? load) >= 10)) {
      next = { ...next, unlockMet: true };
    }
    if (!progressedOk(o)) return next;
    // +5 kg at 4x2, 4x3, 4x4, then the next load at 4x2. Step = plate increment [D23].
    return next.idx < WMU_REPS.length - 1
      ? { ...next, idx: next.idx + 1 }
      : { ...next, idx: 0, load: next.load + ctx.settings.plateIncrement };
  },
  scale80: (s, st) => ({ ...s, load: floorTo(s.load * 0.8, st.plateIncrement) }),
};

// ---------- WP1: weighted pull-ups with load calibration [D24] ----------

export interface WeightedPullupState {
  load: number;
  reps: number[];
  /** Becomes true at the first Right or Hard rating. Until then, Easy adds load instead of reps. */
  calibrated: boolean;
}

const WPU_START = [5, 5, 5, 5];
const WPU_TOP = 8;

const weightedPullup: LineDef<WeightedPullupState> = {
  id: 'weightedPullup',
  progressive: true,
  init: (b) => ({ load: b.weightedPullupLoad, reps: [...WPU_START], calibrated: false }),
  target: (s) => ({
    exercise: 'weightedPullup',
    kind: 'reps',
    reps: [...s.reps],
    load: s.load,
    rateable: true,
    note: s.calibrated ? undefined : 'Finding your load: rate Easy if 5 reps left more than 2 in the tank',
  }),
  advance(s, o, ctx) {
    if (!o.prescription.progresses) return s;
    const effort = o.result?.effort;
    const calibrated = s.calibrated || effort === 'right' || effort === 'hard';
    if (!o.success) return { ...s, calibrated };
    const inc = ctx.settings.plateIncrement;
    if (!s.calibrated && effort === 'easy') return { ...s, load: s.load + inc };
    const next = dpNext(s.reps, WPU_TOP);
    return next ? { ...s, reps: next, calibrated } : { load: s.load + inc, reps: [...WPU_START], calibrated };
  },
  scale80: (s, st) => ({ ...s, load: floorTo(s.load * 0.8, st.plateIncrement) }),
};

// ---------- HP: explosive high pulls (fixed 5x3, bar height logged) ----------

export interface HighPullState {
  /** Unlock half (a): logged at lower chest or waist with a clean set of 3 [D36]. */
  unlockMet: boolean;
  lastHeight?: BarHeight;
}

const highPull: LineDef<HighPullState> = {
  id: 'highPull',
  progressive: false,
  init: () => ({ unlockMet: false }),
  target: () => ({ exercise: 'highPull', kind: 'reps', reps: repeat(5, 3), rateable: false }),
  advance(s, o) {
    const r = o.result;
    if (!r || !o.attempted) return s;
    const high = r.barHeight === 'lowerChest' || r.barHeight === 'waist';
    const met = high && r.sets.some((x) => x.clean && (x.reps ?? 0) >= 3);
    return { unlockMet: s.unlockMet || met, lastHeight: r.barHeight ?? s.lastHeight };
  },
};

// ---------- Total-reps lines: S2, M2, M3 [D21] ----------

export interface TotalState {
  lastSetsUsed?: number;
  /** One-session 80% restart total [D52]. */
  override?: number;
  /** Next-cycle multiplier [D56]. */
  scale: number;
}

function totalLine(
  id: LineId,
  exercise: ExerciseId,
  base: number,
  goal: 'hspu' | 'muscleUp',
  amrapWhen?: (block: number, blockWeek: number) => boolean,
): LineDef<TotalState> {
  const totalFor = (s: TotalState) => s.override ?? round5(base * s.scale);
  return {
    id,
    progressive: true,
    init: () => ({ scale: 1 }),
    target(s, ctx) {
      // M3: one AMRAP test in week 6 of Block 3 replaces the total that day [D22].
      if (ctx.dayKind === 'training' && amrapWhen?.(ctx.block, ctx.blockWeek)) {
        return { exercise, kind: 'amrap', name: `${EXERCISES[exercise].name} AMRAP`, rateable: false, note: 'Count only clean reps' };
      }
      return { exercise, kind: 'total', total: { target: totalFor(s), topSet: false, lastSetsUsed: s.lastSetsUsed }, rateable: true };
    },
    advance(s, o) {
      if (!o.attempted || o.prescription.kind !== 'total') return s;
      const counts = o.prescription.progresses && o.result?.status === 'complete';
      return { ...s, override: undefined, lastSetsUsed: counts ? o.result!.sets.length : s.lastSetsUsed };
    },
    scale80: (s) => ({ ...s, override: round5(totalFor(s) * 0.8) }),
    rebase: (s, r) => ({ ...s, override: undefined, lastSetsUsed: undefined, scale: r.latest[goal] / r.week0[goal] }),
  };
}

// ---------- S3: HSPU Block 3, total 60 then 70, top sets in weeks 2, 4, 6 [D18] [D19] ----------

export interface HspuB3State extends TotalState {
  lastSixtyOk: boolean;
  at70: boolean;
}

const b3Base = (s: HspuB3State, blockWeek: number) => (s.at70 || (blockWeek >= 4 && s.lastSixtyOk) ? 70 : 60);

const hspuB3: LineDef<HspuB3State> = {
  id: 'hspuB3',
  progressive: true,
  init: () => ({ scale: 1, lastSixtyOk: false, at70: false }),
  target: (s, ctx) => ({
    exercise: 'hspu',
    kind: 'total',
    total: {
      target: s.override ?? round5(b3Base(s, ctx.blockWeek) * s.scale),
      topSet: [2, 4, 6].includes(ctx.blockWeek),
      lastSetsUsed: s.lastSetsUsed,
    },
    rateable: true,
  }),
  advance(s, o, ctx) {
    if (!o.attempted) return s;
    if (!o.prescription.progresses) return { ...s, override: undefined };
    const base = b3Base(s, ctx.blockWeek);
    return {
      ...s,
      override: undefined,
      lastSetsUsed: o.result?.status === 'complete' ? o.result.sets.length : s.lastSetsUsed,
      at70: s.at70 || base === 70,
      lastSixtyOk: base === 60 ? o.success : s.lastSixtyOk,
    };
  },
  scale80: (s) => ({ ...s, override: round5((s.at70 ? 70 : 60) * s.scale * 0.8) }),
  rebase: (s, r) => ({ ...s, override: undefined, lastSetsUsed: undefined, at70: false, lastSixtyOk: false, scale: r.latest.hspu / r.week0.hspu }),
};

// ---------- S1: HSPU Block 1 double progression, then a 6th set [D20] ----------

const hspuB1Base = stagedLine('hspuB1', [
  { exercise: 'hspu', rule: { type: 'dp', start: repeat(5, 6), top: 8, onTop: { addSet: 6, maxSets: 6 } } },
]);

// Next cycle: 5 x round(55% of max), top = start + 2 [D56].
const hspuB1: LineDef<StagedState & { top?: number }> = {
  ...hspuB1Base,
  advance(s, o, ctx) {
    if (s.top === undefined) return hspuB1Base.advance!(s, o, ctx);
    if (!progressedOk(o)) return s;
    const next = dpNext(s.reps!, s.top);
    if (next) return { ...s, reps: next };
    if (s.reps!.length < 6) return { ...s, reps: [...s.reps!, s.top - 2] };
    return { ...s, reached: true };
  },
  rebase(s, r) {
    const start = Math.max(1, Math.round(0.55 * r.latest.hspu));
    return { ...s, stage: 0, reps: repeat(5, start), top: start + 2, reached: false };
  },
};

// ---------- Sequences: N1, G1, M1, F1 ----------

// N1: EMOM 6, 7, 8 singles, then every 2 min 4x2, 5x2, 3x3 [D15].
const P90: SeqEntry[] = [
  { kind: 'emom', sets: 6, reps: 1, intervalSec: 60 },
  { kind: 'emom', sets: 7, reps: 1, intervalSec: 60 },
  { kind: 'emom', sets: 8, reps: 1, intervalSec: 60 },
  { kind: 'emom', sets: 4, reps: 2, intervalSec: 120 },
  { kind: 'emom', sets: 5, reps: 2, intervalSec: 120 },
  { kind: 'emom', sets: 3, reps: 3, intervalSec: 120 },
];

// G1: 6x2 s, 6x3 s, 5x4 s, 5x5 s.
const FLAG_D2: SeqEntry[] = [
  { kind: 'hold', sets: 6, seconds: 2 },
  { kind: 'hold', sets: 6, seconds: 3 },
  { kind: 'hold', sets: 5, seconds: 4 },
  { kind: 'hold', sets: 5, seconds: 5 },
];

const pushup90 = seqLine({ id: 'pushup90', exercise: 'pushup90', entry: (i) => P90[i] ?? null });
const flag = seqLine({ id: 'flag', exercise: 'flag', entry: (i) => FLAG_D2[i] ?? null });

// M1: EMOM 8x3, 10x3, 8x4, 10x4. base = reps (3 now; 3/7 of the MU max next cycle [D56]).
const muEmom = seqLine({
  id: 'muEmom',
  exercise: 'muscleUp',
  initBase: () => 3,
  rebaseBase: (r) => Math.max(1, Math.round((3 / 7) * r.latest.muscleUp)),
  entry: (i, base) => {
    const steps = [
      [8, base],
      [10, base],
      [8, base + 1],
      [10, base + 1],
    ];
    const e = steps[i];
    return e ? { kind: 'emom', sets: e[0]!, reps: e[1]!, intervalSec: 60 } : null;
  },
});

// F1: 6x3 s, 8x3 s, 6x4 s, 8x4 s, then the same rule: holds first, then seconds [D14].
const flCluster = seqLine({
  id: 'flCluster',
  exercise: 'flCluster',
  initBase: () => 3,
  rebaseBase: (r) => Math.max(1, Math.round(0.6 * r.latest.frontLever)),
  entry: (i, base) => ({ kind: 'hold', sets: i % 2 === 0 ? 6 : 8, seconds: base + Math.floor(i / 2) }),
});

// ---------- Staged lines: P1–P4, N2, A1, PP1, DP1, F2, F3, F4, PU1, G2 ----------

const plancheOneLeg = stagedLine('plancheOneLeg', [
  { exercise: 'plancheOneLeg', rule: { type: 'time', sets: 6, start: 3, cap: 5, bilateral: 'leg' } },
]);
const plancheAdvTuck = stagedLine('plancheAdvTuck', [
  { exercise: 'plancheAdvTuck', rule: { type: 'time', sets: 3, start: 8, cap: 12 } },
]);
const plancheHalfStraddle = stagedLine('plancheHalfStraddle', [
  { exercise: 'plancheHalfStraddle', rule: { type: 'time', sets: 3, start: 4, cap: 8 } },
]);
const plancheBandStraddle = stagedLine('plancheBandStraddle', [
  { exercise: 'plancheBandStraddle', rule: { type: 'time', sets: 3, start: 5, cap: 10, onTop: 'restart' } },
]);
const hold90 = stagedLine('hold90', [{ exercise: 'hold90', rule: { type: 'time', sets: 4, start: 5, cap: 10 } }]);
const archer = stagedLine('archer', [
  { exercise: 'archerHspu', rule: { type: 'dp', start: [2, 2, 2, 2], top: 4, perSide: true } },
]);
const pseudoPlanche = stagedLine('pseudoPlanche', [
  { exercise: 'pseudoPlanchePushup', rule: { type: 'dp', start: [8, 8, 8], top: 12 } },
]);
const dips = stagedLine('dips', [{ exercise: 'dips', rule: { type: 'dp', start: [12, 12, 12], top: 15 } }]);
const flRaise = stagedLine('flRaise', [{ exercise: 'flRaise', rule: { type: 'dp', start: [3, 3, 3], top: 5 } }]);
const tuckRow = stagedLine('tuckRow', [{ exercise: 'tuckFlRow', rule: { type: 'dp', start: [6, 6, 6], top: 10 } }]);
const pullup = stagedLine('pullup', [{ exercise: 'pullup', rule: { type: 'dp', start: [10, 10, 10], top: 15 } }]);
const flagStraddle = stagedLine('flagStraddle', [
  { exercise: 'flagStraddle', rule: { type: 'time', sets: 3, start: 6, cap: 10 } },
]);
// F3: one-leg 4x8 s → 4x15 s, then straddle 4x6 s → 4x12 s [D28].
const flDuration = stagedLine('flDuration', [
  { exercise: 'flOneLeg', rule: { type: 'time', sets: 4, start: 8, cap: 15, bilateral: 'leg' }, next: 'top' },
  { exercise: 'flStraddle', rule: { type: 'time', sets: 4, start: 6, cap: 12 } },
]);

// ---------- Fixed lines ----------

const fixedReps = (id: LineId, exercise: ExerciseId, reps: number[], note?: string) =>
  fixedLine(id, { exercise, kind: 'reps', reps, note });

// Flag balance sets for one-side flaggers: same seconds as the main line, other side, not counted [D34].
const flagBalance = (id: LineId, of: LineId, exercise: ExerciseId) =>
  fixedLine(id, (ctx) => {
    const main = ctx.prior[of];
    if (ctx.settings.flagSides !== 'one' || !main?.seconds?.length) return null;
    return {
      exercise,
      kind: 'hold',
      name: `${EXERCISES[exercise].name}, other side`,
      seconds: [main.seconds[0]!],
      note: 'Balance set on your other side. Not counted for progression',
    };
  });

const plancheLight = fixedLine('plancheLight', (ctx): Target =>
  ctx.options.plancheLight === 'advTuck'
    ? { exercise: 'plancheLight', name: 'Planche, light: adv tuck', kind: 'hold', seconds: repeat(5, 3) }
    : { exercise: 'plancheLight', name: 'Planche, light: one-leg', kind: 'hold', seconds: repeat(5, 3), bilateral: 'leg' },
);

// A1-x: optional bent-arm set, logged as assisted, never counted [D17].
const archerAssisted = fixedLine('archerAssisted', (ctx) => {
  const a = ctx.prior.archer;
  if (!a?.reps) return null;
  return {
    exercise: 'archerHspu',
    kind: 'reps',
    name: 'Archer HSPU, bent arm (assisted)',
    reps: [Math.max(...a.reps)],
    perSide: true,
    note: 'Assisted volume. Never counted for progression',
  };
});

// ---------- Registry ----------

const LIST: LineDef[] = [
  handstand,
  fixedLine('handstandMax', { exercise: 'handstand', kind: 'maxHold', name: 'Handstand max attempt' }),
  fixedLine('handstandPractice', { exercise: 'handstandPractice', kind: 'practice', practiceMinutes: 10 }),
  fixedLine('practiceShort', { exercise: 'handstandPractice', kind: 'practice', practiceMinutes: 5, name: 'Easy handstand practice' }),
  fixedLine('chestToWall', { exercise: 'chestToWall', kind: 'hold', seconds: [60, 60] }),
  plancheOneLeg,
  plancheAdvTuck,
  plancheHalfStraddle,
  plancheBandStraddle,
  plancheLight,
  pushup90,
  hold90,
  fixedReps('negative90', 'negative90', [1, 1, 1], '5 s down'),
  archer,
  archerAssisted,
  pseudoPlanche,
  hspuB1,
  totalLine('hspuB2', 'hspu', 50, 'hspu'),
  hspuB3,
  dips,
  fixedLine('ntMu', { exercise: 'ntMu', kind: 'attempts', attempts: 3 }),
  highPull,
  weightedMu,
  flCluster,
  flRaise,
  weightedPullup,
  flag,
  flagBalance('flagBalance2', 'flag', 'flag'),
  muEmom,
  totalLine('muTotal30', 'muscleUp', 30, 'muscleUp'),
  totalLine('muTotal40', 'muscleUp', 40, 'muscleUp', (block, bw) => block === 3 && bw === 6),
  flDuration,
  tuckRow,
  pullup,
  flagStraddle,
  flagBalance('flagBalance5', 'flagStraddle', 'flagStraddle'),
  fixedReps('flagNegative', 'flagNegative', [1, 1, 1], 'Slow, 3 to 5 s down'),
  fixedLine('flagStraightBar', { exercise: 'flagStraightBar', kind: 'attempts', attempts: 5 }),
  ...ABS_LINES,
  ...TEST_LINES,
];

export const LINES = Object.fromEntries(LIST.map((l) => [l.id, l])) as Record<LineId, LineDef>;
