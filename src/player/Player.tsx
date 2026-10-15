import { useEffect, useRef, useState, type ReactNode } from 'react';
import { saveLive } from '../db/repo';
import type { AppSettings } from '../db/schema';
import { stepLabel, type Step } from '../engine/steps';
import type { SessionLog } from '../engine/types';
import { EFFORT_RULES, STANDARDS } from '../plan/exercises';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';
import { beep, unlockAudio } from './audio';
import { countdownCue, transitionCue, type Cue } from './cues';
import {
  currentLine,
  elapsedMs,
  emomRound,
  reduce,
  remainingMs,
  tick,
  toSessionLog,
  type Action,
  type LiveSession,
} from './machine';
import { clock, useNow } from './timer';
import { primeVoice, say } from './voice';
import { screenAwake, type AwakeStatus } from './wakeLock';

function play(c: Cue | null) {
  if (!c) return;
  if (c.beep) beep(c.beep);
  if (c.say) say(c.say);
}

function useAwake(): AwakeStatus {
  const [s, setS] = useState<AwakeStatus>(screenAwake.status);
  useEffect(() => {
    const off = screenAwake.subscribe(setS);
    return () => void off();
  }, []);
  return s;
}

/** Everything a tap from the START button has to do: audio, voice, screen lock (brief §7). */
export function startGesture(settings: AppSettings): void {
  unlockAudio(settings.audioMode);
  primeVoice();
  void screenAwake.start();
}

