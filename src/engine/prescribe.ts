import { blockOf, blockWeekOf, type DayKind, type WeekKind } from '../plan/blocks';
import { EXERCISES, STANDARDS } from '../plan/exercises';
import { LINES } from '../plan/progression';
import { DAYS, RIR_OVERRIDES, TEST_DAYS, type Slot, type SlotCtx } from '../plan/sessions';
import { TEST_NOTES } from '../plan/tests';
import type { LineId } from '../plan/types';
import { deloadLine, plancheCut } from './deload';
import { deriveFacts } from './facts';
import type { LineCtx, SessionOptions, StateMap } from './rules';
import type { CheckIn, EngineInput, LinePrescription, Position, Target, TargetKind, TimelineDay } from './types';

export interface SessionPrescription {
  key: string;
  pos: Position;
  kind: DayKind;
  weekKind: WeekKind;
  weekSeq: number;
  title: string;
  warmup: boolean;
  lines: LinePrescription[];
  notes: string[];
}

type PlanInput = Pick<EngineInput, 'settings' | 'baselines' | 'checkins'>;

export function makeCtx(day: TimelineDay, states: StateMap, input: PlanInput, options: SessionOptions = {}): LineCtx {
  return {
    pos: day.pos,
    block: blockOf(day.pos.week),
    blockWeek: blockWeekOf(day.pos.week),
    dayKind: day.kind,
    weekSeq: day.weekSeq,
    settings: input.settings,
    baselines: input.baselines,
    states,
    prior: {},
    options,
  };
}

/** Lets lines react to the session's week before anything is prescribed (handstand weekly +5 s). */
export function runBeforeSession(states: StateMap, day: TimelineDay, input: PlanInput): StateMap {
  const ctx = makeCtx(day, states, input);
  const next = { ...states };
  for (const def of Object.values(LINES)) {
    if (def.beforeSession) next[def.id] = def.beforeSession(next[def.id], ctx);
  }
  return next;
}

export const planchePainActive = (checkins: CheckIn[], weekSeq: number) =>
  checkins.some((c) => c.planchePain && weekSeq > c.weekSeq && weekSeq <= c.weekSeq + 2);

const PROGRESS_KINDS: TargetKind[] = ['reps', 'hold', 'emom', 'total'];

export function dayTitle(kind: DayKind, day: number): string {
  if (kind === 'off') return DAYS[day]!.name;
  if (kind === 'testPush' || kind === 'testPull' || kind === 'testSkill') return TEST_DAYS[kind].name;
  const t = DAYS[day]!;
  const title = `${t.name} (${t.focus})`;
  return kind === 'deload' ? `${t.name} · deload` : title;
}

function slotsFor(kind: DayKind, day: number): Slot[] {
  if (kind === 'off') return [];
  if (kind === 'testPush' || kind === 'testPull' || kind === 'testSkill') return TEST_DAYS[kind].slots;
  return DAYS[day]!.slots;
}

function toPrescription(id: LineId, t: Target, slot: Slot, dayKind: DayKind, input: PlanInput): LinePrescription {
  const ex = EXERCISES[t.exercise];
  const def = LINES[id];
  // Flag holds become two holds per set when you flag on both sides [D34].
  const bilateral =
    t.bilateral ?? (ex.sided && input.settings.flagSides === 'both' && t.kind === 'hold' && !t.side ? 'side' : undefined);
  const counts = dayKind === 'training' || slot.keepInDeload === true;
  const progresses = def.progressive && PROGRESS_KINDS.includes(t.kind) && counts;
  return {
    ...t,
    bilateral,
    line: id,
    name: t.name ?? ex.name,
    // A working-set cue ("~65% of your max") is wrong on a max attempt: show the standard that ends it.
    cue: t.kind === 'maxHold' ? `Max effort. ${STANDARDS[ex.standard]}` : t.kind === 'amrap' ? `Max clean reps. ${STANDARDS[ex.standard]}` : ex.cue,
    rir: RIR_OVERRIDES[id] ?? slot.rir,
    restSec: slot.rest,
    restAfterSec: slot.restAfter ?? slot.rest,
    askEffort: progresses && !!t.rateable,
    progresses,
    isTest: t.kind === 'maxHold' || t.kind === 'amrap' || id.startsWith('test'),
    askBarHeight: slot.askBarHeight,
    askEndedBy: slot.askEndedBy,
    endOnNotClean: id === 'pushup90',
    notCleanLabel: ex.notCleanLabel,
  };
}

/** Day 3's optional easy handstand practice as a one-line session, logged as 'extra' [D63]. */
export function extraPracticePrescription(day: TimelineDay, states: StateMap, input: PlanInput): SessionPrescription {
  const t = LINES.practiceShort.target(states.practiceShort, makeCtx(day, states, input))!;
  const line = toPrescription('practiceShort', t, { line: 'practiceShort', rest: 0 }, 'training', input);
  return {
    key: 'extra',
    pos: day.pos,
    kind: day.kind,
    weekKind: day.weekKind,
    weekSeq: day.weekSeq,
    title: 'Easy handstand practice',
    warmup: false,
    lines: [{ ...line, restAfterSec: 0, progresses: false, askEffort: false }],
    notes: [],
  };
}

export function prescribeDay(
  day: TimelineDay,
  states: StateMap,
  input: PlanInput,
  options: SessionOptions = {},
): SessionPrescription {
  const ctx = makeCtx(day, states, input, options);
  const slotCtx: SlotCtx = { block: ctx.block, blockWeek: ctx.blockWeek, settings: input.settings, facts: deriveFacts(states) };
  const deload = day.kind === 'deload';
  const pain = planchePainActive(input.checkins, day.weekSeq);
  const lines: LinePrescription[] = [];

  for (const slot of slotsFor(day.kind, day.pos.day)) {
    if (slot.when && !slot.when(slotCtx)) continue;
    const id = typeof slot.line === 'function' ? slot.line(slotCtx) : slot.line;
    const t = LINES[id].target(states[id], { ...ctx, slotSets: slot.sets });
    if (!t) continue;
    ctx.prior[id] = t;
    let p: LinePrescription | null = toPrescription(id, t, slot, day.kind, input);
    if (deload && !slot.keepInDeload) p = slot.maxAttempt ? null : deloadLine(p);
    if (p && pain && slot.planche) p = plancheCut(p);
    if (p) lines.push(p);
  }
  if (lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1]!, restAfterSec: 0 };

  const notes: string[] = [];
  if (day.kind.startsWith('test')) notes.push(...TEST_NOTES);
  if (deload) notes.push('Deload: same exercises, half the sets, RIR 4, no max attempts. Abs and handstand practice as normal.');
  if (pain && lines.some((l) => l.note?.includes('pain rule'))) notes.push('Planche pain rule active: planche volume cut by 50%.');

  return {
    key: day.key,
    pos: day.pos,
    kind: day.kind,
    weekKind: day.weekKind,
    weekSeq: day.weekSeq,
    title: dayTitle(day.kind, day.pos.day),
    warmup: lines.length > 0,
    lines,
    notes,
  };
}
