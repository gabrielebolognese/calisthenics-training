// Turns a session prescription into the ordered steps the player renders (brief §4).
import { EXERCISES } from '../plan/exercises';
import type { StandardKey } from '../plan/types';
import { WARMUP, type WarmupItem } from '../plan/warmup';
import type { SessionPrescription } from './prescribe';
import type { LinePrescription, Side } from './types';

/** Pause between the two legs (or sides) of one set [D01]. */
export const SWITCH_REST = 10;

interface StepBase {
  /** Index into prescription.lines. */
  lineIndex: number;
  line: LinePrescription['line'];
  name: string;
  cue: string;
  standard: StandardKey;
  note?: string;
}

export type WorkStep =
  | (StepBase & { kind: 'hold'; seconds: number; set: number; sets: number; side?: Side; sideLabel?: string })
  | (StepBase & {
      kind: 'reps';
      reps: number;
      perSide: boolean;
      load?: number;
      rir?: string;
      set: number;
      sets: number;
      /** Last set of a line that asks Easy/Right/Hard. */
      askEffort: boolean;
      askBarHeight: boolean;
      endOnNotClean: boolean;
      notCleanLabel?: string;
    })
  | (StepBase & {
      kind: 'emom';
      rounds: number;
      reps: number;
      intervalSec: number;
      rir?: string;
      askEffort: boolean;
      endOnNotClean: boolean;
      notCleanLabel?: string;
    })
  | (StepBase & {
      kind: 'totalReps';
      total: number;
      topSet: boolean;
      rir?: string;
      restBetween: number;
      lastSetsUsed?: number;
      askEffort: boolean;
    })
  | (StepBase & { kind: 'maxHold'; side?: Side; sideLabel?: string; askEndedBy: boolean })
  | (StepBase & { kind: 'amrap'; side?: Side; sideLabel?: string; notCleanLabel?: string })
  | (StepBase & { kind: 'practice'; minutes: number })
  | (StepBase & { kind: 'attempts'; count: number; restBetween: number });

export type Step =
  | { kind: 'warmup'; items: WarmupItem[] }
  | WorkStep
  | { kind: 'rest'; seconds: number; reason: 'set' | 'switch' | 'exercise'; next: string };

const sideLabel = (p: LinePrescription, side: Side) => {
  const legs = p.bilateral === 'leg' || EXERCISES[p.exercise].type === 'perLegHold';
  if (p.line === 'testFlagOther') return 'OTHER SIDE';
  return `${side === 'L' ? 'LEFT' : 'RIGHT'} ${legs ? 'LEG' : 'SIDE'}`;
};

function workSteps(p: LinePrescription, lineIndex: number): Step[] {
  const base: StepBase = {
    lineIndex,
    line: p.line,
    name: p.name,
    cue: p.cue,
    standard: EXERCISES[p.exercise].standard,
    note: p.note,
  };
  const out: Step[] = [];
  const restBetweenSets = (i: number, n: number) => {
    if (i < n - 1 && p.restSec > 0) out.push({ kind: 'rest', seconds: p.restSec, reason: 'set', next: '' });
  };

  switch (p.kind) {
    case 'hold': {
      const n = p.seconds!.length;
      p.seconds!.forEach((seconds, i) => {
        if (p.bilateral) {
          // The starting leg alternates set to set [D01].
          const order: Side[] = i % 2 === 0 ? ['L', 'R'] : ['R', 'L'];
          out.push({ ...base, kind: 'hold', seconds, set: i, sets: n, side: order[0], sideLabel: sideLabel(p, order[0]!) });
          out.push({ kind: 'rest', seconds: SWITCH_REST, reason: 'switch', next: '' });
          out.push({ ...base, kind: 'hold', seconds, set: i, sets: n, side: order[1], sideLabel: sideLabel(p, order[1]!) });
        } else {
          out.push({ ...base, kind: 'hold', seconds, set: i, sets: n, side: p.side });
        }
        restBetweenSets(i, n);
      });
      break;
    }
    case 'reps': {
      const n = p.reps!.length;
      p.reps!.forEach((reps, i) => {
        out.push({
          ...base,
          kind: 'reps',
          reps,
          perSide: !!p.perSide,
          load: p.load,
          rir: p.rir,
          set: i,
          sets: n,
          askEffort: p.askEffort && i === n - 1,
          askBarHeight: !!p.askBarHeight && i === n - 1,
          endOnNotClean: !!p.endOnNotClean,
          notCleanLabel: p.notCleanLabel,
        });
        restBetweenSets(i, n);
      });
      break;
    }
    case 'emom':
      out.push({
        ...base,
        kind: 'emom',
        ...p.emom!,
        rir: p.rir,
        askEffort: p.askEffort,
        endOnNotClean: !!p.endOnNotClean,
        notCleanLabel: p.notCleanLabel,
      });
      break;
    case 'total':
      out.push({
        ...base,
        kind: 'totalReps',
        total: p.total!.target,
        topSet: p.total!.topSet,
        rir: p.rir,
        restBetween: p.restSec,
        lastSetsUsed: p.total!.lastSetsUsed,
        askEffort: p.askEffort,
      });
      break;
    case 'maxHold':
      out.push({ ...base, kind: 'maxHold', side: p.side, sideLabel: p.side ? sideLabel(p, p.side) : undefined, askEndedBy: !!p.askEndedBy });
      break;
    case 'amrap':
      out.push({ ...base, kind: 'amrap', side: p.side, sideLabel: p.side ? sideLabel(p, p.side) : undefined, notCleanLabel: p.notCleanLabel });
      break;
    case 'practice':
      out.push({ ...base, kind: 'practice', minutes: p.practiceMinutes! });
      break;
    case 'attempts':
      out.push({ ...base, kind: 'attempts', count: p.attempts!, restBetween: p.restSec });
      break;
  }
  return out;
}

