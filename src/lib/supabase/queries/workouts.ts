/**
 * Workout queries
 * Handles workout sessions and sets (performed truth)
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id?: string;
  day_name?: string;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  completed_at?: string;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  sort_order: number;
}

export interface SessionSet {
  id: string;
  session_exercise_id: string;
  set_number: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  rir?: number;
  duration_sec?: number;
  rest_sec?: number;
  notes?: string;
  performed_at: string;
}

/**
 * Create a new workout session
 */
export async function createWorkoutSession(
  userId: string,
  templateId?: string,
  dayName?: string
): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', { 
      action: 'createWorkoutSession', 
      userId, 
      templateId, 
      dayName 
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .insert({
        user_id: userId,
        template_id: templateId,
        day_name: dayName,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, templateId, dayName });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, templateId, dayName });
    }
    return null;
  }
}

/**
 * Get active session for user
 */
export async function getActiveSession(userId: string): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getActiveSession', userId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId });
    }
    return null;
  }
}

/**
 * Complete a workout session
 */
export async function completeWorkoutSession(sessionId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', { action: 'completeWorkoutSession', sessionId });
  }

  try {
    const { error } = await supabase
      .from('v2_workout_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { sessionId });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return false;
  }
}

/**
 * Save a set to a session exercise
 */
export async function saveSessionSet(
  sessionExerciseId: string,
  setNumber: number,
  setData: {
    reps?: number;
    weight?: number;
    rpe?: number;
    rir?: number;
    duration_sec?: number;
    rest_sec?: number;
    notes?: string;
  }
): Promise<SessionSet | null> {
  if (__DEV__) {
    devLog('workout-query', { 
      action: 'saveSessionSet', 
      sessionExerciseId, 
      setNumber,
      hasReps: setData.reps !== undefined,
      hasDuration: setData.duration_sec !== undefined
    });
  }

  try {
    // Check if set already exists
    const { data: existing } = await supabase
      .from('v2_session_sets')
      .select('id')
      .eq('session_exercise_id', sessionExerciseId)
      .eq('set_number', setNumber)
      .maybeSingle();

    if (existing) {
      // Update existing set
      const { data, error } = await supabase
        .from('v2_session_sets')
        .update(setData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        if (__DEV__) {
          devError('workout-query', error, { sessionExerciseId, setNumber });
        }
        return null;
      }

      return data;
    } else {
      // Create new set
      const { data, error } = await supabase
        .from('v2_session_sets')
        .insert({
          session_exercise_id: sessionExerciseId,
          set_number: setNumber,
          ...setData,
        })
        .select()
        .single();

      if (error) {
        if (__DEV__) {
          devError('workout-query', error, { sessionExerciseId, setNumber });
        }
        return null;
      }

      return data;
    }
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionExerciseId, setNumber });
    }
    return null;
  }
}

/**
 * Prefill session sets with progressive overload targets
 * Creates v2_session_sets rows for planned set count with prefilled reps/weight/duration
 * These are "starting targets" that the user edits, NOT "already performed" values
 */
export async function prefillSessionSets(
  sessionId: string,
  sessionExercises: Array<{
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
  }>,
  targets: Map<string, {
    sets: number;
    reps?: number;
    duration_sec?: number;
    weight?: number;
  }>
): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'prefillSessionSets',
      sessionId,
      exerciseCount: sessionExercises.length,
      targetCount: targets.size,
    });
  }

  try {
    // Create sets for each session exercise
    for (const sessionExercise of sessionExercises) {
      const exerciseId = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
      if (!exerciseId) continue;

      const target = targets.get(exerciseId);
      if (!target) continue;

      // Create sets for the planned set count
      for (let setNumber = 1; setNumber <= target.sets; setNumber++) {
        const { error } = await supabase
          .from('v2_session_sets')
          .insert({
            session_exercise_id: sessionExercise.id,
            set_number: setNumber,
            reps: target.reps || null,
            weight: target.weight || null,
            duration_sec: target.duration_sec || null,
            // RPE/RIR are null initially (user fills these during workout)
            rpe: null,
            rir: null,
            rest_sec: null,
            notes: null,
          });

        if (error) {
          if (__DEV__) {
            devError('workout-query', error, {
              sessionId,
              sessionExerciseId: sessionExercise.id,
              setNumber,
            });
          }
          return false;
        }
      }
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'prefillSessionSets_result',
        sessionId,
        setsCreated: sessionExercises.reduce((sum, se) => {
          const exerciseId = se.exercise_id || se.custom_exercise_id;
          const target = exerciseId ? targets.get(exerciseId) : null;
          return sum + (target?.sets || 0);
        }, 0),
      });
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return false;
  }
}

