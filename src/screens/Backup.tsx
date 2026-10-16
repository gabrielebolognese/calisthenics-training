// Cloud backup UI: the Settings card, the restore picker, and the restore offer on a fresh install (A12–A19).
import { useEffect, useRef, useState } from 'react';
import { formatWhen, plural } from '../app/context';
import { cloud, CloudError, useCloud, type CloudView, type SnapshotInfo } from '../cloud';
import { exportJson, importJson } from '../db/exportImport';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

/** Builds the export file before the tap: iOS only opens the share sheet straight from a tap [A18]. */
export function useExportText(enabled: boolean, data: unknown): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void exportJson().then((t) => live && setText(t));
    return () => {
      live = false;
    };
  }, [enabled, data]);
  return text;
}

const sessionsText = (n: number | null | undefined) => (n === null || n === undefined ? 'sessions unknown' : plural(n, 'session'));

function errorText(e: unknown): string {
  if (e instanceof CloudError && e.kind === 'offline') return 'No connection. Try again when you’re online.';
  return e instanceof Error ? e.message : String(e);
}

export function cloudLine(v: CloudView): { tone: 'idle' | 'busy' | 'good' | 'warn' | 'bad'; title: string; detail: string } {
  const last = v.lastAt ? `Last backup ${formatWhen(v.lastAt)}, ${sessionsText(v.lastSessions)}.` : 'Nothing backed up yet.';
  if (!v.hasToken) return { tone: 'idle', title: 'Off', detail: 'Paste your backup token to turn it on.' };
  if (v.busy) return { tone: 'busy', title: 'Backing up…', detail: last };
  switch (v.status) {
    case 'ok':
      return v.restored && v.lastAt
        ? { tone: 'good', title: 'Up to date', detail: `Restored the backup from ${formatWhen(v.lastAt)}, ${sessionsText(v.lastSessions)}.` }
        : { tone: 'good', title: 'Up to date', detail: last };
    case 'offline':
      return { tone: 'warn', title: 'Waiting for a connection', detail: `${last} It retries by itself.` };
    case 'error':
      return { tone: 'warn', title: 'Couldn’t back up', detail: `${v.message ?? ''} It retries by itself. ${last}`.trim() };
    case 'auth':
      return { tone: 'bad', title: 'Token rejected', detail: 'It doesn’t match the token from the Supabase setup. Paste it again.' };
    case 'setup':
      return { tone: 'bad', title: 'Server not set up', detail: v.message ?? '' };
    case 'fewer':
      return {
        tone: 'warn',
        title: 'Paused',
        detail: `This phone has ${sessionsText(v.localSessions)}, the cloud backup has ${sessionsText(v.cloudSessions)}. Backing up would replace it, so it waits for you.`,
      };
    default:
      return { tone: 'idle', title: 'Not backed up yet', detail: 'It backs up after your next session.' };
  }
}

/** Settings → Cloud backup. */
export function CloudCard({ localSessions, onRestored }: { localSessions: number; onRestored: () => Promise<void> }) {
  const v = useCloud();
  const [draft, setDraft] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [picker, setPicker] = useState(false);
  const [replace, setReplace] = useState(false);
  const [msg, setMsg] = useState('');
  const line = cloudLine(v);
  const value = draft ?? v.token ?? '';

  return (
    <div className="card stack">
      <div className={`cloud-line ${line.tone}`}>
        <span className="cloud-dot" />
        <div>
          <strong>{line.title}</strong>
          <div className="small muted">{line.detail}</div>
        </div>
      </div>

      {v.status === 'fewer' && !v.busy && (
        <div className="banner warn">
          <strong>Keep which data?</strong>
          <div className="small muted">Restore the cloud backup onto this phone, or replace it with this phone’s data. Older backups stay in the list either way.</div>
          <div className="actions">
            <button className="btn btn-small" onClick={() => setPicker(true)}>
              Restore
            </button>
            <button
              className="btn btn-small btn-danger"
              onClick={() => {
                if (!replace) return setReplace(true);
                setReplace(false);
                void cloud.replaceCloud();
              }}
            >
              {replace ? 'Tap again to replace' : 'Replace cloud backup'}
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="token">Backup token</label>
        <div className="token-row">
          <input
            id="token"
            type={show ? 'text' : 'password'}
            value={value}
            placeholder="Paste it here"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn btn-small" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {draft !== null && draft.trim() !== (v.token ?? '') && (
        <button
          className="btn btn-primary btn-block"
          onClick={async () => {
            await cloud.setToken(draft);
            setDraft(null);
            setMsg('');
            void cloud.auto();
          }}
        >
          {draft.trim() ? 'Save token' : 'Remove token'}
        </button>
      )}

      <button className="btn btn-block" disabled={!v.hasToken || v.busy} onClick={() => void cloud.backupNow()}>
        <Icon name="cloud" size={22} />
        {v.busy ? 'Backing up…' : 'Back up now'}
      </button>
      <button className="btn btn-block" disabled={!v.hasToken} onClick={() => setPicker(true)}>
        Restore from backup
      </button>
      <div className="small muted">
        It backs up by itself after every session and check-in, and when you open the app with changes. Offline, it waits and retries. The
        token stays on this phone and is never put in a backup.
      </div>
      {msg && <div className="small">{msg}</div>}

      {picker && (
        <RestoreSheet
          localSessions={localSessions}
          onClose={() => setPicker(false)}
          onRestored={async (n, at) => {
            await onRestored();
            setMsg(`Restored ${plural(n, 'session')} from the backup of ${formatWhen(Date.parse(at))}.`);
          }}
        />
      )}
    </div>
  );
}

