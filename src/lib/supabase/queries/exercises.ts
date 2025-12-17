/**
 * Exercise queries
 * Implements merged per-user exercise view as specified in V2_ARCHITECTURE.md
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export interface MergedExercise {
  id: string;
  name: string;
  description?: string;
  density_score: number;
  primary_muscles: string[];
  secondary_muscles?: string[];
  implicit_hits: Record<string, number>;
  is_unilateral: boolean;
  setup_buffer_sec: number;
  avg_time_per_set_sec: number;
  is_timed: boolean;
  equipment_needed?: string[];
  movement_pattern?: string;
  tempo_category?: string;
  // Source tracking
  source: 'master' | 'custom' | 'override';
}

/**
 * Get merged exercise view for a single exercise
 * Accepts either exercise_id OR custom_exercise_id (not both)
 * Implements: v2_exercises defaults ⊕ non-null overrides
 * If custom_exercise_id provided, fetch from v2_user_custom_exercises directly
 */
export async function getMergedExercise(
  input: { exerciseId?: string; customExerciseId?: string },
  userId: string
): Promise<MergedExercise | null> {
  const { exerciseId, customExerciseId } = input;
  
  if (__DEV__) {
    devLog('exercise-query', { action: 'getMergedExercise', exerciseId, customExerciseId, userId });
  }

  // Validate exactly one is provided
  const hasExerciseId = !!exerciseId;
  const hasCustomExerciseId = !!customExerciseId;
  
  if (hasExerciseId === hasCustomExerciseId) {
    if (__DEV__) {
      devError('exercise-query', new Error('Exactly one of exerciseId or customExerciseId must be provided'), { input, userId });
    }
    return null;
  }

  try {
    // If custom_exercise_id provided, fetch from v2_user_custom_exercises directly
    if (customExerciseId) {
      const { data: customExercise, error: customError } = await supabase
        .from('v2_user_custom_exercises')
        .select('*')
        .eq('id', customExerciseId)
        .eq('user_id', userId)
        .single();

      if (customError || !customExercise) {
        if (__DEV__) {
          devError('exercise-query', customError || new Error('Custom exercise not found'), { customExerciseId, userId });
        }
        return null;
      }

      if (__DEV__) {
        devLog('exercise-query', { action: 'found_custom', customExerciseId });
      }
      return {
        id: customExercise.id,
        name: customExercise.name,
        description: customExercise.description,
        density_score: customExercise.density_score,
        primary_muscles: customExercise.primary_muscles,
        secondary_muscles: customExercise.secondary_muscles,
        implicit_hits: customExercise.implicit_hits,
        is_unilateral: customExercise.is_unilateral,
        setup_buffer_sec: customExercise.setup_buffer_sec,
        avg_time_per_set_sec: customExercise.avg_time_per_set_sec,
        is_timed: customExercise.is_timed,
        equipment_needed: customExercise.equipment_needed,
        movement_pattern: customExercise.movement_pattern,
        tempo_category: customExercise.tempo_category,
        source: 'custom',
      };
    }

    // Get master exercise (exerciseId provided)
    if (!exerciseId) {
      if (__DEV__) {
        devError('exercise-query', new Error('exerciseId required when customExerciseId not provided'), { input, userId });
      }
      return null;
    }

    const { data: masterExercise, error: masterError } = await supabase
      .from('v2_exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();

    if (masterError || !masterExercise) {
      if (__DEV__) {
        devError('exercise-query', masterError || new Error('Exercise not found'), { exerciseId });
      }
      return null;
    }

    // Get user overrides
    const { data: override, error: overrideError } = await supabase
      .from('v2_user_exercise_overrides')
      .select('*')
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (overrideError && __DEV__) {
      devError('exercise-query', overrideError, { exerciseId, userId });
    }

    // Merge: master defaults ⊕ non-null overrides
    const merged: MergedExercise = {
      id: masterExercise.id,
      name: masterExercise.name,
      description: override?.description ?? masterExercise.description,
      density_score: override?.density_score_override ?? masterExercise.density_score,
      primary_muscles: override?.primary_muscles_override ?? masterExercise.primary_muscles,
      secondary_muscles: masterExercise.secondary_muscles,
      implicit_hits: override?.implicit_hits_override ?? masterExercise.implicit_hits,
      is_unilateral: override?.is_unilateral_override ?? masterExercise.is_unilateral,
      setup_buffer_sec: override?.setup_buffer_sec_override ?? masterExercise.setup_buffer_sec,
      avg_time_per_set_sec: override?.avg_time_per_set_sec_override ?? masterExercise.avg_time_per_set_sec,
      is_timed: override?.is_timed_override ?? masterExercise.is_timed,
      equipment_needed: masterExercise.equipment_needed,
      movement_pattern: masterExercise.movement_pattern,
      tempo_category: masterExercise.tempo_category,
      source: override ? 'override' : 'master',
    };

    if (__DEV__) {
      devLog('exercise-query', { 
        action: 'merged_exercise', 
        exerciseId, 
        hasOverrides: !!override,
        overrideFields: override ? Object.keys(override).filter(k => k.includes('_override')) : []
      });
    }

    return merged;
  } catch (error) {
    if (__DEV__) {
      devError('exercise-query', error, { exerciseId, userId });
    }
    return null;
  }
}

/**
 * Get merged exercise view for multiple exercises (bulk)
 */
export async function listMergedExercises(
  userId: string,
  exerciseIds?: string[]
): Promise<MergedExercise[]> {
  if (__DEV__) {
    devLog('exercise-query', { 
      action: 'listMergedExercises', 
      userId, 
      exerciseIdsCount: exerciseIds?.length 
    });
  }

  try {
    // Get all user custom exercises
    let customQuery = supabase
      .from('v2_user_custom_exercises')
      .select('*')
      .eq('user_id', userId);

    if (exerciseIds && exerciseIds.length > 0) {
      customQuery = customQuery.in('id', exerciseIds);
    }

    const { data: customExercises, error: customError } = await customQuery;

    if (customError && __DEV__) {
      devError('exercise-query', customError, { userId });
    }

    const customIds = new Set(customExercises?.map(e => e.id) || []);
    const masterIds = exerciseIds 
      ? exerciseIds.filter(id => !customIds.has(id))
      : undefined;

    // Get master exercises (excluding those with custom versions)
    let masterQuery = supabase
      .from('v2_exercises')
      .select('*');

    if (masterIds && masterIds.length > 0) {
      masterQuery = masterQuery.in('id', masterIds);
    }

    const { data: masterExercises, error: masterError } = await masterQuery;

    if (masterError && __DEV__) {
      devError('exercise-query', masterError, { userId });
    }

    // Get all overrides for these exercises
    const masterExerciseIds = masterExercises?.map(e => e.id) || [];
    let overrideQuery = supabase
      .from('v2_user_exercise_overrides')
      .select('*')
      .eq('user_id', userId);

    if (masterExerciseIds.length > 0) {
      overrideQuery = overrideQuery.in('exercise_id', masterExerciseIds);
    }

    const { data: overrides, error: overrideError } = await overrideQuery;

    if (overrideError && __DEV__) {
      devError('exercise-query', overrideError, { userId });
    }

    // Build override map
    const overrideMap = new Map(
      (overrides || []).map(o => [o.exercise_id, o])
    );

    // Merge custom exercises
    const merged: MergedExercise[] = (customExercises || []).map(ex => ({
      id: ex.id,
      name: ex.name,
      description: ex.description,
      density_score: ex.density_score,
      primary_muscles: ex.primary_muscles,
      secondary_muscles: ex.secondary_muscles,
      implicit_hits: ex.implicit_hits,
      is_unilateral: ex.is_unilateral,
      setup_buffer_sec: ex.setup_buffer_sec,
      avg_time_per_set_sec: ex.avg_time_per_set_sec,
      is_timed: ex.is_timed,
      equipment_needed: ex.equipment_needed,
      movement_pattern: ex.movement_pattern,
      tempo_category: ex.tempo_category,
      source: 'custom',
    }));

    // Merge master exercises with overrides
    for (const master of masterExercises || []) {
      const override = overrideMap.get(master.id);
      merged.push({
        id: master.id,
        name: master.name,
        description: master.description,
        density_score: override?.density_score_override ?? master.density_score,
        primary_muscles: override?.primary_muscles_override ?? master.primary_muscles,
        secondary_muscles: master.secondary_muscles,
        implicit_hits: override?.implicit_hits_override ?? master.implicit_hits,
        is_unilateral: override?.is_unilateral_override ?? master.is_unilateral,
        setup_buffer_sec: override?.setup_buffer_sec_override ?? master.setup_buffer_sec,
        avg_time_per_set_sec: override?.avg_time_per_set_sec_override ?? master.avg_time_per_set_sec,
        is_timed: override?.is_timed_override ?? master.is_timed,
        equipment_needed: master.equipment_needed,
        movement_pattern: master.movement_pattern,
        tempo_category: master.tempo_category,
        source: override ? 'override' : 'master',
      });
    }

    if (__DEV__) {
      devLog('exercise-query', { 
        action: 'listMergedExercises_result', 
        totalCount: merged.length,
        customCount: customExercises?.length || 0,
        overrideCount: overrides?.length || 0
      });
    }

    return merged;
  } catch (error) {
    if (__DEV__) {
      devError('exercise-query', error, { userId });
    }
    return [];
  }
}

