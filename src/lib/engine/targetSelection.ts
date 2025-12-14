/**
 * Target Selection Engine
 * Implements prescription-based target selection as specified in V2_ARCHITECTURE.md
 * Never invents defaults when prescription is missing
 */

import { getExercisePrescription, getPrescriptionsForExercises } from '../supabase/queries/prescriptions';
import { getMergedExercise } from '../supabase/queries/exercises';
import { devLog, devError } from '../utils/logger';

export interface ExerciseTarget {
  exercise_id: string;
  sets: number;
  reps?: number;
  duration_sec?: number;
  mode: 'reps' | 'timed';
}

export interface TargetSelectionContext {
  goal: string;
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
  const exercise = await getMergedExercise(exerciseId, userId);
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
    context.goal,
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

  // Select targets within prescription band
  let sets: number;
  let reps: number | undefined;
  let duration_sec: number | undefined;

  // Sets: choose lower-to-mid range for new users, mid-to-upper for experienced
  if (historyCount < 3) {
    // New user: lower-to-mid
    sets = Math.floor((prescription.sets_min + prescription.sets_max) / 2);
  } else {
    // Experienced: mid-to-upper
    sets = Math.ceil((prescription.sets_min + prescription.sets_max) / 2);
  }
  sets = Math.max(prescription.sets_min, Math.min(prescription.sets_max, sets));

  // Reps or duration based on mode
  if (mode === 'reps') {
    if (prescription.reps_min && prescription.reps_max) {
      if (historyCount < 3) {
        // New user: lower-to-mid
        reps = Math.floor((prescription.reps_min + prescription.reps_max) / 2);
      } else {
        // Experienced: mid-to-upper
        reps = Math.ceil((prescription.reps_min + prescription.reps_max) / 2);
      }
      reps = Math.max(prescription.reps_min, Math.min(prescription.reps_max, reps));
    }
  } else {
    if (prescription.duration_sec_min && prescription.duration_sec_max) {
      if (historyCount < 3) {
        // New user: lower-to-mid
        duration_sec = Math.floor(
          (prescription.duration_sec_min + prescription.duration_sec_max) / 2
        );
      } else {
        // Experienced: mid-to-upper
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

  const target: ExerciseTarget = {
    exercise_id: exerciseId,
    sets,
    mode,
    reps,
    duration_sec,
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
    exerciseIds.map((id) => getMergedExercise(id, userId))
  );

  const validExercises = exercises.filter((e): e is NonNullable<typeof e> => e !== null);
  const modes = validExercises.map((e) => (e.is_timed ? 'timed' : 'reps'));

  // Bulk fetch prescriptions
  const repsPrescriptions = await getPrescriptionsForExercises(
    validExercises.filter((e) => !e.is_timed).map((e) => e.id),
    context.goal,
    context.experience,
    'reps'
  );

  const timedPrescriptions = await getPrescriptionsForExercises(
    validExercises.filter((e) => e.is_timed).map((e) => e.id),
    context.goal,
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

