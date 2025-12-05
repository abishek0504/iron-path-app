import { supabase } from './supabase';
import type { WorkoutLogLike } from './progressionMetrics';

/**
 * Personal Record (PR) management for exercises.
 * PR is the highest weight successfully completed for a given exercise.
 */

export interface PersonalRecord {
  exerciseName: string;
  weight: number;
  reps: number | null;
  performedAt: string;
  sessionId: number | null;
}

/**
 * Computes PR from workout logs for a given exercise.
 * Returns the highest weight successfully completed.
 */
export const computePRFromLogs = (logs: WorkoutLogLike[]): PersonalRecord | null => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return null;
  }

  let maxWeight = 0;
  let prLog: WorkoutLogLike | null = null;

  for (const log of logs) {
    const weight = typeof log.weight === 'number' ? log.weight : null;
    const reps = typeof log.reps === 'number' ? log.reps : null;

    // Only consider logs with valid weight and reps
    if (weight != null && weight > 0 && reps != null && reps > 0) {
      if (weight > maxWeight) {
        maxWeight = weight;
        prLog = log;
      }
    }
  }

  if (!prLog || maxWeight <= 0) {
    return null;
  }

  return {
    exerciseName: prLog.exercise_name,
    weight: maxWeight,
    reps: typeof prLog.reps === 'number' ? prLog.reps : null,
    performedAt: prLog.performed_at,
    sessionId: null, // We don't have session_id in WorkoutLogLike, but could add it
  };
};

/**
 * Fetches PR for an exercise from the database (user_exercises.pr_weight if available)
 * or computes it from recent workout logs.
 */
export const getExercisePR = async (
  userId: string,
  exerciseName: string,
): Promise<PersonalRecord | null> => {
  try {
    // First, check if there's a stored PR in user_exercises
    const { data: userExercise } = await supabase
      .from('user_exercises')
      .select('pr_weight, pr_reps, pr_performed_at')
      .eq('user_id', userId)
      .eq('name', exerciseName)
      .maybeSingle();

    if (userExercise?.pr_weight != null && userExercise.pr_weight > 0) {
      return {
        exerciseName,
        weight: userExercise.pr_weight,
        reps: userExercise.pr_reps || null,
        performedAt: userExercise.pr_performed_at || new Date().toISOString(),
        sessionId: null,
      };
    }

    // If no stored PR, compute from recent logs
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('exercise_name, weight, reps, performed_at')
      .eq('user_id', userId)
      .eq('exercise_name', exerciseName)
      .not('weight', 'is', null)
      .gt('weight', 0)
      .not('reps', 'is', null)
      .gt('reps', 0)
      .order('performed_at', { ascending: false })
      .limit(100);

    if (logs && Array.isArray(logs) && logs.length > 0) {
      return computePRFromLogs(logs as WorkoutLogLike[]);
    }

    return null;
  } catch (error) {
    if (__DEV__) {
      console.error('[personalRecord] Error fetching PR:', error);
    }
    return null;
  }
};

/**
 * Updates or creates PR in user_exercises table.
 */
export const saveExercisePR = async (
  userId: string,
  exerciseName: string,
  pr: PersonalRecord,
): Promise<boolean> => {
  try {
    // Check if user_exercise exists
    const { data: existing } = await supabase
      .from('user_exercises')
      .select('id')
      .eq('user_id', userId)
      .eq('name', exerciseName)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('user_exercises')
        .update({
          pr_weight: pr.weight,
          pr_reps: pr.reps,
          pr_performed_at: pr.performedAt,
        })
        .eq('id', existing.id);

      if (error) {
        if (__DEV__) {
          console.error('[personalRecord] Error updating PR:', error);
        }
        return false;
      }
    } else {
      // Create new user_exercise with PR
      const { error } = await supabase.from('user_exercises').insert({
        user_id: userId,
        name: exerciseName,
        pr_weight: pr.weight,
        pr_reps: pr.reps,
        pr_performed_at: pr.performedAt,
      });

      if (error) {
        if (__DEV__) {
          console.error('[personalRecord] Error creating PR:', error);
        }
        return false;
      }
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.error('[personalRecord] Error saving PR:', error);
    }
    return false;
  }
};

/**
 * Auto-updates PR from a completed workout log if it's a new record.
 * For timed exercises, checks duration (stored in reps field) instead of weight.
 * For non-bodyweight exercises, checks weight + reps combination.
 */
export const maybeUpdatePRFromLog = async (
  userId: string,
  exerciseName: string,
  weight: number,
  reps: number,
  isTimed: boolean = false,
): Promise<boolean> => {
  try {
    // For timed exercises, PR is based on duration (stored in reps field)
    if (isTimed) {
      if (reps <= 0) {
        return false;
      }

      const currentPR = await getExercisePR(userId, exerciseName);
      
      // For timed exercises, compare duration (reps field) - higher duration is better
      if (!currentPR || reps > (currentPR.reps || 0)) {
        const newPR: PersonalRecord = {
          exerciseName,
          weight: 0, // Timed exercises have weight = 0
          reps: reps, // Duration stored in reps field
          performedAt: new Date().toISOString(),
          sessionId: null,
        };

        return await saveExercisePR(userId, exerciseName, newPR);
      }
    } else {
      // For non-bodyweight exercises, PR is based on weight
      // For bodyweight exercises (weight = 0), PR is based on reps
      if (weight <= 0 && reps <= 0) {
        return false;
      }

      const currentPR = await getExercisePR(userId, exerciseName);
      
      if (weight > 0) {
        // Non-bodyweight: compare weight (higher weight is better)
        if (!currentPR || weight > currentPR.weight) {
          const newPR: PersonalRecord = {
            exerciseName,
            weight,
            reps,
            performedAt: new Date().toISOString(),
            sessionId: null,
          };

          return await saveExercisePR(userId, exerciseName, newPR);
        }
      } else {
        // Bodyweight: compare reps (higher reps is better)
        if (!currentPR || (currentPR.weight === 0 && reps > (currentPR.reps || 0))) {
          const newPR: PersonalRecord = {
            exerciseName,
            weight: 0,
            reps,
            performedAt: new Date().toISOString(),
            sessionId: null,
          };

          return await saveExercisePR(userId, exerciseName, newPR);
        }
      }
    }

    return false;
  } catch (error) {
    if (__DEV__) {
      console.error('[personalRecord] Error auto-updating PR:', error);
    }
    return false;
  }
};

