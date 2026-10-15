// PLAN_SPEC §4. The PDF gives the items and the 10 min total; the split is [D09].
export interface WarmupItem {
  name: string;
  seconds: number;
}

export const WARMUP: WarmupItem[] = [
  { name: 'Wrist circles', seconds: 90 },
  { name: 'Wrist push-ups', seconds: 120 },
  { name: 'Scapular push-ups', seconds: 120 },
  { name: 'Scapular pulls', seconds: 120 },
  { name: 'Band dislocates', seconds: 90 },
  { name: 'Light planche lean', seconds: 20 },
  { name: 'Shake out', seconds: 20 },
  { name: 'Light planche lean', seconds: 20 },
];
