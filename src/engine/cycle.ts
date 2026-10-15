// Which day is today (PLAN_SPEC §3.4). Day numbers, not weekdays; never double up;
// off days complete when the date they became due ends; a missed training day waits.
import { CYCLE_WEEKS, DAYS_PER_WEEK, dayKindFor, isTestWeek, type WeekKind } from '../plan/blocks';
import { addDays, maxDate, type LocalDate } from './dates';
import type { EngineEvent, EngineInput, Position, TimelineDay } from './types';

export function posKey(p: Position): string {
  return p.inserted ? `c${p.cycle}-x${p.inserted}-d${p.day}` : `c${p.cycle}-w${p.week}-d${p.day}`;
}

export type CycleStatus =
  /** current can be done today. */
  | 'due'
  /** A cycle day was already completed today; current is up tomorrow. */
  | 'doneToday'
  /** Week 24 is done; waiting for "Start next cycle". */
  | 'cycleComplete'
  /** The start date is in the future. */
  | 'notStarted';

export interface WalkResult {
  /** Completed cycle days, in order. */
  done: TimelineDay[];
  /** The first uncompleted cycle day. */
  current: TimelineDay;
  /** Earliest date current can be completed. */
  availableFrom: LocalDate;
  status: CycleStatus;
}

const byAt = <T extends { at: number }>(a: T, b: T) => a.at - b.at;

export function walk(input: Pick<EngineInput, 'baselines' | 'sessions' | 'events'>, today: LocalDate): WalkResult {
  const sessions = new Map(input.sessions.filter((s) => s.key !== 'extra').map((s) => [s.key, s]));
  const inserts = input.events.filter((e) => e.type === 'earlyDeload').sort(byAt);
  const jumps = input.events.filter((e) => e.type === 'jump').sort(byAt);
  const started = new Set(input.events.flatMap((e) => (e.type === 'newCycle' ? [e.cycle] : [])));
  const used = new Set<EngineEvent>();

  let pos: Position = { cycle: 1, week: 1, day: 1 };
  let resume: Position | null = null;
  let insertedCount = 0;
  let avail = input.baselines.startDate;
  let weekSeq = 0;
  let weekId = '';
  const done: TimelineDay[] = [];

  const next = (p: Position): Position => {
    if (p.inserted) {
      if (p.day < DAYS_PER_WEEK) return { ...p, day: p.day + 1 };
      const r = resume!;
      resume = null;
      return r;
    }
    if (p.day < DAYS_PER_WEEK) return { ...p, day: p.day + 1 };
    if (p.week < CYCLE_WEEKS) return { cycle: p.cycle, week: p.week + 1, day: 1 };
    return { cycle: p.cycle + 1, week: 1, day: 1 };
  };

  for (let guard = 0; guard < 100_000; guard++) {
    if (!pos.inserted) {
      const key = posKey(pos);
      const jump = jumps.find((e) => !used.has(e) && e.fromKey === key);
      if (jump) {
        used.add(jump);
        pos = { cycle: jump.to.cycle, week: jump.to.week, day: jump.to.day };
        continue;
      }
      const ins = inserts.find((e) => !used.has(e) && e.beforeKey === key);
      if (ins) {
        used.add(ins);
        insertedCount++;
        resume = pos;
        pos = { cycle: pos.cycle, week: pos.week, day: 1, inserted: insertedCount };
        continue;
      }
    }

    const wid = pos.inserted ? `x${pos.inserted}` : `c${pos.cycle}w${pos.week}`;
    if (wid !== weekId) {
      weekId = wid;
      weekSeq++;
    }
    const weekKind: WeekKind = pos.inserted ? 'insertedDeload' : isTestWeek(pos.week) ? 'deloadTest' : 'loading';
    const day: TimelineDay = { key: posKey(pos), pos, kind: dayKindFor(weekKind, pos.day), weekKind, weekSeq };
    const statusNow = (): WalkResult => ({
      done,
      current: day,
      availableFrom: avail,
      status: done.length === 0 && today < avail ? 'notStarted' : today < avail ? 'doneToday' : 'due',
    });

    if (pos.cycle > 1 && pos.week === 1 && pos.day === 1 && !pos.inserted && !started.has(pos.cycle)) {
      return { done, current: day, availableFrom: avail, status: 'cycleComplete' };
    }

    if (day.kind === 'off') {
      if (today > avail) {
        done.push({ ...day, date: avail });
        avail = addDays(avail, 1);
        pos = next(pos);
        continue;
      }
      return statusNow();
    }

    const s = sessions.get(day.key);
    if (s) {
      done.push({ ...day, date: s.date, session: s });
      avail = maxDate(avail, addDays(s.date, 1));
      pos = next(pos);
      continue;
    }
    return statusNow();
  }
  throw new Error('Cycle walk did not terminate');
}

/** The 7 days of the current week for the dot strip. "next" is the current day when it is up tomorrow. */
export function weekStrip(w: WalkResult): { day: number; key: string; state: 'done' | 'today' | 'next' | 'upcoming' | 'skipped' }[] {
  const cur = w.current;
  const doneKeys = new Set(w.done.map((d) => d.key));
  const curState = w.status === 'due' ? 'today' : 'next';
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => {
    const pos = { ...cur.pos, day: i + 1 };
    const key = posKey(pos);
    const state = doneKeys.has(key) ? 'done' : i + 1 === cur.pos.day ? curState : i + 1 < cur.pos.day ? 'skipped' : 'upcoming';
    return { day: i + 1, key, state };
  });
}
