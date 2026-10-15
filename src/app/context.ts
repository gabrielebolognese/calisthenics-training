import { useEffect, useState } from 'react';
import type { AppData } from '../db/repo';
import type { AppSettings } from '../db/schema';
import { blockOf } from '../plan/blocks';
import { DAYS } from '../plan/sessions';
import type { Today } from '../engine/index';
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
  /** App time in ms (includes the dev date offset). */
  now: number;
  dev: Dev;
  refresh: () => Promise<void>;
  addEvent: (e: EngineEvent) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
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
  const p = day.pos;
  const cycle = p.cycle > 1 ? `Cycle ${p.cycle} · ` : '';
  const where = p.inserted ? `Extra deload week (before week ${p.week})` : `Block ${blockOf(p.week)} · Week ${p.week}`;
  return `${cycle}${where} · Day ${p.day}: ${DAYS[p.day]!.name}`;
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
