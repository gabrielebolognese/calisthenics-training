import { useState, type ReactNode } from 'react';
import { formatDate, formatLongDate, positionShort, type AppCtx } from '../app/context';
import { saveCheckin, saveGtg } from '../db/repo';
import { exportJson, downloadText } from '../db/exportImport';
import { describeTarget } from '../engine/describe';
import type { Gtg } from '../engine/index';
import { latestTest, week0Points } from '../engine/results';
import type { SessionOptions } from '../engine/rules';
import { DAYS } from '../plan/sessions';
import { GOALS } from '../plan/targets';
import { Header } from '../ui/Header';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

export function Today({
  ctx,
  onStart,
  onExtra,
  options,
  setOptions,
}: {
  ctx: AppCtx;
  onStart: () => void;
  onExtra: () => void;
  options: SessionOptions;
  setOptions: (o: SessionOptions) => void;
}) {
  const { today } = ctx;
  const w = today.walk;
  const cur = w.current;
  const [checkIn, setCheckIn] = useState<number | null>(null);
  const training = w.status === 'due' && cur.kind !== 'off' && today.prescription.lines.length > 0;
  const tomorrow = `Day ${cur.pos.day}, ${cur.kind === 'off' ? 'rest day' : DAYS[cur.pos.day]!.name}`;

  return (
    <div className="screen">
      <Header eyebrow={formatLongDate(today.date)} title="Today" onSettings={ctx.openSettings} />
      <StreakCard ctx={ctx} training={training} />
      <WeekStrip ctx={ctx} />

      {today.alerts.length > 0 && (
        <div className="stack" style={{ marginTop: 16 }}>
          <Alerts ctx={ctx} onCheckIn={setCheckIn} />
        </div>
      )}

      {w.status === 'cycleComplete' ? (
        <CycleDone ctx={ctx} />
      ) : w.status === 'notStarted' ? (
        <>
          <Hero
            ctx={ctx}
            orb={
              <div className="orb orb-quiet">
                <Icon name="calendar" size={46} />
              </div>
            }
            title={`Starts ${formatDate(w.availableFrom)}`}
            foot="Day 1 is Push A. Here is what it looks like."
          />
          <SessionList ctx={ctx} options={options} setOptions={setOptions} />
        </>
      ) : w.status === 'doneToday' ? (
        <Hero
          ctx={ctx}
          orb={
            <div className="orb orb-done">
              <Icon name="check" size={58} strokeWidth={2.6} />
            </div>
          }
          title="Done for today"
          foot={`Tomorrow: ${tomorrow}. One cycle day per date, never double up.`}
        />
      ) : cur.kind === 'off' ? (
        <>
          <Hero
            ctx={ctx}
            orb={
              <div className="orb orb-quiet">
                <Icon name="moon" size={48} />
              </div>
            }
            title="Rest day"
            foot={cur.pos.day === 3 ? 'Off or tricking. Max-effort tricking fits best today or on Day 7.' : 'Full rest. It still counts for your streak.'}
          >
            {cur.pos.day === 3 && (
              <button className="btn btn-block" style={{ marginTop: 16 }} onClick={onExtra}>
                Optional: 5 min easy handstand practice
              </button>
            )}
          </Hero>
          {today.gtg && <GtgChecklist ctx={ctx} gtg={today.gtg} />}
        </>
      ) : (
        <>
          <Hero
            ctx={ctx}
            title={today.prescription.title}
            orb={
              <button className="orb orb-go" onClick={onStart} aria-label="Start session">
                <Icon name="play" size={30} />
                <span>START</span>
              </button>
            }
            foot={today.prescription.warmup ? 'Starts with the 10 min warm-up.' : undefined}
            chips
          />
          <SessionList ctx={ctx} options={options} setOptions={setOptions} />
          {today.gtg && <GtgChecklist ctx={ctx} gtg={today.gtg} />}
        </>
      )}

      {checkIn !== null && <CheckInSheet ctx={ctx} weekSeq={checkIn} onClose={() => setCheckIn(null)} />}
    </div>
  );
}

