/**
 * Prescription queries
 * Fetches curated exercise targets from v2_exercise_prescriptions
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export interface ExercisePrescription {
  id: string;
  exercise_id: string;
  goal: string;
  experience: string;
  mode: 'reps' | 'timed';
  sets_min: number;
  sets_max: number;
  reps_min: number | null;
  reps_max: number | null;
  duration_sec_min: number | null;
  duration_sec_max: number | null;
  is_active: boolean;
  source_notes?: string;
}

/**
 * Get prescription for an exercise given context
 * Returns null if no prescription found (data error - must be handled by caller)
 */
export async function getExercisePrescription(
  exerciseId: string,
  goal: string,
  experience: string,
  mode: 'reps' | 'timed'
): Promise<ExercisePrescription | null> {
  if (__DEV__) {
    devLog('prescription-query', { 
      action: 'getExercisePrescription', 
      exerciseId, 
      goal, 
      experience, 
      mode 
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_exercise_prescriptions')
      .select('*')
      .eq('exercise_id', exerciseId)
      .eq('goal', goal)
      .eq('experience', experience)
      .eq('mode', mode)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('prescription-query', error, { exerciseId, goal, experience, mode });
      }
      return null;
    }

    if (!data) {
      if (__DEV__) {
        devError('prescription-query', new Error('No prescription found'), { 
          exerciseId, 
          goal, 
          experience, 
          mode 
        });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('prescription-query', error, { exerciseId, goal, experience, mode });
    }
    return null;
  }
}

/**
 * Get all prescriptions for an exercise (all goals/experiences/modes)
 */
export async function getExercisePrescriptions(
  exerciseId: string
): Promise<ExercisePrescription[]> {
  if (__DEV__) {
    devLog('prescription-query', { 
      action: 'getExercisePrescriptions', 
      exerciseId 
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_exercise_prescriptions')
      .select('*')
      .eq('exercise_id', exerciseId)
      .eq('is_active', true)
      .order('goal', { ascending: true })
      .order('experience', { ascending: true });

    if (error) {
      if (__DEV__) {
        devError('prescription-query', error, { exerciseId });
      }
      return [];
    }

    return data || [];
  } catch (error) {
    if (__DEV__) {
      devError('prescription-query', error, { exerciseId });
    }
    return [];
  }
}

/**
 * Get prescriptions for multiple exercises (bulk)
 */
export async function getPrescriptionsForExercises(
  exerciseIds: string[],
  goal: string,
  experience: string,
  mode: 'reps' | 'timed'
): Promise<Map<string, ExercisePrescription>> {
  if (__DEV__) {
    devLog('prescription-query', { 
      action: 'getPrescriptionsForExercises', 
      exerciseIdsCount: exerciseIds.length,
      goal,
      experience,
      mode
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_exercise_prescriptions')
      .select('*')
      .in('exercise_id', exerciseIds)
      .eq('goal', goal)
      .eq('experience', experience)
      .eq('mode', mode)
      .eq('is_active', true);

    if (error) {
      if (__DEV__) {
        devError('prescription-query', error, { exerciseIds, goal, experience, mode });
      }
      return new Map();
    }

    const map = new Map<string, ExercisePrescription>();
    for (const prescription of data || []) {
      map.set(prescription.exercise_id, prescription);
    }

    if (__DEV__) {
      devLog('prescription-query', { 
        action: 'getPrescriptionsForExercises_result', 
        foundCount: map.size,
        requestedCount: exerciseIds.length
      });
    }

    return map;
  } catch (error) {
    if (__DEV__) {
      devError('prescription-query', error, { exerciseIds, goal, experience, mode });
    }
    return new Map();
  }
}

