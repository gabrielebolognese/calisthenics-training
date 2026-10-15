import type { Target } from './types';

const sameOrList = (xs: number[], unit = '') =>
  xs.every((x) => x === xs[0]) ? `${xs.length} x ${xs[0]}${unit}` : xs.map((x) => `${x}${unit}`).join(', ');

/** Short text for a prescription: "4 x 35 s", "+5 kg 4 x 2", "3, 3, 2, 2 per side", "EMOM 6 x 1". */
export function describeTarget(t: Target): string {
  switch (t.kind) {
    case 'reps': {
      const load = t.load ? `+${t.load} kg ` : '';
      return `${load}${sameOrList(t.reps!)}${t.perSide ? ' per side' : ''}`;
    }
    case 'hold': {
      const per = t.bilateral === 'leg' ? ' per leg' : t.bilateral === 'side' ? ' per side' : '';
      return `${sameOrList(t.seconds!, ' s')}${per}`;
    }
    case 'emom': {
      const e = t.emom!;
      return e.intervalSec === 60 ? `EMOM ${e.rounds} x ${e.reps}` : `${e.rounds} x ${e.reps} every ${e.intervalSec / 60} min`;
    }
    case 'total':
      return `Total ${t.total!.target}${t.total!.topSet ? ', top set first' : ''}`;
    case 'practice':
      return `${t.practiceMinutes} min`;
    case 'attempts':
      return `${t.attempts} attempts`;
    case 'maxHold':
      return 'Max hold';
    case 'amrap':
      return 'Max reps';
  }
}
