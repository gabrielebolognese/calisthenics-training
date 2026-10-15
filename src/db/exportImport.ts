// Export everything to a JSON file, import it back, reset (brief §10 Settings).
import { db } from './schema';

const FORMAT = 'calisthenics-backup';
const VERSION = 1;

export async function exportJson(): Promise<string> {
  const data = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    kv: await db.kv.toArray(),
    sessions: await db.sessions.toArray(),
    checkins: await db.checkins.toArray(),
    events: await db.events.toArray(),
    gtg: await db.gtg.toArray(),
  };
  return JSON.stringify(data, null, 1);
}

export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replaces all data with the backup. Throws on a file that isn't a backup. */
export async function importJson(text: string): Promise<void> {
  const data = JSON.parse(text);
  if (data?.format !== FORMAT || !Array.isArray(data.sessions)) throw new Error('This file is not a Calisthenics backup.');
  await db.transaction('rw', [db.kv, db.sessions, db.checkins, db.events, db.gtg, db.live], async () => {
    await Promise.all([db.kv.clear(), db.sessions.clear(), db.checkins.clear(), db.events.clear(), db.gtg.clear(), db.live.clear()]);
    await db.kv.bulkPut(data.kv ?? []);
    await db.sessions.bulkPut(data.sessions);
    await db.checkins.bulkPut(data.checkins ?? []);
    await db.events.bulkPut(data.events ?? []);
    await db.gtg.bulkPut(data.gtg ?? []);
  });
}

export async function resetAll(): Promise<void> {
  await db.delete();
  await db.open();
}
