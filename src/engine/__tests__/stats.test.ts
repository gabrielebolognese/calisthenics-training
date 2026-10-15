import { describe, expect, it } from 'vitest';
import type { ExerciseId, LineId } from '../../plan/types';
import { addDays } from '../dates';
import { computeStats, exerciseTotals, MAX_SESSION_MS, streak } from '../stats';
import type { SessionLog } from '../types';
import { makeInput, noon, runDays, simulate, START, todayAt, trainOn } from './helpers';

describe('streak [A06]', () => {
  it('counts every plan day kept, rest days included', () => {
    const input = makeInput();
    const { end } = simulate(input, 2);
    const s = streak(todayAt(input, end));
    expect(s).toEqual({ current: 14, best: 14, today: false });
  });

  it('counts today once the session is done', () => {
    const input = makeInput();
    const end = runDays(input, START, 2);
    const s = streak(todayAt(input, addDays(end, -1)));
    expect(s.today).toBe(true);
    expect(s.current).toBe(2);
  });

  it('counts a rest day as soon as it starts', () => {
    const input = makeInput();
    const end = runDays(input, START, 2); // Days 1 and 2; Day 3 is off.
    const t = todayAt(input, end);
    expect(t.walk.current.kind).toBe('off');
    expect(streak(t)).toEqual({ current: 3, best: 3, today: true });
  });

  it('a missed training day breaks it, and the best run is kept', () => {
    const input = makeInput();
    const end = runDays(input, START, 7);
    // Week 2 Day 1 skipped on its date, done the day after.
    trainOn(input, addDays(end, 1));
    const t = todayAt(input, addDays(end, 1));
    expect(streak(t)).toEqual({ current: 1, best: 7, today: true });
    // Without training today the streak is still alive until the date ends.
    expect(streak(todayAt(input, addDays(end, 2))).current).toBe(1);
    expect(streak(todayAt(input, addDays(end, 3))).current).toBe(0);
  });

  it('extra practice never counts', () => {
    const input = makeInput();
    input.sessions.push({ id: 'x', key: 'extra', date: START, startedAt: noon(START), finishedAt: noon(START) + 300_000, lines: [] });
    expect(streak(todayAt(input, addDays(START, 1))).current).toBe(0);
  });
});

describe('exercise totals [A08]', () => {
  const info: Partial<Record<LineId, { exercise: ExerciseId; perSide: boolean }>> = {
    hspuB1: { exercise: 'hspu', perSide: false },
    testHspu: { exercise: 'hspu', perSide: false },
    archer: { exercise: 'archerHspu', perSide: true },
    archerAssisted: { exercise: 'archerHspu', perSide: true },
    flag: { exercise: 'flag', perSide: false },
    ntMu: { exercise: 'ntMu', perSide: false },
    weightedPullup: { exercise: 'weightedPullup', perSide: false },
  };
  const session = (id: string, date: string, lines: SessionLog['lines']): SessionLog => ({
    id,
    key: id,
    date,
    startedAt: noon(date),
    finishedAt: noon(date) + 3_600_000,
    lines,
  });
  const sessions = [
    session('a', START, [
      {
        line: 'hspuB1',
        status: 'complete',
        sets: [
          { set: 0, reps: 5, clean: true },
          { set: 1, reps: 5, clean: true },
          { set: 2, reps: 4, clean: true },
          { set: 3, reps: 3, clean: false },
        ],
      },
      { line: 'archer', status: 'complete', sets: [{ set: 0, reps: 2, clean: true }] },
      { line: 'archerAssisted', status: 'complete', sets: [{ set: 0, reps: 3, clean: true }] },
      {
        line: 'flag',
        status: 'complete',
        sets: [
          { set: 0, seconds: 5, clean: true },
          { set: 1, seconds: 3, clean: false },
        ],
      },
      { line: 'ntMu', status: 'complete', sets: [], attempts: [true, false, false] },
      { line: 'weightedPullup', status: 'complete', sets: [{ set: 0, reps: 5, load: 10, clean: true }] },
      { line: 'hspuB1', status: 'skipped', sets: [] },
    ]),
    session('b', addDays(START, 7), [{ line: 'testHspu', status: 'complete', sets: [{ set: 0, reps: 6, clean: true }] }]),
  ];
  const totals = exerciseTotals(sessions, (_, l) => info[l] ?? null);
  const get = (k: string) => totals.find((t) => t.key === k)!;

  it('adds clean reps across sessions, tests included', () => {
    expect(get('hspu')).toMatchObject({ total: 20, sessions: 2, best: 6, unit: 'reps' });
    expect(get('hspu').points.map((p) => [p.value, p.cumulative])).toEqual([
      [14, 14],
      [6, 20],
    ]);
  });

  it('counts per-side reps on both sides and keeps assisted reps apart', () => {
    expect(get('archerHspu')).toMatchObject({ total: 4, best: 2, bestPerSide: true });
    expect(get('archerAssisted').total).toBe(6);
  });

  it('counts every second held, best from clean holds', () => {
    expect(get('flag')).toMatchObject({ unit: 'seconds', total: 8, best: 5 });
  });

  it('counts clean attempts out of all attempts', () => {
    expect(get('ntMu')).toMatchObject({ unit: 'attempts', total: 1, attempts: 3 });
  });

  it('tracks the heaviest load', () => {
    expect(get('weightedPullup').maxLoad).toBe(10);
  });
});

describe('time trained [A07]', () => {
  it('sums session durations by plan week, capped per session', () => {
    const input = makeInput();
    simulate(input, 2);
    const n = input.sessions.length;
    input.sessions[0]!.finishedAt = input.sessions[0]!.startedAt + 10 * 3_600_000;
    const t = todayAt(input, addDays(START, 14));
    const s = computeStats(input, t);
    expect(s.sessions).toBe(n);
    expect(s.totalMs).toBe((n - 1) * 3_600_000 + MAX_SESSION_MS);
    expect(s.weeks.map((w) => w.label)).toEqual(['W1', 'W2', 'W3']);
    expect(s.weeks.reduce((sum, w) => sum + w.ms, 0)).toBe(s.totalMs);
    expect(s.weeks.at(-1)).toMatchObject({ ms: 0, current: true });
    expect(s.totalReps).toBeGreaterThan(0);
    expect(s.exercises.find((e) => e.exercise === 'handstand')?.unit).toBe('seconds');
  });
});
