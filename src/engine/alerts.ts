// Banners on Today (PLAN_SPEC §12, §13, brief §10–12).
import { GTG_BLOCK_WEEKS } from '../plan/gtg';
import type { Facts } from '../plan/sessions';
import type { WalkResult } from './cycle';
import { addDays, daysBetween, localDate, startOfLocalDate, type LocalDate } from './dates';
import { dropTrigger, type FoldResult } from './progression';
import type { AlertKind, EngineInput } from './types';

export type Alert =
  | { kind: 'checkIn'; weekSeq: number }
  | { kind: 'deload'; reason: string }
  | { kind: 'longBreak'; days: number }
  | { kind: 'unlock' }
  | { kind: 'backup' }
  | { kind: 'gtgAsk' }
  | { kind: 'cycleComplete' };

export const LONG_BREAK_DAYS = 14;

export function computeAlerts(input: EngineInput, w: WalkResult, f: FoldResult, facts: Facts, today: LocalDate): Alert[] {
  const alerts: Alert[] = [];
  const dismissedSince = (what: AlertKind, t: number) =>
    input.events.some((e) => e.type === 'dismiss' && e.what === what && e.at >= t);

  if (w.status === 'cycleComplete') alerts.push({ kind: 'cycleComplete' });

  // Weekly check-in: due after Day 7 of the most recent completed week.
  const lastWeekEnd = [...w.done].reverse().find((d) => d.pos.day === 7);
  if (lastWeekEnd && !input.checkins.some((c) => c.weekSeq === lastWeekEnd.weekSeq)) {
    const dueFrom = startOfLocalDate(addDays(lastWeekEnd.date!, 1));
    if (!dismissedSince('checkIn', dueFrom)) alerts.push({ kind: 'checkIn', weekSeq: lastWeekEnd.weekSeq });
  }

  // Early deload triggers (p.14). Only offered during loading weeks.
  if (w.current.weekKind === 'loading') {
    const triggers: { at: number; reason: string }[] = [];
    const latest = [...input.checkins].sort((a, b) => a.weekSeq - b.weekSeq).pop();
    if (latest && latest.painMax >= 3 && latest.painOver24h) {
      triggers.push({ at: latest.at, reason: `Joint pain ${latest.painMax}/10 lasting more than 24 h` });
    }
    if (latest && latest.nightsUnder6 >= 3) {
      triggers.push({ at: latest.at, reason: `${latest.nightsUnder6} nights under 6 h of sleep` });
    }
    const drop = dropTrigger(f.drops);
    if (drop) triggers.push({ at: drop.at, reason: `Day ${drop.day} came in below prescription 2 sessions in a row` });

    const deloadedAfter = (t: number) =>
      input.events.some((e) => e.type === 'earlyDeload' && e.at >= t) ||
      w.done.some((d) => d.kind !== 'training' && d.kind !== 'off' && (d.session?.finishedAt ?? 0) > t);
    const live = triggers.find((t) => !dismissedSince('deload', t.at) && !deloadedAfter(t.at));
    if (live) alerts.push({ kind: 'deload', reason: live.reason });
  }

  // Missed 2 or more weeks: restart at 80% (p.14).
  const lastTraining = [...w.done].reverse().find((d) => d.session);
  if (lastTraining) {
    const days = daysBetween(lastTraining.date!, today);
    const handled = input.events.some(
      (e) =>
        (e.type === 'restart80' || (e.type === 'dismiss' && e.what === 'longBreak')) && e.at > lastTraining.session!.finishedAt,
    );
    if (days >= LONG_BREAK_DAYS && !handled) alerts.push({ kind: 'longBreak', days });
  }

  if (facts.ntUnlocked && !input.events.some((e) => e.type === 'dismiss' && e.what === 'unlock')) {
    alerts.push({ kind: 'unlock' });
  }

  // After each test week, suggest a backup once.
  const lastTest = [...w.done].reverse().find((d) => d.kind === 'testSkill' && d.session);
  if (lastTest && !dismissedSince('backup', lastTest.session!.finishedAt)) alerts.push({ kind: 'backup' });

  // GTG: ask whether to keep it after every 4 loading weeks with GTG on [D54].
  if (input.settings.gtg && input.settings.gtgSince !== undefined) {
    const decisions = input.events.filter((e) => e.type === 'gtgDecision').map((e) => e.at);
    const since = localDate(Math.max(input.settings.gtgSince, ...decisions));
    const weeks = w.done.filter((d) => d.pos.day === 7 && d.weekKind === 'loading' && d.date! >= since).length;
    if (weeks >= GTG_BLOCK_WEEKS) alerts.push({ kind: 'gtgAsk' });
  }

  return alerts;
}
