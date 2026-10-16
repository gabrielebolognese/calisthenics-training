import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AppData } from '../db/repo';
import type { AppSettings } from '../db/schema';
import { localDate } from '../engine/dates';
import { blockOf } from '../plan/blocks';
import { DAYS } from '../plan/sessions';
import type { Today } from '../engine/index';
import type { Stats } from '../engine/stats';
import type { EngineEvent, EngineInput, TimelineDay } from '../engine/types';

export const DAY_MS = 86_400_000;

export interface Dev {
  on: boolean;
  offsetDays: number;
  setOffsetDays: (n: number) => void;
}

export interface AppCtx {
  data: AppData & { baselines: NonNullable<AppData['baselines']> };
  input: EngineInput;
  today: Today;
  stats: Stats;
  /** App time in ms (includes the dev date offset). */
  now: number;
  dev: Dev;
  refresh: () => Promise<void>;
  addEvent: (e: EngineEvent) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  openSettings: () => void;
}

function readOffset(): number {
  try {
    return Number(localStorage.getItem('devOffsetDays') ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Dev mode (?dev=1): timers 10x faster, fake dates, jump anywhere (brief §15). */
export function useDev(): Dev {
  const on = new URLSearchParams(location.search).has('dev');
  const [offsetDays, set] = useState(on ? readOffset() : 0);
  return {
    on,
    offsetDays,
    setOffsetDays: (n) => {
      set(n);
      try {
        localStorage.setItem('devOffsetDays', String(n));
      } catch {
        // Private mode: the offset just won't survive a reload.
      }
    },
  };
}

/** Wall clock that refreshes every 30 s and when the app comes back to the foreground. */
export function useClock(): number {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setT(Date.now()), 30_000);
    const vis = () => document.visibilityState === 'visible' && setT(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return t;
}

/** "Block 1 · Week 3 · Day 4: Push B" (brief §10). */
export function positionLabel(day: TimelineDay): string {
  return `${positionShort(day)}: ${DAYS[day.pos.day]!.name}`;
}

/** "Block 1 · Week 3 · Day 4". */
export function positionShort(day: TimelineDay): string {
  const p = day.pos;
  const cycle = p.cycle > 1 ? `Cycle ${p.cycle} · ` : '';
  const where = p.inserted ? `Extra deload week (before week ${p.week})` : `Block ${blockOf(p.week)} · Week ${p.week}`;
  return `${cycle}${where} · Day ${p.day}`;
}

/** A drill-down (one exercise, one session): opens at the top, and going back restores the list's scroll. */
export function useDrill<T>(): [T | null, (v: T | null) => void] {
  const [open, set] = useState<T | null>(null);
  const saved = useRef(0);
  const back = useRef(false);
  useLayoutEffect(() => {
    window.scrollTo(0, back.current ? saved.current : 0);
    back.current = false;
  }, [open]);
  return [
    open,
    (v) => {
      if (v !== null) saved.current = window.scrollY;
      else back.current = true;
      set(v);
    },
  ];
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatLongDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "12 h 40 min", "45 min". */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

/** Seconds held: "45 s", "12 min 30 s", "1 h 05 min". */
export function formatSeconds(s: number): string {
  s = Math.round(s);
  if (s < 60) return `${s} s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
  return formatDuration(s * 1000);
}

export const formatInt = (n: number) => Math.round(n).toLocaleString();

/** A moment, as a person says it: "today at 14:32", "yesterday at 09:10", "Thu 16 Oct, 14:32". */
export function formatWhen(ms: number, now = Date.now()): string {
  const time = new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const day = localDate(ms);
  if (day === localDate(now)) return `today at ${time}`;
  if (day === localDate(now - DAY_MS)) return `yesterday at ${time}`;
  return `${formatDate(day)}, ${time}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${formatInt(n)} ${n === 1 ? one : many}`;
