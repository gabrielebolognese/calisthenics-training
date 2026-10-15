import { formatDuration, formatInt, formatSeconds, type AppCtx } from '../app/context';
import { sessionStats } from '../engine/stats';
import { Icon } from '../ui/Icon';
import { Tile } from '../ui/Tile';

const STATUS = {
  progressed: '↑ Progresses',
  repeat: '↻ Same next time',
  done: '✓ Done',
  skipped: '– Not done',
} as const;

/** After a session: what it added up to, what progressed and what repeats next time (brief §7 Finish). */
export function Summary({ ctx, id, onClose }: { ctx: AppCtx; id: string; onClose: () => void }) {
  const session = ctx.data.sessions.find((s) => s.id === id);
  const summaries = ctx.today.fold.summaries[id];
  const totals = session ? sessionStats(ctx.stats, session) : null;
  const streak = ctx.stats.streak.current;

  return (
    <div className="screen no-tabs">
      <section className="hero">
        <div className="orb-wrap">
          <div className="orb orb-done pop">
            <Icon name="check" size={58} strokeWidth={2.6} />
          </div>
        </div>
        <h1 className="hero-title">Session saved</h1>
        {session?.finishedEarly ? (
          <p className="hero-foot">Finished early. What you did is saved; the rest repeats next time.</p>
        ) : (
          streak > 0 && (
            <div className="chips center">
              <span className="chip flame">
                <Icon name="flame" size={15} strokeWidth={2.2} />
                {streak} day streak
              </span>
            </div>
          )
        )}
      </section>

      {totals && (
        <div className="tiles three">
          <Tile icon="clock" tone="cyan" label="Time" value={formatDuration(totals.ms)} />
          <Tile icon="bolt" tone="gold" label="Reps" value={formatInt(totals.reps)} />
          <Tile icon="hourglass" tone="violet" label="Held" value={formatSeconds(totals.seconds)} />
        </div>
      )}

      {summaries ? (
        <ul className="card rows" style={{ marginTop: 16 }}>
          {summaries.map((x) => (
            <li key={x.line}>
              <div className="row-btn static">
                <span className="row-main">
                  <span className="row-name">{x.name}</span>
                  {x.next && x.status !== 'skipped' && <span className="small muted">Next: {x.next}</span>}
                </span>
                <span className={`status-${x.status}`}>{STATUS[x.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>
          Nice. It doesn't count as a cycle day, it's just extra practice.
        </p>
      )}
      <button className="btn btn-primary btn-big btn-block" style={{ marginTop: 20 }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
