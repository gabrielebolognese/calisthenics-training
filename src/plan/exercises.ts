import type { Exercise, ExerciseId, StandardKey } from './types';

// PLAN_SPEC §2.1 (PDF p.2). "tempo" is the fallback for exercises without a standard [D10].
export const STANDARDS: Record<StandardKey, string> = {
  hspu: 'Head reaches the same depth every rep, full lockout at the top, no kip.',
  pushup90:
    'Start and end in a handstand, lower until the body is horizontal, press back up. A rep that stops at 80 degrees is logged as partial, not counted.',
  archer: 'The extended arm stays fully straight. Bent-arm reps are logged as assisted, not counted.',
  handstand: 'The clock stops at the first step, hand shift or broken line.',
  frontLever: 'Straight arms, hips in line with shoulders. The clock stops when the hips drop.',
  flag: 'Body parallel to the ground (within about 10 degrees).',
  muscleUp: 'Dead hang start, no kip, no chicken wing, full dip lockout.',
  planche:
    'Straight arms, shoulders protracted, hips at shoulder height. Adv tuck counts only with a flat back.',
  tempo: 'Controlled, about 2 s down. Negatives: 3 to 5 s down. Stop at the RIR shown.',
};

/** Shown under "How?" with every standard (PLAN_SPEC §2.2). */
export const EFFORT_RULES = [
  'Strength and rep work: stop at the RIR written for each exercise, usually 1 to 3.',
  'Holds: end the set 1 to 2 s before form breaks.',
  'Failure is only allowed on test days and on abs (RIR 0 to 1).',
  'If a set turns ugly, end it.',
];

const ex = (e: Exercise): Exercise => e;

