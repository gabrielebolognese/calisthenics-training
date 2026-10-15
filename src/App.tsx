import { useCallback, useEffect, useMemo, useState } from 'react';
import { DAY_MS, newId, useClock, useDev, type AppCtx, type Dev } from './app/context';
import { addEvent, finishLive, loadAll, requestPersistence, saveBaselines, saveSettings, type AppData } from './db/repo';
import type { AppSettings } from './db/schema';
import { computeToday } from './engine/index';
import { extraPracticePrescription } from './engine/prescribe';
import type { SessionOptions } from './engine/rules';
import { computeStats } from './engine/stats';
import { buildSteps } from './engine/steps';
import type { EngineEvent, EngineInput, SessionLog } from './engine/types';
import { setSoundEnabled } from './player/audio';
import { startSession, type LiveSession } from './player/machine';
import { Player, startGesture } from './player/Player';
import { setVoiceEnabled } from './player/voice';
import { setTraining } from './pwa';
import { Logs } from './screens/Logs';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/Settings';
import { Stats } from './screens/Stats';
import { Summary } from './screens/Summary';
import { Today } from './screens/Today';
import { TabBar, type Tab } from './ui/TabBar';

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const dev = useDev();
  const refresh = useCallback(async () => setData(await loadAll()), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!data) return;
    setSoundEnabled(data.settings.sound);
    setVoiceEnabled(data.settings.voice);
  }, [data]);

  if (!data) return null;
  if (!data.baselines) {
    return (
      <Onboarding
        onDone={async (b) => {
          await saveBaselines(b);
          await saveSettings(data.settings);
          await requestPersistence();
          await refresh();
        }}
      />
    );
  }
  return <Shell data={data as AppCtx['data']} refresh={refresh} dev={dev} />;
}

function Shell({ data, refresh, dev }: { data: AppCtx['data']; refresh: () => Promise<void>; dev: Dev }) {
  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playing, setPlaying] = useState<{ live: LiveSession; resumed: boolean } | null>(() =>
    data.live ? { live: data.live, resumed: true } : null,
  );
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [options, setOptions] = useState<SessionOptions>({});
  const clock = useClock();
  const offsetMs = dev.offsetDays * DAY_MS;
  const now = clock + offsetMs;
  const minute = Math.floor(now / 60_000);

  useEffect(() => {
    void requestPersistence();
  }, []);

  // App updates wait until no session is running.
  useEffect(() => setTraining(playing !== null), [playing]);

  const input: EngineInput = useMemo(
    () => ({ baselines: data.baselines, settings: data.settings, sessions: data.sessions, checkins: data.checkins, events: data.events }),
    [data],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => computeToday(input, now, options), [input, minute, options]);
  const stats = useMemo(() => computeStats(input, today), [input, today]);

  // Each tab opens at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, settingsOpen]);

  const ctx: AppCtx = {
    data,
    input,
    today,
    stats,
    now,
    dev,
    refresh,
    addEvent: async (e: EngineEvent) => {
      await addEvent(e);
      await refresh();
    },
    updateSettings: async (patch: Partial<AppSettings>) => {
      await saveSettings({ ...data.settings, ...patch });
      await refresh();
    },
    openSettings: () => setSettingsOpen(true),
  };

  const speed = dev.on ? 10 : 1;
  const begin = (live: LiveSession) => setPlaying({ live, resumed: false });

  const start = () => {
    startGesture(data.settings);
    begin(
      startSession({
        id: newId(),
        key: today.walk.current.key,
        date: today.date,
        prescription: today.prescription,
        steps: today.steps,
        now: Date.now(),
        speed,
        options,
      }),
    );
  };

  const startExtra = () => {
    startGesture(data.settings);
    const prescription = extraPracticePrescription(today.walk.current, today.states, input);
    begin(startSession({ id: newId(), key: 'extra', date: today.date, prescription, steps: buildSteps(prescription), now: Date.now(), speed }));
  };

  const finish = async (log: SessionLog) => {
    // Dev date offset: store the session at the fake time so the engine orders it correctly.
    const shifted = offsetMs ? { ...log, startedAt: log.startedAt + offsetMs, finishedAt: log.finishedAt + offsetMs } : log;
    await finishLive(shifted);
    await refresh();
    setPlaying(null);
    setOptions({});
    setSummaryId(log.id);
  };

  if (playing) {
    return <Player key={playing.live.id} initial={playing.live} settings={data.settings} needsGesture={playing.resumed} onFinish={finish} />;
  }
  if (summaryId) return <Summary ctx={ctx} id={summaryId} onClose={() => setSummaryId(null)} />;

  return (
    <>
      <div className="view" key={settingsOpen ? 'settings' : tab}>
        {settingsOpen ? (
          <SettingsScreen ctx={ctx} onBack={() => setSettingsOpen(false)} />
        ) : (
          <>
            {tab === 'today' && <Today ctx={ctx} onStart={start} onExtra={startExtra} options={options} setOptions={setOptions} />}
            {tab === 'stats' && <Stats ctx={ctx} />}
            {tab === 'logs' && <Logs ctx={ctx} />}
          </>
        )}
      </div>
      <TabBar
        tab={settingsOpen ? null : tab}
        onChange={(t) => {
          setSettingsOpen(false);
          setTab(t);
        }}
      />
    </>
  );
}
