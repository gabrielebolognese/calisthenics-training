// PLAN_SPEC §9. Test lines: no progression, results feed Progress, the handstand base and GTG.
import { fixedLine, type LineDef } from '../engine/rules';
import type { GoalId, LineId } from './types';

export const TEST_NOTES = [
  'Same time of day, same surface, full warm-up, film every attempt.',
  'Count only reps that pass the rep standards.',
];

export const TEST_LINES: LineDef[] = [
  fixedLine('testHandstand', { exercise: 'handstand', kind: 'maxHold', name: 'Handstand max' }),
  fixedLine('test90', { exercise: 'pushup90', kind: 'amrap', name: '90 degree push-up max' }),
  fixedLine('testArcherL', { exercise: 'archerHspu', kind: 'amrap', side: 'L', name: 'Archer HSPU max, left' }),
  fixedLine('testArcherR', { exercise: 'archerHspu', kind: 'amrap', side: 'R', name: 'Archer HSPU max, right' }),
  fixedLine('testHspu', { exercise: 'hspu', kind: 'amrap', name: 'HSPU AMRAP' }),
  fixedLine('testFrontLever', { exercise: 'flCluster', kind: 'maxHold', name: 'Front lever max hold' }),
  fixedLine('testMuscleUp', { exercise: 'muscleUp', kind: 'amrap', name: 'Muscle-up AMRAP' }),
  fixedLine('testFlag', { exercise: 'flag', kind: 'maxHold', name: 'Human flag max' }),
  fixedLine('testFlagOther', { exercise: 'flag', kind: 'maxHold', name: 'Human flag max, other side' }),
  fixedLine('testPlancheHalfStraddle', { exercise: 'plancheHalfStraddle', kind: 'maxHold', name: 'Half-straddle planche max' }),
  fixedLine('testPlancheOneLegL', { exercise: 'plancheOneLeg', kind: 'maxHold', side: 'L', name: 'One-leg planche max, left leg' }),
  fixedLine('testPlancheOneLegR', { exercise: 'plancheOneLeg', kind: 'maxHold', side: 'R', name: 'One-leg planche max, right leg' }),
  fixedLine('testPlancheAdvTuck', { exercise: 'plancheAdvTuck', kind: 'maxHold', name: 'Adv tuck planche max' }),
  fixedLine('testNtMu', { exercise: 'ntMu', kind: 'attempts', attempts: 3, name: 'No-transition muscle-up attempts' }),
];

/** Which goal each result counts toward (tests, the weekly handstand max, the week 22 MU AMRAP). */
export const RESULT_GOALS: Partial<Record<LineId, { goal: GoalId; source: 'test' | 'training'; level?: string; side?: 'L' | 'R' }>> = {
  testHandstand: { goal: 'handstand', source: 'test' },
  handstandMax: { goal: 'handstand', source: 'training' },
  test90: { goal: 'pushup90', source: 'test' },
  testArcherL: { goal: 'archer', source: 'test', side: 'L' },
  testArcherR: { goal: 'archer', source: 'test', side: 'R' },
  testHspu: { goal: 'hspu', source: 'test' },
  testFrontLever: { goal: 'frontLever', source: 'test' },
  testMuscleUp: { goal: 'muscleUp', source: 'test' },
  muTotal40: { goal: 'muscleUp', source: 'test' },
  testFlag: { goal: 'flag', source: 'test' },
  testFlagOther: { goal: 'flag', source: 'test', side: 'R' },
  testPlancheHalfStraddle: { goal: 'planche', source: 'test', level: 'Half-straddle' },
  testPlancheOneLegL: { goal: 'planche', source: 'test', level: 'One-leg', side: 'L' },
  testPlancheOneLegR: { goal: 'planche', source: 'test', level: 'One-leg', side: 'R' },
  testPlancheAdvTuck: { goal: 'planche', source: 'test', level: 'Adv tuck' },
  testNtMu: { goal: 'ntMuscleUp', source: 'test' },
};
