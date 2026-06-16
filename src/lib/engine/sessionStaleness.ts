/**
 * Smart Refresh: detect session staleness (structural, biomechanical, target).
 * Used by Active Workout to show Refresh button state (Gray / Orange / Red).
 */

import { devLog } from '../utils/logger';

export interface StalenessInput {
  session: {
    id: string;
    template_id?: string | null;
    day_name?: string | null;
    started_at: string;
  };
  sessionExercises: {
    exercise_id?: string | null;
    custom_exercise_id?: string | null;
    sort_order: number;
  }[];
  templateSlots: {
    exercise_id?: string | null;
    custom_exercise_id?: string | null;
    sort_order: number;
  }[];
  muscleFreshnessMap?: Record<string, number>;
  exercisePrimaryMuscles?: Record<string, string[]>;
  lastCompletedWorkoutAt?: string | null;
}

export interface StalenessResult {
  structural: boolean;
  biomechanical: boolean;
  target: boolean;
}

function exerciseKey(
  ex: { exercise_id?: string | null; custom_exercise_id?: string | null }
): string {
  return (ex.exercise_id || ex.custom_exercise_id) || '';
}

/**
 * Structural hash: template slot order+ids vs session exercise order+ids
 * (session exercises that match template by exercise_id/custom_exercise_id).
 */
function structuralDivergence(
  sessionExercises: StalenessInput['sessionExercises'],
  templateSlots: StalenessInput['templateSlots']
): boolean {
  const templateKeys = templateSlots
    .map((s) => exerciseKey(s))
    .filter(Boolean);
  const sessionKeysFromTemplate = sessionExercises
    .map((e) => exerciseKey(e))
    .filter((k) => templateKeys.includes(k));
  const templateOrder = templateKeys.join(',');
  const sessionOrder = sessionKeysFromTemplate.join(',');
  const lengthMatch = sessionKeysFromTemplate.length === templateKeys.length;
  const orderMatch = sessionOrder === templateOrder;
  const divergent = !lengthMatch || !orderMatch;
  if (__DEV__) {
    devLog('session-staleness', {
      action: 'structuralCheck',
      templateKeys,
      sessionKeysFromTemplate,
      lengthMatch,
      orderMatch,
      divergent,
    });
  }
  return divergent;
}

/**
 * Biomechanical: any primary muscle freshness < 30% (recovery zone).
 */
function biomechanicalDivergence(
  sessionExercises: StalenessInput['sessionExercises'],
  muscleFreshnessMap: Record<string, number>,
  exercisePrimaryMuscles: Record<string, string[]>
): boolean {
  const FRESHNESS_THRESHOLD = 30;
  for (const ex of sessionExercises) {
    const key = exerciseKey(ex);
    const muscles = exercisePrimaryMuscles[key];
    if (!muscles?.length) continue;
    for (const muscle of muscles) {
      const freshness = muscleFreshnessMap[muscle];
      if (freshness !== undefined && freshness < FRESHNESS_THRESHOLD) {
        if (__DEV__) {
          devLog('session-staleness', {
            action: 'biomechanicalCheck',
            muscle,
            freshness,
            threshold: FRESHNESS_THRESHOLD,
          });
        }
        return true;
      }
    }
  }
  return false;
}

/**
 * Target freshness: last completed workout after session started
 * => progressive overload calc is based on stale history.
 */
function targetDivergence(
  sessionStartedAt: string,
  lastCompletedWorkoutAt: string | null | undefined
): boolean {
  if (!lastCompletedWorkoutAt) return false;
  const divergent = new Date(lastCompletedWorkoutAt) > new Date(sessionStartedAt);
  if (__DEV__ && divergent) {
    devLog('session-staleness', {
      action: 'targetCheck',
      sessionStartedAt,
      lastCompletedWorkoutAt,
      divergent: true,
    });
  }
  return divergent;
}

/**
 * Returns which kinds of staleness apply.
 * Orange = structural or target; Red = biomechanical.
 */
export function detectSessionStaleness(input: StalenessInput): StalenessResult {
  const structural = structuralDivergence(
    input.sessionExercises,
    input.templateSlots
  );
  let biomechanical = false;
  if (
    input.muscleFreshnessMap &&
    input.exercisePrimaryMuscles &&
    Object.keys(input.exercisePrimaryMuscles).length > 0
  ) {
    biomechanical = biomechanicalDivergence(
      input.sessionExercises,
      input.muscleFreshnessMap,
      input.exercisePrimaryMuscles
    );
  }
  const target = targetDivergence(
    input.session.started_at,
    input.lastCompletedWorkoutAt
  );

  return { structural, biomechanical, target };
}
