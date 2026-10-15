import { beforeAll, describe, expect, it } from 'vitest';
import { LINES } from '../../plan/progression';
import type { LineId } from '../../plan/types';
import { addDays } from '../dates';
import { describeTarget } from '../describe';
import type { Today } from '../index';
import { dpNext } from '../rules';
import type { Effort, LinePrescription, Outcome } from '../types';
import { DEFAULT_SETTINGS, failed, makeInput, perfect, simulate, START, todayAt, trainOn } from './helpers';

const at = (days: Map<string, Today>, week: number, day: number, id: LineId) => {
  const t = days.get(`${week}-${day}`);
  const l = t?.prescription.lines.find((x) => x.line === id);
  return l ? describeTarget(l) : undefined;
};

// Synthetic outcomes for unit-testing a line's advance().
const ctx = (over: Record<string, unknown> = {}) =>
  ({ settings: DEFAULT_SETTINGS, blockWeek: 1, block: 1, ...over }) as never;
const outcome = (success: boolean, effort?: Effort, progresses = true): Outcome => ({
  prescription: { progresses } as LinePrescription,
  result: { line: 'archer', status: 'complete', sets: [], effort },
  success,
  below: !success,
  attempted: true,
});
const step = <S,>(id: LineId, s: S, o: Outcome, c = ctx()): S => LINES[id].advance!(s, o, c);
const tgt = (id: LineId, s: unknown, c = ctx()) => describeTarget(LINES[id].target(s, c)!);

describe('double progression [D02]', () => {
  it('fills evenly, passing through every N x k', () => {
    const seq = [[2, 2, 2, 2]];
    let cur: number[] | null = [2, 2, 2, 2];
    while ((cur = dpNext(cur, 4))) seq.push(cur);
    expect(seq.map((r) => r.join(''))).toEqual(['2222', '3222', '3322', '3332', '3333', '4333', '4433', '4443', '4444']);
  });

  it('HSPU Block 1: 5x6 up to 5x8, then a 6th set of 6 that climbs to 8, then hold', () => {
    let s = LINES.hspuB1.init(makeInput().baselines, DEFAULT_SETTINGS);
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      seen.push(tgt('hspuB1', s));
      s = step('hspuB1', s, outcome(true, 'right'));
    }
    expect(seen.slice(0, 2)).toEqual(['5 x 6', '7, 6, 6, 6, 6']);
    expect(seen[10]).toBe('5 x 8');
    expect(seen[11]).toBe('8, 8, 8, 8, 8, 6');
    expect(seen[13]).toBe('6 x 8');
    expect(tgt('hspuB1', step('hspuB1', s, outcome(true)))).toBe('6 x 8');
  });

  it('abs: all sets at the top add 5 kg and reset the reps', () => {
    let s = LINES.declineCrunch.init(makeInput().baselines, DEFAULT_SETTINGS);
    for (let i = 0; i < 12; i++) s = step('declineCrunch', s, outcome(true));
    expect(tgt('declineCrunch', s)).toBe('+5 kg 3 x 12');
    expect(tgt('declineCrunch', step('declineCrunch', s, outcome(true)))).toBe('+10 kg 3 x 8');
  });
});

describe('success rule (PLAN_SPEC §7.1)', () => {
  const s0 = () => LINES.archer.init(makeInput().baselines, DEFAULT_SETTINGS);
  it('progresses only on success and not Hard', () => {
    expect(tgt('archer', step('archer', s0(), outcome(true, 'right')))).toBe('3, 2, 2, 2 per side');
    expect(tgt('archer', step('archer', s0(), outcome(false, 'right')))).toBe('4 x 2 per side');
  });

  it('a not-clean set, fewer reps, a Hard rating or a skipped line all repeat the numbers', () => {
    const input = makeInput();
    trainOn(input, START, (p) => (p.line === 'archer' ? failed(p) : p.line === 'pseudoPlanche' ? perfect(p, { effort: 'hard' }) : 'perfect'));
    const { t } = nextDay1(input);
    expect(describeTarget(t.prescription.lines.find((l) => l.line === 'archer')!)).toBe('4 x 2 per side');
    expect(describeTarget(t.prescription.lines.find((l) => l.line === 'pseudoPlanche')!)).toBe('3 x 8');
    expect(describeTarget(t.prescription.lines.find((l) => l.line === 'legRaise')!)).toBe('9, 8, 8');
  });

  it('a skipped line repeats', () => {
    const input = makeInput();
    trainOn(input, START, (p) => (p.line === 'archer' ? 'skip' : 'perfect'));
    expect(describeTarget(nextDay1(input).t.prescription.lines.find((l) => l.line === 'archer')!)).toBe('4 x 2 per side');
  });
});

