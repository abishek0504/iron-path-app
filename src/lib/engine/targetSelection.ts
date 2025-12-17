/**
 * Target Selection Engine
 * Implements prescription-based target selection as specified in V2_ARCHITECTURE.md
 * Never invents defaults when prescription is missing
 */

import { getExercisePrescription } from '../supabase/queries/prescriptions';
import { getMergedExercise } from '../supabase/queries/exercises';
import { getExerciseHistory } from '../supabase/queries/workouts';
import { devLog, devError } from '../utils/logger';

export interface ExerciseTarget {
  exercise_id: string;
  sets: number;
  reps?: number;
  duration_sec?: number;
  weight?: number; // Suggested weight for progressive overload (reps mode only)
  mode: 'reps' | 'timed';
}

export interface TargetSelectionContext {
  experience: string;
}

export interface ExerciseIdentifier {
  exerciseId?: string;
  customExerciseId?: string;
}

/**
 * Select targets for a single exercise
 * Returns null if prescription is missing (data error)
 */
export async function selectExerciseTargets(
  exerciseRef: ExerciseIdentifier,
  userId: string,
  context: TargetSelectionContext,
  historyCount: number = 0
): Promise<ExerciseTarget | null> {
  const hasExerciseId = !!exerciseRef.exerciseId;
  const hasCustomExerciseId = !!exerciseRef.customExerciseId;

  if (hasExerciseId === hasCustomExerciseId) {
    if (__DEV__) {
      devError(
        'target-selection',
        new Error('Exactly one of exerciseId or customExerciseId must be provided'),
        { exerciseRef, userId }
      );
    }
    return null;
  }

  const exerciseKey = exerciseRef.exerciseId || exerciseRef.customExerciseId!;

  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargets',
      exerciseId: exerciseRef.exerciseId,
      customExerciseId: exerciseRef.customExerciseId,
      userId,
      context,
      historyCount,
    });
  }

  // Get merged exercise to determine mode
  const exercise = await getMergedExercise(exerciseRef, userId);
  if (!exercise) {
    if (__DEV__) {
      devError('target-selection', new Error('Exercise not found'), {
        exerciseRef,
        userId,
      });
    }
    return null;
  }

  // Determine mode
  const mode: 'reps' | 'timed' = exercise.is_timed ? 'timed' : 'reps';

  // Fetch prescription (custom exercises fall back to their own target bands)
  const prescription =
    exercise.source === 'custom'
      ? (() => {
          const setsMin = exercise.sets_min;
          const setsMax = exercise.sets_max;
          if (setsMin === undefined || setsMax === undefined) {
            return null;
          }
          if (mode === 'reps') {
            if (
              exercise.reps_min === undefined ||
              exercise.reps_max === undefined
            ) {
              return null;
            }
          } else {
            if (
              exercise.duration_sec_min === undefined ||
              exercise.duration_sec_max === undefined
            ) {
              return null;
            }
          }
          return {
            sets_min: setsMin,
            sets_max: setsMax,
            reps_min: exercise.reps_min,
            reps_max: exercise.reps_max,
            duration_sec_min: exercise.duration_sec_min,
            duration_sec_max: exercise.duration_sec_max,
          };
        })()
      : await getExercisePrescription(
          exerciseRef.exerciseId || exercise.id,
          context.experience,
          mode
        );

  if (!prescription) {
    // Hard rule: no prescription = data error, exclude from generation
    if (__DEV__) {
      devError('target-selection', new Error('No prescription found'), {
        exerciseRef,
        context,
        mode,
      });
    }
    return null;
  }

  // Get exercise history for progressive overload
  const history = await getExerciseHistory(exerciseKey, userId, 5);
  const hasHistory = history && history.sets.length > 0;

  // Select targets within prescription band with progressive overload
  let sets: number;
  let reps: number | undefined;
  let duration_sec: number | undefined;
  let weight: number | undefined;

  // Sets: choose lower-to-mid range for new users, mid-to-upper for experienced
  if (historyCount < 3) {
    // New user: lower-to-mid
    sets = Math.floor((prescription.sets_min + prescription.sets_max) / 2);
  } else {
    // Experienced: mid-to-upper
    sets = Math.ceil((prescription.sets_min + prescription.sets_max) / 2);
  }
  sets = Math.max(prescription.sets_min, Math.min(prescription.sets_max, sets));

  // Reps or duration based on mode with progressive overload
  if (mode === 'reps') {
    if (prescription.reps_min && prescription.reps_max) {
      if (
        hasHistory &&
        history.lastReps !== null &&
        history.lastWeight !== null
      ) {
        // Progressive overload logic for reps mode
        const lastReps = history.lastReps;
        const lastWeight = history.lastWeight;
        const avgRPE = history.avgRPE;

        // If hit top of rep band with acceptable effort (RPE <= 7), increase weight
        if (lastReps >= prescription.reps_max * 0.9 && (!avgRPE || avgRPE <= 7)) {
          // Increase weight by small step (2.5-5% or 2.5-5 lbs)
          const weightIncrease = Math.max(lastWeight * 0.025, 2.5);
          weight = lastWeight + weightIncrease;
          // Reset reps to lower end of band
          reps = prescription.reps_min;
        } else {
          // Increase reps toward top of band (clamp within band)
          reps = Math.min(lastReps + 1, prescription.reps_max);
          reps = Math.max(prescription.reps_min, reps);
          weight = lastWeight; // Keep same weight
        }
      } else {
        // No history: use default selection
        if (historyCount < 3) {
          reps = Math.floor((prescription.reps_min + prescription.reps_max) / 2);
        } else {
          reps = Math.ceil((prescription.reps_min + prescription.reps_max) / 2);
        }
        reps = Math.max(prescription.reps_min, Math.min(prescription.reps_max, reps));
      }
    }
  } else {
    // Timed mode
    if (prescription.duration_sec_min && prescription.duration_sec_max) {
      if (hasHistory && history.lastDuration !== null) {
        // Progressive overload: increase duration toward top of band
        const lastDuration = history.lastDuration;
        duration_sec = Math.min(lastDuration + 5, prescription.duration_sec_max); // Increase by 5 seconds
        duration_sec = Math.max(prescription.duration_sec_min, duration_sec);
      } else {
        // No history: use default selection
        if (historyCount < 3) {
          duration_sec = Math.floor(
            (prescription.duration_sec_min + prescription.duration_sec_max) / 2
          );
        } else {
          duration_sec = Math.ceil(
            (prescription.duration_sec_min + prescription.duration_sec_max) / 2
          );
        }
        duration_sec = Math.max(
          prescription.duration_sec_min,
          Math.min(prescription.duration_sec_max, duration_sec)
        );
      }
    }
  }

  const target: ExerciseTarget = {
    exercise_id: exercise.id,
    sets,
    mode,
    reps,
    duration_sec,
    weight, // Progressive overload suggested weight
  };

  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargets_result',
      target,
      prescriptionBand: {
        sets: [prescription.sets_min, prescription.sets_max],
        reps: mode === 'reps' ? [prescription.reps_min, prescription.reps_max] : null,
        duration:
          mode === 'timed'
            ? [prescription.duration_sec_min, prescription.duration_sec_max]
            : null,
      },
    });
  }

  return target;
}

/**
 * Select targets for multiple exercises (bulk)
 * Filters out exercises without prescriptions
 */
export async function selectExerciseTargetsBulk(
  exercises: ExerciseIdentifier[],
  userId: string,
  context: TargetSelectionContext,
  historyCounts: Map<string, number> = new Map()
): Promise<ExerciseTarget[]> {
  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargetsBulk',
      exerciseIdsCount: exercises.length,
      userId,
      context,
    });
  }

  const targets: ExerciseTarget[] = [];

  for (const ref of exercises) {
    const key = ref.exerciseId || ref.customExerciseId;
    const historyCount = key ? historyCounts.get(key) || 0 : 0;
    const target = await selectExerciseTargets(ref, userId, context, historyCount);
    if (target) {
      targets.push(target);
    }
  }

  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargetsBulk_result',
      requestedCount: exercises.length,
      targetCount: targets.length,
      excludedCount: exercises.length - targets.length,
    });
  }

  return targets;
}

