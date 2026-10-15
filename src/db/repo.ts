import type { LocalDate } from '../engine/dates';
import type { Baselines, CheckIn, EngineEvent, SessionLog } from '../engine/types';
import type { LiveSession } from '../player/machine';
import { db, type AppSettings, type GtgRow } from './schema';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  // Your equipment and answers, 2026-10-15 [D34] [D57].
  plateIncrement: 5,
  flagSides: 'one',
  abWheel: false,
  bands: true,
  homeBar: true,
  gtg: false,
  archerAssistedSet: false,
  sound: true,
  voice: true,
  audioMode: 'transient',
};

export interface AppData {
  settings: AppSettings;
  baselines: Baselines | null;
  sessions: SessionLog[];
  checkins: CheckIn[];
  events: EngineEvent[];
  live: LiveSession | null;
  gtg: GtgRow[];
}

export async function loadAll(): Promise<AppData> {
  const [settings, baselines, sessions, checkins, events, live, gtg] = await Promise.all([
    db.kv.get('settings'),
    db.kv.get('baselines'),
    db.sessions.orderBy('startedAt').toArray(),
    db.checkins.toArray(),
    db.events.orderBy('id').toArray(),
    db.live.get('live'),
    db.gtg.toArray(),
  ]);
  return {
    settings: { ...DEFAULT_APP_SETTINGS, ...(settings?.value as Partial<AppSettings> | undefined) },
    baselines: (baselines?.value as Baselines | undefined) ?? null,
    sessions,
    checkins,
    events: events.map((e) => e.event),
    live: live?.state ?? null,
    gtg,
  };
}

export const saveSettings = (s: AppSettings) => db.kv.put({ key: 'settings', value: s });
export const saveBaselines = (b: Baselines) => db.kv.put({ key: 'baselines', value: b });
export const saveSession = (s: SessionLog) => db.sessions.put(s);
export const deleteSession = (id: string) => db.sessions.delete(id);
export const saveCheckin = (c: CheckIn) => db.checkins.put(c);
export const addEvent = (e: EngineEvent) => db.events.add({ event: e });
export const saveLive = (state: LiveSession) => db.live.put({ id: 'live', state });
export const clearLive = () => db.live.delete('live');
export const saveGtg = (date: LocalDate, ticks: boolean[][]) => db.gtg.put({ date, ticks });

/** Saves the finished session and clears the live one in a single transaction. */
export async function finishLive(log: SessionLog): Promise<void> {
  await db.transaction('rw', db.sessions, db.live, async () => {
    await db.sessions.put(log);
    await db.live.delete('live');
  });
}

/** Ask the browser to keep this storage (brief §2). Safe to call on every launch. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
