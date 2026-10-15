// PLAN_SPEC §6 (session tables) and §9 (test days). Rest in seconds.
import { ABS_RIR } from './abs';
import type { DayKind } from './blocks';
import type { LineId } from './types';
import type { Settings } from '../engine/types';

/** Facts derived from line states that decide which slots appear. */
export interface Facts {
  /** One-leg planche 6x5 s clean on both legs: adv tuck is replaced [D27]. */
  plancheSwitched: boolean;
  /** No-transition attempts unlocked [D36]. */
  ntUnlocked: boolean;
  /** Last handstand max ended at the shoulders [D31]. */
  chestToWall: boolean;
}

export interface SlotCtx {
  block: number;
  blockWeek: number;
  settings: Settings;
  facts: Facts;
}

export interface Slot {
  line: LineId | ((c: SlotCtx) => LineId);
  /** Rest between sets. */
  rest: number;
  /** Rest after the last set, before the next line. Default: rest [D07]. */
  restAfter?: number;
  rir?: string;
  /** Set count override. */
  sets?: number;
  when?: (c: SlotCtx) => boolean;
  /** Max attempts are dropped in deload weeks. */
  maxAttempt?: boolean;
  /** Straight-arm planche: halved by the planche pain rule [D51]. */
  planche?: boolean;
  /** Abs and handstand practice stay normal in deload weeks. */
  keepInDeload?: boolean;
  askBarHeight?: boolean;
  askEndedBy?: boolean;
}

export interface DayTemplate {
  day: number;
  name: string;
  focus: string;
  /** Session length from the PDF table. */
  minutes: string;
  slots: Slot[];
}

const switched = (c: SlotCtx) => c.facts.plancheSwitched;
const oneSide = (c: SlotCtx) => c.settings.flagSides === 'one';

const ABS_A: Slot[] = [
  { line: 'declineCrunch', rest: 60, rir: ABS_RIR, keepInDeload: true },
  { line: 'legRaise', rest: 60, rir: ABS_RIR, keepInDeload: true },
];
const ABS_B: Slot[] = [
  { line: 'dragonFlag', rest: 60, rir: ABS_RIR, keepInDeload: true },
  { line: 'abWheel', rest: 60, rir: ABS_RIR, keepInDeload: true, when: (c) => c.settings.abWheel },
];
const ABS_C: Slot[] = [
  { line: 'lSit', rest: 60, keepInDeload: true },
  { line: 'weightedCrunch', rest: 60, rir: ABS_RIR, keepInDeload: true },
];

