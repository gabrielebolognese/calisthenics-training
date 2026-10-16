// The app's one Cloud instance, wired to IndexedDB and fetch.
import { useSyncExternalStore } from 'react';
import { importSnapshot, makeSnapshot } from '../db/exportImport';
import { db } from '../db/schema';
import { Cloud, type CloudState, type CloudView } from './core';

export { CloudError, type CloudView, type SnapshotInfo } from './core';

export const cloud = new Cloud({
  fetch: (url, init) => fetch(url, init),
  load: async () => {
    const [token, state] = await Promise.all([db.sync.get('token'), db.sync.get('state')]);
    return { token: (token?.value as string | undefined) ?? null, state: (state?.value as CloudState | undefined) ?? null };
  },
  saveToken: async (token) => {
    if (token) await db.sync.put({ key: 'token', value: token });
    else await db.sync.delete('token');
  },
  saveState: async (state) => {
    await db.sync.put({ key: 'state', value: state });
  },
  local: async () => ((await db.kv.get('baselines')) ? makeSnapshot() : null),
  replace: importSnapshot,
  later: (fn, ms) => {
    const t = window.setTimeout(fn, ms);
    return () => window.clearTimeout(t);
  },
});

export const useCloud = (): CloudView => useSyncExternalStore(cloud.subscribe, cloud.getView);

/** Backs up on open, whenever the app comes back to the foreground, and when the connection returns [A16]. */
export function startAutoBackup(): () => void {
  const go = () => void cloud.auto();
  const visible = () => document.visibilityState === 'visible' && go();
  go();
  window.addEventListener('online', go);
  document.addEventListener('visibilitychange', visible);
  return () => {
    window.removeEventListener('online', go);
    document.removeEventListener('visibilitychange', visible);
  };
}
