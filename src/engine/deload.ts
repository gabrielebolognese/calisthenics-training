import type { LinePrescription } from './types';

const half = (n: number) => Math.ceil(n / 2);

/**
 * Deload [D43]: same exercises, half the sets (first sets kept), same reps, seconds and loads,
 * RIR 4, no max attempts, no rating, no progression. Returns null for lines that are dropped.
 */
export function deloadLine(p: LinePrescription): LinePrescription | null {
  const base: LinePrescription = { ...p, progresses: false, askEffort: false, note: 'Deload: half the sets, RIR 4' };
  switch (p.kind) {
    case 'reps':
      return { ...base, reps: p.reps!.slice(0, half(p.reps!.length)), rir: '4' };
    case 'hold':
      return { ...base, seconds: p.seconds!.slice(0, half(p.seconds!.length)) };
    case 'emom':
      return { ...base, emom: { ...p.emom!, rounds: half(p.emom!.rounds) }, rir: '4' };
    case 'total':
      return { ...base, total: { ...p.total!, target: half(p.total!.target), topSet: false }, rir: '4' };
    case 'attempts':
      return { ...base, attempts: half(p.attempts!) };
    case 'practice':
      return p;
    default:
      return null;
  }
}

/** Planche pain at elbow or shoulder: planche volume cut by 50% for 2 weeks [D51]. */
export function plancheCut(p: LinePrescription): LinePrescription {
  if (p.kind !== 'hold') return p;
  return {
    ...p,
    seconds: p.seconds!.slice(0, half(p.seconds!.length)),
    progresses: false,
    askEffort: false,
    note: 'Planche volume cut by 50% for 2 weeks (pain rule)',
  };
}
