import { ComponentPreferences } from './trainingPreferences';

export interface TimeEstimationInput {
  movementPattern?: string | null;
  tempoCategory?: string | null;
  setupBufferSec?: number | null;
  isUnilateral?: boolean | null;
  targetSets: number;
  targetReps: number;
  positionIndex?: number; // 0-based index within the workout
}

export interface TimeEstimationResult {
  estimatedDurationSec: number;
  estimatedTimePerRepSec: number;
}

const TEMPO_SECONDS_PER_REP: Record<string, number> = {
  grind: 5.0,
  standard: 3.5,
  ballistic: 1.5,
};

const getTempoSecondsPerRep = (tempoCategory?: string | null): number => {
  if (!tempoCategory) return TEMPO_SECONDS_PER_REP.standard;
  const key = tempoCategory.toLowerCase();
  if (key in TEMPO_SECONDS_PER_REP) {
    return TEMPO_SECONDS_PER_REP[key];
  }
  return TEMPO_SECONDS_PER_REP.standard;
};

/**
 * Very lightweight deterministic time estimation used by the adaptive engine.
 * This is intentionally simple and only runs when building or adjusting plans.
 */
export const estimateExerciseDuration = (input: TimeEstimationInput): TimeEstimationResult => {
  const tempo = getTempoSecondsPerRep(input.tempoCategory);
  const unilateralFactor = input.isUnilateral ? 2 : 1;
  const setup = input.setupBufferSec ?? 15;

  const totalReps = input.targetSets * input.targetReps;
  const baseSeconds = totalReps * tempo * unilateralFactor;

  // Simple fatigue bump: later exercises are slightly slower.
  const idx = input.positionIndex ?? 0;
  const fatigueMultiplier = 1 + Math.min(idx * 0.05, 0.3); // up to +30%

  const estimatedDurationSec = Math.round((baseSeconds + setup) * fatigueMultiplier);
  const safeTotalReps = totalReps > 0 ? totalReps : 1;
  const estimatedTimePerRepSec = estimatedDurationSec / safeTotalReps;

  if (__DEV__) {
    console.log('[timeEstimation] estimateExerciseDuration', {
      input,
      tempo,
      unilateralFactor,
      setup,
      fatigueMultiplier,
      estimatedDurationSec,
      estimatedTimePerRepSec,
    });
  }

  return {
    estimatedDurationSec,
    estimatedTimePerRepSec,
  };
};


