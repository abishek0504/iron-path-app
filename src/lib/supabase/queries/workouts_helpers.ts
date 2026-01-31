/**
 * Workout query helpers for structure edits
 * Split from workouts.ts to avoid circular dependencies
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import {
  createWorkoutSession,
  type WorkoutSession,
  prefillSessionSets,
  getSessionWithSets,
} from './workouts';
import { selectExerciseTargets, type TargetSelectionContext } from '../../engine/targetSelection';
import { getTemplateSlotsForDay } from './templates';
import { getMergedExercise } from './exercises';

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
  userId: string,
  edit: {
    type: 'addSlot' | 'removeSlot' | 'swapExercise' | 'reorderSlots' | 'updateNotes';
    // Add slot
    exerciseId?: string;
    customExerciseId?: string;
    sortOrder?: number;
    experience?: string;
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

      if (!result) return false;

      // Prefill sets for the new exercise
      const context: TargetSelectionContext = {
        experience: edit.experience || 'beginner',
      };

      const target = await selectExerciseTargets(
        {
          exerciseId: edit.exerciseId,
          customExerciseId: edit.customExerciseId,
        },
        userId,
        context,
        0
      );

      if (target) {
        const targets = new Map();
        const exerciseKey = edit.exerciseId || edit.customExerciseId!;
        targets.set(exerciseKey, {
          sets: target.sets,
          reps: target.reps,
          duration_sec: target.duration_sec,
          weight: target.weight,
        });

        await prefillSessionSets(sessionId, [result], targets);
      }

      return true;
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

export interface SmartRefreshPlan {
  additions: Array<{ name: string; exercise_id?: string; custom_exercise_id?: string; sort_order: number }>;
  removals: Array<{ session_exercise_id: string; name: string }>;
  hasAdjustments: boolean;
}

/**
 * Compute Smart Refresh plan: additions (from template not in session),
 * removals (session exercises not in template, not protected by performed_at),
 * and whether targets will be recalculated.
 */
export async function getSmartRefreshPlan(
  sessionId: string,
  templateId: string,
  dayName: string,
  userId: string
): Promise<SmartRefreshPlan | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSmartRefreshPlan', sessionId, templateId, dayName });
  }

  const sessionData = await getSessionWithSets(sessionId);
  if (!sessionData?.session || !sessionData.exercises.length) {
    return null;
  }

  const templateSlots = await getTemplateSlotsForDay(templateId, dayName);
  const templateKeys = new Set(
    templateSlots.map((s) => s.exercise_id || s.custom_exercise_id).filter(Boolean)
  );
  const sessionKeys = new Set(
    sessionData.exercises.map((e) => e.exercise_id || e.custom_exercise_id).filter(Boolean)
  );

  const protectedSessionExerciseIds = new Set<string>();
  for (const ex of sessionData.exercises) {
    const hasPerformedSet = ex.sets?.some((s) => s.performed_at != null);
    if (hasPerformedSet) {
      protectedSessionExerciseIds.add(ex.id);
    }
  }

  const removals: SmartRefreshPlan['removals'] = [];
  for (const ex of sessionData.exercises) {
    const key = ex.exercise_id || ex.custom_exercise_id;
    if (!key) continue;
    if (templateKeys.has(key)) continue;
    if (protectedSessionExerciseIds.has(ex.id)) continue;
    const meta = await getMergedExercise(
      ex.exercise_id ? { exerciseId: ex.exercise_id } : { customExerciseId: ex.custom_exercise_id! },
      userId
    );
    removals.push({ session_exercise_id: ex.id, name: meta?.name || 'Exercise' });
  }

  const additions: SmartRefreshPlan['additions'] = [];
  for (const slot of templateSlots) {
    const key = slot.exercise_id || slot.custom_exercise_id;
    if (!key || sessionKeys.has(key)) continue;
    const meta = await getMergedExercise(
      slot.exercise_id ? { exerciseId: slot.exercise_id } : { customExerciseId: slot.custom_exercise_id! },
      userId
    );
    additions.push({
      name: meta?.name || 'Exercise',
      exercise_id: slot.exercise_id || undefined,
      custom_exercise_id: slot.custom_exercise_id || undefined,
      sort_order: slot.sort_order,
    });
  }

  const hasAdjustments = true;

  if (__DEV__) {
    devLog('workout-query', {
      action: 'getSmartRefreshPlan_result',
      sessionId,
      additionsCount: additions.length,
      removalsCount: removals.length,
    });
  }

  return { additions, removals, hasAdjustments };
}

/**
 * Apply Smart Refresh: delete unprotected divergent exercises, insert from template, recalc targets.
 * Never deletes sets with performed_at.
 */
export async function applySmartRefresh(
  sessionId: string,
  templateId: string,
  dayName: string,
  userId: string,
  experience: string
): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', { action: 'applySmartRefresh', sessionId, templateId, dayName });
  }

  const sessionData = await getSessionWithSets(sessionId);
  if (!sessionData?.session || !sessionData.exercises.length) {
    return false;
  }

  const templateSlots = await getTemplateSlotsForDay(templateId, dayName);
  const templateKeys = new Set(
    templateSlots.map((s) => s.exercise_id || s.custom_exercise_id).filter(Boolean)
  );
  const sessionKeysBefore = new Set(
    sessionData.exercises.map((e) => e.exercise_id || e.custom_exercise_id).filter(Boolean)
  );

  const protectedSessionExerciseIds = new Set<string>();
  for (const ex of sessionData.exercises) {
    const hasPerformedSet = ex.sets?.some((s) => s.performed_at != null);
    if (hasPerformedSet) protectedSessionExerciseIds.add(ex.id);
  }

  for (const ex of sessionData.exercises) {
    const key = ex.exercise_id || ex.custom_exercise_id;
    if (!key || templateKeys.has(key) || protectedSessionExerciseIds.has(ex.id)) continue;
    const { error } = await supabase
      .from('v2_session_exercises')
      .delete()
      .eq('id', ex.id)
      .eq('session_id', sessionId);
    if (error && __DEV__) {
      devError('workout-query', error, { action: 'applySmartRefresh_delete', sessionExerciseId: ex.id });
    }
  }

  const context: TargetSelectionContext = { experience };
  let nextSortOrder = Math.max(0, ...sessionData.exercises.map((e) => e.sort_order)) + 1;
  for (const slot of templateSlots) {
    const key = slot.exercise_id || slot.custom_exercise_id;
    if (!key || sessionKeysBefore.has(key)) continue;
    const created = await createSessionExercise(sessionId, {
      exerciseId: slot.exercise_id || undefined,
      customExerciseId: slot.custom_exercise_id || undefined,
      sortOrder: nextSortOrder++,
    });
    if (created) {
      const target = await selectExerciseTargets(
        {
          exerciseId: slot.exercise_id || undefined,
          customExerciseId: slot.custom_exercise_id || undefined,
        },
        userId,
        context,
        0
      );
      if (target) {
        const targetsMap = new Map();
        targetsMap.set(key, {
          sets: target.sets,
          reps: target.reps,
          duration_sec: target.duration_sec,
          weight: target.weight,
        });
        await prefillSessionSets(sessionId, [created], targetsMap);
      }
    }
  }

  if (__DEV__) {
    devLog('workout-query', { action: 'applySmartRefresh_done', sessionId });
  }
  return true;
}