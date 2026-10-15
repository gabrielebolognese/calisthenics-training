// Week 1 must match the PDF session tables exactly (PLAN_SPEC §6).
import { describe, expect, it } from 'vitest';
import { LINES } from '../../plan/progression';
import { DAYS } from '../../plan/sessions';
import { addDays } from '../dates';
import { describeTarget } from '../describe';
import { buildSteps, SWITCH_REST } from '../steps';
import type { Today } from '../index';
import { makeInput, START, todayAt, trainOn } from './helpers';

function weekOne(settings = {}) {
  const input = makeInput({ settings });
  const days: Record<number, Today> = {};
  for (let i = 0; i < 7; i++) {
    const t = todayAt(input, addDays(START, i));
    days[t.walk.current.pos.day] = t;
    trainOn(input, addDays(START, i));
  }
  return days;
}

const summary = (t: Today) => t.prescription.lines.map((l) => [l.line, describeTarget(l), l.restSec]);

describe('week 1 numbers (PDF p.4–7)', () => {
  const w = weekOne();

  it('Day 1: Push A', () => {
    expect(w[1]!.prescription.title).toBe('Push A (intensity)');
    expect(summary(w[1]!)).toEqual([
      ['handstand', '4 x 35 s', 90],
      ['plancheOneLeg', '6 x 3 s per leg', 120],
      ['plancheAdvTuck', '3 x 8 s', 120],
      ['pushup90', 'EMOM 6 x 1', 0],
      ['archer', '4 x 2 per side', 180],
      ['pseudoPlanche', '3 x 8', 90],
      ['declineCrunch', '+5 kg 3 x 8', 60],
      ['legRaise', '3 x 8', 60],
    ]);
  });

  it('Day 2: Pull A (one-side flagger gets a balance set)', () => {
    expect(summary(w[2]!)).toEqual([
      ['highPull', '5 x 3', 120],
      ['weightedMu', '+5 kg 4 x 2', 180],
      ['flCluster', '6 x 3 s', 90],
      ['flRaise', '3 x 3', 120],
      ['weightedPullup', '+5 kg 4 x 5', 150],
      ['flag', '6 x 2 s', 90],
      ['flagBalance2', '1 x 2 s', 90],
    ]);
  });

  it('Day 3 and Day 7 are off', () => {
    expect(w[3]!.walk.current.kind).toBe('off');
    expect(w[3]!.prescription.lines).toEqual([]);
    expect(w[7]!.walk.current.kind).toBe('off');
  });

  it('Day 4: Push B (no ab wheel in your setup)', () => {
    expect(summary(w[4]!)).toEqual([
      ['handstandMax', 'Max hold', 120],
      ['handstand', '3 x 35 s', 90],
      ['hspuB1', '5 x 6', 120],
      ['hold90', '4 x 5 s', 120],
      ['negative90', '3 x 1', 120],
      ['dips', '3 x 12', 90],
      ['dragonFlag', '3 x 5', 60],
    ]);
    expect(w[4]!.prescription.lines.find((l) => l.line === 'hspuB1')!.rir).toBe('2–3');
  });

  it('Day 5: Pull B', () => {
    expect(summary(w[5]!)).toEqual([
      ['muEmom', 'EMOM 8 x 3', 120],
      ['flDuration', '4 x 8 s per leg', 120],
      ['tuckRow', '3 x 6', 90],
      ['pullup', '3 x 10', 120],
      ['flagStraddle', '3 x 6 s', 90],
      ['flagBalance5', '1 x 6 s', 90],
      ['flagNegative', '3 x 1', 90],
    ]);
  });

  it('Day 6: Skill', () => {
    expect(summary(w[6]!)).toEqual([
      ['handstandPractice', '10 min', 90],
      ['plancheLight', '5 x 3 s per leg', 120],
      ['flagStraightBar', '5 attempts', 120],
      ['lSit', '4 x 10 s', 60],
      ['weightedCrunch', '+5 kg 3 x 10', 60],
    ]);
  });

  it('settings change the session: ab wheel, both flag sides, archer assisted set', () => {
    const v = weekOne({ abWheel: true, flagSides: 'both', archerAssistedSet: true });
    expect(summary(v[4]!).at(-1)).toEqual(['abWheel', '2 x 8', 60]);
    expect(describeTarget(v[2]!.prescription.lines.find((l) => l.line === 'flag')!)).toBe('6 x 2 s per side');
    expect(v[2]!.prescription.lines.some((l) => l.line === 'flagBalance2')).toBe(false);
    expect(v[1]!.prescription.lines.some((l) => l.line === 'archerAssisted')).toBe(true);
  });

  it('the last line has no rest after it', () => {
    for (const d of [1, 2, 4, 5, 6]) expect(w[d]!.prescription.lines.at(-1)!.restAfterSec).toBe(0);
  });

  it('effort is asked only on progressing rep lines', () => {
    const asks = (d: number) => w[d]!.prescription.lines.filter((l) => l.askEffort).map((l) => l.line);
    expect(asks(1)).toEqual(['pushup90', 'archer', 'pseudoPlanche', 'declineCrunch', 'legRaise']);
    expect(asks(2)).toEqual(['weightedMu', 'flRaise', 'weightedPullup']);
    expect(asks(4)).toEqual(['hspuB1', 'dips', 'dragonFlag']);
  });
});

