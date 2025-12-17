/**
 * Rebalance Engine
 * Detects muscle coverage gaps and recommends minimal exercise adjustments
 * Minimal V2 implementation: avoids freshness dependency unless cache exists
 */

import { supabase } from '../supabase/client';
import { getMergedExercise } from '../supabase/queries/exercises';
import { devLog, devError } from '../utils/logger';

// Constants
export const N_SESSIONS_LOOKBACK = 6; // Number of recent sessions to analyze
export const MIN_GAP_MUSCLES = 1; // Minimum number of missing muscles that triggers prompt

export interface RebalanceResult {
  needsRebalance: boolean;
  reasons: string[];
  missedMuscles: string[]; // Muscles not hit in last N sessions
}

/**
 * Check if workout needs rebalancing based on muscle coverage
 * Minimal V2: checks muscles not hit in last N sessions (no freshness dependency)
 */
export async function needsRebalance(
  userId: string,
  templateId?: string,
  dayName?: string
): Promise<RebalanceResult> {
  if (__DEV__) {
    devLog('rebalance', {
      action: 'needsRebalance',
      userId,
      templateId,
      dayName,
    });
  }

  const reasons: string[] = [];
  const missedMuscles: string[] = [];

  try {
    // Get last N completed sessions
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('v2_workout_sessions')
      .select('id, started_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(N_SESSIONS_LOOKBACK);

    if (sessionsError) {
      if (__DEV__) {
        devError('rebalance', sessionsError, { userId });
      }
      return { needsRebalance: false, reasons: [], missedMuscles: [] };
    }

    if (!recentSessions || recentSessions.length === 0) {
      // No recent sessions - no rebalancing needed
      return { needsRebalance: false, reasons: [], missedMuscles: [] };
    }

    const sessionIds = recentSessions.map((s) => s.id);

    // Get all session exercises from recent sessions
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id')
      .in('session_id', sessionIds);

    if (exercisesError) {
      if (__DEV__) {
        devError('rebalance', exercisesError, { userId, sessionIds });
      }
      return { needsRebalance: false, reasons: [], missedMuscles: [] };
    }

    if (!sessionExercises || sessionExercises.length === 0) {
      // No exercises in recent sessions
      return { needsRebalance: false, reasons: [], missedMuscles: [] };
    }

    // Get all unique exercise IDs (both master and custom)
    const exerciseIds = new Set<string>();
    const customExerciseIds = new Set<string>();

    for (const se of sessionExercises) {
      if (se.exercise_id) {
        exerciseIds.add(se.exercise_id);
      }
      if (se.custom_exercise_id) {
        customExerciseIds.add(se.custom_exercise_id);
      }
    }

    // Get merged exercises to determine primary muscles
    const allMusclesHit = new Set<string>();

    for (const exerciseId of exerciseIds) {
      const exercise = await getMergedExercise({ exerciseId }, userId);
      if (exercise && exercise.primary_muscles) {
        for (const muscle of exercise.primary_muscles) {
          allMusclesHit.add(muscle);
        }
        // Also add implicit hits
        if (exercise.implicit_hits) {
          for (const muscle of Object.keys(exercise.implicit_hits)) {
            allMusclesHit.add(muscle);
          }
        }
      }
    }

    for (const customExerciseId of customExerciseIds) {
      const exercise = await getMergedExercise({ customExerciseId }, userId);
      if (exercise && exercise.primary_muscles) {
        for (const muscle of exercise.primary_muscles) {
          allMusclesHit.add(muscle);
        }
        // Also add implicit hits
        if (exercise.implicit_hits) {
          for (const muscle of Object.keys(exercise.implicit_hits)) {
            allMusclesHit.add(muscle);
          }
        }
      }
    }

    // Get all canonical muscles from v2_muscles
    const { data: allMuscles, error: musclesError } = await supabase
      .from('v2_muscles')
      .select('key');

    if (musclesError) {
      if (__DEV__) {
        devError('rebalance', musclesError, { userId });
      }
      return { needsRebalance: false, reasons: [], missedMuscles: [] };
    }

    if (!allMuscles || allMuscles.length === 0) {
      // No muscles defined - cannot check gaps
      return { needsRebalance: false, reasons: [], missedMuscles: [] };
    }

    // Find missed muscles (muscles not hit in last N sessions)
    const allMuscleKeys = new Set(allMuscles.map((m) => m.key));
    for (const muscleKey of allMuscleKeys) {
      if (!allMusclesHit.has(muscleKey)) {
        missedMuscles.push(muscleKey);
      }
    }

    // Check if we have enough missed muscles to trigger rebalancing
    if (missedMuscles.length >= MIN_GAP_MUSCLES) {
      reasons.push(
        `${missedMuscles.length} muscle${missedMuscles.length > 1 ? 's' : ''} not hit in last ${recentSessions.length} session${recentSessions.length > 1 ? 's' : ''}: ${missedMuscles.slice(0, 5).join(', ')}${missedMuscles.length > 5 ? '...' : ''}`
      );
    }

    const needsRebalanceResult = reasons.length > 0;

    if (__DEV__) {
      devLog('rebalance', {
        action: 'needsRebalance_result',
        userId,
        needsRebalance: needsRebalanceResult,
        missedMuscleCount: missedMuscles.length,
        recentSessionCount: recentSessions.length,
      });
    }

    return {
      needsRebalance: needsRebalanceResult,
      reasons,
      missedMuscles,
    };
  } catch (error) {
    if (__DEV__) {
      devError('rebalance', error, { userId, templateId, dayName });
    }
    return { needsRebalance: false, reasons: [], missedMuscles: [] };
  }
}

