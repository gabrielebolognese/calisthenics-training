// PLAN_SPEC §10. Abs: 10 to 14 hard sets per week, 6 to 15 reps, RIR 0 to 1.
import { stagedLine, type LineDef } from '../engine/rules';

export const ABS_RIR = '0–1';

export const ABS_LINES: LineDef[] = [
  // Abs A (Day 1). +5 kg when all sets reach 12, back to 3x8 [D37].
  stagedLine('declineCrunch', [
    {
      exercise: 'declineCrunch',
      rule: { type: 'dp', start: [8, 8, 8], top: 12, load: { start: 5, step: 5 }, onTop: 'addLoad' },
    },
  ]),
  // Strict leg raise → toes to bar → toes to bar with slow negatives [D38].
  stagedLine('legRaise', [
    { exercise: 'legRaise', name: 'Strict hanging leg raise', rule: { type: 'dp', start: [8, 8, 8], top: 12 }, next: 'top' },
    { exercise: 'legRaise', name: 'Toes to bar', rule: { type: 'dp', start: [8, 8, 8], top: 12 }, next: 'top' },
    {
      exercise: 'legRaise',
      name: 'Toes to bar, slow negatives',
      note: '3 to 5 s down',
      rule: { type: 'dp', start: [8, 8, 8], top: 12 },
    },
  ]),
  // Abs B (Day 4). Negatives until rated Easy, then full dragon flags 3x3 → 3x5 [D39].
  stagedLine('dragonFlag', [
    {
      exercise: 'dragonFlagNeg',
      rule: { type: 'fixed', target: { kind: 'reps', reps: [5, 5, 5], note: '5 s down' } },
      next: 'easy',
    },
    { exercise: 'dragonFlag', rule: { type: 'dp', start: [3, 3, 3], top: 5 } },
  ]),
  // Only if you have an ab wheel (Settings). Knees, then standing [D40].
  stagedLine('abWheel', [
    { exercise: 'abWheel', name: 'Ab wheel rollout (knees)', rule: { type: 'dp', start: [8, 8], top: 12 }, next: 'top' },
    { exercise: 'abWheel', name: 'Ab wheel rollout (standing)', rule: { type: 'dp', start: [8, 8], top: 12 } },
  ]),
  // Abs C (Day 6). L-sit 4x10 → 4x15 s, then V-sit [D41].
  stagedLine('lSit', [
    { exercise: 'lSit', name: 'L-sit compression', rule: { type: 'time', sets: 4, start: 10, cap: 15 }, next: 'top' },
    { exercise: 'lSit', name: 'V-sit compression', rule: { type: 'time', sets: 4, start: 10, cap: 15 } },
  ]),
  stagedLine('weightedCrunch', [
    {
      exercise: 'weightedCrunch',
      rule: { type: 'dp', start: [10, 10, 10], top: 15, load: { start: 5, step: 5 }, onTop: 'addLoad' },
    },
  ]),
];
