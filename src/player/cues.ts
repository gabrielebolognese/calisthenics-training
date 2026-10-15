// What to beep and say, decided from state changes and countdowns (brief §7: audio and voice).
import type { BeepKind } from './audio';
import type { LiveSession } from './machine';
import { spokenDuration } from './voice';

export interface Cue {
  beep?: BeepKind;
  say?: string;
}

const setText = (set: number, sets: number) => (sets > 1 ? `Set ${set + 1} of ${sets}. ` : '');

function changed(prev: LiveSession | null, next: LiveSession): boolean {
  if (!prev || prev.index !== next.index) return true;
  const a = prev.phase;
  const b = next.phase;
  if (a.k !== b.k) return true;
  if (a.k === 'warmup' && b.k === 'warmup') return a.item !== b.item;
  if (a.k === 'attempt' && b.k === 'attempt') return a.i !== b.i;
  if (a.k === 'total' && b.k === 'total') return a.sets.length !== b.sets.length;
  return false;
}

/** Cue for entering the current phase. */
function enterCue(s: LiveSession): Cue | null {
  const st = s.steps[s.index];
  const p = s.phase;
  if (!st) return null;
  switch (p.k) {
    case 'warmup':
      return st.kind === 'warmup' ? { beep: 'go', say: st.items[p.item]?.name } : null;
    case 'rest':
      if (st.kind !== 'rest') return null;
      return { say: st.reason === 'switch' ? 'Switch.' : `Rest ${spokenDuration(st.seconds)}.` };
    case 'ready':
      if (st.kind === 'hold') {
        const side = st.sideLabel ? `, ${st.sideLabel.toLowerCase()}` : '';
        return { say: `${setText(st.set, st.sets)}${st.name}${side}. ${st.seconds} seconds.` };
      }
      if (st.kind === 'maxHold') return { say: `${st.name}. Max hold.` };
      if (st.kind === 'emom') return { say: `${st.name}. ${st.rounds} rounds of ${st.reps}.` };
      return null;
    case 'hold':
      return { beep: 'go', say: 'Hold.' };
    case 'stopwatch':
      return { beep: 'go', say: 'Go.' };
    case 'emom':
      return { beep: 'go', say: 'Round 1.' };
    case 'reps': {
      if (st.kind !== 'reps') return null;
      const load = st.load ? `Plus ${st.load} kilos. ` : '';
      const unit = st.perSide ? 'per side' : st.reps === 1 ? 'rep' : 'reps';
      return { say: `${setText(st.set, st.sets)}${st.name}. ${load}${st.reps} ${unit}.` };
    }
    case 'total': {
      if (st.kind !== 'totalReps') return null;
      const done = p.sets.reduce((a, x) => a + (x.reps ?? 0), 0);
      if (done === 0) return { say: `${st.name}. Total ${st.total}.${st.topSet ? ' Top set first, RIR 1.' : ''}` };
      return { say: `${st.total - done} to go.` };
    }
    case 'totalRest':
      return st.kind === 'totalReps' ? { say: `Rest ${spokenDuration(st.restBetween)}.` } : null;
    case 'count':
      return st.kind === 'amrap' ? { say: `${st.name}. Max reps.` } : null;
    case 'practice':
      return st.kind === 'practice' ? { say: `${st.name}. ${st.minutes} minutes.` } : null;
    case 'attempt':
      return st.kind === 'attempts' ? { say: `Attempt ${p.i + 1} of ${st.count}.` } : null;
    default:
      return null;
  }
}

export function transitionCue(prev: LiveSession | null, next: LiveSession): Cue | null {
  if (next.finished) return prev && !prev.finished ? { beep: 'end', say: 'Session done.' } : null;
  if (!changed(prev, next)) return null;
  const a = prev?.phase.k;
  const ended = (a === 'hold' || a === 'emom' || a === 'practice' || a === 'stopwatch') && (prev!.index !== next.index || next.phase.k !== a);
  const c = enterCue(next);
  if (!ended) return c;
  return { beep: 'end', say: ['Done.', c?.say].filter(Boolean).join(' ') };
}

/** Beeps on the last 3 seconds of countdowns, "10 seconds" on longer rests, a beep at each EMOM round. */
export function countdownCue(
  s: LiveSession,
  prev: { ms: number | null; round: number },
  cur: { ms: number | null; round: number },
): Cue | null {
  const k = s.phase.k;
  if (k === 'emom' && cur.round > prev.round) return { beep: 'round', say: `Round ${cur.round + 1}.` };
  if (prev.ms === null || cur.ms === null) return null;
  const crossed = (x: number) => prev.ms! > x && cur.ms! <= x;
  const st = s.steps[s.index];
  const longRest = (k === 'rest' && st?.kind === 'rest' && st.seconds > 20) || k === 'totalRest' || k === 'attemptRest';
  if (longRest && crossed(10_000)) return { say: '10 seconds.' };
  const ticking = k === 'rest' || k === 'ready' || k === 'totalRest' || k === 'attemptRest' || k === 'warmup';
  if (ticking && (crossed(3000) || crossed(2000) || crossed(1000))) return { beep: 'tick' };
  return null;
}
