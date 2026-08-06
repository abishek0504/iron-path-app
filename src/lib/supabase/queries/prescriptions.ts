/**
 * Prescription queries
 * Prefers bundled catalog; falls back to Supabase only if a row is missing locally.
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import {
  getBundledPrescription,
  getBundledPrescriptionsForExercises,
} from '../../../data/bundledCatalog';

export interface ExercisePrescription {
  id: string;
  exercise_id: string;
  experience: string;
  mode: 'reps' | 'timed';
  sets_min: number;
  sets_max: number;
  reps_min: number | null;
  reps_max: number | null;
  duration_sec_min: number | null;
  duration_sec_max: number | null;
  suggested_weight_lbs: number | null;
  suggested_weight_kg: number | null;
  /** Multiplier of bodyweight for suggested weight. suggested = current_weight * this. 0 = bodyweight-only. Always set (no NULL). */
  suggested_weight_multiplier_bw: number;
  is_active: boolean;
  source_notes?: string;
}

/**
 * Get prescription for an exercise given context
 * Returns null if no prescription found (data error - must be handled by caller)
 */
export async function getExercisePrescription(
  exerciseId: string,
  experience: string,
  mode: 'reps' | 'timed'
): Promise<ExercisePrescription | null> {
  if (__DEV__) {
    devLog('prescription-query', {
      action: 'getExercisePrescription',
      exerciseId,
      experience,
      mode,
    });
  }

  const bundled = getBundledPrescription(exerciseId, experience, mode);
  if (bundled) return bundled;

  try {
    const { data, error } = await supabase
      .from('v2_exercise_prescriptions')
      .select('id, exercise_id, experience, mode, sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, suggested_weight_lbs, suggested_weight_kg, suggested_weight_multiplier_bw, is_active, source_notes')
      .eq('exercise_id', exerciseId)
      .eq('experience', experience)
      .eq('mode', mode)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('prescription-query', error, { exerciseId, experience, mode });
      }
      return null;
    }

    if (!data) {
      if (__DEV__) {
        devError('prescription-query', new Error('No prescription found'), {
          exerciseId,
          experience,
          mode,
        });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('prescription-query', error, { exerciseId, experience, mode });
    }
    return null;
  }
}

/**
 * Get all prescriptions for an exercise (all experiences/modes)
 */
export async function getExercisePrescriptions(
  exerciseId: string
): Promise<ExercisePrescription[]> {
  if (__DEV__) {
    devLog('prescription-query', {
      action: 'getExercisePrescriptions',
      exerciseId,
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_exercise_prescriptions')
      .select('id, exercise_id, experience, mode, sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, suggested_weight_lbs, suggested_weight_kg, suggested_weight_multiplier_bw, is_active, source_notes')
      .eq('exercise_id', exerciseId)
      .eq('is_active', true)
      .order('experience', { ascending: true })
      .order('mode', { ascending: true });

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
 * Get prescriptions for multiple exercises (bulk) — local-first from bundled catalog.
 */
export async function getPrescriptionsForExercises(
  exerciseIds: string[],
  experience: string,
  mode: 'reps' | 'timed'
): Promise<Map<string, ExercisePrescription>> {
  if (__DEV__) {
    devLog('prescription-query', {
      action: 'getPrescriptionsForExercises',
      exerciseIdsCount: exerciseIds.length,
      experience,
      mode,
    });
  }

  if (exerciseIds.length === 0) {
    return new Map();
  }

  const bundled = getBundledPrescriptionsForExercises(exerciseIds, experience, mode);
  if (bundled.size === exerciseIds.length) {
    if (__DEV__) {
      devLog('prescription-query', {
        action: 'getPrescriptionsForExercises_result',
        foundCount: bundled.size,
        requestedCount: exerciseIds.length,
        source: 'bundled',
      });
    }
    return bundled;
  }

  // Fill any gaps from network (new exercises not yet in the shipped snapshot).
  const missing = exerciseIds.filter((id) => !bundled.has(id));
  if (missing.length === 0) return bundled;

  try {
    const { data, error } = await supabase
      .from('v2_exercise_prescriptions')
      .select('id, exercise_id, experience, mode, sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, suggested_weight_lbs, suggested_weight_kg, suggested_weight_multiplier_bw, is_active, source_notes')
      .in('exercise_id', missing)
      .eq('experience', experience)
      .eq('mode', mode)
      .eq('is_active', true);

    if (error) {
      if (__DEV__) {
        devError('prescription-query', error, { exerciseIds: missing, experience, mode });
      }
      return bundled;
    }

    for (const prescription of data || []) {
      bundled.set(prescription.exercise_id, prescription);
    }

    if (__DEV__) {
      devLog('prescription-query', {
        action: 'getPrescriptionsForExercises_result',
        foundCount: bundled.size,
        requestedCount: exerciseIds.length,
        source: 'bundled+network',
      });
    }

    return bundled;
  } catch (error) {
    if (__DEV__) {
      devError('prescription-query', error, { exerciseIds, experience, mode });
    }
    return bundled;
  }
}
