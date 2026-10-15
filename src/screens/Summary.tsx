import type { AppCtx } from '../app/context';

const STATUS = {
  progressed: '↑ Progresses',
  repeat: '↻ Same next time',
  done: '✓ Done',
  skipped: '– Not done',
} as const;

/** After a session: what progressed and what repeats next time (brief §7 Finish). */
export function Summary({ ctx, id, onClose }: { ctx: AppCtx; id: string; onClose: () => void }) {
  const session = ctx.data.sessions.find((s) => s.id === id);
  const summaries = ctx.today.fold.summaries[id];
  return (
    <div className="screen" style={{ paddingBottom: 32 }}>
      <h1>Session saved</h1>
      {session?.finishedEarly && <p className="muted">Finished early. What you did is saved; the rest repeats next time.</p>}
      {summaries ? (
        <ul className="list card" style={{ padding: '0 16px' }}>
          {summaries.map((x) => (
            <li key={x.line}>
              <div className="item" style={{ display: 'block' }}>
                <div className="row spread">
                  <strong>{x.name}</strong>
                  <span className={`status-${x.status}`}>{STATUS[x.status]}</span>
                </div>
                {x.next && x.status !== 'skipped' && <div className="small muted">Next: {x.next}</div>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nice. It doesn't count as a cycle day, it's just extra practice.</p>
      )}
      <button className="btn btn-primary btn-big btn-block" style={{ marginTop: 16 }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