export const DAYS: Record<number, DayTemplate> = {
  1: {
    day: 1,
    name: 'Push A',
    focus: 'intensity',
    minutes: '~70 min',
    slots: [
      { line: 'handstand', rest: 90, sets: 4 },
      { line: 'plancheOneLeg', rest: 120, planche: true },
      { line: 'plancheAdvTuck', rest: 120, planche: true, when: (c) => !switched(c) },
      { line: 'plancheHalfStraddle', rest: 120, planche: true, when: switched },
      { line: 'plancheBandStraddle', rest: 120, planche: true, when: (c) => switched(c) && c.settings.bands },
      { line: 'pushup90', rest: 0, restAfter: 120 },
      { line: 'archer', rest: 180, rir: '1–3' },
      { line: 'archerAssisted', rest: 180, when: (c) => c.settings.archerAssistedSet },
      { line: 'pseudoPlanche', rest: 90, rir: '2' },
      ...ABS_A,
    ],
  },
  2: {
    day: 2,
    name: 'Pull A',
    focus: 'intensity',
    minutes: '~70 min',
    slots: [
      { line: 'ntMu', rest: 180, maxAttempt: true, when: (c) => c.facts.ntUnlocked },
      { line: 'highPull', rest: 120, rir: '1–3', askBarHeight: true },
      { line: 'weightedMu', rest: 180, rir: '1–3' },
      { line: 'flCluster', rest: 90 },
      { line: 'flRaise', rest: 120, rir: '1–3' },
      { line: 'weightedPullup', rest: 150, rir: '2' },
      { line: 'flag', rest: 90 },
      { line: 'flagBalance2', rest: 90, when: oneSide },
    ],
  },
  3: { day: 3, name: 'Off or tricking', focus: 'rest', minutes: '0 to 5 min', slots: [] },
  4: {
    day: 4,
    name: 'Push B',
    focus: 'volume',
    minutes: '~65 min',
    slots: [
      { line: 'handstandMax', rest: 120, maxAttempt: true, askEndedBy: true },
      { line: 'handstand', rest: 90, sets: 3 },
      { line: (c) => (c.block === 1 ? 'hspuB1' : c.block === 2 ? 'hspuB2' : 'hspuB3'), rest: 120, rir: '2' },
      { line: 'hold90', rest: 120 },
      { line: 'negative90', rest: 120 },
      { line: 'dips', rest: 90, rir: '2' },
      ...ABS_B,
    ],
  },
  5: {
    day: 5,
    name: 'Pull B',
    focus: 'volume',
    minutes: '~65 min',
    slots: [
      { line: (c) => (c.block === 1 ? 'muEmom' : c.block === 2 ? 'muTotal30' : 'muTotal40'), rest: 120, rir: '2' },
      { line: 'flDuration', rest: 120 },
      { line: 'tuckRow', rest: 90, rir: '1–3' },
      { line: 'pullup', rest: 120, rir: '2' },
      { line: 'flagStraddle', rest: 90 },
      { line: 'flagBalance5', rest: 90, when: oneSide },
      { line: 'flagNegative', rest: 90 },
    ],
  },
  6: {
    day: 6,
    name: 'Skill',
    focus: 'short',
    minutes: '~30 min',
    slots: [
      { line: 'handstandPractice', rest: 90, keepInDeload: true },
      { line: 'chestToWall', rest: 90, when: (c) => c.facts.chestToWall },
      { line: 'plancheLight', rest: 120, planche: true },
      { line: 'flagStraightBar', rest: 120 },
      ...ABS_C,
    ],
  },
  7: { day: 7, name: 'Off', focus: 'full rest', minutes: '0', slots: [] },
};

/** HSPU Block 1 is "RIR 2 to 3" in the PDF; later blocks are RIR 2. MU EMOM is "RIR 2+". */
export const RIR_OVERRIDES: Partial<Record<LineId, string>> = { hspuB1: '2–3', muEmom: '2+' };

export type TestDayKind = Extract<DayKind, 'testPush' | 'testPull' | 'testSkill'>;

const TEST_REST = 180; // [D08]

export const TEST_DAYS: Record<TestDayKind, { name: string; slots: Slot[] }> = {
  testPush: {
    name: 'Test day: push',
    slots: [
      { line: 'testHandstand', rest: TEST_REST, askEndedBy: true },
      { line: 'test90', rest: TEST_REST },
      { line: 'testArcherL', rest: TEST_REST },
      { line: 'testArcherR', rest: TEST_REST },
      { line: 'testHspu', rest: TEST_REST },
      ...ABS_B,
    ],
  },
  testPull: {
    name: 'Test day: pull',
    slots: [
      { line: 'testFrontLever', rest: TEST_REST },
      { line: 'testMuscleUp', rest: TEST_REST },
    ],
  },
  testSkill: {
    name: 'Test day: flag and planche',
    slots: [
      { line: 'testFlag', rest: TEST_REST },
      { line: 'testFlagOther', rest: TEST_REST, when: (c) => c.settings.flagSides === 'both' },
      { line: 'testPlancheHalfStraddle', rest: TEST_REST, when: switched },
      { line: 'testPlancheOneLegL', rest: TEST_REST },
      { line: 'testPlancheOneLegR', rest: TEST_REST },
      { line: 'testPlancheAdvTuck', rest: TEST_REST },
      { line: 'testNtMu', rest: TEST_REST, when: (c) => c.facts.ntUnlocked },
      { line: 'handstandPractice', rest: 90, keepInDeload: true },
      ...ABS_C,
    ],
  },
};
