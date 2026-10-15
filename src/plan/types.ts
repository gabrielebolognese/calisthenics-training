// Types for the plan as data. Every value in src/plan traces back to PLAN_SPEC.md.

export type StandardKey =
  | 'hspu'
  | 'pushup90'
  | 'archer'
  | 'handstand'
  | 'frontLever'
  | 'flag'
  | 'muscleUp'
  | 'planche'
  | 'tempo';

export type ExerciseId =
  | 'handstand'
  | 'handstandPractice'
  | 'chestToWall'
  | 'plancheOneLeg'
  | 'plancheAdvTuck'
  | 'plancheHalfStraddle'
  | 'plancheBandStraddle'
  | 'plancheLight'
  | 'pushup90'
  | 'hold90'
  | 'negative90'
  | 'archerHspu'
  | 'hspu'
  | 'pseudoPlanchePushup'
  | 'dips'
  | 'highPull'
  | 'weightedMu'
  | 'ntMu'
  | 'flCluster'
  | 'flRaise'
  | 'weightedPullup'
  | 'flag'
  | 'muscleUp'
  | 'flOneLeg'
  | 'flStraddle'
  | 'tuckFlRow'
  | 'pullup'
  | 'flagStraddle'
  | 'flagNegative'
  | 'flagStraightBar'
  | 'declineCrunch'
  | 'legRaise'
  | 'dragonFlagNeg'
  | 'dragonFlag'
  | 'abWheel'
  | 'lSit'
  | 'weightedCrunch';

export type ExerciseType = 'reps' | 'hold' | 'perSideReps' | 'perLegHold' | 'emom' | 'practice' | 'attempts';

export interface Exercise {
  id: ExerciseId;
  name: string;
  type: ExerciseType;
  /** The short note from the PDF session tables. */
  cue: string;
  standard: StandardKey;
  weighted?: boolean;
  /** Flag family: done on one side, or both when Settings says so. */
  sided?: boolean;
  /** How a rep that misses the standard is logged (PDF rep standards). */
  notCleanLabel?: string;
}

export type GoalId =
  | 'hspu'
  | 'pushup90'
  | 'archer'
  | 'handstand'
  | 'frontLever'
  | 'flag'
  | 'muscleUp'
  | 'ntMuscleUp'
  | 'planche'
  | 'abs';

/** Progression lines. One exercise can have several lines (HSPU per block) and one line can change exercise (stages). */
export type LineId =
  // Day 1
  | 'handstand'
  | 'plancheOneLeg'
  | 'plancheAdvTuck'
  | 'plancheHalfStraddle'
  | 'plancheBandStraddle'
  | 'pushup90'
  | 'archer'
  | 'archerAssisted'
  | 'pseudoPlanche'
  // Day 2
  | 'ntMu'
  | 'highPull'
  | 'weightedMu'
  | 'flCluster'
  | 'flRaise'
  | 'weightedPullup'
  | 'flag'
  | 'flagBalance2'
  // Day 4
  | 'handstandMax'
  | 'hspuB1'
  | 'hspuB2'
  | 'hspuB3'
  | 'hold90'
  | 'negative90'
  | 'dips'
  // Day 5
  | 'muEmom'
  | 'muTotal30'
  | 'muTotal40'
  | 'flDuration'
  | 'tuckRow'
  | 'pullup'
  | 'flagStraddle'
  | 'flagBalance5'
  | 'flagNegative'
  // Day 6 and Day 3
  | 'handstandPractice'
  | 'practiceShort'
  | 'chestToWall'
  | 'plancheLight'
  | 'flagStraightBar'
  // Abs
  | 'declineCrunch'
  | 'legRaise'
  | 'dragonFlag'
  | 'abWheel'
  | 'lSit'
  | 'weightedCrunch'
  // Tests
  | 'testHandstand'
  | 'test90'
  | 'testArcherL'
  | 'testArcherR'
  | 'testHspu'
  | 'testFrontLever'
  | 'testMuscleUp'
  | 'testFlag'
  | 'testFlagOther'
  | 'testPlancheHalfStraddle'
  | 'testPlancheOneLegL'
  | 'testPlancheOneLegR'
  | 'testPlancheAdvTuck'
  | 'testNtMu';
