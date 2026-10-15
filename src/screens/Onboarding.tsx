import { useState } from 'react';
import { localDate } from '../engine/dates';
import type { Baselines } from '../engine/types';
import { WEEK0 } from '../plan/targets';

type Week0 = Omit<Baselines, 'startDate'>;

const FIELDS: [keyof Week0, string, string][] = [
  ['hspu', 'HSPU', 'reps'],
  ['pushup90', '90 degree push-up', 'clean reps'],
  ['archer', 'Archer HSPU', 'per side'],
  ['handstand', 'Freestanding handstand', 's'],
  ['frontLeverBad', 'Front lever, bad day', 's'],
  ['frontLeverGood', 'Front lever, good day', 's'],
  ['flag', 'Human flag', 's'],
  ['muscleUp', 'Muscle-up', 'reps'],
  ['weightedPullupLoad', 'Weighted pull-ups, starting load', 'kg'],
];

/** First launch only: start date, week 0 values, starting pull-up load (brief §10). */
export function Onboarding({ onDone }: { onDone: (b: Baselines) => void }) {
  const [startDate, setStartDate] = useState(localDate(Date.now()));
  const [v, setV] = useState<Week0>({ ...WEEK0 });

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <h1>Calisthenics</h1>
      <p className="muted">Your week 0 numbers from the plan. Change any that are wrong, then start.</p>
      <div className="stack">
        <div className="field">
          <label htmlFor="start">Start date</label>
          <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="two-col">
          {FIELDS.map(([key, label, unit]) => (
            <div className="field" key={key}>
              <label htmlFor={key}>
                {label} ({unit})
              </label>
              <input
                id={key}
                inputMode="decimal"
                value={String(v[key])}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(',', '.'));
                  if (!Number.isNaN(n)) setV({ ...v, [key]: n });
                }}
              />
            </div>
          ))}
        </div>
        <p className="small muted">
          The pull-up load is a first guess: rate a set Easy and the next session adds 5 kg, until a set feels right.
        </p>
        <button className="btn btn-primary btn-big btn-block" onClick={() => onDone({ startDate, ...v })}>
          Start
        </button>
      </div>
    </div>
  );
}
