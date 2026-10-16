import { useEffect, useRef, useState } from 'react';
import { DAY_MS, formatDate, positionLabel, type AppCtx } from '../app/context';
import { backupFileName, exportJson, importJson, resetAll, shareFile } from '../db/exportImport';
import type { AppSettings } from '../db/schema';
import { localDate } from '../engine/dates';
import { screenAwake, type AwakeStatus } from '../player/wakeLock';
import { Header } from '../ui/Header';
import { CloudCard, useExportText } from './Backup';

/** Brief §10 Settings. */
export function SettingsScreen({ ctx, onBack }: { ctx: AppCtx; onBack: () => void }) {
  const s = ctx.data.settings;
  const set = (patch: Partial<AppSettings>) => void ctx.updateSettings(patch);
  const cur = ctx.today.walk.current;
  const [week, setWeek] = useState(cur.pos.week);
  const [day, setDay] = useState(cur.pos.day);
  const [shiftOk, setShiftOk] = useState(false);
  const [awake, setAwake] = useState<AwakeStatus>(screenAwake.status);
  const [testing, setTesting] = useState(false);
  const [reset, setReset] = useState(0);
  const [msg, setMsg] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const exportText = useExportText(true, ctx.data);

  useEffect(() => screenAwake.subscribe(setAwake), []);
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const toggle = (k: keyof AppSettings, label: string, hint?: string) => (
    <label className="toggle">
      <span>
        {label}
        {hint && <div className="small muted">{hint}</div>}
      </span>
      <input
        type="checkbox"
        checked={Boolean(s[k])}
        onChange={(e) => set({ [k]: e.target.checked, ...(k === 'gtg' && e.target.checked ? { gtgSince: ctx.now } : {}) })}
      />
    </label>
  );

  const choice = <T extends string | number>(value: T, options: [T, string][], onPick: (v: T) => void) => (
    <div className="row" style={{ gap: 8 }}>
      {options.map(([v, label]) => (
        <button key={String(v)} className={`btn btn-small ${v === value ? 'btn-primary' : ''}`} style={{ flex: 1, fontSize: 17 }} onClick={() => onPick(v)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen">
      <Header onBack={onBack} title="Settings" />

      <h2>Sound</h2>
      <div className="card">
        {toggle('sound', 'Beeps')}
        {toggle('voice', 'Voice cues')}
        <div className="field" style={{ marginTop: 8 }}>
          <label>Mixing with music</label>
          {choice<AppSettings['audioMode']>(
            s.audioMode,
            [
              ['transient', 'Duck briefly'],
              ['ambient', 'Mix'],
            ],
            (v) => set({ audioMode: v }),
          )}
          <div className="small muted">
            {navigator.audioSession ? 'Audio Session API available.' : 'Audio Session API not available in this browser.'}
          </div>
        </div>
      </div>

      <h2>Training</h2>
      <div className="card">
        {toggle('gtg', 'GTG on Day 3 and Day 6', 'Optional. Never in deload or test weeks.')}
        <div className="field" style={{ marginTop: 8 }}>
          <label>Smallest plate</label>
          {choice<AppSettings['plateIncrement']>(
            s.plateIncrement,
            [
              [5, '5 kg'],
              [2.5, '2.5 kg'],
              [1.25, '1.25 kg'],
            ],
            (v) => set({ plateIncrement: v }),
          )}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Human flag</label>
          {choice<AppSettings['flagSides']>(
            s.flagSides,
            [
              ['one', 'One side'],
              ['both', 'Both sides'],
            ],
            (v) => set({ flagSides: v }),
          )}
        </div>
        {toggle('abWheel', 'I have an ab wheel')}
        {toggle('bands', 'I have resistance bands', 'Needed for band-assisted straddle planche.')}
        {toggle('homeBar', 'Pull-up bar at home', 'Needed for muscle-up GTG.')}
        {toggle('archerAssistedSet', 'Extra bent-arm archer set', 'Assisted volume, never counted.')}
      </div>

      <h2>Plan position</h2>
      <div className="card stack">
        <div>
          <strong>{positionLabel(cur)}</strong>
          <div className="small muted">Started {formatDate(ctx.data.baselines.startDate)}</div>
        </div>
        <div className="two-col">
          <div className="field">
            <label htmlFor="wk">Week</label>
            <select id="wk" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dy">Day</label>
            <select id="dy" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn btn-block"
          onClick={async () => {
            if (!shiftOk) return setShiftOk(true);
            await ctx.addEvent({ type: 'jump', at: ctx.now, fromKey: cur.key, to: { cycle: cur.pos.cycle, week, day } });
            setShiftOk(false);
          }}
        >
          {shiftOk ? `Tap again: move to week ${week}, day ${day}` : 'Shift position'}
        </button>
        <div className="small muted">For corrections only. Days you already logged stay logged.</div>
      </div>

      <h2>Screen lock</h2>
      <div className="card stack">
        <div className="row spread">
          <span>Status</span>
          <strong>{{ off: 'Off', native: 'On (Wake Lock)', video: 'On (video fallback)', failed: 'Failed' }[awake]}</strong>
        </div>
        <button
          className="btn btn-block"
          onClick={() => {
            if (testing) {
              screenAwake.stop();
              setTesting(false);
            } else {
              void screenAwake.start();
              setTesting(true);
            }
          }}
        >
          {testing ? 'Stop test' : 'Test: keep the screen on'}
        </button>
        <div className="small muted">Needs iOS 18.4 or later from the home screen. If it fails, set Auto-Lock to Never while training.</div>
      </div>

      <h2>Cloud backup</h2>
      <CloudCard localSessions={ctx.data.sessions.length} onRestored={ctx.refresh} />

      <h2>Data</h2>
      <div className="card stack">
        <div className="small muted">
          Everything lives on this phone; the cloud backup is a copy. Deleting the home screen icon deletes the phone’s copy.
          {persisted !== null && ` Storage is ${persisted ? 'persistent' : 'not marked persistent yet'}.`}
        </div>
        <button
          className="btn btn-block"
          onClick={async () => {
            await shareFile(backupFileName(localDate(ctx.now)), exportText ?? (await exportJson()));
          }}
        >
          Export backup file
        </button>
        <div className="small muted">Opens the share sheet: Save to Files → iCloud Drive.</div>
        <button className="btn btn-block" onClick={() => file.current?.click()}>
          Import backup file
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importJson(await f.text());
              await ctx.refresh();
              setMsg('Backup imported.');
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Import failed.');
            }
            e.target.value = '';
          }}
        />
        <button
          className="btn btn-danger btn-block"
          onClick={async () => {
            if (reset < 2) return setReset(reset + 1);
            await resetAll();
            location.reload();
          }}
        >
          {['Reset all data', 'Are you sure? Tap again', 'Last chance: tap to delete everything'][reset]}
        </button>
        {msg && <div className="small">{msg}</div>}
      </div>

      {ctx.dev.on && (
        <>
          <h2>Dev</h2>
          <div className="card stack">
            <div className="small muted">Timers run 10x faster. Fake date: {formatDate(localDate(ctx.now))}</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-small" style={{ flex: 1 }} onClick={() => ctx.dev.setOffsetDays(ctx.dev.offsetDays - 1)}>
                −1 day
              </button>
              <button className="btn btn-small" style={{ flex: 1 }} onClick={() => ctx.dev.setOffsetDays(ctx.dev.offsetDays + 1)}>
                +1 day
              </button>
              <button className="btn btn-small" style={{ flex: 1 }} onClick={() => ctx.dev.setOffsetDays(ctx.dev.offsetDays + 7)}>
                +1 week
              </button>
              <button className="btn btn-small" style={{ flex: 1 }} onClick={() => ctx.dev.setOffsetDays(0)}>
                Today
              </button>
            </div>
            <div className="small muted">Offset: {ctx.dev.offsetDays} days ({Math.round((ctx.dev.offsetDays * DAY_MS) / 3_600_000)} h)</div>
          </div>
        </>
      )}
    </div>
  );
}
