import { roundLiftWeight } from '../utils/units';

export const WARMUP_LADDER = [
  { percent: 0.4, reps: 8 },
  { percent: 0.6, reps: 5 },
  { percent: 0.8, reps: 3 },
] as const;

export interface WarmupPrescription {
  weight: number;
  reps: number;
  percent: number;
}

export function buildWarmupLadder(
  workingWeight: number,
  useImperial: boolean,
): WarmupPrescription[] {
  if (!Number.isFinite(workingWeight) || workingWeight <= 0) return [];
  return WARMUP_LADDER.map((step) => ({
    percent: step.percent,
    reps: step.reps,
    weight: roundLiftWeight(workingWeight * step.percent, useImperial),
  }));
}