export function Player({
  initial,
  settings,
  needsGesture,
  onFinish,
}: {
  initial: LiveSession;
  settings: AppSettings;
  /** Resumed after a reload: audio and the screen lock need one tap to come back. */
  needsGesture: boolean;
  onFinish: (log: SessionLog) => void;
}) {
  const [s, setS] = useState(initial);
  const [menu, setMenu] = useState(false);
  const [how, setHow] = useState(false);
  const [gate, setGate] = useState(needsGesture);
  const now = useNow(!s.finished);
  const awake = useAwake();
  const prev = useRef<LiveSession | null>(needsGesture ? initial : null);
  const countdown = useRef({ key: '', ms: null as number | null, round: 0 });
  const finished = useRef(false);

  const dispatch = (a: Action) => setS((cur) => reduce(cur, a, Date.now()));

  // Timers: compare timestamps on every frame.
  useEffect(() => {
    setS((cur) => tick(cur, now));
  }, [now]);

  // Persist every change, cue every transition, hand over when finished.
  useEffect(() => {
    if (!s.finished && (s !== initial || !needsGesture)) void saveLive(s);
    play(transitionCue(prev.current, s));
    prev.current = s;
    if (s.finished && !finished.current) {
      finished.current = true;
      screenAwake.stop();
      onFinish(toSessionLog(s, Date.now()));
    }
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown beeps, "10 seconds", EMOM rounds.
  useEffect(() => {
    const key = `${s.index}:${s.phase.k}`;
    const cur = { ms: remainingMs(s, now), round: emomRound(s, now) };
    if (countdown.current.key === key) play(countdownCue(s, countdown.current, cur));
    countdown.current = { key, ...cur };
  }, [now, s]);

  // Release the screen lock when leaving the player.
  useEffect(() => () => screenAwake.stop(), []);

  const st = s.steps[s.index];
  const p = s.phase;
  if (!st || s.finished) return <div className="player" />;

  const left = remainingMs(s, now);
  const work = st.kind !== 'rest' && st.kind !== 'warmup' ? st : null;
  const li = currentLine(s);
  const lineName = li !== undefined ? s.prescription.lines[li]?.name : undefined;

  const title = st.kind === 'warmup' ? 'Warm-up' : st.kind === 'rest' ? (st.reason === 'switch' ? 'Switch' : 'Rest') : st.name;
  const sub = subtitle(st, p, s, now);
  const progress = (s.index / s.steps.length) * 100;

  return (
    <div className={`player phase-${phaseClass(p.k)}`}>
      {(p.k === 'hold' || p.k === 'stopwatch') && (
        <button className="tap-anywhere" aria-label="Stop" onPointerDown={() => dispatch({ type: 'stop' })} />
      )}

      <div className="player-top">
        <div>
          <div className="player-title">{title}</div>
          {sub && <div className="player-sub">{sub}</div>}
        </div>
        <div className="player-icons" style={{ position: 'relative', zIndex: 2 }}>
          <span className={`awake ${awake === 'native' || awake === 'video' ? 'on' : awake === 'failed' ? 'fail' : ''}`}>
            <i /> {awake === 'native' || awake === 'video' ? 'Screen on' : awake === 'failed' ? 'May lock' : 'Screen'}
          </span>
          <button className="icon-btn" aria-label="Menu" onClick={() => setMenu(true)}>
            ⋯
          </button>
        </div>
      </div>
      <div className="progress">
        <div style={{ width: `${progress}%` }} />
      </div>
      {awake === 'failed' && <div className="warnline">Screen may lock. Set Auto-Lock to Never while training.</div>}

      <div className="player-main">
        <Main s={s} st={st} now={now} left={left} dispatch={dispatch} />
        {work && p.k !== 'ask' && (
          <>
            <div className="cue">{work.cue}</div>
            {work.note && <div className="note">{work.note}</div>}
            <button className="btn btn-ghost" style={{ position: 'relative', zIndex: 2 }} onClick={() => setHow((h) => !h)}>
              {how ? 'Hide' : 'How?'}
            </button>
            {how && (
              <div className="how">
                <p style={{ marginTop: 0 }}>{STANDARDS[work.standard]}</p>
                {EFFORT_RULES.map((r) => (
                  <div key={r}>· {r}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="player-bottom" style={{ position: 'relative', zIndex: 2 }}>
        <Bottom s={s} st={st} dispatch={dispatch} />
      </div>

      {menu && (
        <Sheet title="Session" onClose={() => setMenu(false)}>
          {st.kind === 'warmup' && (
            <button className="btn" onClick={() => (dispatch({ type: 'skipWarmup' }), setMenu(false))}>
              Skip warm-up
            </button>
          )}
          {lineName && (p.k === 'total' || p.k === 'totalRest' || p.k === 'attempt' || p.k === 'attemptRest' || p.k === 'practice') && (
            <button className="btn" onClick={() => (dispatch({ type: 'endLine' }), setMenu(false))}>
              Finish this exercise
            </button>
          )}
          {lineName && (
            <button className="btn" onClick={() => (dispatch({ type: 'pain' }), setMenu(false))}>
              Stop {lineName} (pain)
            </button>
          )}
          <button className="btn btn-danger" onClick={() => (dispatch({ type: 'finishEarly' }), setMenu(false))}>
            Finish early and save
          </button>
          <button className="btn btn-ghost" onClick={() => setMenu(false)}>
            Close
          </button>
        </Sheet>
      )}

      {gate && (
        <Sheet title="Resume session" onClose={() => undefined}>
          <p className="muted" style={{ margin: 0 }}>
            The session continues where you left it. One tap turns sound and the screen lock back on.
          </p>
          <button
            className="btn btn-primary btn-big"
            onClick={() => {
              startGesture(settings);
              setGate(false);
            }}
          >
            CONTINUE
          </button>
        </Sheet>
      )}
    </div>
  );
}

function phaseClass(k: LiveSession['phase']['k']): string {
  if (k === 'hold' || k === 'stopwatch' || k === 'emom') return 'hold';
  if (k === 'rest' || k === 'totalRest' || k === 'attemptRest' || k === 'warmup') return 'rest';
  if (k === 'ready') return 'ready';
  return 'work';
}

function subtitle(st: Step, p: LiveSession['phase'], s: LiveSession, now: number): string | null {
  if (st.kind === 'warmup' && p.k === 'warmup') return `${p.item + 1} of ${st.items.length}`;
  if (st.kind === 'rest') return null;
  if (st.kind === 'hold' || st.kind === 'reps') return st.sets > 1 ? `Set ${st.set + 1} of ${st.sets}` : null;
  if (st.kind === 'emom' && p.k === 'emom') return `Round ${emomRound(s, now) + 1} of ${st.rounds}`;
  if (st.kind === 'emom') return `${st.rounds} rounds`;
  if (st.kind === 'totalReps' && (p.k === 'total' || p.k === 'totalRest')) return `Set ${p.sets.length + (p.k === 'total' ? 1 : 0)}`;
  if (st.kind === 'attempts' && (p.k === 'attempt' || p.k === 'attemptRest')) return `Attempt ${p.i + 1} of ${st.count}`;
  return null;
}

type MainProps = { s: LiveSession; st: Step; now: number; left: number | null; dispatch: (a: Action) => void };

function Main({ s, st, now, left, dispatch }: MainProps): ReactNode {
  const p = s.phase;
  const secs = left !== null ? Math.ceil(left / 1000) : 0;

  switch (p.k) {
    case 'warmup': {
      if (st.kind !== 'warmup') return null;
      const next = st.items[p.item + 1];
      return (
        <>
          <div className="kicker">Warm-up</div>
          <div className="big">{st.items[p.item]!.name}</div>
          <div className="huge">{clock(left ?? 0)}</div>
          {next && <div className="next">Then: {next.name}</div>}
        </>
      );
    }
    case 'rest':
      return (
        <>
          <div className="kicker">{st.kind === 'rest' && st.reason === 'switch' ? 'Switch' : 'Rest'}</div>
          <div className="huge">{clock(left ?? 0)}</div>
          {st.kind === 'rest' && st.next && <div className="cue">Next: {st.next}</div>}
        </>
      );
    case 'ready':
      return (
        <>
          <div className="kicker">Get in position</div>
          {st.kind === 'hold' && st.sideLabel && <div className="side">{st.sideLabel}</div>}
          <div className="big">
            {st.kind === 'hold' ? `HOLD ${st.seconds} s` : st.kind === 'emom' ? `${st.rounds} × ${st.reps}` : 'MAX HOLD'}
          </div>
          {st.kind === 'maxHold' && st.sideLabel && <div className="side">{st.sideLabel}</div>}
          <div className="huge">{secs}</div>
        </>
      );
    case 'hold':
      return (
        <>
          <div className="kicker">Hold</div>
          {st.kind === 'hold' && st.sideLabel && <div className="side">{st.sideLabel}</div>}
          <div className="huge">{secs}</div>
          <div className="next">Tap anywhere if you break early</div>
        </>
      );
    case 'stopwatch':
      return (
        <>
          <div className="kicker">Max hold</div>
          {st.kind === 'maxHold' && st.sideLabel && <div className="side">{st.sideLabel}</div>}
          <div className="huge">{Math.floor(elapsedMs(s, now) / 1000)}</div>
          <div className="next">Tap anywhere to stop</div>
        </>
      );
    case 'reps': {
      if (st.kind !== 'reps') return null;
      return (
        <>
          {st.load ? <div className="big">+{st.load} kg</div> : null}
          <div className="huge">{st.reps}</div>
          <div className="kicker">{st.perSide ? 'per side' : st.reps === 1 ? 'rep' : 'reps'}</div>
          {st.rir && <div className="muted">RIR {st.rir}</div>}
        </>
      );
    }
    case 'adjust': {
      if (st.kind !== 'reps') return null;
      return (
        <div style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 2 }} className="stack">
          <div className="kicker">Reps done{st.perSide ? ' per side' : ''}</div>
          <Stepper value={p.reps} max={st.reps} onChange={(v) => dispatch({ type: 'adjust', reps: v })} />
          <label className="toggle card">
            <span>{st.notCleanLabel ?? 'Not clean'}</span>
            <input type="checkbox" checked={!p.clean} onChange={(e) => dispatch({ type: 'adjust', clean: !e.target.checked })} />
          </label>
          {st.endOnNotClean && !p.clean && <div className="note">This ends the exercise for today.</div>}
        </div>
      );
    }
    case 'emom': {
      if (st.kind !== 'emom') return null;
      return (
        <>
          <div className="kicker">Round {emomRound(s, now) + 1} of {st.rounds}</div>
          <div className="huge">{st.reps}</div>
          <div className="kicker">{st.reps === 1 ? 'rep' : 'reps'}</div>
          <div className="big num">{clock(left ?? 0)}</div>
        </>
      );
    }
    case 'total':
    case 'totalRest': {
      if (st.kind !== 'totalReps') return null;
      const done = p.sets.reduce((a, x) => a + (x.reps ?? 0), 0);
      const top = st.topSet && p.sets.length === 0;
      return (
        <>
          <div className="kicker">{top ? 'Top set · RIR 1' : `Total ${st.total} · RIR ${st.rir ?? '2'}`}</div>
          <div className="huge">{st.total - done}</div>
          <div className="kicker">to go</div>
          {p.k === 'totalRest' && <div className="big num" style={{ color: 'var(--rest)' }}>{clock(left ?? 0)}</div>}
          {st.lastSetsUsed && <div className="next">Last time: {st.lastSetsUsed} sets</div>}
          {p.k === 'total' && (
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Stepper value={p.value} min={0} max={st.total} onChange={(v) => dispatch({ type: 'count', value: v })} />
            </div>
          )}
        </>
      );
    }
    case 'count':
      return (
        <>
          <div className="kicker">Max reps{st.kind === 'amrap' && st.sideLabel ? ` · ${st.sideLabel}` : ''}</div>
          <div className="next">Clean reps only</div>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <Stepper value={p.value} onChange={(v) => dispatch({ type: 'count', value: v })} />
          </div>
        </>
      );
    case 'practice':
      return (
        <>
          <div className="kicker">Practice</div>
          <div className="huge">{clock(left ?? 0)}</div>
        </>
      );
    case 'attempt':
    case 'attemptRest':
      if (st.kind !== 'attempts') return null;
      return (
        <>
          <div className="kicker">
            Attempt {p.i + 1} of {st.count}
          </div>
          {p.k === 'attemptRest' ? <div className="huge">{clock(left ?? 0)}</div> : <div className="big">Clean?</div>}
        </>
      );
    case 'ask':
      return <Ask q={p.queue[0]!} dispatch={dispatch} />;
    default:
      return null;
  }
}

function Ask({ q, dispatch }: { q: 'effort' | 'barHeight' | 'endedBy'; dispatch: (a: Action) => void }) {
  if (q === 'effort') {
    return (
      <div className="stack" style={{ width: '100%', maxWidth: 420 }}>
        <div className="big">How was it?</div>
        <button className="btn btn-block btn-big" onClick={() => dispatch({ type: 'answer', q: 'effort', value: 'easy' })}>
          Easy
        </button>
        <button className="btn btn-block btn-big btn-primary" onClick={() => dispatch({ type: 'answer', q: 'effort', value: 'right' })}>
          Right
        </button>
        <button className="btn btn-block btn-big" onClick={() => dispatch({ type: 'answer', q: 'effort', value: 'hard' })}>
          Hard
        </button>
        <div className="next">Easy: more left than the RIR. Hard: past it, or grinding. Hard repeats next time.</div>
      </div>
    );
  }
  if (q === 'barHeight') {
    return (
      <div className="stack" style={{ width: '100%', maxWidth: 420 }}>
        <div className="big">Bar height?</div>
        {(
          [
            ['chest', 'Chest'],
            ['lowerChest', 'Lower chest'],
            ['waist', 'Waist'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} className="btn btn-block btn-big" onClick={() => dispatch({ type: 'answer', q: 'barHeight', value: v })}>
            {label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="stack" style={{ width: '100%', maxWidth: 420 }}>
      <div className="big">What ended it?</div>
      <button className="btn btn-block btn-big" onClick={() => dispatch({ type: 'answer', q: 'endedBy', value: 'balance' })}>
        Balance
      </button>
      <button className="btn btn-block btn-big" onClick={() => dispatch({ type: 'answer', q: 'endedBy', value: 'shoulders' })}>
        Shoulders
      </button>
    </div>
  );
}

function Bottom({ s, st, dispatch }: { s: LiveSession; st: Step; dispatch: (a: Action) => void }): ReactNode {
  const p = s.phase;
  switch (p.k) {
    case 'warmup':
      return (
        <div className="secondary-row">
          <button className="btn btn-small" onClick={() => dispatch({ type: 'skip' })}>
            Next item
          </button>
          <button className="btn btn-small" onClick={() => dispatch({ type: 'skipWarmup' })}>
            Skip warm-up
          </button>
        </div>
      );
    case 'rest':
    case 'totalRest':
    case 'attemptRest':
      return (
        <>
          <div className="secondary-row">
            <button className="btn btn-small" onClick={() => dispatch({ type: 'addRest' })}>
              +15 s
            </button>
            <button className="btn btn-small" onClick={() => dispatch({ type: 'skip' })}>
              Skip
            </button>
          </div>
        </>
      );
    case 'ready':
      return (
        <div className="secondary-row">
          <button className="btn btn-small" onClick={() => dispatch({ type: 'skip' })}>
            Start now
          </button>
        </div>
      );
    case 'reps':
      return (
        <>
          <button className="btn btn-primary btn-block btn-big" onClick={() => dispatch({ type: 'done' })}>
            DONE
          </button>
          <div className="secondary-row">
            <button className="btn btn-ghost" onClick={() => dispatch({ type: 'less' })}>
              Less / not clean
            </button>
          </div>
        </>
      );
    case 'adjust':
      return (
        <>
          <button className="btn btn-primary btn-block btn-big" onClick={() => dispatch({ type: 'confirm' })}>
            SAVE
          </button>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'back' })}>
            Back
          </button>
        </>
      );
    case 'emom':
      return (
        <div className="secondary-row">
          <button className="btn btn-small" onClick={() => dispatch({ type: 'missed' })}>
            Missed
          </button>
          {st.kind === 'emom' && st.endOnNotClean && (
            <button className="btn btn-small btn-danger" onClick={() => dispatch({ type: 'partial' })}>
              {st.notCleanLabel ?? 'Not clean'}
            </button>
          )}
        </div>
      );
    case 'total':
      return (
        <button className="btn btn-primary btn-block btn-big" onClick={() => dispatch({ type: 'confirm' })}>
          SAVE SET
        </button>
      );
    case 'count':
      return (
        <button className="btn btn-primary btn-block btn-big" onClick={() => dispatch({ type: 'confirm' })}>
          SAVE
        </button>
      );
    case 'practice':
      return (
        <div className="secondary-row">
          <button className="btn btn-small" onClick={() => dispatch({ type: 'endLine' })}>
            End practice
          </button>
        </div>
      );
    case 'attempt':
      return (
        <div className="two-col">
          <button className="btn btn-big" onClick={() => dispatch({ type: 'attempt', ok: false })}>
            No
          </button>
          <button className="btn btn-big btn-primary" onClick={() => dispatch({ type: 'attempt', ok: true })}>
            Yes
          </button>
        </div>
      );
    default:
      return st.kind === 'rest' ? <div className="next">{stepLabel(st)}</div> : null;
  }
}
