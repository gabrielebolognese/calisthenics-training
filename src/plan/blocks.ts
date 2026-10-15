// PLAN_SPEC §3. Three 8-week blocks: 7 loading weeks, then 1 deload and test week.

export const WEEKS_PER_BLOCK = 8;
export const BLOCK_COUNT = 3;
export const CYCLE_WEEKS = WEEKS_PER_BLOCK * BLOCK_COUNT;
export const DAYS_PER_WEEK = 7;

export const BLOCKS = [
  { block: 1, name: 'Base', focus: 'Volume at moderate intensity', changes: 'Double progression everywhere, +5 kg weighted work, one-leg planche and one-leg lever' },
  { block: 2, name: 'Intensity', focus: 'Heavier and denser', changes: 'Total-reps method for HSPU and MU, +10 kg MU, straddle lever, half-straddle planche' },
  { block: 3, name: 'Peak', focus: 'Quality and top sets', changes: 'Higher rep totals, top sets, no-transition MU attempts, longer holds' },
] as const;

export const blockOf = (week: number) => Math.ceil(week / WEEKS_PER_BLOCK);
export const blockWeekOf = (week: number) => ((week - 1) % WEEKS_PER_BLOCK) + 1;
export const isTestWeek = (week: number) => week % WEEKS_PER_BLOCK === 0;

export const OFF_DAYS = [3, 7];

export type WeekKind = 'loading' | 'deloadTest' | 'insertedDeload';
export type DayKind = 'training' | 'off' | 'deload' | 'testPush' | 'testPull' | 'testSkill';

/** Day mapping inside each kind of week (PLAN_SPEC §8, [B], [D44], [D45]). */
export function dayKindFor(weekKind: WeekKind, day: number): DayKind {
  if (OFF_DAYS.includes(day)) return 'off';
  if (weekKind === 'loading') return 'training';
  if (weekKind === 'insertedDeload') return 'deload';
  if (day === 4) return 'testPush';
  if (day === 5) return 'testPull';
  if (day === 6) return 'testSkill';
  return 'deload';
}
