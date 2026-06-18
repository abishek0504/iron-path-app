/**
 * Exercise history for progressive overload and weight suggestions.
 * Split from workouts.ts to avoid circular imports with targetSelection.ts.
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export interface ExerciseHistory {
  sets: {
    id: string;
    session_exercise_id: string;
    set_number: number;
    reps?: number;
    weight?: number;
    rpe?: number;
    rir?: number;
    duration_sec?: number;
    performed_at: string;
  }[];
  lastRPE: number | null;
  lastRIR: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  lastDuration: number | null;
  avgRPE: number | null;
}

export async function getExerciseHistory(
  exerciseId: string,
  userId: string,
  limit = 5
): Promise<ExerciseHistory> {
  const empty: ExerciseHistory = {
    sets: [],
    lastRPE: null,
    lastRIR: null,
    lastWeight: null,
    lastReps: null,
    lastDuration: null,
    avgRPE: null,
  };

  if (__DEV__) {
    devLog('workout-query', {
      action: 'getExerciseHistory',
      exerciseId,
      userId,
      limit,
    });
  }

  try {
    const { data: stretchRow } = await supabase
      .from('v2_exercises')
      .select('is_stretch')
      .eq('id', exerciseId)
      .maybeSingle();
    if (stretchRow?.is_stretch) {
      return empty;
    }

    const { data, error } = await supabase
      .from('v2_session_sets')
      .select(
        `
          id,
          session_exercise_id,
          set_number,
          reps,
          weight,
          rpe,
          rir,
          duration_sec,
          performed_at,
          v2_session_exercises!inner(
            exercise_id,
            custom_exercise_id,
            session_id,
            v2_workout_sessions!inner(user_id, status)
          )
        `
      )
      .eq('v2_session_exercises.v2_workout_sessions.user_id', userId)
      .eq('v2_session_exercises.v2_workout_sessions.status', 'completed')
      .or(`exercise_id.eq.${exerciseId},custom_exercise_id.eq.${exerciseId}`, { foreignTable: 'v2_session_exercises' })
      .not('performed_at', 'is', null)
      .neq('set_type', 'warmup')
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { exerciseId, userId, limit });
      }
      return empty;
    }

    const sets =
      (data || []).map((set) => ({
        id: set.id,
        session_exercise_id: set.session_exercise_id,
        set_number: set.set_number,
        reps: set.reps ?? undefined,
        weight: set.weight ?? undefined,
        rpe: set.rpe ?? undefined,
        rir: set.rir ?? undefined,
        duration_sec: set.duration_sec ?? undefined,
        performed_at: set.performed_at,
      })) || [];

    if (!sets.length) {
      return empty;
    }

    const last = sets[0];
    const rpeValues = sets
      .map((s) => s.rpe)
      .filter((val): val is number => val !== undefined && val !== null);
    const avgRPE =
      rpeValues.length > 0
        ? rpeValues.reduce((sum, val) => sum + val, 0) / rpeValues.length
        : null;

    const result: ExerciseHistory = {
      sets,
      lastRPE: last.rpe ?? null,
      lastRIR: last.rir ?? null,
      lastWeight: last.weight ?? null,
      lastReps: last.reps ?? null,
      lastDuration: last.duration_sec ?? null,
      avgRPE,
    };

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getExerciseHistory_result',
        exerciseId,
        userId,
        setCount: sets.length,
        lastPerformedAt: last.performed_at,
        avgRPE,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { exerciseId, userId, limit });
    }
    return empty;
  }
}