/** One-line label for the "next up" preview on rest screens. */
export function stepLabel(s: Step): string {
  switch (s.kind) {
    case 'warmup':
      return 'Warm-up';
    case 'rest':
      return `Rest ${s.seconds} s`;
    case 'hold':
      return `${s.name} · set ${s.set + 1} of ${s.sets} · ${s.seconds} s${s.sideLabel ? ` · ${s.sideLabel.toLowerCase()}` : ''}`;
    case 'reps':
      return `${s.name} · set ${s.set + 1} of ${s.sets} · ${s.load ? `+${s.load} kg ` : ''}${s.reps}${s.perSide ? ' per side' : ' reps'}`;
    case 'emom':
      return `${s.name} · ${s.rounds} x ${s.reps}, every ${s.intervalSec} s`;
    case 'totalReps':
      return `${s.name} · total ${s.total}`;
    case 'maxHold':
      return `${s.name} · max hold`;
    case 'amrap':
      return `${s.name} · max reps`;
    case 'practice':
      return `${s.name} · ${s.minutes} min`;
    case 'attempts':
      return `${s.name} · ${s.count} attempts`;
  }
}

export function buildSteps(presc: SessionPrescription): Step[] {
  const steps: Step[] = [];
  if (presc.warmup) steps.push({ kind: 'warmup', items: WARMUP });
  presc.lines.forEach((p, i) => {
    steps.push(...workSteps(p, i));
    if (i < presc.lines.length - 1 && p.restAfterSec > 0) {
      steps.push({ kind: 'rest', seconds: p.restAfterSec, reason: 'exercise', next: '' });
    }
  });
  // Fill the "next up" previews.
  return steps.map((s, i) => (s.kind === 'rest' ? { ...s, next: steps[i + 1] ? stepLabel(steps[i + 1]!) : '' } : s));
}

/** Rough session length for the Today preview. */
export function estimateSeconds(steps: Step[]): number {
  const REP = 3;
  let total = 0;
  for (const s of steps) {
    switch (s.kind) {
      case 'warmup':
        total += s.items.reduce((a, it) => a + it.seconds, 0);
        break;
      case 'rest':
        total += s.seconds;
        break;
      case 'hold':
        total += s.seconds + 5;
        break;
      case 'reps':
        total += s.reps * REP * (s.perSide ? 2 : 1) + 5;
        break;
      case 'emom':
        total += s.rounds * s.intervalSec;
        break;
      case 'totalReps': {
        const sets = s.lastSetsUsed ?? Math.ceil(s.total / 6);
        total += s.total * REP + (sets - 1) * s.restBetween;
        break;
      }
      case 'maxHold':
        total += 60;
        break;
      case 'amrap':
        total += 45;
        break;
      case 'practice':
        total += s.minutes * 60;
        break;
      case 'attempts':
        total += s.count * 15 + (s.count - 1) * s.restBetween;
        break;
    }
  }
  return total;
}