/** After Day 1 on START: trains Days 2–7 cleanly and returns week 2's Day 1. */
function nextDay1(input: ReturnType<typeof makeInput>) {
  for (let i = 1; i < 7; i++) trainOn(input, addDays(START, i));
  return { t: todayAt(input, addDays(START, 7)) };
}

describe('Block 1 projection if every session succeeds (PLAN_SPEC §7.8)', () => {
  let days: Map<string, Today>;
  beforeAll(() => {
    days = simulate(makeInput(), 7).days;
  });

  const weeks = [1, 2, 3, 4, 5, 6, 7];
  const row = (day: number, id: LineId) => weeks.map((w) => at(days, w, day, id));

  it('handstand +5 s per week', () => {
    expect(row(1, 'handstand')).toEqual(['4 x 35 s', '4 x 40 s', '4 x 45 s', '4 x 50 s', '4 x 55 s', '4 x 60 s', '4 x 65 s']);
  });

  it('planche: one-leg to 6x5 s, then half-straddle and band straddle replace adv tuck in week 4', () => {
    expect(row(1, 'plancheOneLeg').map((x) => x?.split(' x ')[1])).toEqual(['3 s per leg', '4 s per leg', '5 s per leg', '5 s per leg', '5 s per leg', '5 s per leg', '5 s per leg']);
    expect(row(1, 'plancheAdvTuck')).toEqual(['3 x 8 s', '3 x 9 s', '3 x 10 s', undefined, undefined, undefined, undefined]);
    expect(row(1, 'plancheHalfStraddle')).toEqual([undefined, undefined, undefined, '3 x 4 s', '3 x 5 s', '3 x 6 s', '3 x 7 s']);
    expect(row(1, 'plancheBandStraddle')).toEqual([undefined, undefined, undefined, '3 x 5 s', '3 x 6 s', '3 x 7 s', '3 x 8 s']);
  });

  it('90 degree push-up sequence and holds', () => {
    expect(row(1, 'pushup90')).toEqual([
      'EMOM 6 x 1',
      'EMOM 7 x 1',
      'EMOM 8 x 1',
      '4 x 2 every 2 min',
      '5 x 2 every 2 min',
      '3 x 3 every 2 min',
      '3 x 3 every 2 min',
    ]);
    expect(row(4, 'hold90')).toEqual(['4 x 5 s', '4 x 6 s', '4 x 7 s', '4 x 8 s', '4 x 9 s', '4 x 10 s', '4 x 10 s']);
  });

  it('double progression lines in week 7', () => {
    expect(at(days, 7, 1, 'archer')).toBe('4, 4, 3, 3 per side');
    expect(at(days, 7, 1, 'pseudoPlanche')).toBe('3 x 10');
    expect(at(days, 7, 4, 'hspuB1')).toBe('8, 7, 7, 7, 7');
    expect(at(days, 7, 2, 'flRaise')).toBe('3 x 5');
    expect(at(days, 7, 2, 'weightedPullup')).toBe('+5 kg 7, 7, 6, 6');
    expect(at(days, 7, 5, 'pullup')).toBe('3 x 12');
    expect(at(days, 7, 4, 'dips')).toBe('3 x 14');
  });

  it('weighted muscle-up ladder with 5 kg plates', () => {
    expect(row(2, 'weightedMu')).toEqual(['+5 kg 4 x 2', '+5 kg 4 x 3', '+5 kg 4 x 4', '+10 kg 4 x 2', '+10 kg 4 x 3', '+10 kg 4 x 4', '+15 kg 4 x 2']);
  });

  it('sequences: clusters continue by the rule, flag and MU EMOM hold at the end', () => {
    expect(row(2, 'flCluster')).toEqual(['6 x 3 s', '8 x 3 s', '6 x 4 s', '8 x 4 s', '6 x 5 s', '8 x 5 s', '6 x 6 s']);
    expect(row(2, 'flag')).toEqual(['6 x 2 s', '6 x 3 s', '5 x 4 s', '5 x 5 s', '5 x 5 s', '5 x 5 s', '5 x 5 s']);
    expect(row(5, 'muEmom')).toEqual(['EMOM 8 x 3', 'EMOM 10 x 3', 'EMOM 8 x 4', 'EMOM 10 x 4', 'EMOM 10 x 4', 'EMOM 10 x 4', 'EMOM 10 x 4']);
  });

  it('time lines: one-leg front lever and straddle flag', () => {
    expect(row(5, 'flDuration')).toEqual(['4 x 8 s per leg', '4 x 9 s per leg', '4 x 10 s per leg', '4 x 11 s per leg', '4 x 12 s per leg', '4 x 13 s per leg', '4 x 14 s per leg']);
    expect(row(5, 'flagStraddle')).toEqual(['3 x 6 s', '3 x 7 s', '3 x 8 s', '3 x 9 s', '3 x 10 s', '3 x 10 s', '3 x 10 s']);
  });

  it('lines at their top say so', () => {
    const flag = days.get('7-2')!.prescription.lines.find((l) => l.line === 'flag')!;
    expect(flag.note).toMatch(/Top of the plan/);
  });
});

