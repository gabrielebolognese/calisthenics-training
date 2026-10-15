import { useState } from 'react';
import { formatDate, positionLabel, type AppCtx } from '../app/context';
import { deleteSession, saveSession } from '../db/repo';
import { describeTarget } from '../engine/describe';
import type { LineResult, SessionLog, SetResult } from '../engine/types';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

const EFFORT = { easy: 'Easy', right: 'Right', hard: 'Hard' } as const;
const STATUS: Record<LineResult['status'], string> = {
  complete: '',
  stoppedEarly: 'finished early',
  pain: 'stopped: pain',
  skipped: 'not done',
};

/** Sessions newest first; every set, editable (brief §10 Log). */
export function Log({ ctx }: { ctx: AppCtx }) {
  const [open, setOpen] = useState<string | null>(null);
  const sessions = [...ctx.data.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const session = sessions.find((s) => s.id === open);
  if (session) return <SessionDetail ctx={ctx} session={session} onBack={() => setOpen(null)} />;

  const titleOf = (s: SessionLog) => ctx.today.fold.prescriptions[s.id]?.title ?? (s.key === 'extra' ? 'Easy handstand practice' : 'Session');
  const dayOf = (s: SessionLog) => ctx.today.walk.done.find((d) => d.session?.id === s.id);

  return (
    <div className="screen">
      <h1>Log</h1>
      {sessions.length === 0 && <p className="muted">No sessions yet. They appear here as soon as you finish one.</p>}
      <ul className="list">
        {sessions.map((s) => {
          const d = dayOf(s);
          return (
            <li key={s.id}>
              <button onClick={() => setOpen(s.id)}>
                <span>
                  <strong>{titleOf(s)}</strong>
                  <div className="small muted">
                    {formatDate(s.date)}
                    {d ? ` · ${positionLabel(d).replace(/ · Day \d: .*/, '')}` : ''}
                    {s.finishedEarly ? ' · finished early' : ''}
                  </div>
                </span>
                <span className="muted">›</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h2>Weekly check-ins</h2>
      {ctx.data.checkins.length === 0 && <p className="muted small">None yet. Today asks after each Day 7.</p>}
      <ul className="list">
        {[...ctx.data.checkins]
          .sort((a, b) => b.weekSeq - a.weekSeq)
          .map((c) => (
            <li key={c.weekSeq}>
              <div className="item">
                <span>
                  <strong>Week {c.weekSeq}</strong>
                  <div className="small muted">
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
                  </div>
                </span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

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
    <div className="screen">
      <button className="btn btn-ghost" style={{ paddingLeft: 0 }} onClick={onBack}>
        ‹ Log
      </button>
      <h1>{presc?.title ?? 'Easy handstand practice'}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {formatDate(session.date)}
        {session.finishedEarly ? ' · finished early' : ''}
      </p>
      <p className="small muted">Tap a set to fix a mis-tap. Everything after it is recomputed.</p>

      <div className="stack">
        {session.lines.map((r, li) => {
          const p = presc?.lines.find((l) => l.line === r.line);
          const o = outcomes?.find((x) => x.prescription.line === r.line);
          return (
            <div className="card" key={r.line}>
              <div className="row spread">
                <strong>{p?.name ?? r.line}</strong>
                {o && p?.progresses && (
                  <span className={o.success ? 'status-progressed' : 'status-repeat'}>{o.success ? '✓ clean' : '↻ repeat'}</span>
                )}
              </div>
              <div className="small muted">
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
                        <td style={{ textAlign: 'right' }}>{s.clean ? '✓' : <span className="status-repeat">not clean</span>}</td>
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
