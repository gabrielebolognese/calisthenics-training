// Snapshots of all data: the JSON export file and the cloud backup are the same thing (brief §10 Settings, A15).
import type { CheckIn, SessionLog } from '../engine/types';
import { db, DB_VERSION, type EventRow, type GtgRow, type KvRow } from './schema';

const FORMAT = 'calisthenics-backup';

export interface Snapshot {
  format: typeof FORMAT;
  /** The IndexedDB schema version that wrote it. Files from before cloud backup have none: version 1. */
  schemaVersion: number;
  exportedAt: string;
  kv: KvRow[];
  sessions: SessionLog[];
  checkins: CheckIn[];
  events: EventRow[];
  gtg: GtgRow[];
}

/** Everything except the live session and the cloud token. */
export async function makeSnapshot(): Promise<Snapshot> {
  const [kv, sessions, checkins, events, gtg] = await db.transaction('r', [db.kv, db.sessions, db.checkins, db.events, db.gtg], () =>
    Promise.all([db.kv.toArray(), db.sessions.toArray(), db.checkins.toArray(), db.events.toArray(), db.gtg.toArray()]),
  );
  return { format: FORMAT, schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), kv, sessions, checkins, events, gtg };
}

/** The part of a snapshot that changes with your data (no timestamp), for "anything new to back up?". */
export const snapshotData = (s: Snapshot): string => JSON.stringify([s.kv, s.sessions, s.checkins, s.events, s.gtg]);

export async function exportJson(): Promise<string> {
  return JSON.stringify(await makeSnapshot(), null, 1);
}

/** Throws on anything that isn't a backup, or one written by a newer version of the app. */
export function parseSnapshot(text: string): Snapshot {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return checkSnapshot(data);
}

export function checkSnapshot(value: unknown): Snapshot {
  const data = value as Partial<Snapshot> | null;
  if (data?.format !== FORMAT || !Array.isArray(data.sessions)) throw new Error('This is not a Calisthenics backup.');
  const schemaVersion = data.schemaVersion ?? 1;
  if (typeof schemaVersion !== 'number' || schemaVersion > DB_VERSION) {
    throw new Error('This backup comes from a newer version of the app. Close the app, open it again to update, then retry.');
  }
  return {
    format: FORMAT,
    schemaVersion,
    exportedAt: data.exportedAt ?? '',
    kv: data.kv ?? [],
    sessions: data.sessions,
    checkins: data.checkins ?? [],
    events: data.events ?? [],
    gtg: data.gtg ?? [],
  };
}

/** Replaces all data with the snapshot. The cloud token and status stay. */
export async function importSnapshot(s: Snapshot): Promise<void> {
  await db.transaction('rw', [db.kv, db.sessions, db.checkins, db.events, db.gtg, db.live], async () => {
    await Promise.all([db.kv.clear(), db.sessions.clear(), db.checkins.clear(), db.events.clear(), db.gtg.clear(), db.live.clear()]);
    await db.kv.bulkPut(s.kv);
    await db.sessions.bulkPut(s.sessions);
    await db.checkins.bulkPut(s.checkins);
    await db.events.bulkPut(s.events);
    await db.gtg.bulkPut(s.gtg);
  });
}

export const importJson = (text: string): Promise<void> => importSnapshot(parseSnapshot(text));

export const backupFileName = (date: string) => `calisthenics-backup-${date}.json`;

/**
 * Opens the share sheet with the file (Save to Files → iCloud Drive), or downloads it where sharing files
 * isn't supported. iOS only opens the sheet straight from a tap, so build the text before the tap [A18].
 */
export async function shareFile(name: string, text: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // NotAllowedError (the tap expired) and anything else: fall back to a download.
    }
  }
  downloadText(name, text);
  return 'downloaded';
}

function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function resetAll(): Promise<void> {
  await db.delete();
  await db.open();
}
