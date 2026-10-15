import { describe, expect, it } from 'vitest';
import { addDays } from '../engine/dates';
import { describeTarget } from '../engine/describe';
import { computeToday } from '../engine/index';
import { buildSteps } from '../engine/steps';
import type { EngineInput } from '../engine/types';
import { makeInput, noon, START, trainOn } from '../engine/__tests__/helpers';
import { reduce, remainingMs, startSession, tick, toSessionLog, type Action, type LiveSession } from './machine';

function start(input: EngineInput, date = START, speed = 1): LiveSession {
  const t = computeToday(input, noon(date));
  return startSession({ id: 'live1', key: t.walk.current.key, date, prescription: t.prescription, steps: t.steps, now: noon(date), speed });
}

/** Ends of the current timed phase, or null when the phase waits for a tap. */
function phaseEnd(s: LiveSession): number | null {
  const p = s.phase;
  const st = s.steps[s.index];
  if ('endsAt' in p) return p.endsAt;
  if (p.k === 'emom' && st?.kind === 'emom') return p.startedAt + (st.rounds * st.intervalSec * 1000) / s.speed;
  return null;
}

/** Advances like a foreground app: ticks at every phase end up to `now`. */
function runTo(s0: LiveSession, now: number): LiveSession {
  let s = s0;
  for (let end = phaseEnd(s); end !== null && end <= now; end = phaseEnd(s)) s = tick(s, end);
  return tick(s, now);
}

/** Plays the session as planned: timers run out, one tap per rep set, answers when asked. Counts taps. */
function play(s0: LiveSession, now0: number, react: (s: LiveSession) => Action | null = () => null) {
  let s = s0;
  let now = now0;
  let taps = 0;
  for (let guard = 0; guard < 5000 && !s.finished; guard++) {
    const custom = react(s);
    if (custom) {
      s = reduce(s, custom, now);
      taps++;
      continue;
    }
    const end = phaseEnd(s);
    if (end !== null) {
      now = Math.max(now, end);
      s = tick(s, now);
      continue;
    }
    const p = s.phase;
    const a: Action | null =
      p.k === 'reps' ? { type: 'done' }
      : p.k === 'total' ? { type: 'confirm' }
      : p.k === 'count' ? { type: 'confirm' }
      : p.k === 'attempt' ? { type: 'attempt', ok: false }
      : p.k === 'ask' && p.queue[0] === 'effort' ? { type: 'answer', q: 'effort', value: 'right' }
      : p.k === 'ask' && p.queue[0] === 'barHeight' ? { type: 'answer', q: 'barHeight', value: 'chest' }
      : p.k === 'ask' && p.queue[0] === 'endedBy' ? { type: 'answer', q: 'endedBy', value: 'balance' }
      : null;
    if (p.k === 'stopwatch') {
      now += 40_000;
      s = reduce(s, { type: 'stop' }, now);
      taps++;
      continue;
    }
    if (!a) throw new Error(`Stuck in ${p.k}`);
    s = reduce(s, a, now);
    taps++;
  }
  return { s, now, taps };
}

describe('player: a session as planned', () => {
  it('Day 1 runs with one tap per rep set plus the effort ratings, and the log progresses every line', () => {
    const input = makeInput();
    const live = start(input);
    const repSets = live.steps.filter((x) => x.kind === 'reps').length;
    const ratings = live.prescription.lines.filter((l) => l.askEffort).length;
    const { s, now, taps } = play(live, noon(START));
    expect(taps).toBe(repSets + ratings);
    expect(s.results.every((r) => r.status === 'complete')).toBe(true);

    input.sessions.push(toSessionLog(s, now));
    const t = computeToday(input, noon(addDays(START, 7)));
    const summaries = t.fold.summaries.live1!;
    expect(summaries.filter((x) => x.status === 'repeat')).toEqual([]);
    expect(summaries.find((x) => x.line === 'archer')!.status).toBe('progressed');
  });

  it('logs every line of every day of week 1 as a success', () => {
    const input = makeInput();
    for (let i = 0; i < 7; i++) {
      const date = addDays(START, i);
      const t = computeToday(input, noon(date));
      if (t.walk.current.kind === 'off') continue;
      const live = startSession({ id: `d${i}`, key: t.walk.current.key, date, prescription: t.prescription, steps: t.steps, now: noon(date) });
      const { s, now } = play(live, noon(date));
      input.sessions.push(toSessionLog(s, now));
      const outcomes = computeToday(input, noon(addDays(date, 1))).fold.outcomes[`d${i}`]!;
      expect(outcomes.filter((o) => !o.success && o.prescription.progresses).map((o) => o.prescription.line)).toEqual([]);
    }
  });
});