function StreakCard({ ctx, training }: { ctx: AppCtx; training: boolean }) {
  const s = ctx.stats.streak;
  const w = ctx.today.walk;
  const hint = s.today
    ? w.status === 'doneToday'
      ? 'Today’s session is in.'
      : 'Rest day, kept as planned.'
    : s.current
      ? training
        ? `Train today to make it ${s.current + 1}.`
        : 'Rest days count too.'
      : training
        ? 'Train today to start one.'
        : 'Every plan day you keep adds one.';
  return (
    <div className={`streak ${s.current ? 'lit' : ''}`}>
      <div className="streak-icon">
        <Icon name="flame" size={26} />
      </div>
      <div className="streak-main">
        <div className="streak-num">
          <span className="num">{s.current}</span> day streak
        </div>
        <div className="small muted">{hint}</div>
      </div>
      <div className="streak-best">
        <div className="eyebrow">Best</div>
        <div className="num">{s.best}</div>
      </div>
    </div>
  );
}

function WeekStrip({ ctx }: { ctx: AppCtx }) {
  return (
    <div className="week" aria-label="This week">
      {ctx.today.strip.map((d) => (
        <div key={d.key} className={`wday is-${d.state}`} aria-label={`Day ${d.day}: ${d.state}`}>
          <span className="wday-name">{DAYS[d.day]!.name.replace('Off or tricking', 'Off')}</span>
          <span className="wday-dot num">{d.state === 'done' ? <Icon name="check" size={16} strokeWidth={3} /> : d.day}</span>
        </div>
      ))}
    </div>
  );
}

function Hero({
  ctx,
  orb,
  title,
  foot,
  chips,
  children,
}: {
  ctx: AppCtx;
  orb: ReactNode;
  title: string;
  foot?: string;
  chips?: boolean;
  children?: ReactNode;
}) {
  const { today } = ctx;
  const cur = today.walk.current;
  const isTest = cur.kind.startsWith('test');
  const label =
    cur.weekKind === 'insertedDeload' ? 'Extra deload week' : isTest ? 'Test week' : cur.weekKind === 'deloadTest' ? 'Deload week' : null;
  return (
    <section className="hero">
      <div className="eyebrow">{positionShort(cur)}</div>
      <h2 className="hero-title">{title}</h2>
      {chips && (
        <div className="chips">
          {label && <span className={`chip ${isTest ? 'test' : 'deload'}`}>{label}</span>}
          <span className="chip">
            <Icon name="clock" size={15} strokeWidth={2.2} />~{today.estimatedMinutes} min
          </span>
          <span className="chip">{today.prescription.lines.length} exercises</span>
        </div>
      )}
      <div className="orb-wrap">{orb}</div>
      {foot && <p className="hero-foot">{foot}</p>}
      {children}
    </section>
  );
}

