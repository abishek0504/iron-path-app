/**
 * Weight Suggestion Logic
 *
 * Calculates smart weight suggestions based on:
 * 1. Recent workout history (progressive overload)
 * 2. Prescription bodyweight multiplier (suggested = current_weight * multiplier; no NULLs)
 * 3. Fallback default when no history/prescription
 */

import { getExerciseHistory } from '../supabase/queries/workouts';
import { getUserProfileCached } from '../cache/dashboardStatsCache';
import { supabase } from '../supabase/client';
import { devLog } from './logger';
import { formatDurationDisplay } from './formatDuration';

const DEFAULT_BW_LBS = 150;
const DEFAULT_BW_KG = 70;

interface WeightSuggestion {
  weight?: number;
  reps?: number;
  duration_sec?: number;
  source: 'history' | 'prescription' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate suggested weight for next set
 * experienceLevel: optional; if not provided, fetched from user profile for prescription lookup
 */
export async function calculateWeightSuggestion(
  exerciseId: string | undefined,
  customExerciseId: string | undefined,
  userId: string,
  setNumber: number,
  mode: 'reps' | 'timed',
  targetReps?: number,
  targetDuration?: number,
  experienceLevel?: string,
  useImperial: boolean = true
): Promise<WeightSuggestion> {
  if (__DEV__) {
    devLog('weight-suggestion', {
      action: 'calculateSuggestion',
      exerciseId,
      customExerciseId,
      setNumber,
      mode,
    });
  }

  if (exerciseId) {
    const { data: stretchRow } = await supabase
      .from('v2_exercises')
      .select('is_stretch')
      .eq('id', exerciseId)
      .maybeSingle();
    if (stretchRow?.is_stretch) {
      return {
        duration_sec: targetDuration,
        source: 'prescription',
        confidence: 'medium',
      };
    }
  }

  // Get recent history (last 5 sessions) — strength exercises only
  const referenceId = exerciseId || customExerciseId!;
  const history = await getExerciseHistory(referenceId, userId, 5);

  if (history && history.sets.length > 0) {
    // Find most recent similar set (same set number or close)
    const recentSet = history.sets.find(h => h.set_number === setNumber) || history.sets[0];

    if (mode === 'reps') {
      // Progressive overload: if last time hit target reps cleanly, suggest 2.5-5% increase
      if (recentSet.reps && targetReps && recentSet.reps >= targetReps && recentSet.weight) {
        const increment =
          useImperial
            ? recentSet.weight >= 100
              ? 5
              : 2.5
            : recentSet.weight >= 45
              ? 2.5
              : 1.25;
        const precision = useImperial ? 2 : 4;
        return {
          weight: Math.round((recentSet.weight + increment) * precision) / precision,
          reps: targetReps,
          source: 'history',
          confidence: 'high',
        };
      }

      // Otherwise, use last successful weight
      if (recentSet.weight && recentSet.reps) {
        return {
          weight: recentSet.weight,
          reps: targetReps || recentSet.reps,
          source: 'history',
          confidence: 'medium',
        };
      }
    } else {
      // Timed exercises - suggest last duration
      if (recentSet.duration_sec) {
        return {
          duration_sec: targetDuration || recentSet.duration_sec,
          source: 'history',
          confidence: 'high',
        };
      }
    }
  }

  // No history - use prescription bodyweight multiplier (always a number, no NULLs)
  if (referenceId && mode === 'reps') {
    const experience = experienceLevel ?? (await getUserProfileCached(userId))?.experience_level ?? 'beginner';
    const { data: prescription } = await supabase
      .from('v2_exercise_prescriptions')
      .select('suggested_weight_multiplier_bw')
      .eq('exercise_id', referenceId)
      .eq('experience', experience)
      .eq('mode', 'reps')
      .eq('is_active', true)
      .maybeSingle();

    if (prescription && typeof prescription.suggested_weight_multiplier_bw === 'number') {
      const multiplier = prescription.suggested_weight_multiplier_bw;
      const profile = await getUserProfileCached(userId);
      const bw = profile?.current_weight ?? (useImperial ? DEFAULT_BW_LBS : DEFAULT_BW_KG);
      const raw = bw * multiplier;
      const precision = useImperial ? 2 : 4;
      const weight = Math.round(raw * precision) / precision;

      if (__DEV__) {
        devLog('weight-suggestion', {
          action: 'usingPrescriptionBwMultiplier',
          weight,
          multiplier,
          experience,
        });
      }

      return {
        reps: targetReps,
        weight,
        source: 'prescription',
        confidence: 'medium',
      };
    }
  }

  // Fallback - no history, no prescription: still return 0 so UI has a value (user edits at workout)
  if (mode === 'reps') {
    return {
      reps: targetReps,
      weight: 0,
      source: 'default',
      confidence: 'low',
    };
  } else {
    return {
      duration_sec: targetDuration,
      source: 'default',
      confidence: 'low',
    };
  }
}

/**
 * Format weight suggestion for display
 */
export function formatWeightSuggestion(
  suggestion: WeightSuggestion,
  useImperial: boolean
): string {
  if (typeof suggestion.weight === 'number') {
    const unit = useImperial ? 'lbs' : 'kg';
    return `${suggestion.weight} ${unit}`;
  }

  if (suggestion.duration_sec != null) {
    return formatDurationDisplay(suggestion.duration_sec);
  }

  return 'Enter weight';
}
