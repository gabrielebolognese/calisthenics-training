import type { HandstandState, HighPullState, WeightedMuState } from '../plan/progression';
import type { Facts } from '../plan/sessions';
import type { StagedState, StateMap } from './rules';

export function deriveFacts(states: StateMap): Facts {
  const oneLeg = states.plancheOneLeg as StagedState;
  const hs = states.handstand as HandstandState;
  return {
    plancheSwitched: oneLeg.reached,
    ntUnlocked: (states.highPull as HighPullState).unlockMet && (states.weightedMu as WeightedMuState).unlockMet,
    chestToWall: hs.lastEndedBy === 'shoulders',
  };
}
