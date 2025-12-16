/**
 * Workout query helpers for structure edits
 * Split from workouts.ts to avoid circular dependencies
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import { createWorkoutSession, type WorkoutSession } from './workouts';

/**
 * Get or create active session for today
 * Used for "Today only" structure edits
 */
export async function getOrCreateActiveSessionForToday(
  userId: string,
  dayName?: string
): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getOrCreateActiveSessionForToday', userId, dayName });
  }

  try {
    // Check if there is an in-progress session for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingSession, error: queryError } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('started_at', `${today}T00:00:00Z`)
      .lt('started_at', `${today}T23:59:59Z`)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError && __DEV__) {
      devError('workout-query', queryError, { userId, dayName });
    }

    if (existingSession) {
      return existingSession;
    }

    // Create new session for today
    return await createWorkoutSession(userId, undefined, dayName);
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, dayName });
    }
    return null;
  }
}

/**
 * Create session exercise (structure only)
 * Used for applying structure edits to sessions
 */
export async function createSessionExercise(
  sessionId: string,
  input: {
    exerciseId?: string;
    customExerciseId?: string;
    sortOrder: number;
  }
): Promise<{ id: string; session_id: string; exercise_id?: string; custom_exercise_id?: string; sort_order: number } | null> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'createSessionExercise',
      sessionId,
      exerciseId: input.exerciseId,
      customExerciseId: input.customExerciseId,
      sortOrder: input.sortOrder,
    });
  }

  // Validate exactly one of exerciseId or customExerciseId is provided
  const hasExerciseId = !!input.exerciseId;
  const hasCustomExerciseId = !!input.customExerciseId;

  if (hasExerciseId === hasCustomExerciseId) {
    if (__DEV__) {
      devError('workout-query', new Error('Exactly one of exerciseId or customExerciseId must be provided'), {
        sessionId,
        input,
      });
    }
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('v2_session_exercises')
      .insert({
        session_id: sessionId,
        exercise_id: input.exerciseId || null,
        custom_exercise_id: input.customExerciseId || null,
        sort_order: input.sortOrder,
      })
      .select()
      .single();

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { sessionId, input });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId, input });
    }
    return null;
  }
}

/**
 * Apply structure edit to session
 * Used for "Today only" scope
 */
export async function applyStructureEditToSession(
  sessionId: string,
  edit: {
    type: 'addSlot' | 'removeSlot' | 'swapExercise' | 'reorderSlots' | 'updateNotes';
    // Add slot
    exerciseId?: string;
    customExerciseId?: string;
    sortOrder?: number;
    // Remove slot
    sessionExerciseId?: string;
    // Swap exercise
    targetSessionExerciseId?: string;
    newExerciseId?: string;
    newCustomExerciseId?: string;
    // Update notes (future)
    notes?: string;
  }
): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', { action: 'applyStructureEditToSession', sessionId, editType: edit.type });
  }

  try {
    if (edit.type === 'addSlot') {
      if (!edit.exerciseId && !edit.customExerciseId) {
        if (__DEV__) {
          devError('workout-query', new Error('exerciseId or customExerciseId required for addSlot'), { sessionId, edit });
        }
        return false;
      }

      // Get current max sort_order
      const { data: existing } = await supabase
        .from('v2_session_exercises')
        .select('sort_order')
        .eq('session_id', sessionId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sortOrder = edit.sortOrder ?? ((existing?.sort_order ?? 0) + 1);

      const result = await createSessionExercise(sessionId, {
        exerciseId: edit.exerciseId,
        customExerciseId: edit.customExerciseId,
        sortOrder,
      });

      return !!result;
    } else if (edit.type === 'removeSlot') {
      if (!edit.sessionExerciseId) {
        if (__DEV__) {
          devError('workout-query', new Error('sessionExerciseId required for removeSlot'), { sessionId, edit });
        }
        return false;
      }

      const { error } = await supabase
        .from('v2_session_exercises')
        .delete()
        .eq('id', edit.sessionExerciseId)
        .eq('session_id', sessionId);

      if (error) {
        if (__DEV__) {
          devError('workout-query', error, { sessionId, edit });
        }
        return false;
      }

      return true;
    } else if (edit.type === 'swapExercise') {
      if (!edit.targetSessionExerciseId || (!edit.newExerciseId && !edit.newCustomExerciseId)) {
        if (__DEV__) {
          devError('workout-query', new Error('targetSessionExerciseId and newExerciseId/newCustomExerciseId required for swapExercise'), {
            sessionId,
            edit,
          });
        }
        return false;
      }

      const { error } = await supabase
        .from('v2_session_exercises')
        .update({
          exercise_id: edit.newExerciseId || null,
          custom_exercise_id: edit.newCustomExerciseId || null,
        })
        .eq('id', edit.targetSessionExerciseId)
        .eq('session_id', sessionId);

      if (error) {
        if (__DEV__) {
          devError('workout-query', error, { sessionId, edit });
        }
        return false;
      }

      return true;
    }

    // TODO: Implement reorderSlots and updateNotes
    if (__DEV__) {
      devLog('workout-query', { action: 'applyStructureEditToSession', note: `${edit.type} not yet implemented` });
    }

    return false;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId, edit });
    }
    return false;
  }
}

