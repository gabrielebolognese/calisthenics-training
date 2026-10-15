import { formatDate, formatDuration, formatInt, formatSeconds, useDrill, type AppCtx } from '../app/context';
import { daysBetween } from '../engine/dates';
import type { ExerciseTotal } from '../engine/stats';
import { BODYWEIGHT_TARGET } from '../plan/targets';
import { AreaChart, BarChart, Sparkline } from '../ui/charts';
import { Header } from '../ui/Header';
import { Icon } from '../ui/Icon';
import { Tile } from '../ui/Tile';

const toneOf = (e: ExerciseTotal) => (e.unit === 'seconds' ? 'violet' : e.unit === 'attempts' ? 'gold' : 'green');
const colorOf = (e: ExerciseTotal) => `var(--${toneOf(e)})`;
const shortDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' });
};

function amount(e: ExerciseTotal): { value: string; unit: string } {
  if (e.unit === 'seconds') return { value: formatSeconds(e.total), unit: 'held' };
  if (e.unit === 'attempts') return { value: formatInt(e.total), unit: `clean of ${e.attempts}` };
  return { value: formatInt(e.total), unit: e.total === 1 ? 'rep' : 'reps' };
}

/** Lifetime totals: time trained, sessions, every exercise added up across all days [A07, A08]. */
export function Stats({ ctx }: { ctx: AppCtx }) {
  const [open, setOpen] = useDrill<string>();
  const st = ctx.stats;
  const opened = st.exercises.find((e) => e.key === open);
  if (opened) return <ExerciseDetail e={opened} onBack={() => setOpen(null)} />;

  const byTotal = (a: ExerciseTotal, b: ExerciseTotal) => b.total - a.total;
  const reps = st.exercises.filter((e) => e.unit !== 'seconds').sort(byTotal);
  const holds = st.exercises.filter((e) => e.unit === 'seconds').sort(byTotal);
  const thisWeek = st.weeks.find((w) => w.current)?.ms ?? 0;
  const avg = st.sessions ? st.totalMs / st.sessions : 0;
  const bw = ctx.data.checkins.filter((c) => c.bodyweight !== undefined).sort((a, b) => a.weekSeq - b.weekSeq);

  return (
    <div className="screen">
      <Header eyebrow="All time" title="Statistics" onSettings={ctx.openSettings} />

      <div className="tiles">
        <Tile icon="clock" tone="cyan" label="Time trained" value={formatDuration(st.totalMs)} sub={st.sessions ? `${formatDuration(avg)} per session` : 'Starts with your first session'} />
        <Tile icon="checkCircle" tone="green" label="Sessions" value={formatInt(st.sessions)} sub={`Best streak: ${st.streak.best} ${st.streak.best === 1 ? 'day' : 'days'}`} />
        <Tile icon="bolt" tone="gold" label="Reps" value={formatInt(st.totalReps)} sub="Clean, every exercise" />
        <Tile icon="hourglass" tone="violet" label="Time holding" value={formatSeconds(st.totalHoldSeconds)} sub="Every hold added up" />
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <div>
            <div className="eyebrow">Time per week</div>
            <div className="chart-big num">{formatDuration(thisWeek)}</div>
            <div className="small muted">this week</div>
          </div>
        </div>
        {st.totalMs > 0 && (
          <BarChart
            bars={st.weeks.slice(-12).map((w) => ({ label: w.label, value: Math.round(w.ms / 60_000), current: w.current }))}
            color="var(--cyan)"
            label="Minutes trained per plan week"
            format={(v) => `${v}m`}
          />
        )}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Every exercise</h2>
          {st.exercises.length > 0 && <span className="small muted">Tap one for its charts</span>}
        </div>
        {st.exercises.length === 0 ? (
          <div className="card empty">
            <Icon name="stats" size={30} />
            <p>Your totals start adding up after the first session: every rep and every second, across all days.</p>
          </div>
        ) : (
          <>
            {reps.length > 0 && <ExerciseList title="Reps" list={reps} onOpen={setOpen} />}
            {holds.length > 0 && <ExerciseList title="Holds" list={holds} onOpen={setOpen} />}
          </>
        )}
      </section>

      <section className="section">
        <div className="card chart-card">
          <div className="chart-head">
            <div>
              <div className="eyebrow">Bodyweight</div>
              <div className="chart-big num">{bw.length ? `${bw.at(-1)!.bodyweight} kg` : '–'}</div>
              <div className="small muted">From the weekly check-ins. {BODYWEIGHT_TARGET}.</div>
            </div>
          </div>
          {bw.length > 0 && (
            <AreaChart
              points={bw.map((c) => ({ x: c.weekSeq, y: c.bodyweight! }))}
              color="var(--cyan)"
              label="Bodyweight by week"
              format={(v) => `${v} kg`}
              start={`Week ${bw[0]!.weekSeq}`}
              end={`Week ${bw.at(-1)!.weekSeq}`}
              fit
            />
          )}
        </div>
      </section>
    </div>
  );
}

