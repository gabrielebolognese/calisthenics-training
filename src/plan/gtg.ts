// PLAN_SPEC §11. GTG: optional, Day 3 and Day 6 only, never in deload or test weeks, no alarms.
export const GTG_DAYS = [3, 6];
export const GTG_ROWS = 5;
export const GTG_FRACTION = 0.4;
/** "Run it in 4-week blocks, then decide whether to keep it" [D54]. */
export const GTG_BLOCK_WEEKS = 4;

export const gtgReps = (max: number) => Math.max(1, Math.round(GTG_FRACTION * max));