function SessionList({ ctx, options, setOptions }: { ctx: AppCtx; options: SessionOptions; setOptions: (o: SessionOptions) => void }) {
  const p = ctx.today.prescription;
  const hasLight = p.lines.some((l) => l.line === 'plancheLight');
  const light = options.plancheLight ?? 'oneLeg';

  return (
    <section className="section">
      <div className="section-head">
        <h2>The session</h2>
        <span className="muted small">{p.lines.length} exercises</span>
      </div>
      {p.notes.map((n) => (
        <p key={n} className="small muted note-line">
          {n}
        </p>
      ))}
      {hasLight && (
        <div className="segmented" role="group" aria-label="Light planche">
          {(['oneLeg', 'advTuck'] as const).map((v) => (
            <button key={v} aria-pressed={light === v} onClick={() => setOptions({ ...options, plancheLight: v })}>
              Light planche: {v === 'oneLeg' ? 'one-leg' : 'adv tuck'}
            </button>
          ))}
        </div>
      )}
      <ol className="card ex-list">
        {p.warmup && (
          <li className="ex warm">
            <span className="ex-n">
              <Icon name="bolt" size={15} strokeWidth={2.2} />
            </span>
            <span className="ex-name">
              Warm-up
              <div className="small muted">10 min, guided</div>
            </span>
          </li>
        )}
        {p.lines.map((l, i) => (
          <li key={l.line} className="ex">
            <span className="ex-n num">{i + 1}</span>
            <span className="ex-name">
              {l.name}
              {l.note && <div className="small muted">{l.note}</div>}
            </span>
            <span className="ex-what num">
              {describeTarget(l)}
              {l.rir && <div className="small muted">RIR {l.rir}</div>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Banner({ title, text, tone, actions }: { title: string; text?: string; tone?: 'warn' | 'good'; actions: [string, () => void][] }) {
  return (
    <div className={`banner ${tone ?? ''}`}>
      <strong>{title}</strong>
      {text && <div className="small muted">{text}</div>}
      <div className="actions">
        {actions.map(([label, fn], i) => (
          <button key={label} className={`btn btn-small ${i === 0 ? 'btn-primary' : ''}`} style={i === 0 ? { fontSize: 17 } : undefined} onClick={fn}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Alerts({ ctx, onCheckIn }: { ctx: AppCtx; onCheckIn: (weekSeq: number) => void }) {
  const { now, today } = ctx;
  const dismiss = (what: 'deload' | 'longBreak' | 'unlock' | 'backup' | 'checkIn') => ctx.addEvent({ type: 'dismiss', at: now, what });
  return (
    <>
      {today.alerts.map((a) => {
        switch (a.kind) {
          case 'checkIn':
            return (
              <Banner key={a.kind} title="Weekly check-in" text="Four quick inputs about last week." actions={[['Fill in', () => onCheckIn(a.weekSeq)], ['Skip', () => void dismiss('checkIn')]]} />
            );
          case 'deload':
            return (
              <Banner
                key={a.kind}
                tone="warn"
                title="Deload recommended"
                text={`${a.reason}. Take the deload week now, then resume where you were.`}
                actions={[
                  ['Start deload week', () => void ctx.addEvent({ type: 'earlyDeload', at: now, beforeKey: today.walk.current.key })],
                  ['Ignore', () => void dismiss('deload')],
                ]}
              />
            );
          case 'longBreak':
            return (
              <Banner
                key={a.kind}
                tone="warn"
                title="Back after a break"
                text={`${a.days} days since your last session. Restart at 80% of your last numbers?`}
                actions={[
                  ['Restart at 80%', () => void ctx.addEvent({ type: 'restart80', at: now })],
                  ['No', () => void dismiss('longBreak')],
                ]}
              />
            );
          case 'unlock':
            return (
              <Banner
                key={a.kind}
                tone="good"
                title="No-transition attempts unlocked"
                text="3 attempts now open Day 2, before everything else."
                actions={[['OK', () => void dismiss('unlock')]]}
              />
            );
          case 'backup':
            return (
              <Banner
                key={a.kind}
                title="Test week done"
                text="Export a backup of your data."
                actions={[
                  [
                    'Export',
                    () =>
                      void exportJson().then((j) => {
                        downloadText(`calisthenics-backup-${today.date}.json`, j);
                        return dismiss('backup');
                      }),
                  ],
                  ['Not now', () => void dismiss('backup')],
                ]}
              />
            );
          case 'gtgAsk':
            return (
              <Banner
                key={a.kind}
                title="4 weeks of GTG"
                text="Keep GTG for another 4 weeks? Drop it the moment it feels like a chore."
                actions={[
                  ['Keep', () => void ctx.addEvent({ type: 'gtgDecision', at: now, keep: true })],
                  [
                    'Stop',
                    () =>
                      void ctx
                        .addEvent({ type: 'gtgDecision', at: now, keep: false })
                        .then(() => ctx.updateSettings({ gtg: false })),
                  ],
                ]}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function GtgChecklist({ ctx, gtg }: { ctx: AppCtx; gtg: Gtg }) {
  const date = ctx.today.date;
  const stored = ctx.data.gtg.find((g) => g.date === date)?.ticks;
  const ticks = stored ?? Array.from({ length: gtg.rows }, () => [false, false]);
  const toggle = async (i: number, j: number) => {
    const next = ticks.map((r) => [...r]);
    next[i]![j] = !next[i]![j];
    await saveGtg(date, next);
    await ctx.refresh();
  };
  const cols = gtg.muReps !== null ? '40px 1fr 1fr' : '40px 1fr';
  return (
    <div className="card stack" style={{ marginTop: 24 }}>
      <div>
        <strong>GTG</strong>
        <div className="small muted">No timers, no alarms. Attach each set to something you already do. A missed set doesn't matter.</div>
      </div>
      {ticks.map((r, i) => (
        <div key={i} className="gtg-row" style={{ gridTemplateColumns: cols }}>
          <span className="muted num">{i + 1}</span>
          {gtg.muReps !== null && (
            <button className={`btn ${r[0] ? 'on' : ''}`} onClick={() => void toggle(i, 0)}>
              MU × {gtg.muReps} {r[0] ? '✓' : ''}
            </button>
          )}
          <button className={`btn ${r[1] ? 'on' : ''}`} onClick={() => void toggle(i, 1)}>
            HSPU × {gtg.hspuReps} {r[1] ? '✓' : ''}
          </button>
        </div>
      ))}
    </div>
  );
}

function CycleDone({ ctx }: { ctx: AppCtx }) {
  const { today } = ctx;
  const w0 = week0Points(ctx.data.baselines);
  const rows = GOALS.filter((g) => w0.some((p) => p.goal === g.id));
  const unit = (u: string) => (u === 's' ? ' s' : '');
  return (
    <>
      <section className="hero">
        <div className="orb-wrap">
          <div className="orb orb-done">
            <Icon name="trophy" size={54} strokeWidth={2.2} />
          </div>
        </div>
        <h2 className="hero-title">Cycle {today.walk.current.pos.cycle - 1} complete</h2>
        <p className="hero-foot">Week 0 against your latest tests. The next cycle uses these tests as its new baselines.</p>
      </section>
      <div className="card">
        <table className="sets">
          <thead>
            <tr>
              <th>Goal</th>
              <th>Week 0</th>
              <th>Now</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id}>
                <td>{g.skill}</td>
                <td className="num">
                  {w0.find((p) => p.goal === g.id)!.value}
                  {unit(g.unit)}
                </td>
                <td className="num">
                  <strong>
                    {latestTest(today.tests, g.id)}
                    {unit(g.unit)}
                  </strong>
                </td>
                <td className="muted">{g.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="btn btn-primary btn-big btn-block"
        style={{ marginTop: 16 }}
        onClick={() => void ctx.addEvent({ type: 'newCycle', at: ctx.now, cycle: today.walk.current.pos.cycle })}
      >
        Start next cycle
      </button>
    </>
  );
}

function CheckInSheet({ ctx, weekSeq, onClose }: { ctx: AppCtx; weekSeq: number; onClose: () => void }) {
  const [bodyweight, setBodyweight] = useState('');
  const [sleep, setSleep] = useState('');
  const [nights, setNights] = useState(0);
  const [pain, setPain] = useState(0);
  const [over24, setOver24] = useState(false);
  const [planche, setPlanche] = useState(false);
  const [notes, setNotes] = useState('');
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

  const save = async () => {
    await saveCheckin({
      weekSeq,
      at: ctx.now,
      bodyweight: num(bodyweight),
      sleepAvg: num(sleep),
      nightsUnder6: nights,
      painMax: pain,
      painOver24h: pain > 0 && over24,
      planchePain: planche,
      notes: notes.trim() || undefined,
    });
    await ctx.refresh();
    onClose();
  };

  return (
    <Sheet title="Weekly check-in" onClose={onClose}>
      <div className="two-col">
        <div className="field">
          <label htmlFor="bw">Avg bodyweight (kg)</label>
          <input id="bw" inputMode="decimal" placeholder="optional" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sl">Avg sleep (h)</label>
          <input id="sl" inputMode="decimal" placeholder="optional" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Nights under 6 h</label>
        <Stepper value={nights} max={7} onChange={setNights} />
      </div>
      <div className="field">
        <label>Worst joint pain (0 to 10)</label>
        <Stepper value={pain} max={10} onChange={setPain} />
      </div>
      {pain > 0 && (
        <label className="toggle">
          <span>Did it last more than 24 h?</span>
          <input type="checkbox" checked={over24} onChange={(e) => setOver24(e.target.checked)} />
        </label>
      )}
      <label className="toggle">
        <span>Planche pain at elbow or shoulder</span>
        <input type="checkbox" checked={planche} onChange={(e) => setPlanche(e.target.checked)} />
      </label>
      <div className="field">
        <label htmlFor="nt">Notes</label>
        <input id="nt" placeholder="optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" onClick={() => void save()}>
        Save
      </button>
    </Sheet>
  );
}
