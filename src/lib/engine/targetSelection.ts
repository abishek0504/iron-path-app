/**
 * Target Selection Engine
 * Implements prescription-based target selection as specified in V2_ARCHITECTURE.md
 * Never invents defaults when prescription is missing
 */

import { getExercisePrescription, getPrescriptionsForExercises } from '../supabase/queries/prescriptions';
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

/**
 * Select targets for a single exercise
 * Returns null if prescription is missing (data error)
 */
export async function selectExerciseTargets(
  exerciseId: string,
  userId: string,
  context: TargetSelectionContext,
  historyCount: number = 0
): Promise<ExerciseTarget | null> {
  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargets',
      exerciseId,
      userId,
      context,
      historyCount,
    });
  }

  // Get merged exercise to determine mode
  const exercise = await getMergedExercise({ exerciseId }, userId);
  if (!exercise) {
    if (__DEV__) {
      devError('target-selection', new Error('Exercise not found'), { exerciseId, userId });
    }
    return null;
  }

  // Determine mode
  const mode: 'reps' | 'timed' = exercise.is_timed ? 'timed' : 'reps';

  // Fetch prescription
  const prescription = await getExercisePrescription(
    exerciseId,
    context.experience,
    mode
  );

  if (!prescription) {
    // Hard rule: no prescription = data error, exclude from generation
    if (__DEV__) {
      devError('target-selection', new Error('No prescription found'), {
        exerciseId,
        context,
        mode,
      });
    }
    return null;
  }

  // Get exercise history for progressive overload
  const history = await getExerciseHistory(exerciseId, userId, 5);
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
      if (hasHistory && history.lastReps && history.lastWeight !== undefined) {
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
      if (hasHistory && history.lastDuration !== undefined) {
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
    exercise_id: exerciseId,
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
  exerciseIds: string[],
  userId: string,
  context: TargetSelectionContext,
  historyCounts: Map<string, number> = new Map()
): Promise<ExerciseTarget[]> {
  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargetsBulk',
      exerciseIdsCount: exerciseIds.length,
      userId,
      context,
    });
  }

  const targets: ExerciseTarget[] = [];

  // Get all merged exercises to determine modes
  const exercises = await Promise.all(
    exerciseIds.map((id) => getMergedExercise({ exerciseId: id }, userId))
  );

  const validExercises = exercises.filter((e): e is NonNullable<typeof e> => e !== null);
  const modes = validExercises.map((e) => (e.is_timed ? 'timed' : 'reps'));

  // Bulk fetch prescriptions
  const repsPrescriptions = await getPrescriptionsForExercises(
    validExercises.filter((e) => !e.is_timed).map((e) => e.id),
    context.experience,
    'reps'
  );

  const timedPrescriptions = await getPrescriptionsForExercises(
    validExercises.filter((e) => e.is_timed).map((e) => e.id),
    context.experience,
    'timed'
  );

  // Select targets for each exercise
  for (let i = 0; i < validExercises.length; i++) {
    const exercise = validExercises[i];
    const mode = modes[i];
    const historyCount = historyCounts.get(exercise.id) || 0;

    const prescription =
      mode === 'reps'
        ? repsPrescriptions.get(exercise.id)
        : timedPrescriptions.get(exercise.id);

    if (!prescription) {
      // Exclude from generation (data error)
      if (__DEV__) {
        devError('target-selection', new Error('No prescription found'), {
          exerciseId: exercise.id,
          context,
          mode,
        });
      }
      continue;
    }

    // Select targets (same logic as single exercise)
    let sets: number;
    if (historyCount < 3) {
      sets = Math.floor((prescription.sets_min + prescription.sets_max) / 2);
    } else {
      sets = Math.ceil((prescription.sets_min + prescription.sets_max) / 2);
    }
    sets = Math.max(prescription.sets_min, Math.min(prescription.sets_max, sets));

    let reps: number | undefined;
    let duration_sec: number | undefined;

    if (mode === 'reps' && prescription.reps_min && prescription.reps_max) {
      if (historyCount < 3) {
        reps = Math.floor((prescription.reps_min + prescription.reps_max) / 2);
      } else {
        reps = Math.ceil((prescription.reps_min + prescription.reps_max) / 2);
      }
      reps = Math.max(prescription.reps_min, Math.min(prescription.reps_max, reps));
    } else if (mode === 'timed' && prescription.duration_sec_min && prescription.duration_sec_max) {
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

    targets.push({
      exercise_id: exercise.id,
      sets,
      mode,
      reps,
      duration_sec,
    });
  }

  if (__DEV__) {
    devLog('target-selection', {
      action: 'selectExerciseTargetsBulk_result',
      requestedCount: exerciseIds.length,
      validCount: validExercises.length,
      targetCount: targets.length,
      excludedCount: exerciseIds.length - targets.length,
    });
  }

  return targets;
}

