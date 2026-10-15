import { useState, type ReactNode } from 'react';
import { formatDate, formatDuration, positionShort, useDrill, type AppCtx } from '../app/context';
import { deleteSession, saveSession } from '../db/repo';
import { describeTarget } from '../engine/describe';
import { makeCtx } from '../engine/prescribe';
import { bestTraining, latestTest, week0Points, type TestPoint } from '../engine/results';
import { sessionMs } from '../engine/stats';
import type { LineResult, SessionLog, SetResult } from '../engine/types';
import { LINES } from '../plan/progression';
import { GOALS, type Goal } from '../plan/targets';
import type { LineId } from '../plan/types';
import { Header } from '../ui/Header';
import { Icon } from '../ui/Icon';
import { LineChart } from '../ui/LineChart';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

type Segment = 'maxes' | 'sessions' | 'checkins';
const SEGMENTS: [Segment, string][] = [
  ['maxes', 'Maxes'],
  ['sessions', 'Sessions'],
  ['checkins', 'Check-ins'],
];

/** Current maxes from the tests, every session (editable) and the weekly check-ins. */
export function Logs({ ctx }: { ctx: AppCtx }) {
  const [segment, setSegment] = useState<Segment>('maxes');
  const [open, setOpen] = useDrill<string>();
  const session = ctx.data.sessions.find((s) => s.id === open);
  if (session) return <SessionDetail ctx={ctx} session={session} onBack={() => setOpen(null)} />;

  return (
    <div className="screen">
      <Header eyebrow={positionShort(ctx.today.walk.current)} title="Logs" onSettings={ctx.openSettings} />
      <div className="segmented sticky" role="tablist">
        {SEGMENTS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={segment === id} aria-pressed={segment === id} onClick={() => setSegment(id)}>
            {label}
          </button>
        ))}
      </div>
      {segment === 'maxes' && <Maxes ctx={ctx} />}
      {segment === 'sessions' && <Sessions ctx={ctx} onOpen={setOpen} />}
      {segment === 'checkins' && <CheckIns ctx={ctx} />}
    </div>
  );
}

// ---------- Maxes ----------

