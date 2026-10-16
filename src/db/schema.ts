// IndexedDB through Dexie (brief §13). Position, tests and progression state are not stored:
// the engine derives them from sessions, check-ins and events every time.
import Dexie, { type Table } from 'dexie';
import type { LocalDate } from '../engine/dates';
import type { Baselines, CheckIn, EngineEvent, SessionLog, Settings } from '../engine/types';
import type { AudioMode } from '../player/audio';
import type { LiveSession } from '../player/machine';

export interface AppSettings extends Settings {
  sound: boolean;
  voice: boolean;
  audioMode: AudioMode;
}

export interface KvRow {
  key: 'settings' | 'baselines';
  value: unknown;
}

export interface EventRow {
  id?: number;
  event: EngineEvent;
}

export interface LiveRow {
  id: 'live';
  state: LiveSession;
}

/** Cloud backup token and status. Never exported or restored, so a backup can't carry its own key. */
export interface SyncRow {
  key: 'token' | 'state';
  value: unknown;
}

/** GTG ticks for one date: rows × [muscle-up, HSPU]. */
export interface GtgRow {
  date: LocalDate;
  ticks: boolean[][];
}

/** Also the schemaVersion written into every snapshot [A15]. */
export const DB_VERSION = 2;

export class CaliDB extends Dexie {
  kv!: Table<KvRow, string>;
  sessions!: Table<SessionLog, string>;
  checkins!: Table<CheckIn, number>;
  events!: Table<EventRow, number>;
  live!: Table<LiveRow, string>;
  gtg!: Table<GtgRow, string>;
  sync!: Table<SyncRow, string>;

  constructor() {
    super('calisthenics');
    this.version(1).stores({
      kv: 'key',
      sessions: 'id, date, startedAt',
      checkins: 'weekSeq',
      events: '++id',
      live: 'id',
      gtg: 'date',
    });
    this.version(DB_VERSION).stores({ sync: 'key' });
  }
}

export const db = new CaliDB();

export type { Baselines };