describe('player: holds and timers', () => {
  it('a hold runs: 5 s get ready, the hold, then rest, all by itself', () => {
    const input = makeInput();
    let s = start(input);
    s = reduce(s, { type: 'skipWarmup' }, noon(START));
    expect(s.phase.k).toBe('ready');
    expect(remainingMs(s, noon(START))).toBe(5000);
    s = tick(s, noon(START) + 5000);
    expect(s.phase).toMatchObject({ k: 'hold' });
    s = tick(s, noon(START) + 5000 + 35_000);
    expect(s.phase.k).toBe('rest');
    expect(s.results[0]!.sets).toEqual([{ set: 0, side: undefined, seconds: 35, clean: true }]);
  });

  it('breaking early logs the actual seconds as not clean', () => {
    let s = reduce(start(makeInput()), { type: 'skipWarmup' }, noon(START));
    s = tick(s, noon(START) + 5000);
    s = reduce(s, { type: 'stop' }, noon(START) + 5000 + 21_400);
    expect(s.results[0]!.sets[0]).toMatchObject({ seconds: 21, clean: false });
    expect(s.phase.k).toBe('rest');
  });

  it('resumes after a reload: JSON round trip keeps the remaining time', () => {
    let s = reduce(start(makeInput()), { type: 'skipWarmup' }, noon(START));
    s = runTo(s, noon(START) + 5000 + 35_000); // first hold done, resting 90 s
    const saved = JSON.parse(JSON.stringify(s)) as LiveSession;
    expect(remainingMs(saved, noon(START) + 40_000 + 30_000)).toBe(60_000);
  });

  it('a rest that finished while away moves on, and the next phase starts now rather than back then', () => {
    let s = reduce(start(makeInput()), { type: 'skipWarmup' }, noon(START));
    s = runTo(s, noon(START) + 40_000); // resting until +130 s
    const back = noon(START) + 600_000;
    s = tick(s, back);
    expect(s.phase).toEqual({ k: 'ready', endsAt: back + 5000 });
  });

  it('per-leg holds log left and right for the same set', () => {
    const input = makeInput();
    let s = reduce(start(input), { type: 'skipWarmup' }, noon(START));
    const firstOneLeg = s.steps.findIndex((x) => x.kind === 'hold' && x.line === 'plancheOneLeg');
    let now = noon(START);
    while (s.index <= firstOneLeg + 2) {
      const p = s.phase;
      now = 'endsAt' in p ? p.endsAt : now;
      s = tick(s, now);
    }
    const r = s.results.find((x) => x.line === 'plancheOneLeg')!;
    expect(r.sets).toEqual([
      { set: 0, side: 'L', seconds: 3, clean: true },
      { set: 0, side: 'R', seconds: 3, clean: true },
    ]);
  });

  it('+15 s and Skip on a rest', () => {
    let s = reduce(start(makeInput()), { type: 'skipWarmup' }, noon(START));
    s = runTo(s, noon(START) + 40_000);
    const before = remainingMs(s, noon(START) + 40_000)!;
    s = reduce(s, { type: 'addRest' }, noon(START) + 40_000);
    expect(remainingMs(s, noon(START) + 40_000)).toBe(before + 15_000);
    s = reduce(s, { type: 'skip' }, noon(START) + 41_000);
    expect(s.phase.k).toBe('ready');
  });

  it('dev speed runs timers 10x faster but logs real seconds', () => {
    let s = reduce(start(makeInput(), START, 10), { type: 'skipWarmup' }, noon(START));
    expect(remainingMs(s, noon(START))).toBe(5000);
    s = runTo(s, noon(START) + 500 + 3500);
    expect(s.results[0]!.sets[0]).toMatchObject({ seconds: 35, clean: true });
  });
});