// PLAN_SPEC §5.
export const EXERCISES: Record<ExerciseId, Exercise> = {
  handstand: ex({ id: 'handstand', name: 'Freestanding handstand', type: 'hold', cue: '~65% of your max', standard: 'handstand' }),
  handstandPractice: ex({ id: 'handstandPractice', name: 'Handstand practice', type: 'practice', cue: 'Balance quality, no max attempts', standard: 'handstand' }),
  chestToWall: ex({ id: 'chestToWall', name: 'Chest-to-wall handstand', type: 'hold', cue: 'Shoulder endurance: your last max ended at the shoulders', standard: 'handstand' }),
  plancheOneLeg: ex({ id: 'plancheOneLeg', name: 'One-leg planche', type: 'perLegHold', cue: 'Stop before hips drop', standard: 'planche' }),
  plancheAdvTuck: ex({ id: 'plancheAdvTuck', name: 'Adv tuck planche', type: 'hold', cue: 'Flat back only', standard: 'planche' }),
  plancheHalfStraddle: ex({ id: 'plancheHalfStraddle', name: 'Half-straddle planche', type: 'hold', cue: 'Stop before hips drop', standard: 'planche' }),
  plancheBandStraddle: ex({ id: 'plancheBandStraddle', name: 'Band-assisted straddle planche', type: 'hold', cue: 'Band under the hips', standard: 'planche' }),
  plancheLight: ex({ id: 'plancheLight', name: 'Planche, light', type: 'perLegHold', cue: 'Effort about 6 out of 10', standard: 'planche' }),
  pushup90: ex({ id: 'pushup90', name: '90 degree push-up', type: 'emom', cue: 'Stop the block if a rep drops to 80 degrees', standard: 'pushup90', notCleanLabel: 'Partial (80°)' }),
  hold90: ex({ id: 'hold90', name: '90 degree hold', type: 'hold', cue: 'Static at the horizontal position', standard: 'pushup90' }),
  negative90: ex({ id: 'negative90', name: '90 degree negative', type: 'reps', cue: 'From handstand to horizontal, 5 s down', standard: 'pushup90' }),
  archerHspu: ex({ id: 'archerHspu', name: 'Archer HSPU', type: 'perSideReps', cue: 'Straight extended arm. First rep each side: 3 s down', standard: 'archer', notCleanLabel: 'Bent arm (assisted)' }),
  hspu: ex({ id: 'hspu', name: 'HSPU', type: 'reps', cue: 'Main rep builder', standard: 'hspu' }),
  pseudoPlanchePushup: ex({ id: 'pseudoPlanchePushup', name: 'Pseudo planche push-ups', type: 'reps', cue: 'Shoulders ahead of hands', standard: 'tempo' }),
  dips: ex({ id: 'dips', name: 'Straight bar dips', type: 'reps', cue: 'Carries over to muscle-up lockout', standard: 'tempo' }),
  highPull: ex({ id: 'highPull', name: 'Explosive high pull-ups', type: 'reps', cue: 'Pull the bar to lower chest or higher, done fresh', standard: 'tempo' }),
  weightedMu: ex({ id: 'weightedMu', name: 'Weighted muscle-up', type: 'reps', cue: 'Dip belt or backpack', standard: 'muscleUp', weighted: true }),
  ntMu: ex({ id: 'ntMu', name: 'No-transition muscle-up', type: 'attempts', cue: 'Fresh, before everything else', standard: 'muscleUp' }),
  flCluster: ex({ id: 'flCluster', name: 'Front lever clusters', type: 'hold', cue: 'Full lever, ~60% of a 5 s bad day', standard: 'frontLever' }),
  flRaise: ex({ id: 'flRaise', name: 'Front lever raises', type: 'reps', cue: 'From inverted hang to lever, slow', standard: 'frontLever' }),
  weightedPullup: ex({ id: 'weightedPullup', name: 'Weighted pull-ups', type: 'reps', cue: 'Pick the load where 5 reps leave 2 in the tank', standard: 'tempo', weighted: true }),
  flag: ex({ id: 'flag', name: 'Human flag (monkey bars)', type: 'hold', cue: 'Both sides if you train both', standard: 'flag', sided: true }),
  muscleUp: ex({ id: 'muscleUp', name: 'Muscle-up', type: 'emom', cue: 'Main rep builder, RIR 2+', standard: 'muscleUp' }),
  flOneLeg: ex({ id: 'flOneLeg', name: 'One-leg front lever', type: 'perLegHold', cue: 'Longer holds at an easier level', standard: 'frontLever' }),
  flStraddle: ex({ id: 'flStraddle', name: 'Straddle front lever', type: 'hold', cue: 'Longer holds at an easier level', standard: 'frontLever' }),
  tuckFlRow: ex({ id: 'tuckFlRow', name: 'Tuck front lever rows', type: 'reps', cue: 'Pull to the bar keeping the lever line', standard: 'frontLever' }),
  pullup: ex({ id: 'pullup', name: 'Pull-ups', type: 'reps', cue: 'Endurance base for muscle-ups', standard: 'tempo' }),
  flagStraddle: ex({ id: 'flagStraddle', name: 'Straddle flag', type: 'hold', cue: 'Easier level, longer holds', standard: 'flag', sided: true }),
  flagNegative: ex({ id: 'flagNegative', name: 'Flag negative', type: 'reps', cue: 'Lower from vertical to horizontal, slow', standard: 'flag' }),
  flagStraightBar: ex({ id: 'flagStraightBar', name: 'Flag on straight bar', type: 'attempts', cue: 'Skill practice, not effort. Same hand spacing as on monkey bars', standard: 'flag' }),
  declineCrunch: ex({ id: 'declineCrunch', name: 'Weighted decline crunch or sit-up', type: 'reps', cue: 'Plate on chest', standard: 'tempo', weighted: true }),
  legRaise: ex({ id: 'legRaise', name: 'Strict hanging leg raise', type: 'reps', cue: 'No swing, toes to bar when possible', standard: 'tempo' }),
  dragonFlagNeg: ex({ id: 'dragonFlagNeg', name: 'Dragon flag negatives', type: 'reps', cue: '5 s down. Full dragon flags once negatives are easy', standard: 'tempo' }),
  dragonFlag: ex({ id: 'dragonFlag', name: 'Dragon flag', type: 'reps', cue: 'Full range, controlled', standard: 'tempo' }),
  abWheel: ex({ id: 'abWheel', name: 'Ab wheel rollout', type: 'reps', cue: 'Knees first, then standing', standard: 'tempo' }),
  lSit: ex({ id: 'lSit', name: 'L-sit compression', type: 'hold', cue: 'Supports handstand and press work', standard: 'tempo' }),
  weightedCrunch: ex({ id: 'weightedCrunch', name: 'Weighted crunch', type: 'reps', cue: 'Plate on chest', standard: 'tempo', weighted: true }),
};
