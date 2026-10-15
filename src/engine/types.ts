import type { DayKind, WeekKind } from '../plan/blocks';
import type { ExerciseId, LineId } from '../plan/types';
import type { LocalDate } from './dates';

// ---------- Position in the plan ----------

export interface Position {
  cycle: number;
  /** 1–24 overall. For an inserted deload week: the week it was inserted into. */
  week: number;
  day: number;
  /** Set when this day belongs to an inserted early-deload week (1-based count). */
  inserted?: number;
}

// ---------- User settings and baselines ----------

export type PlateIncrement = 5 | 2.5 | 1.25;

export interface Settings {
  plateIncrement: PlateIncrement;
  flagSides: 'one' | 'both';
  abWheel: boolean;
  bands: boolean;
  homeBar: boolean;
  gtg: boolean;
  /** When GTG was last switched on (ms). */
  gtgSince?: number;
  archerAssistedSet: boolean;
}

export interface Baselines {
  startDate: LocalDate;
  hspu: number;
  pushup90: number;
  archer: number;
  handstand: number;
  frontLeverBad: number;
  frontLeverGood: number;
  flag: number;
  muscleUp: number;
  weightedPullupLoad: number;
}

// ---------- Logs ----------

export type Side = 'L' | 'R';
export type Effort = 'easy' | 'right' | 'hard';
export type BarHeight = 'chest' | 'lowerChest' | 'waist';
export type EndedBy = 'balance' | 'shoulders';

export interface SetResult {
  /** 0-based set (or round, or attempt) index. */
  set: number;
  side?: Side;
  reps?: number;
  seconds?: number;
  load?: number;
  clean: boolean;
}

/**
 * complete: the line ran to its end (including the 90° early stop rule).
 * stoppedEarly: cut by "Finish early". pain: "Stop exercise (pain)". skipped: never reached.
 */
export type LineStatus = 'complete' | 'stoppedEarly' | 'pain' | 'skipped';

export interface LineResult {
  line: LineId;
  status: LineStatus;
  sets: SetResult[];
  effort?: Effort;
  barHeight?: BarHeight;
  endedBy?: EndedBy;
  /** Attempt rows (NT muscle-up, flag on straight bar). */
  attempts?: boolean[];
  /** Day 6 light planche variant actually done. */
  variant?: 'oneLeg' | 'advTuck';
}

export interface SessionLog {
  id: string;
  /** Timeline key of the cycle day, or 'extra' for the optional off-day practice. */
  key: string;
  date: LocalDate;
  startedAt: number;
  finishedAt: number;
  finishedEarly?: boolean;
  lines: LineResult[];
  notes?: string;
}

export interface CheckIn {
  /** The timeline week this check-in reports on. */
  weekSeq: number;
  at: number;
  bodyweight?: number;
  sleepAvg?: number;
  nightsUnder6: number;
  painMax: number;
  painOver24h: boolean;
  planchePain: boolean;
  notes?: string;
}

export type AlertKind = 'deload' | 'longBreak' | 'unlock' | 'backup' | 'checkIn';

export type EngineEvent =
  /** Early deload accepted: insert a deload week before this (uncompleted) day. */
  | { type: 'earlyDeload'; at: number; beforeKey: string }
  /** Manual shift from Settings or the dev panel. */
  | { type: 'jump'; at: number; fromKey: string; to: Position }
  | { type: 'restart80'; at: number }
  | { type: 'newCycle'; at: number; cycle: number }
  | { type: 'dismiss'; at: number; what: AlertKind }
  | { type: 'gtgDecision'; at: number; keep: boolean };

export interface EngineInput {
  baselines: Baselines;
  settings: Settings;
  sessions: SessionLog[];
  checkins: CheckIn[];
  events: EngineEvent[];
}

// ---------- Timeline ----------

export interface TimelineDay {
  key: string;
  pos: Position;
  kind: DayKind;
  weekKind: WeekKind;
  /** Sequential week counter across the whole history, inserted weeks included. */
  weekSeq: number;
  /** Completion date for done days. */
  date?: LocalDate;
  session?: SessionLog;
}

// ---------- Prescriptions ----------

export type TargetKind = 'reps' | 'hold' | 'emom' | 'total' | 'practice' | 'attempts' | 'maxHold' | 'amrap';

/** The numbers a line's rule produces, before deload or pain changes. */
export interface Target {
  exercise: ExerciseId;
  kind: TargetKind;
  /** Display name override for a variation ("Toes to bar"). */
  name?: string;
  reps?: number[];
  seconds?: number[];
  /** Reps per side, both sides in one set (archer). */
  perSide?: boolean;
  /** Holds where each set is two timed holds: left + right leg, or side A + side B. */
  bilateral?: 'leg' | 'side';
  side?: Side;
  load?: number;
  emom?: { rounds: number; reps: number; intervalSec: number };
  total?: { target: number; topSet: boolean; lastSetsUsed?: number };
  practiceMinutes?: number;
  attempts?: number;
  /** Rule reads the Easy/Right/Hard rating. */
  rateable?: boolean;
  note?: string;
  stage?: number;
}

export interface LinePrescription extends Target {
  line: LineId;
  name: string;
  cue: string;
  rir?: string;
  restSec: number;
  restAfterSec: number;
  askEffort: boolean;
  /** Whether this session's result can move the line forward. */
  progresses: boolean;
  isTest?: boolean;
  askBarHeight?: boolean;
  askEndedBy?: boolean;
  /** 90 degree rule: a not-clean rep ends the line for the day. */
  endOnNotClean?: boolean;
  notCleanLabel?: string;
}

export interface Outcome {
  prescription: LinePrescription;
  result?: LineResult;
  /** The line ran and the result met every set clean, without a Hard rating. */
  success: boolean;
  /** Ran to the end but finished below prescription (feeds the deload trigger). */
  below: boolean;
  attempted: boolean;
}
