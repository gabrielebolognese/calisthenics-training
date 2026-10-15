// Test points and maxes for Progress, GTG and the next-cycle baselines.
import { RESULT_GOALS } from '../plan/tests';
import type { GoalId } from '../plan/types';
import type { LocalDate } from './dates';
import type { Baselines, LineResult, Side, TimelineDay } from './types';

export interface TestPoint {
  goal: GoalId;
  value: number;
  side?: Side;
  level?: string;
  date: LocalDate;
  weekSeq: number;
  cycle: number;
  week: number;
  source: 'week0' | 'test' | 'training';
}

function valueOf(r: LineResult): number | null {
  if (r.status === 'skipped') return null;
  if (r.attempts) return r.attempts.some(Boolean) ? 1 : 0;
  const clean = r.sets.filter((s) => s.clean);
  if (!clean.length) return r.sets.length ? 0 : null;
  if (clean.some((s) => s.seconds !== undefined)) return Math.max(...clean.map((s) => s.seconds ?? 0));
  return clean.reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function week0Points(b: Baselines): TestPoint[] {
  const at = { date: b.startDate, weekSeq: 0, cycle: 1, week: 0, source: 'week0' as const };
  return [
    { goal: 'hspu', value: b.hspu, ...at },
    { goal: 'pushup90', value: b.pushup90, ...at },
    { goal: 'archer', value: b.archer, ...at },
    { goal: 'handstand', value: b.handstand, ...at },
    { goal: 'frontLever', value: b.frontLeverBad, ...at },
    { goal: 'flag', value: b.flag, ...at },
    { goal: 'muscleUp', value: b.muscleUp, ...at },
  ];
}

export function extractTests(done: TimelineDay[], b: Baselines): TestPoint[] {
  const points = week0Points(b);
  for (const d of done) {
    if (!d.session) continue;
    for (const r of d.session.lines) {
      const map = RESULT_GOALS[r.line];
      if (!map) continue;
      // The muscle-up total line is a test only on its week 22 AMRAP day.
      if (r.line === 'muTotal40' && !(d.pos.week === 22 && d.kind === 'training')) continue;
      const value = valueOf(r);
      if (value === null) continue;
      points.push({
        goal: map.goal,
        value,
        side: map.side,
        level: map.level,
        date: d.date!,
        weekSeq: d.weekSeq,
        cycle: d.pos.cycle,
        week: d.pos.week,
        source: map.source,
      });
    }
  }
  return points;
}

/** Latest test (or week 0) value per goal. For archer, the lower side of the latest test. */
export function latestTest(points: TestPoint[], goal: GoalId): number {
  const tests = points.filter((p) => p.goal === goal && p.source !== 'training');
  if (!tests.length) return 0;
  const last = tests[tests.length - 1]!;
  const same = tests.filter((p) => p.weekSeq === last.weekSeq);
  return goal === 'archer' ? Math.min(...same.map((p) => p.value)) : last.value;
}