function ExerciseList({ title, list, onOpen }: { title: string; list: ExerciseTotal[]; onOpen: (key: string) => void }) {
  return (
    <>
      <div className="group-label">{title}</div>
      <ul className="card rows">
        {list.map((e) => {
          const a = amount(e);
          return (
            <li key={e.key}>
              <button className="row-btn" onClick={() => onOpen(e.key)}>
                <span className="row-main">
                  <span className="row-name">{e.name}</span>
                  <span className="row-value">
                    <b className={`num tone-${toneOf(e)}`}>{a.value}</b> {a.unit}
                  </span>
                </span>
                <Sparkline values={e.points.map((p) => p.cumulative)} color={colorOf(e)} />
                <Icon name="chevron" size={18} className="chev" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ExerciseDetail({ e, onBack }: { e: ExerciseTotal; onBack: () => void }) {
  const color = colorOf(e);
  const a = amount(e);
  const fmt = e.unit === 'seconds' ? formatSeconds : formatInt;
  const verb = e.unit === 'seconds' ? 'held' : e.unit === 'attempts' ? 'landed' : 'done';
  const tail = e.unit === 'seconds' ? `of ${e.name}` : e.unit === 'attempts' ? `clean, in ${e.attempts} attempts` : `${a.unit} of ${e.name}`;
  const best = e.unit === 'seconds' ? formatSeconds(e.best) : `${e.best} ${e.bestPerSide ? 'per side' : e.best === 1 ? 'rep' : 'reps'}`;
  const first = e.points[0]!.date;
  const recent = e.points.slice(-14);

  return (
    <div className="screen view">
      <Header onBack={onBack} backLabel="Statistics" eyebrow="Exercise" title={e.name} />

      <section className={`total-hero tone-${toneOf(e)}`}>
        <div className="eyebrow">So far you’ve {verb}</div>
        <div className="mega num">{a.value}</div>
        <div className="total-tail">{tail}</div>
      </section>

      <div className="tiles">
        <Tile label="Sessions" value={formatInt(e.sessions)} />
        {e.unit !== 'attempts' && <Tile label="Best set" value={best} />}
        {e.maxLoad > 0 && <Tile label="Heaviest" value={`+${e.maxLoad} kg`} />}
        <Tile label="Last done" value={formatDate(e.last)} />
      </div>

      <div className="card chart-card">
        <div className="eyebrow">Running total</div>
        <AreaChart
          points={e.points.map((p) => ({ x: daysBetween(first, p.date), y: p.cumulative }))}
          color={color}
          label={`${e.name}: running total`}
          format={fmt}
          start={formatDate(first)}
          end={formatDate(e.last)}
        />
      </div>

      <div className="card chart-card">
        <div className="eyebrow">Per session{e.points.length > recent.length ? `, last ${recent.length}` : ''}</div>
        <BarChart
          bars={recent.map((p, i) => ({ label: shortDate(p.date), value: p.value, current: i === recent.length - 1 }))}
          color={color}
          label={`${e.name}: per session`}
          format={fmt}
        />
      </div>
    </div>
  );
}