describe('the full 24 weeks if every session succeeds', () => {
  let days: Map<string, Today>;
  beforeAll(() => {
    days = simulate(makeInput(), 24).days;
  });

  it('HSPU changes method per block: DP, total 50, total 60 then 70 with top sets', () => {
    expect(at(days, 9, 4, 'hspuB2')).toBe('Total 50');
    expect(days.get('10-4')!.prescription.lines.find((l) => l.line === 'hspuB2')!.total!.lastSetsUsed).toBe(9);
    expect(at(days, 17, 4, 'hspuB3')).toBe('Total 60');
    expect(at(days, 18, 4, 'hspuB3')).toBe('Total 60, top set first');
    expect(at(days, 19, 4, 'hspuB3')).toBe('Total 60');
    expect(at(days, 20, 4, 'hspuB3')).toBe('Total 70, top set first');
    expect(at(days, 21, 4, 'hspuB3')).toBe('Total 70');
    expect(at(days, 22, 4, 'hspuB3')).toBe('Total 70, top set first');
  });

  it('muscle-up: EMOM, total 30, total 40, AMRAP in week 22', () => {
    expect(at(days, 9, 5, 'muTotal30')).toBe('Total 30');
    expect(at(days, 17, 5, 'muTotal40')).toBe('Total 40');
    expect(at(days, 22, 5, 'muTotal40')).toBe('Max reps');
    expect(at(days, 23, 5, 'muTotal40')).toBe('Total 40');
  });

  it('front lever switches from one-leg to straddle after 4x15 s', () => {
    expect(at(days, 9, 5, 'flDuration')).toBe('4 x 15 s per leg');
    expect(at(days, 10, 5, 'flDuration')).toBe('4 x 6 s');
    expect(days.get('10-5')!.prescription.lines.find((l) => l.line === 'flDuration')!.exercise).toBe('flStraddle');
  });

  it('band-assisted straddle restarts with a lighter band at the top', () => {
    const l = days.get('11-1')!.prescription.lines.find((x) => x.line === 'plancheBandStraddle')!;
    expect(describeTarget(l)).toBe('3 x 5 s');
    expect(l.note).toMatch(/lighter band/);
  });
});

describe('weekly handstand and the max (H1, [D29], [D30])', () => {
  it('no +5 s when a Day 4 handstand set fails', () => {
    const input = makeInput();
    const { days } = simulate(input, 2, (p, d) => (p.line === 'handstand' && d.pos.day === 4 && d.pos.week === 1 ? failed(p) : 'perfect'));
    expect(at(days, 2, 1, 'handstand')).toBe('4 x 35 s');
  });

  it('a higher max raises the working time to 65% of it, rounded to 5 s', () => {
    const input = makeInput();
    const { days } = simulate(input, 2, undefined, { maxSeconds: 75 });
    // max(35 + 5, round5(0.65 × 75 = 48.75) = 50)
    expect(at(days, 2, 1, 'handstand')).toBe('4 x 50 s');
  });

  it('a new max never lowers the working time', () => {
    const input = makeInput();
    const { days } = simulate(input, 2, undefined, { maxSeconds: 56 });
    expect(at(days, 2, 1, 'handstand')).toBe('4 x 40 s');
  });

  it('a max ended by the shoulders adds chest-to-wall holds on Day 6', () => {
    const input = makeInput();
    const { days } = simulate(input, 1, (p) => (p.line === 'handstandMax' ? { ...perfect(p), endedBy: 'shoulders' } : 'perfect'));
    expect(at(days, 1, 6, 'chestToWall')).toBe('2 x 60 s');
  });
});

