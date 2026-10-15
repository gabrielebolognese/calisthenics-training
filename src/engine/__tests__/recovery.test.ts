// Deload and test weeks, early deload, long break, performance drop, planche pain, GTG, check-ins, next cycle.
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import { describeTarget } from '../describe';
import type { Today } from '../index';
import type { CheckIn, LineResult } from '../types';
import { failed, makeInput, noon, perfect, simulate, START, todayAt, trainOn, type Policy } from './helpers';

const lineOf = (t: Today | undefined, id: string) => t?.prescription.lines.find((l) => l.line === id);
const desc = (t: Today | undefined, id: string) => {
  const l = lineOf(t, id);
  return l ? describeTarget(l) : undefined;
};
const ids = (t: Today | undefined) => t?.prescription.lines.map((l) => l.line);

const checkIn = (weekSeq: number, o: Partial<CheckIn> = {}): CheckIn => ({
  weekSeq,
  at: noon(addDays(START, weekSeq * 7)),
  nightsUnder6: 0,
  painMax: 0,
  painOver24h: false,
  planchePain: false,
  ...o,
});

describe('scheduled deload and test week (week 8)', () => {
  let days: Map<string, Today>;
  beforeAll(() => {
    const input = makeInput();
    const testValues: Policy = (p) =>
      p.line === 'testHandstand' ? { ...perfect(p), sets: [{ set: 0, seconds: 120, clean: true }] } : 'perfect';
    days = simulate(input, 9, testValues).days;
  });

  it('Day 1 deload: half the sets, same numbers, RIR 4, abs as normal', () => {
    const t = days.get('8-1')!;
    expect(t.prescription.title).toBe('Push A · deload');
    expect(desc(t, 'handstand')).toBe('2 x 70 s');
    expect(desc(t, 'plancheOneLeg')).toBe('3 x 5 s per leg');
    expect(desc(t, 'pushup90')).toBe('2 x 3 every 2 min');
    expect(desc(t, 'archer')).toBe('2 x 4 per side');
    expect(lineOf(t, 'archer')!.rir).toBe('4');
    expect(lineOf(t, 'archer')!.askEffort).toBe(false);
    expect(lineOf(t, 'declineCrunch')!.progresses).toBe(true);
    expect(lineOf(t, 'declineCrunch')!.askEffort).toBe(true);
  });

  it('deload sessions do not move progression', () => {
    expect(desc(days.get('7-1'), 'archer')).toBe('4, 4, 3, 3 per side');
    expect(desc(days.get('9-1'), 'archer')).toBe('4, 4, 4, 3 per side');
  });

  it('test day push: handstand, 90 degree, archer per side, HSPU AMRAP last, then Abs B', () => {
    const t = days.get('8-4')!;
    expect(t.prescription.title).toBe('Test day: push');
    expect(ids(t)).toEqual(['testHandstand', 'test90', 'testArcherL', 'testArcherR', 'testHspu', 'dragonFlag']);
    expect(t.prescription.notes[0]).toMatch(/film every attempt/);
  });

  it('test day pull: front lever max hold, muscle-up AMRAP', () => {
    expect(ids(days.get('8-5'))).toEqual(['testFrontLever', 'testMuscleUp']);
  });

  it('third test day: flag, planche per level (hardest first), then practice and Abs C', () => {
    expect(ids(days.get('8-6'))).toEqual([
      'testFlag',
      'testPlancheHalfStraddle',
      'testPlancheOneLegL',
      'testPlancheOneLegR',
      'testPlancheAdvTuck',
      'handstandPractice',
      'lSit',
      'weightedCrunch',
    ]);
  });

  it('the test handstand max resets the base: 65% of 120 s = 80 s', () => {
    expect(desc(days.get('9-1'), 'handstand')).toBe('4 x 80 s');
  });

  it('suggests a backup after the test week', () => {
    expect(days.get('9-1')!.alerts.some((a) => a.kind === 'backup')).toBe(true);
  });
});