/** Every snapshot in the cloud, newest first. Tap one, then confirm. */
export function RestoreSheet({
  localSessions,
  onClose,
  onRestored,
}: {
  localSessions: number;
  onClose: () => void;
  onRestored: (sessions: number, at: string) => Promise<void>;
}) {
  const [items, setItems] = useState<SnapshotInfo[] | null>(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState<SnapshotInfo | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    cloud.list().then(setItems, (e) => setError(errorText(e)));
  }, []);

  const restore = async () => {
    if (!pick) return;
    setWorking(true);
    setError('');
    try {
      const n = await cloud.restore(pick.key);
      await onRestored(n, pick.at);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setWorking(false);
    }
  };

  return (
    <Sheet title="Restore from backup" onClose={onClose}>
      {!items && !error && <div className="small muted">Loading backups…</div>}
      {items?.length === 0 && <div className="small muted">No backups yet.</div>}
      {items && items.length > 0 && (
        <ul className="list snap-list">
          {items.map((s) => (
            <li key={s.key}>
              <button aria-pressed={pick?.key === s.key} onClick={() => setPick(s)}>
                <span>
                  <strong>{formatWhen(Date.parse(s.at))}</strong>
                  <div className="small muted">
                    {sessionsText(s.sessions)}
                    {s.latest ? ' · latest' : ''}
                  </div>
                </span>
                {pick?.key === s.key && <Icon name="checkCircle" size={26} />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pick && (
        <>
          <div className="small muted">
            Replaces everything on this phone ({sessionsText(localSessions)}) with this backup ({sessionsText(pick.sessions)}).
          </div>
          <button className="btn btn-primary btn-block" disabled={working} onClick={() => void restore()}>
            {working ? 'Restoring…' : 'Restore this backup'}
          </button>
        </>
      )}
      {error && <div className="warnline">{error}</div>}
    </Sheet>
  );
}

/**
 * Onboarding on an empty phone: paste the token (or use the one saved), then one tap restores the latest backup.
 * A backup file works too (moving from the old address, or no cloud at all).
 */
export function RestoreOffer({ onRestored }: { onRestored: () => Promise<void> }) {
  const v = useCloud();
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'ask' | 'looking' | 'found' | 'none'>('ask');
  const [latest, setLatest] = useState<SnapshotInfo | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [older, setOlder] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const find = async () => {
    setPhase('looking');
    setError('');
    try {
      const items = await cloud.list();
      setLatest(items[0] ?? null);
      setPhase(items[0] ? 'found' : 'none');
    } catch (e) {
      setError(errorText(e));
      setPhase('ask');
    }
  };

  // A token is already on this phone: look for its backup straight away.
  useEffect(() => {
    if (v.loaded && v.hasToken) void find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.loaded]);

  const restore = async () => {
    setWorking(true);
    setError('');
    try {
      await cloud.restore();
      await onRestored();
    } catch (e) {
      setError(errorText(e));
      setWorking(false);
    }
  };

  return (
    <div className="card stack restore-offer">
      <div className="restore-head">
        <span className="restore-icon">
          <Icon name="cloud" size={20} />
        </span>
        <strong>Restore from cloud backup</strong>
      </div>

      {phase === 'found' && latest ? (
        <>
          <div>
            Backup from <strong>{formatWhen(Date.parse(latest.at))}</strong>, {sessionsText(latest.sessions)}.
          </div>
          <button className="btn btn-primary btn-big btn-block" disabled={working} onClick={() => void restore()}>
            {working ? 'Restoring…' : 'Restore'}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setOlder(true)}>
            Choose an older backup
          </button>
        </>
      ) : phase === 'looking' ? (
        <div className="small muted">Looking for your backup…</div>
      ) : (
        <>
          <div className="small muted">
            {phase === 'none' ? 'No backups for this token yet.' : 'Reinstalled the app? Paste your backup token to bring everything back.'}
          </div>
          <input
            type="password"
            aria-label="Backup token"
            placeholder="Backup token"
            value={draft}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="btn btn-block"
            disabled={!draft.trim()}
            onClick={async () => {
              await cloud.setToken(draft);
              await find();
            }}
          >
            Find my backup
          </button>
        </>
      )}
      {error && <div className="warnline">{error}</div>}

      <button className="btn btn-ghost btn-block" onClick={() => file.current?.click()}>
        Import a backup file instead
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            await importJson(await f.text());
            await onRestored();
          } catch (err) {
            setError(errorText(err));
          }
        }}
      />

      {older && <RestoreSheet localSessions={0} onClose={() => setOlder(false)} onRestored={onRestored} />}
    </div>
  );
}
