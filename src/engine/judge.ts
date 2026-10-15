import type { LinePrescription, LineResult, Outcome, SetResult, Side } from './types';

/**
 * Success rule (PLAN_SPEC §7.1, [D03]): per line, every prescribed set completed at the
 * prescribed reps, seconds and load, every set clean, and no Hard rating where one is asked.
 */
export function judge(p: LinePrescription, r: LineResult | undefined): Outcome {
  const attempted = !!r && r.status !== 'skipped' && (r.sets.length > 0 || (r.attempts?.length ?? 0) > 0);
  if (!r || !attempted) return { prescription: p, result: r, success: false, below: false, attempted: false };
  const met = meets(p, r);
  const complete = r.status === 'complete';
  return {
    prescription: p,
    result: r,
    attempted,
    success: complete && met && !(p.askEffort && r.effort === 'hard'),
    // "Completed below prescription" counts only for lines that ran to the end [D49].
    below: complete && p.progresses && !met,
  };
}

function meets(p: LinePrescription, r: LineResult): boolean {
  const find = (i: number, side?: Side): SetResult | undefined =>
    r.sets.find((s) => s.set === i && s.side === side) ??
    (side ? r.sets.find((s) => s.set === i && s.side === undefined) : undefined);

  const ok = (s: SetResult | undefined, need: { reps?: number; seconds?: number }) =>
    !!s &&
    s.clean &&
    (need.reps === undefined || (s.reps ?? 0) >= need.reps) &&
    (need.seconds === undefined || (s.seconds ?? 0) >= need.seconds) &&
    (p.load === undefined || (s.load ?? p.load) >= p.load);

  const sides: Side[] = ['L', 'R'];

  switch (p.kind) {
    case 'reps':
      return p.reps!.every((n, i) => (p.perSide ? sides.every((sd) => ok(find(i, sd), { reps: n })) : ok(find(i), { reps: n })));
    case 'hold':
      return p.seconds!.every((n, i) =>
        p.bilateral ? sides.every((sd) => ok(find(i, sd), { seconds: n })) : ok(find(i, p.side), { seconds: n }),
      );
    case 'emom':
      return Array.from({ length: p.emom!.rounds }, (_, i) => i).every((i) => ok(find(i), { reps: p.emom!.reps }));
    case 'total':
      return r.sets.filter((s) => s.clean).reduce((sum, s) => sum + (s.reps ?? 0), 0) >= p.total!.target;
    default:
      return true;
  }
}