describe('player: reps, EMOM, totals, tests', () => {
  it('"Less" logs fewer reps and Not clean', () => {
    const input = makeInput();
    const live = start(input);
    const { s } = play(live, noon(START), (x) => {
      const st = x.steps[x.index];
      if (st?.kind === 'reps' && st.line === 'archer' && st.set === 0) {
        if (x.phase.k === 'reps') return { type: 'less' };
        if (x.phase.k === 'adjust' && x.phase.reps === 2) return { type: 'adjust', reps: 1, clean: false };
        if (x.phase.k === 'adjust') return { type: 'confirm' };
      }
      return null;
    });
    expect(s.results.find((r) => r.line === 'archer')!.sets[0]).toMatchObject({ reps: 1, clean: false });
  });

  it('EMOM runs by itself; Missed logs a failed round', () => {
    const input = makeInput();
    let marked = false;
    const { s } = play(start(input), noon(START), (x) => {
      if (x.phase.k === 'emom' && !marked) {
        marked = true;
        return { type: 'missed' };
      }
      return null;
    });
    const sets = s.results.find((r) => r.line === 'pushup90')!.sets;
    expect(sets).toHaveLength(6);
    expect(sets[0]).toEqual({ set: 0, reps: 0, clean: false });
    expect(sets.slice(1).every((x) => x.clean)).toBe(true);
  });

  it('90 degree partial rep ends the line for the day', () => {
    const input = makeInput();
    let s = reduce(start(input), { type: 'skipWarmup' }, noon(START));
    let now = noon(START);
    while (s.steps[s.index]?.kind !== 'emom' || s.phase.k !== 'emom') {
      const p = s.phase;
      if (p.k === 'reps') s = reduce(s, { type: 'done' }, now);
      else {
        now = 'endsAt' in p ? p.endsAt : now;
        s = tick(s, now);
      }
    }
    const emomAt = s.index;
    if (s.phase.k !== 'emom') throw new Error('expected emom');
    now = s.phase.startedAt + 2 * 60_000 + 10_000; // third round
    s = reduce(s, { type: 'partial' }, now);
    const r = s.results.find((x) => x.line === 'pushup90')!;
    expect(r.status).toBe('complete');
    expect(r.sets.map((x) => x.clean)).toEqual([true, true, false]);
    expect(s.index).toBe(emomAt + 1);
    expect(s.steps[s.index]).toMatchObject({ kind: 'rest', reason: 'exercise' });
  });

  it('total reps: stepper prefilled, rest between sets, ends at the total and logs sets used', () => {
    const input = makeInput();
    input.events.push({ type: 'jump', at: 1, fromKey: 'c1-w1-d1', to: { cycle: 1, week: 9, day: 4 } });
    const live = start(input);
    expect(live.prescription.lines.find((l) => l.line === 'hspuB2')).toBeDefined();
    const { s } = play(live, noon(START));
    const r = s.results.find((x) => x.line === 'hspuB2')!;
    expect(r.sets.reduce((a, x) => a + (x.reps ?? 0), 0)).toBeGreaterThanOrEqual(50);
    expect(r.sets[0]!.reps).toBe(6); // 50 / 8 sets, rounded
    expect(r.effort).toBe('right');
  });

  it('test day: stopwatch, AMRAP stepper, what ended the handstand max', () => {
    const input = makeInput();
    input.events.push({ type: 'jump', at: 1, fromKey: 'c1-w1-d1', to: { cycle: 1, week: 8, day: 4 } });
    const { s } = play(start(input), noon(START));
    expect(s.results.find((x) => x.line === 'testHandstand')).toMatchObject({ sets: [{ seconds: 40, clean: true }], endedBy: 'balance' });
    expect(s.results.find((x) => x.line === 'testHspu')!.status).toBe('complete');
  });
});

describe('player: stopping', () => {
  it('Finish early keeps finished lines, marks the current one, skips the rest', () => {
    const input = makeInput();
    let s = reduce(start(input), { type: 'skipWarmup' }, noon(START));
    s = runTo(s, noon(START) + 5000 + 35_000);
    s = reduce(s, { type: 'finishEarly' }, noon(START) + 41_000);
    expect(s.finished).toBe(true);
    expect(s.results[0]!.status).toBe('stoppedEarly');
    expect(s.results.slice(1).every((r) => r.status === 'skipped')).toBe(true);

    // The cycle day still counts as done, and the unfinished lines repeat.
    input.sessions.push(toSessionLog(s, noon(START) + 42_000));
    const t = computeToday(input, noon(addDays(START, 1)));
    expect(t.walk.current.pos.day).toBe(2);
    for (let i = 1; i < 7; i++) trainOn(input, addDays(START, i));
    const next = computeToday(input, noon(addDays(START, 7)));
    expect(next.walk.current.pos).toEqual({ cycle: 1, week: 2, day: 1 });
    expect(describeTarget(next.prescription.lines.find((l) => l.line === 'handstand')!)).toBe('4 x 35 s');
    expect(describeTarget(next.prescription.lines.find((l) => l.line === 'archer')!)).toBe('4 x 2 per side');
  });

  it('Stop exercise (pain) ends that line and moves to the next one', () => {
    let s = reduce(start(makeInput()), { type: 'skipWarmup' }, noon(START));
    s = runTo(s, noon(START) + 40_000); // resting after handstand set 1
    s = reduce(s, { type: 'pain' }, noon(START) + 41_000);
    expect(s.results[0]!.status).toBe('pain');
    expect(s.steps[s.index]).toMatchObject({ kind: 'rest', reason: 'exercise' });
  });

  it('attempts: Yes/No rows with rest between', () => {
    const input = makeInput();
    for (let i = 0; i < 5; i++) trainOn(input, addDays(START, i));
    const date = addDays(START, 5);
    const t = computeToday(input, noon(date));
    const live = startSession({ id: 'x', key: t.walk.current.key, date, prescription: t.prescription, steps: buildSteps(t.prescription), now: noon(date) });
    let n = 0;
    const { s } = play(live, noon(date), (x) => (x.phase.k === 'attempt' ? { type: 'attempt', ok: n++ % 2 === 0 } : null));
    expect(s.results.find((r) => r.line === 'flagStraightBar')!.attempts).toEqual([true, false, true, false, true]);
  });
});
