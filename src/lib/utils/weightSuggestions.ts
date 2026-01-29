/**
 * Weight Suggestion Logic
 *
 * Calculates smart weight suggestions based on:
 * 1. Recent workout history (progressive overload)
 * 2. Prescription bodyweight multiplier (suggested = current_weight * multiplier; no NULLs)
 * 3. Fallback default when no history/prescription
 */

import { getExerciseHistory } from '../supabase/queries/workouts';
import { getUserProfile } from '../supabase/queries/users';
import { supabase } from '../supabase/client';
import { devLog } from './logger';

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

  // Get recent history (last 5 sessions)
  const referenceId = exerciseId || customExerciseId!;
  const history = await getExerciseHistory(referenceId, userId, 5);

  if (history && history.length > 0) {
    // Find most recent similar set (same set number or close)
    const recentSet = history.find(h => h.set_number === setNumber) || history[0];

    if (mode === 'reps') {
      // Progressive overload: if last time hit target reps cleanly, suggest 2.5-5% increase
      if (recentSet.reps && targetReps && recentSet.reps >= targetReps && recentSet.weight) {
        const increment = recentSet.weight >= 100 ? 5 : 2.5; // 5 lbs for heavy, 2.5 for light
        return {
          weight: Math.round((recentSet.weight + increment) * 2) / 2, // Round to nearest 0.5
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
    const experience = experienceLevel ?? (await getUserProfile(userId))?.experience_level ?? 'beginner';
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
      const profile = await getUserProfile(userId);
      const bw = profile?.current_weight ?? (useImperial ? DEFAULT_BW_LBS : DEFAULT_BW_KG);
      const raw = bw * multiplier;
      const weight = Math.round(raw * 2) / 2;

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

  if (suggestion.duration_sec) {
    const mins = Math.floor(suggestion.duration_sec / 60);
    const secs = suggestion.duration_sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return 'Enter weight';
}
