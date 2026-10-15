import type { ReactNode } from 'react';
import type { AppCtx } from '../app/context';
import { describeTarget } from '../engine/describe';
import { makeCtx } from '../engine/prescribe';
import { bestTraining, latestTest, type TestPoint } from '../engine/results';
import { LINES } from '../plan/progression';
import { BODYWEIGHT_TARGET, GOALS, type Goal } from '../plan/targets';
import type { LineId } from '../plan/types';
import { LineChart } from '../ui/LineChart';

/** One card per goal from the PDF Goals table, tests over the 24 weeks, bodyweight (brief §10). */
export function Progress({ ctx }: { ctx: AppCtx }) {
  const { today } = ctx;
  const cycle = today.walk.current.pos.cycle;
  const lineCtx = makeCtx(today.walk.current, today.states, ctx.input);
  const current = (id: LineId) => {
    const t = LINES[id].target(today.states[id], lineCtx);
    return t ? `${t.name ?? ''}${t.name ? ' ' : ''}${describeTarget(t)}` : null;
  };

  const bw = ctx.data.checkins.filter((c) => c.bodyweight !== undefined).sort((a, b) => a.weekSeq - b.weekSeq);

  return (
    <div className="screen">
      <h1>Progress</h1>
      <p className="muted small" style={{ marginTop: 0 }}>
        Tests in weeks 8, 16 and 24. The realistic column is an honest estimate, not a promise.
      </p>
      <div className="stack">
        {GOALS.map((g) => {
          if (g.id === 'planche') {
            const levels = today.tests.filter((p) => p.goal === 'planche' && p.cycle === cycle);
            const lastWeek = levels.at(-1)?.weekSeq;
            return (
              <GoalCard key={g.id} g={g}>
                <dl className="goal-grid">
                  <dt>Working on</dt>
                  <dd>{today.facts.plancheSwitched ? 'One-leg, half-straddle, band straddle' : 'One-leg and adv tuck'}</dd>
                  {levels
                    .filter((p) => p.weekSeq === lastWeek)
                    .map((p) => (
                      <Pair key={`${p.level}${p.side ?? ''}`} k={`Test: ${p.level}${p.side ? ` ${p.side}` : ''}`} v={`${p.value} s`} />
                    ))}
                </dl>
              </GoalCard>
            );
          }
          if (g.id === 'ntMuscleUp') {
            const attempts = ctx.data.sessions.flatMap((s) => s.lines.filter((l) => l.line === 'ntMu' || l.line === 'testNtMu').flatMap((l) => l.attempts ?? []));
            return (
              <GoalCard key={g.id} g={g}>
                <dl className="goal-grid">
                  <dt>Attempts</dt>
                  <dd>{today.facts.ntUnlocked ? 'Unlocked' : 'Not yet unlocked'}</dd>
                  <dt>Clean so far</dt>
                  <dd>
                    {attempts.filter(Boolean).length} of {attempts.length}
                  </dd>
                </dl>
              </GoalCard>
            );
          }
          if (g.id === 'abs') {
            return (
              <GoalCard key={g.id} g={g}>
                <div className="small stack" style={{ marginTop: 10 }}>
                  {(['declineCrunch', 'legRaise', 'dragonFlag', 'lSit', 'weightedCrunch'] as LineId[]).map((id) => (
                    <div key={id}>{current(id)}</div>
                  ))}
                </div>
              </GoalCard>
            );
          }
          return <NumericGoal key={g.id} ctx={ctx} g={g} cycle={cycle} />;
        })}

        <div className="card">
          <strong>Bodyweight</strong>
          <div className="small muted">From the weekly check-ins. {BODYWEIGHT_TARGET}.</div>
          {bw.length ? (
            <LineChart
              label="Bodyweight by week"
              points={bw.map((c) => ({ x: c.weekSeq, y: c.bodyweight! }))}
              xMax={Math.max(8, ...bw.map((c) => c.weekSeq))}
              xTicks={[]}
            />
          ) : (
            <p className="small muted">No bodyweight logged yet.</p>
          )}
        </div>
      </div>
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

function GoalCard({ g, children }: { g: Goal; children: ReactNode }) {
  return (
    <div className="card">
      <div className="row spread">
        <strong>{g.skill}</strong>
        <span className="label">{g.priority}</span>
      </div>
      <dl className="goal-grid">
        <Pair k="Week 0" v={g.week0} />
        <Pair k="Target" v={g.target} />
        <Pair k="Realistic by week 24" v={g.realistic} />
      </dl>
      {children}
    </div>
  );
}

function NumericGoal({ ctx, g, cycle }: { ctx: AppCtx; g: Goal; cycle: number }) {
  const unit = g.unit === 's' ? ' s' : g.unit === 'reps/side' ? '/side' : '';
  const points = ctx.today.tests.filter((p) => p.goal === g.id && p.source !== 'training' && (p.cycle === cycle || p.source === 'week0'));
  const tests = points.filter((p) => p.source === 'test');
  const latest = tests.length ? latestTest(ctx.today.tests, g.id) : null;
  const best = bestTraining(g.id, ctx.data.sessions);
  const chart = byWeek(points, g.id === 'archer');
  const value = latest ?? chart[0]?.y ?? 0;
  const pct = g.targetValue ? Math.min(100, (value / g.targetValue) * 100) : 0;

  return (
    <GoalCard g={g}>
      <dl className="goal-grid">
        <Pair k="Latest test" v={latest !== null ? `${latest}${unit}` : '–'} />
        <Pair k="Best in training" v={best !== null ? `${best}${unit}` : '–'} />
      </dl>
      <div className="bar" aria-label={`${Math.round(pct)}% of target`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <LineChart label={`${g.skill} tests`} points={chart} target={g.targetValue} xMax={24} unit={unit.trim()} />
    </GoalCard>
  );
}

/** One point per test week (archer: the lower side). */
function byWeek(points: TestPoint[], lowerSide: boolean): { x: number; y: number }[] {
  const weeks = new Map<number, number[]>();
  for (const p of points) weeks.set(p.week, [...(weeks.get(p.week) ?? []), p.value]);
  return [...weeks.entries()].map(([x, ys]) => ({ x, y: lowerSide ? Math.min(...ys) : Math.max(...ys) }));
}
