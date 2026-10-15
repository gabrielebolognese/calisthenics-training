import type { GoalId } from './types';

// PLAN_SPEC §1 (PDF p.1). Numbers are what the app compares against; text is shown as written.
export interface Goal {
  id: GoalId;
  skill: string;
  unit: 'reps' | 'reps/side' | 's' | 'level' | 'text';
  week0: string;
  target: string;
  /** Lower bound of the target, used for the progress bar [D59]. */
  targetValue?: number;
  priority: string;
  realistic: string;
}

export const GOALS: Goal[] = [
  { id: 'hspu', skill: 'HSPU', unit: 'reps', week0: '11 reps (fatigued at 6)', target: '20 to 25', targetValue: 20, priority: 'Primary', realistic: '16 to 20' },
  { id: 'pushup90', skill: '90 degree push-up', unit: 'reps', week0: '2 clean (3rd at ~80 degrees)', target: '5+', targetValue: 5, priority: 'Primary', realistic: '4 to 5' },
  { id: 'archer', skill: 'Archer HSPU', unit: 'reps/side', week0: '2 per side clean (3 with bent arm)', target: '4 per side clean', targetValue: 4, priority: 'Primary', realistic: '3 to 4 per side' },
  { id: 'handstand', skill: 'Freestanding handstand', unit: 's', week0: '55 s', target: '120 s', targetValue: 120, priority: 'Primary', realistic: '90 to 120 s' },
  { id: 'frontLever', skill: 'Front lever', unit: 's', week0: '5 s (bad day) to 8 s (good day)', target: '20 to 30 s', targetValue: 20, priority: 'Primary, long term', realistic: '12 to 15 s' },
  { id: 'flag', skill: 'Human flag (monkey bars)', unit: 's', week0: '4 s', target: '10 to 15 s', targetValue: 10, priority: 'Primary', realistic: '8 to 12 s' },
  { id: 'muscleUp', skill: 'Muscle-up', unit: 'reps', week0: '7 reps', target: '20+', targetValue: 20, priority: 'Primary', realistic: '13 to 16' },
  { id: 'ntMuscleUp', skill: 'No-transition muscle-up', unit: 'text', week0: 'not yet', target: '1 clean rep', priority: 'Secondary', realistic: 'attempts start in Block 3' },
  { id: 'planche', skill: 'Planche', unit: 'level', week0: 'adv tuck, one-leg for a few seconds', target: 'full planche, a few clean seconds', priority: 'Secondary', realistic: 'clean one-leg, straddle work started' },
  { id: 'abs', skill: 'Abs', unit: 'text', week0: 'visible, not sharp', target: 'thicker and sharper', priority: 'Secondary', realistic: 'visibly sharper' },
];

/** Week 0 test values, preloaded at onboarding and editable there (PLAN_SPEC §1). */
export const WEEK0 = {
  hspu: 11,
  pushup90: 2,
  archer: 2,
  handstand: 55,
  frontLeverBad: 5,
  frontLeverGood: 8,
  flag: 4,
  muscleUp: 7,
  /** New exercise for you: start light, the calibration rule finds the real load [D24]. */
  weightedPullupLoad: 5,
} as const;

/** The PDF's bodyweight target, shown as a reference band on the chart [D60]. */
export const BODYWEIGHT_TARGET = 'Flat to −0.5 kg per month';