describe('weekly exposures per skill (PDF p.4)', () => {
  const w = weekOne();
  const all = [1, 2, 4, 5, 6].map((d) => w[d]!.prescription.lines.map((l) => l.exercise));
  const daysWith = (pred: (e: string) => boolean) => all.filter((ex) => ex.some(pred)).length;

  it('handstand 3 (+ optional Day 3), planche 3, front lever 2, flag 3, muscle-up 2, HSPU family 2, abs 3', () => {
    expect(daysWith((e) => e.startsWith('handstand'))).toBe(3);
    expect(daysWith((e) => e.startsWith('planche') || e === 'hold90' || e === 'negative90')).toBe(3);
    expect(daysWith((e) => e.startsWith('fl') && !e.startsWith('flag'))).toBe(2);
    expect(daysWith((e) => e.startsWith('flag'))).toBe(3);
    expect(daysWith((e) => e === 'weightedMu' || e === 'muscleUp')).toBe(2);
    expect(daysWith((e) => e === 'hspu' || e === 'archerHspu')).toBe(2);
    const abs = ['declineCrunch', 'legRaise', 'dragonFlagNeg', 'abWheel', 'lSit', 'weightedCrunch'];
    expect(daysWith((e) => abs.includes(e))).toBe(3);
  });

  it('every slot points at a defined line', () => {
    for (const t of Object.values(DAYS)) {
      for (const s of t.slots) if (typeof s.line === 'string') expect(LINES[s.line]).toBeDefined();
    }
  });
});

describe('player steps', () => {
  const w = weekOne();

  it('per-leg holds: left and right with a short switch, starting leg alternates', () => {
    const steps = buildSteps(w[1]!.prescription);
    const oneLeg = steps.filter((s) => s.kind === 'hold' && s.line === 'plancheOneLeg');
    expect(oneLeg).toHaveLength(12);
    expect(oneLeg.slice(0, 4).map((s) => (s.kind === 'hold' ? s.sideLabel : ''))).toEqual([
      'LEFT LEG',
      'RIGHT LEG',
      'RIGHT LEG',
      'LEFT LEG',
    ]);
    const i = steps.findIndex((s) => s.kind === 'hold' && s.line === 'plancheOneLeg');
    expect(steps[i + 1]).toMatchObject({ kind: 'rest', seconds: SWITCH_REST, reason: 'switch' });
    expect(steps[i + 3]).toMatchObject({ kind: 'rest', seconds: 120, reason: 'set' });
  });

  it('starts with the warm-up, rests preview the next step, effort only on the last set', () => {
    const steps = buildSteps(w[1]!.prescription);
    expect(steps[0]!.kind).toBe('warmup');
    const rest = steps.find((s) => s.kind === 'rest')!;
    expect(rest.kind === 'rest' && rest.next).toContain('Freestanding handstand');
    const archer = steps.filter((s) => s.kind === 'reps' && s.line === 'archer');
    expect(archer.map((s) => s.kind === 'reps' && s.askEffort)).toEqual([false, false, false, true]);
  });

  it('estimated session length is close to the PDF times', () => {
    expect(w[1]!.estimatedMinutes).toBeGreaterThan(60);
    expect(w[1]!.estimatedMinutes).toBeLessThan(85);
    expect(w[2]!.estimatedMinutes).toBeGreaterThan(55);
    expect(w[2]!.estimatedMinutes).toBeLessThan(85);
    expect(w[6]!.estimatedMinutes).toBeLessThan(55);
  });
});