function Maxes({ ctx }: { ctx: AppCtx }) {
  const { today } = ctx;
  const cur = today.walk.current;
  const cycle = cur.pos.cycle;
  const nextTest = [8, 16, 24].find((w) => w >= cur.pos.week);
  const lineCtx = makeCtx(cur, today.states, ctx.input);
  const current = (id: LineId) => {
    const t = LINES[id].target(today.states[id], lineCtx);
    return t ? `${t.name ?? ''}${t.name ? ' ' : ''}${describeTarget(t)}` : null;
  };

  return (
    <div className="stack">
      <p className="small muted intro">
        Your latest test for each goal (week 0 until the first test).{' '}
        {cur.kind.startsWith('test') ? 'This is a test week.' : nextTest ? `Next tests: week ${nextTest}.` : ''}
      </p>
      {GOALS.map((g) => {
        if (g.id === 'planche') {
          const levels = today.tests.filter((p) => p.goal === 'planche' && p.cycle === cycle);
          const lastWeek = levels.at(-1)?.weekSeq;
          return (
            <InfoCard key={g.id} g={g}>
              <dl className="goal-grid">
                <dt>Working on</dt>
                <dd>{today.facts.plancheSwitched ? 'One-leg, half-straddle, band straddle' : 'One-leg and adv tuck'}</dd>
                {levels
                  .filter((p) => p.weekSeq === lastWeek)
                  .map((p) => (
                    <Pair key={`${p.level}${p.side ?? ''}`} k={`Test: ${p.level}${p.side ? ` ${p.side}` : ''}`} v={`${p.value} s`} />
                  ))}
                <Pair k="Target" v={g.target} />
              </dl>
            </InfoCard>
          );
        }
        if (g.id === 'ntMuscleUp') {
          const attempts = ctx.data.sessions.flatMap((s) => s.lines.filter((l) => l.line === 'ntMu' || l.line === 'testNtMu').flatMap((l) => l.attempts ?? []));
          return (
            <InfoCard key={g.id} g={g}>
              <dl className="goal-grid">
                <dt>Attempts</dt>
                <dd>{today.facts.ntUnlocked ? 'Unlocked' : 'Not yet unlocked'}</dd>
                <dt>Clean so far</dt>
                <dd>
                  {attempts.filter(Boolean).length} of {attempts.length}
                </dd>
                <Pair k="Target" v={g.target} />
              </dl>
            </InfoCard>
          );
        }
        if (g.id === 'abs') {
          return (
            <InfoCard key={g.id} g={g}>
              <div className="small stack" style={{ marginTop: 10 }}>
                {(['declineCrunch', 'legRaise', 'dragonFlag', 'lSit', 'weightedCrunch'] as LineId[]).map((id) => (
                  <div key={id}>{current(id)}</div>
                ))}
              </div>
            </InfoCard>
          );
        }
        return <MaxCard key={g.id} ctx={ctx} g={g} cycle={cycle} />;
      })}
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

function InfoCard({ g, children }: { g: Goal; children: ReactNode }) {
  return (
    <div className="card max-card">
      <div className="max-top static">
        <div className="max-name">{g.skill}</div>
        <span className="chip small-chip">{g.priority}</span>
      </div>
      {children}
    </div>
  );
}

function MaxCard({ ctx, g, cycle }: { ctx: AppCtx; g: Goal; cycle: number }) {
  const [open, setOpen] = useState(false);
  const unit = g.unit === 's' ? ' s' : g.unit === 'reps/side' ? '/side' : '';
  const unitWord = g.unit === 's' ? 's' : g.unit === 'reps/side' ? 'per side' : 'reps';
  const points = ctx.today.tests.filter((p) => p.goal === g.id && p.source !== 'training' && (p.cycle === cycle || p.source === 'week0'));
  const tests = points.filter((p) => p.source === 'test');
  const value = latestTest(ctx.today.tests, g.id);
  const w0 = week0Points(ctx.data.baselines).find((p) => p.goal === g.id)?.value ?? 0;
  const delta = tests.length ? value - w0 : 0;
  const best = bestTraining(g.id, ctx.data.sessions);
  const pct = g.targetValue ? Math.min(100, (value / g.targetValue) * 100) : 0;

  return (
    <div className={`card max-card ${open ? 'open' : ''}`}>
      <button className="max-top" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="max-left">
          <span className="max-name">{g.skill}</span>
          <span className="small muted">{tests.length ? `Tested ${formatDate(tests.at(-1)!.date)}` : 'Week 0 baseline'}</span>
        </span>
        <span className="max-right">
          <span className="max-value num">
            {value}
            <span className="max-unit"> {unitWord}</span>
          </span>
          {delta !== 0 && (
            <span className={`delta ${delta > 0 ? 'up' : 'down'}`}>
              {delta > 0 ? '+' : ''}
              {delta}
              {unit} since week 0
            </span>
          )}
        </span>
      </button>
      <div className="meter" aria-label={`${Math.round(pct)}% of target`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <button className="max-foot" onClick={() => setOpen(!open)} aria-hidden="true" tabIndex={-1}>
        <span>Target {g.target}</span>
        <Icon name="chevron" size={16} className={`chev ${open ? 'down' : ''}`} />
      </button>
      {open && (
        <>
          <dl className="goal-grid">
            <Pair k="Week 0" v={g.week0} />
            <Pair k="Best in training" v={best !== null ? `${best}${unit}` : '–'} />
            <Pair k="Realistic by week 24" v={g.realistic} />
            <Pair k="Priority" v={g.priority} />
          </dl>
          <LineChart label={`${g.skill} tests`} points={byWeek(points, g.id === 'archer')} target={g.targetValue} xMax={24} unit={unit.trim()} />
        </>
      )}
    </div>
  );
}

/** One point per test week (archer: the lower side). */
function byWeek(points: TestPoint[], lowerSide: boolean): { x: number; y: number }[] {
  const weeks = new Map<number, number[]>();
  for (const p of points) weeks.set(p.week, [...(weeks.get(p.week) ?? []), p.value]);
  return [...weeks.entries()].map(([x, ys]) => ({ x, y: lowerSide ? Math.min(...ys) : Math.max(...ys) }));
}

// ---------- Sessions ----------

const titleOf = (ctx: AppCtx, s: SessionLog) => ctx.today.fold.prescriptions[s.id]?.title ?? (s.key === 'extra' ? 'Easy handstand practice' : 'Session');

function Sessions({ ctx, onOpen }: { ctx: AppCtx; onOpen: (id: string) => void }) {
  const sessions = [...ctx.data.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const dayOf = (s: SessionLog) => ctx.today.walk.done.find((d) => d.session?.id === s.id);

  if (!sessions.length) {
    return (
      <div className="card empty">
        <Icon name="logs" size={30} />
        <p>No sessions yet. They appear here as soon as you finish one, with every set.</p>
      </div>
    );
  }
  return (
    <ul className="card rows">
      {sessions.map((s) => {
        const d = dayOf(s);
        const [, m, day] = s.date.split('-').map(Number) as [number, number, number];
        const month = new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
        return (
          <li key={s.id}>
            <button className="row-btn" onClick={() => onOpen(s.id)}>
              <span className="date-badge">
                <span className="num">{day}</span>
                <span>{month}</span>
              </span>
              <span className="row-main">
                <span className="row-name">{titleOf(ctx, s)}</span>
                <span className="small muted">
                  {[d ? positionShort(d) : 'Extra practice', formatDuration(sessionMs(s)), s.finishedEarly && 'finished early'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="chevron" size={18} className="chev" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Check-ins ----------

function CheckIns({ ctx }: { ctx: AppCtx }) {
  const list = [...ctx.data.checkins].sort((a, b) => b.weekSeq - a.weekSeq);
  if (!list.length) {
    return (
      <div className="card empty">
        <Icon name="calendar" size={30} />
        <p>None yet. Today asks for one after each Day 7.</p>
      </div>
    );
  }
  return (
    <ul className="card rows">
      {list.map((c) => (
        <li key={c.weekSeq}>
          <div className="row-btn static">
            <span className="row-main">
              <span className="row-name">Week {c.weekSeq}</span>
              <span className="small muted">
                {[
                  c.bodyweight !== undefined && `${c.bodyweight} kg`,
                  c.sleepAvg !== undefined && `${c.sleepAvg} h sleep`,
                  `${c.nightsUnder6} nights < 6 h`,
                  `pain ${c.painMax}/10${c.painOver24h ? ' > 24 h' : ''}`,
                  c.planchePain && 'planche pain',
                  c.notes,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- One session ----------

const EFFORT = { easy: 'Easy', right: 'Right', hard: 'Hard' } as const;
const STATUS: Record<LineResult['status'], string> = {
  complete: '',
  stoppedEarly: 'finished early',
  pain: 'stopped: pain',
  skipped: 'not done',
};

function SessionDetail({ ctx, session, onBack }: { ctx: AppCtx; session: SessionLog; onBack: () => void }) {
  const presc = ctx.today.fold.prescriptions[session.id];
  const outcomes = ctx.today.fold.outcomes[session.id];
  const [edit, setEdit] = useState<{ line: number; set: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveSet = async (li: number, si: number, set: SetResult) => {
    const lines = session.lines.map((r, i) => (i === li ? { ...r, sets: r.sets.map((x, j) => (j === si ? set : x)) } : r));
    await saveSession({ ...session, lines });
    await ctx.refresh();
    setEdit(null);
  };

  return (
    <div className="screen view">
      <Header
        onBack={onBack}
        backLabel="Logs"
        eyebrow={`${formatDate(session.date)} · ${formatDuration(sessionMs(session))}${session.finishedEarly ? ' · finished early' : ''}`}
        title={presc?.title ?? 'Easy handstand practice'}
      />
      <p className="small muted intro">Tap a set to fix a mis-tap. Everything after it is recomputed.</p>

      <div className="stack">
        {session.lines.map((r, li) => {
          const p = presc?.lines.find((l) => l.line === r.line);
          const o = outcomes?.find((x) => x.prescription.line === r.line);
          return (
            <div className="card" key={r.line}>
              <div className="row spread">
                <strong>{p?.name ?? r.line}</strong>
                {o && p?.progresses && (
                  <span className={`chip small-chip ${o.success ? 'good' : 'warn'}`}>{o.success ? '✓ clean' : '↻ repeat'}</span>
                )}
              </div>
              <div className="small muted" style={{ marginTop: 2 }}>
                Prescribed: {p ? describeTarget(p) : '–'}
                {r.effort ? ` · rated ${EFFORT[r.effort]}` : ''}
                {r.barHeight ? ` · bar to ${r.barHeight === 'lowerChest' ? 'lower chest' : r.barHeight}` : ''}
                {r.endedBy ? ` · ended by ${r.endedBy}` : ''}
                {STATUS[r.status] ? ` · ${STATUS[r.status]}` : ''}
              </div>
              {r.sets.length > 0 && (
                <table className="sets" style={{ marginTop: 8 }}>
                  <tbody>
                    {r.sets.map((s, si) => (
                      <tr key={si} onClick={() => setEdit({ line: li, set: si })} style={{ cursor: 'pointer' }}>
                        <td className="muted">
                          Set {s.set + 1}
                          {s.side ? ` ${s.side}` : ''}
                        </td>
                        <td className="num">
                          {s.load ? `+${s.load} kg · ` : ''}
                          {s.seconds !== undefined ? `${s.seconds} s` : `${s.reps ?? 0} reps`}
                        </td>
                        <td style={{ textAlign: 'right' }}>{s.clean ? <span className="tone-green">✓</span> : <span className="status-repeat">not clean</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {r.attempts && <div className="small">Attempts: {r.attempts.map((a) => (a ? '✓' : '✗')).join(' ')}</div>}
            </div>
          );
        })}
      </div>

      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 24 }}
        onClick={async () => {
          if (!confirmDelete) return setConfirmDelete(true);
          await deleteSession(session.id);
          await ctx.refresh();
          onBack();
        }}
      >
        {confirmDelete ? 'Tap again to delete this session' : 'Delete session'}
      </button>

      {edit && (
        <EditSet set={session.lines[edit.line]!.sets[edit.set]!} onClose={() => setEdit(null)} onSave={(s) => void saveSet(edit.line, edit.set, s)} />
      )}
    </div>
  );
}

function EditSet({ set, onSave, onClose }: { set: SetResult; onSave: (s: SetResult) => void; onClose: () => void }) {
  const seconds = set.seconds !== undefined;
  const [value, setValue] = useState(seconds ? set.seconds! : (set.reps ?? 0));
  const [clean, setClean] = useState(set.clean);
  return (
    <Sheet title={`Set ${set.set + 1}${set.side ? ` ${set.side}` : ''}`} onClose={onClose}>
      <Stepper value={value} onChange={setValue} unit={seconds ? 's' : 'reps'} />
      <label className="toggle">
        <span>Clean</span>
        <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
      </label>
      <button className="btn btn-primary btn-block" onClick={() => onSave(seconds ? { ...set, seconds: value, clean } : { ...set, reps: value, clean })}>
        Save
      </button>
    </Sheet>
  );
}