describe('early deload', () => {
  it('pain 3+ lasting more than 24 h recommends a deload; accepting inserts a deload week and resumes', () => {
    const input = makeInput();
    let d = simulate(input, 2).end;
    input.checkins.push(checkIn(2, { painMax: 4, painOver24h: true }));
    const t = todayAt(input, d);
    expect(t.alerts.find((a) => a.kind === 'deload')).toMatchObject({ reason: expect.stringMatching(/pain 4\/10/) });
    const archerBefore = desc(t, 'archer');

    input.events.push({ type: 'earlyDeload', at: noon(d), beforeKey: t.walk.current.key });
    const ins = todayAt(input, d);
    expect(ins.walk.current.weekKind).toBe('insertedDeload');
    expect(ins.alerts.some((a) => a.kind === 'deload')).toBe(false);
    expect(desc(ins, 'archer')).toBe('2 x 3 per side');

    d = simulate(input, 1, undefined, undefined, d).end;
    const back = todayAt(input, d);
    expect(back.walk.current.pos).toEqual({ cycle: 1, week: 3, day: 1 });
    expect(desc(back, 'archer')).toBe(archerBefore);
  });

  it('3+ nights under 6 h recommends a deload; Ignore hides it', () => {
    const input = makeInput();
    const d = simulate(input, 1).end;
    input.checkins.push(checkIn(1, { nightsUnder6: 3 }));
    expect(todayAt(input, d).alerts.some((a) => a.kind === 'deload')).toBe(true);
    input.events.push({ type: 'dismiss', at: noon(d), what: 'deload' });
    expect(todayAt(input, d).alerts.some((a) => a.kind === 'deload')).toBe(false);
  });

  it('two Day 1 sessions in a row below prescription on 2+ lines trigger it', () => {
    const input = makeInput();
    const bad: Policy = (p, day) => (day.pos.day === 1 && (p.line === 'archer' || p.line === 'pseudoPlanche') ? failed(p) : 'perfect');
    const one = simulate(input, 1, bad).end;
    expect(todayAt(input, one).alerts.some((a) => a.kind === 'deload')).toBe(false);
    trainOn(input, one, bad);
    const t = todayAt(input, addDays(one, 1));
    expect(t.alerts.find((a) => a.kind === 'deload')).toMatchObject({ reason: expect.stringMatching(/Day 1/) });
  });

  it('one weak line is not a performance drop', () => {
    const input = makeInput();
    const bad: Policy = (p, day) => (day.pos.day === 1 && p.line === 'archer' ? failed(p) : 'perfect');
    const d = simulate(input, 2, bad).end;
    expect(todayAt(input, d).alerts.some((a) => a.kind === 'deload')).toBe(false);
  });
});

describe('long break: restart at 80% [D52]', () => {
  it('shows after 14+ days and scales reps, seconds, loads and sequences', () => {
    const input = makeInput();
    const d = simulate(input, 4).end;
    const before = todayAt(input, d);
    expect(desc(before, 'archer')).toBe('4 x 3 per side');
    expect(desc(before, 'handstand')).toBe('4 x 55 s');

    const later = addDays(d, 20);
    const t = todayAt(input, later);
    expect(t.alerts.find((a) => a.kind === 'longBreak')).toMatchObject({ days: 22 });

    input.events.push({ type: 'restart80', at: noon(later) - 1000 });
    const after = todayAt(input, later);
    expect(after.alerts.some((a) => a.kind === 'longBreak')).toBe(false);
    expect(desc(after, 'archer')).toBe('4 x 2 per side');
    expect(desc(after, 'handstand')).toBe('4 x 45 s');
    expect(desc(after, 'pseudoPlanche')).toBe('8, 7, 7'); // [10, 9, 9] × 0.8
  });

  it('weighted lines drop the load only; sequences snap down', () => {
    const input = makeInput();
    const d = simulate(input, 4).end;
    const day2 = addDays(d, 21);
    input.events.push({ type: 'restart80', at: noon(day2) - 1000 });
    trainOn(input, addDays(d, 20)); // Day 1
    const t = todayAt(input, day2);
    expect(t.walk.current.pos.day).toBe(2);
    expect(desc(t, 'weightedMu')).toBe('+5 kg 4 x 3'); // +10 kg 4x3: 10 × 0.8 = 8 → 5 kg plates, reps kept
    expect(desc(t, 'flCluster')).toBe('6 x 4 s'); // 6x5 s = 30 s → ≤ 24 s
  });
});

