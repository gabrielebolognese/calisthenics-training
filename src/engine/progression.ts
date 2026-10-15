// Replays the whole log into line states (logs are the source of truth, PLAN_SPEC §15).
// Editing a past set and re-running the fold recomputes everything after it.
import { LINES } from '../plan/progression';
import type { LineId } from '../plan/types';
import { judge } from './judge';
import { makeCtx, prescribeDay, runBeforeSession, type SessionPrescription } from './prescribe';
import { extractTests, latestTest } from './results';
import type { Rebase, StateMap } from './rules';
import type { EngineEvent, EngineInput, Outcome, TimelineDay } from './types';

export function initStates(input: Pick<EngineInput, 'baselines' | 'settings'>): StateMap {
  const states = {} as StateMap;
  for (const def of Object.values(LINES)) states[def.id] = def.init(input.baselines, input.settings);
  return states;
}

export interface LineSummary {
  line: LineId;
  name: string;
  status: 'progressed' | 'repeat' | 'done' | 'skipped';
}

export interface DropEntry {
  day: number;
  down: boolean;
  at: number;
}

export interface FoldResult {
  states: StateMap;
  outcomes: Record<string, Outcome[]>;
  prescriptions: Record<string, SessionPrescription>;
  summaries: Record<string, LineSummary[]>;
  /** Training sessions since the last deload or test session, for the performance-drop trigger. */
  drops: DropEntry[];
}

function applyEvent(states: StateMap, e: EngineEvent, input: EngineInput, done: TimelineDay[]): StateMap {
  const next = { ...states };
  if (e.type === 'restart80') {
    for (const def of Object.values(LINES)) if (def.scale80) next[def.id] = def.scale80(next[def.id], input.settings);
  }
  if (e.type === 'newCycle') {
    const points = extractTests(done, input.baselines);
    const r: Rebase = {
      latest: {
        hspu: latestTest(points, 'hspu'),
        muscleUp: latestTest(points, 'muscleUp'),
        handstand: latestTest(points, 'handstand'),
        frontLever: latestTest(points, 'frontLever'),
      },
      week0: input.baselines,
    };
    for (const def of Object.values(LINES)) if (def.rebase) next[def.id] = def.rebase(next[def.id], r, input.settings);
  }
  return next;
}

/** Folds every completed session (in timeline order) and every state event up to `now`. */
export function fold(input: EngineInput, done: TimelineDay[], now: number): FoldResult {
  let states = initStates(input);
  const events = input.events.filter((e) => e.type === 'restart80' || e.type === 'newCycle').sort((a, b) => a.at - b.at);
  let ei = 0;
  const folded: TimelineDay[] = [];
  const applyUntil = (t: number) => {
    while (ei < events.length && events[ei]!.at <= t) states = applyEvent(states, events[ei++]!, input, folded);
  };

  const res: FoldResult = { states, outcomes: {}, prescriptions: {}, summaries: {}, drops: [] };

  for (const day of done) {
    const session = day.session;
    if (!session) {
      folded.push(day);
      continue;
    }
    applyUntil(session.startedAt);
    states = runBeforeSession(states, day, input);
    const variant = session.lines.find((l) => l.line === 'plancheLight')?.variant;
    const options = { plancheLight: variant };
    const presc = prescribeDay(day, states, input, options);
    const outcomes = presc.lines.map((p) => judge(p, session.lines.find((r) => r.line === p.line)));
    const ctx = makeCtx(day, states, input, options);

    const before = states;
    const after = { ...states };
    for (const o of outcomes) {
      const def = LINES[o.prescription.line];
      if (def.advance) after[def.id] = def.advance(after[def.id], o, ctx);
    }
    for (const def of Object.values(LINES)) {
      if (def.observe) after[def.id] = def.observe(after[def.id], session, ctx);
    }
    states = after;
    folded.push(day);

    res.outcomes[session.id] = outcomes;
    res.prescriptions[session.id] = presc;
    res.summaries[session.id] = outcomes.map((o) => summarize(o, before, after, day, input));

    // Performance drop: 2+ progressing lines below prescription in one training session [D49].
    if (day.kind === 'training') {
      const below = outcomes.filter((o) => o.below && LINES[o.prescription.line].progressive).length;
      res.drops.push({ day: day.pos.day, down: below >= 2, at: session.finishedAt });
    } else if (day.kind !== 'off') {
      res.drops = [];
    }
  }
  applyUntil(now);
  res.states = states;
  return res;
}

function summarize(o: Outcome, before: StateMap, after: StateMap, day: TimelineDay, input: EngineInput): LineSummary {
  const p = o.prescription;
  const base = { line: p.line, name: p.name };
  if (!o.attempted) return { ...base, status: 'skipped' };
  if (!p.progresses) return { ...base, status: 'done' };
  if (!o.success) return { ...base, status: 'repeat' };
  const def = LINES[p.line];
  const ctx = makeCtx(day, after, input);
  const t0 = JSON.stringify(def.target(before[p.line], ctx));
  const t1 = JSON.stringify(def.target(after[p.line], ctx));
  return { ...base, status: t0 !== t1 ? 'progressed' : 'done' };
}

/** Day number whose last two training sessions (since the last deload) were both down, if any. */
export function dropTrigger(drops: DropEntry[]): DropEntry | null {
  const byDay = new Map<number, DropEntry[]>();
  for (const d of drops) byDay.set(d.day, [...(byDay.get(d.day) ?? []), d]);
  let hit: DropEntry | null = null;
  for (const list of byDay.values()) {
    const [a, b] = list.slice(-2);
    if (a?.down && b?.down && (!hit || b.at > hit.at)) hit = b;
  }
  return hit;
}