describe('weighted lines', () => {
  it('weighted MU step follows the plate increment', () => {
    const c = ctx({ settings: { ...DEFAULT_SETTINGS, plateIncrement: 2.5 } });
    let s = LINES.weightedMu.init(makeInput().baselines, DEFAULT_SETTINGS);
    for (let i = 0; i < 3; i++) s = step('weightedMu', s, outcome(true), c);
    expect(tgt('weightedMu', s)).toBe('+7.5 kg 4 x 2');
  });

  it('weighted pull-ups calibrate: Easy adds load, Right starts double progression [D24]', () => {
    let s = LINES.weightedPullup.init(makeInput().baselines, DEFAULT_SETTINGS);
    s = step('weightedPullup', s, outcome(true, 'easy'));
    expect(tgt('weightedPullup', s)).toBe('+10 kg 4 x 5');
    s = step('weightedPullup', s, outcome(true, 'easy'));
    expect(tgt('weightedPullup', s)).toBe('+15 kg 4 x 5');
    s = step('weightedPullup', s, outcome(true, 'right'));
    expect(tgt('weightedPullup', s)).toBe('+15 kg 6, 5, 5, 5');
    // Once calibrated, Easy is a normal success.
    s = step('weightedPullup', s, outcome(true, 'easy'));
    expect(tgt('weightedPullup', s)).toBe('+15 kg 6, 6, 5, 5');
    // 10 more reps reach 4x8; the next success adds a plate and resets to 4x5.
    for (let i = 0; i < 10; i++) s = step('weightedPullup', s, outcome(true, 'right'));
    expect(tgt('weightedPullup', s)).toBe('+15 kg 4 x 8');
    s = step('weightedPullup', s, outcome(true, 'right'));
    expect(tgt('weightedPullup', s)).toBe('+20 kg 4 x 5');
  });
});

describe('abs variations', () => {
  it('dragon flag negatives rated Easy switch to full dragon flags [D39]', () => {
    const input = makeInput();
    const { days } = simulate(input, 2, (p) => (p.line === 'dragonFlag' ? perfect(p, { effort: 'easy' }) : 'perfect'));
    const l = days.get('2-4')!.prescription.lines.find((x) => x.line === 'dragonFlag')!;
    expect(l.exercise).toBe('dragonFlag');
    expect(describeTarget(l)).toBe('3 x 3');
  });

  it('leg raise moves to toes to bar after 3x12', () => {
    let s = LINES.legRaise.init(makeInput().baselines, DEFAULT_SETTINGS);
    for (let i = 0; i < 13; i++) s = step('legRaise', s, outcome(true));
    expect(LINES.legRaise.target(s, ctx())!.name).toBe('Toes to bar');
  });
});

describe('no-transition muscle-up unlock [D36]', () => {
  it('unlocks after high pulls at lower chest and +10 kg x 3 clean, then opens Day 2', () => {
    const input = makeInput();
    const { days } = simulate(input, 7, (p) => (p.line === 'highPull' ? { ...perfect(p), barHeight: 'lowerChest' } : 'perfect'));
    expect(days.get('5-2')!.prescription.lines[0]!.line).toBe('highPull');
    // Week 5 Day 2 is +10 kg 4x3, so attempts open in week 6.
    expect(days.get('6-2')!.prescription.lines[0]!.line).toBe('ntMu');
    expect(days.get('6-2')!.alerts.some((a) => a.kind === 'unlock')).toBe(true);
  });

  it('stays locked while the high pulls only reach the chest', () => {
    const { days } = simulate(makeInput(), 7);
    expect(days.get('7-2')!.prescription.lines.some((l) => l.line === 'ntMu')).toBe(false);
  });
});

describe('90 degree push-up rule', () => {
  it('a not-clean rep ends the line for the day', () => {
    const t = todayAt(makeInput(), START);
    const l = t.prescription.lines.find((x) => x.line === 'pushup90')!;
    expect(l.endOnNotClean).toBe(true);
    expect(l.notCleanLabel).toBe('Partial (80°)');
  });
});