describe('planche pain rule [D51]', () => {
  it('halves planche holds for the next 2 weeks without progressing them', () => {
    const input = makeInput();
    simulate(input, 1);
    input.checkins.push(checkIn(1, { planchePain: true }));
    const { days } = simulate(input, 3, undefined, undefined, addDays(START, 7));
    expect(desc(days.get('2-1'), 'plancheOneLeg')).toBe('3 x 4 s per leg');
    expect(lineOf(days.get('2-1'), 'plancheOneLeg')!.progresses).toBe(false);
    expect(desc(days.get('2-6'), 'plancheLight')).toBe('3 x 3 s per leg');
    expect(desc(days.get('3-1'), 'plancheAdvTuck')).toBe('2 x 9 s');
    expect(desc(days.get('4-1'), 'plancheOneLeg')).toBe('6 x 4 s per leg');
    expect(desc(days.get('2-1'), 'archer')).toBe('3, 2, 2, 2 per side');
  });
});

describe('GTG [D54]', () => {
  it('Day 3 and Day 6 of loading weeks, ~40% of the latest max', () => {
    const input = makeInput({ settings: { gtg: true, gtgSince: noon(START) } });
    const { days } = simulate(input, 1);
    expect(days.get('1-6')!.gtg).toEqual({ rows: 5, muReps: 3, hspuReps: 4 });
    expect(days.get('1-1')!.gtg).toBeNull();
    // Day 3 is a rest day, so simulate() doesn't record it: check it directly.
    const off = makeInput({ settings: { gtg: true, gtgSince: noon(START) } });
    trainOn(off, START);
    trainOn(off, addDays(START, 1));
    const day3 = todayAt(off, addDays(START, 2));
    expect(day3.walk.current.kind).toBe('off');
    expect(day3.gtg).toEqual({ rows: 5, muReps: 3, hspuReps: 4 });
  });

  it('HSPU only without a bar at home; never in deload or test weeks; asks after 4 weeks', () => {
    const input = makeInput({ settings: { gtg: true, gtgSince: noon(START), homeBar: false } });
    const { days } = simulate(input, 9);
    expect(days.get('1-6')!.gtg).toEqual({ rows: 5, muReps: null, hspuReps: 4 });
    expect(days.get('8-6')!.gtg).toBeNull();
    expect(days.get('4-6')!.alerts.some((a) => a.kind === 'gtgAsk')).toBe(false);
    expect(days.get('5-1')!.alerts.some((a) => a.kind === 'gtgAsk')).toBe(true);
  });
});

describe('weekly check-in', () => {
  it('is due after Day 7 and clears once submitted', () => {
    const input = makeInput();
    const d = simulate(input, 1).end;
    expect(todayAt(input, addDays(START, 6)).alerts.some((a) => a.kind === 'checkIn')).toBe(false);
    expect(todayAt(input, d).alerts.find((a) => a.kind === 'checkIn')).toEqual({ kind: 'checkIn', weekSeq: 1 });
    input.checkins.push(checkIn(1));
    expect(todayAt(input, d).alerts.some((a) => a.kind === 'checkIn')).toBe(false);
  });
});

describe('next cycle [D56]', () => {
  it('rebases percent-defined starts from the week 24 tests', () => {
    const input = makeInput();
    const tests: Record<string, Partial<LineResult['sets'][number]>> = {
      testHspu: { reps: 18 },
      testMuscleUp: { reps: 14 },
      testHandstand: { seconds: 100 },
      testFrontLever: { seconds: 12 },
    };
    const policy: Policy = (p) => (tests[p.line] ? { ...perfect(p), sets: [{ set: 0, clean: true, ...tests[p.line] }] } : 'perfect');
    const { end } = simulate(input, 24, policy);
    expect(todayAt(input, end).walk.status).toBe('cycleComplete');
    input.events.push({ type: 'newCycle', at: noon(end) - 1000, cycle: 2 });
    const { days } = simulate(input, 2, undefined, undefined, end);
    const w1 = (d: number) => days.get(`1-${d}`);
    expect(w1(1)!.walk.current.pos.cycle).toBe(2);
    expect(desc(w1(1), 'handstand')).toBe('4 x 65 s');
    expect(desc(w1(2), 'flCluster')).toBe('6 x 7 s');
    expect(desc(w1(4), 'hspuB1')).toBe('5 x 10');
    expect(desc(w1(5), 'muEmom')).toBe('EMOM 8 x 6');
    expect(desc(w1(1), 'archer')).toBe('4 x 4 per side');
  });
});
