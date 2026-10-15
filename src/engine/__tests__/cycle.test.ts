import { describe, expect, it } from 'vitest';
import { walk } from '../cycle';
import { addDays } from '../dates';
import { makeInput, runDays, START, todayAt, trainOn } from './helpers';

describe('cycle: which day is today', () => {
  it('starts at cycle 1, week 1, day 1 on the start date', () => {
    const t = todayAt(makeInput(), START);
    expect(t.walk.status).toBe('due');
    expect(t.walk.current.pos).toEqual({ cycle: 1, week: 1, day: 1 });
    expect(t.walk.current.kind).toBe('training');
  });

  it('shows "not started" before the start date', () => {
    expect(todayAt(makeInput(), addDays(START, -2)).walk.status).toBe('notStarted');
  });

  it('never doubles up: after a session the next day waits for tomorrow', () => {
    const input = makeInput();
    trainOn(input, START);
    const later = todayAt(input, START);
    expect(later.walk.status).toBe('doneToday');
    expect(later.walk.current.pos.day).toBe(2);
    expect(trainOn(input, START)).toBeNull();
    expect(todayAt(input, addDays(START, 1)).walk.status).toBe('due');
  });

  it('off days complete when their date ends (Day 2 Monday → Day 3 Tuesday → Day 4 Wednesday)', () => {
    const input = makeInput();
    const mon = addDays(START, 7);
    trainOn(input, START); // Day 1
    trainOn(input, mon); // Day 2 a week later (missed days just wait)
    const tue = todayAt(input, addDays(mon, 1));
    expect(tue.walk.current.pos.day).toBe(3);
    expect(tue.walk.current.kind).toBe('off');
    expect(tue.walk.status).toBe('due');
    const wed = todayAt(input, addDays(mon, 2));
    expect(wed.walk.current.pos.day).toBe(4);
    // Missing Wednesday: Thursday still shows Day 4.
    const thu = todayAt(input, addDays(mon, 3));
    expect(thu.walk.current.pos.day).toBe(4);
    expect(thu.walk.status).toBe('due');
  });

  it('a missed training day is not skipped', () => {
    const input = makeInput();
    trainOn(input, START);
    const t = todayAt(input, addDays(START, 5));
    expect(t.walk.current.pos).toEqual({ cycle: 1, week: 1, day: 2 });
  });

  it('rolls weeks after Day 7 and blocks after week 8', () => {
    const input = makeInput();
    let d = runDays(input, START, 7);
    expect(todayAt(input, d).walk.current.pos).toEqual({ cycle: 1, week: 2, day: 1 });
    d = runDays(input, d, 7 * 7);
    const t = todayAt(input, d);
    expect(t.walk.current.pos).toEqual({ cycle: 1, week: 9, day: 1 });
    expect(t.walk.current.weekSeq).toBe(9);
  });

  it('maps deload and test week days', () => {
    const input = makeInput();
    const d = runDays(input, START, 7 * 7);
    const kinds = Array.from({ length: 7 }, (_, i) => {
      const t = todayAt(input, addDays(d, i));
      trainOn(input, addDays(d, i));
      return [t.walk.current.pos.week, t.walk.current.kind];
    });
    expect(kinds).toEqual([
      [8, 'deload'],
      [8, 'deload'],
      [8, 'off'],
      [8, 'testPush'],
      [8, 'testPull'],
      [8, 'testSkill'],
      [8, 'off'],
    ]);
  });

  it('inserts an early deload week and resumes at the same day', () => {
    const input = makeInput();
    let d = runDays(input, START, 7 + 3); // week 2, days 1–3 done
    const cur = todayAt(input, d).walk.current;
    expect(cur.pos).toEqual({ cycle: 1, week: 2, day: 4 });
    input.events.push({ type: 'earlyDeload', at: Date.now(), beforeKey: cur.key });
    const ins = todayAt(input, d).walk.current;
    expect(ins.pos).toEqual({ cycle: 1, week: 2, day: 1, inserted: 1 });
    expect(ins.kind).toBe('deload');
    expect(ins.weekKind).toBe('insertedDeload');
    d = runDays(input, d, 7);
    const back = todayAt(input, d).walk.current;
    expect(back.pos).toEqual({ cycle: 1, week: 2, day: 4 });
    expect(back.weekKind).toBe('loading');
  });

  it('applies a manual shift (jump)', () => {
    const input = makeInput();
    const cur = todayAt(input, START).walk.current;
    input.events.push({ type: 'jump', at: 1, fromKey: cur.key, to: { cycle: 1, week: 3, day: 4 } });
    expect(todayAt(input, START).walk.current.pos).toEqual({ cycle: 1, week: 3, day: 4 });
  });

  it('stops after week 24 until the next cycle is started', () => {
    const input = makeInput();
    const d = runDays(input, START, 24 * 7);
    const t = todayAt(input, d);
    expect(t.walk.status).toBe('cycleComplete');
    expect(t.alerts.some((a) => a.kind === 'cycleComplete')).toBe(true);
    input.events.push({ type: 'newCycle', at: Date.now(), cycle: 2 });
    const t2 = todayAt(input, d);
    expect(t2.walk.status).toBe('due');
    expect(t2.walk.current.pos).toEqual({ cycle: 2, week: 1, day: 1 });
  });

  it('is a pure function of sessions and dates', () => {
    const input = makeInput();
    runDays(input, START, 10);
    const a = walk(input, addDays(START, 10));
    const b = walk(input, addDays(START, 10));
    expect(a).toEqual(b);
  });
});
