/**
 * Weight Suggestion Logic
 * 
 * Calculates smart weight suggestions based on:
 * 1. Recent workout history (progressive overload)
 * 2. Exercise prescriptions (default starting point)
 * 3. User experience level
 */

import { getExerciseHistory } from '../supabase/queries/workouts';
import { supabase } from '../supabase/client';
import { devLog } from './logger';

interface WeightSuggestion {
  weight?: number;
  reps?: number;
  duration_sec?: number;
  source: 'history' | 'prescription' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate suggested weight for next set
 */
export async function calculateWeightSuggestion(
  exerciseId: string | undefined,
  customExerciseId: string | undefined,
  userId: string,
  setNumber: number,
  mode: 'reps' | 'timed',
  targetReps?: number,
  targetDuration?: number
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

  // No history - fetch from prescription table
  if (referenceId && mode === 'reps') {
    const { data: prescription } = await supabase
      .from('v2_exercise_prescriptions')
      .select('suggested_weight_lbs, suggested_weight_kg, experience')
      .eq('exercise_id', referenceId)
      .eq('mode', 'reps')
      .single();

    if (prescription && prescription.suggested_weight_lbs) {
      // Use prescription weight (assume beginner/intermediate for now)
      const weight = prescription.suggested_weight_lbs; // TODO: Use user's actual experience level
      
      if (__DEV__) {
        devLog('weight-suggestion', {
          action: 'usingPrescription',
          weight,
          experience: prescription.experience,
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

  // Fallback - no history, no prescription
  if (mode === 'reps') {
    return {
      reps: targetReps,
      weight: undefined, // User will input first time
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
  if (suggestion.weight) {
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
