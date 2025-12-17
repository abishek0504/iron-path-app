/**
 * Validation layer
 * Shared validation helpers for muscle keys and implicit hits
 * Used by Edge/admin writes and client writes for overrides/custom exercises
 */

import { devLog, devError } from './logger';

/**
 * Validates that all muscle keys exist in v2_muscles
 * @param muscleKeys - Array of muscle keys to validate
 * @param availableMuscles - Set of valid muscle keys from v2_muscles
 * @returns Array of invalid keys (empty if all valid)
 */
export function validateMuscleKeys(
  muscleKeys: string[],
  availableMuscles: Set<string>
): string[] {
  const invalid: string[] = [];
  
  for (const key of muscleKeys) {
    if (!availableMuscles.has(key)) {
      invalid.push(key);
    }
  }
  
  if (invalid.length > 0 && __DEV__) {
    devError('validation', new Error('Invalid muscle keys'), { invalid });
  }
  
  return invalid;
}

/**
 * Validates and clamps implicit_hits values to 0..1
 * @param implicitHits - JSONB object mapping muscle_key -> activation
 * @param availableMuscles - Set of valid muscle keys
 * @returns Validated and clamped implicit_hits object
 */
export function validateAndClampImplicitHits(
  implicitHits: Record<string, number>,
  availableMuscles: Set<string>
): Record<string, number> {
  const validated: Record<string, number> = {};
  const clamped: string[] = [];
  const invalidKeys: string[] = [];
  
  for (const [key, value] of Object.entries(implicitHits)) {
    // Check key exists
    if (!availableMuscles.has(key)) {
      invalidKeys.push(key);
      continue;
    }
    
    // Clamp value to 0..1
    const clampedValue = Math.max(0, Math.min(1, value));
    if (clampedValue !== value) {
      clamped.push(key);
    }
    validated[key] = clampedValue;
  }
  
  if (__DEV__) {
    if (invalidKeys.length > 0) {
      devError('validation', new Error('Invalid muscle keys in implicit_hits'), { invalidKeys });
    }
    if (clamped.length > 0) {
      devLog('validation', { action: 'clamped_implicit_hits', clamped });
    }
  }
  
  return validated;
}

/**
 * Validates primary_muscles array
 * @param primaryMuscles - Array of muscle keys
 * @param availableMuscles - Set of valid muscle keys
 * @returns true if all valid
 */
export function validatePrimaryMuscles(
  primaryMuscles: string[],
  availableMuscles: Set<string>
): boolean {
  const invalid = validateMuscleKeys(primaryMuscles, availableMuscles);
  return invalid.length === 0;
}

/**
 * Validates density_score is in valid range
 * @param densityScore - Density score value
 * @returns true if valid (0-10)
 */
export function validateDensityScore(densityScore: number): boolean {
  return densityScore >= 0 && densityScore <= 10;
}

/**
 * Validates custom exercise target bands
 * @param exercise - Custom exercise object with target band fields
 * @param availableMuscles - Set of valid muscle keys
 * @returns Validation result with errors array
 */
export function validateCustomExerciseTargets(
  exercise: {
    mode?: string;
    sets_min?: number;
    sets_max?: number;
    reps_min?: number;
    reps_max?: number;
    duration_sec_min?: number;
    duration_sec_max?: number;
    primary_muscles?: string[];
    implicit_hits?: Record<string, number>;
  },
  availableMuscles: Set<string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate mode
  if (!exercise.mode || !['reps', 'timed'].includes(exercise.mode)) {
    errors.push('mode must be "reps" or "timed"');
  }

  // Validate sets bounds
  if (exercise.sets_min === undefined || exercise.sets_min === null) {
    errors.push('sets_min is required');
  } else if (exercise.sets_min < 1) {
    errors.push('sets_min must be >= 1');
  }

  if (exercise.sets_max === undefined || exercise.sets_max === null) {
    errors.push('sets_max is required');
  } else if (exercise.sets_max < 1 || exercise.sets_max > 10) {
    errors.push('sets_max must be between 1 and 10');
  }

  if (
    exercise.sets_min !== undefined &&
    exercise.sets_max !== undefined &&
    exercise.sets_min > exercise.sets_max
  ) {
    errors.push('sets_min must be <= sets_max');
  }

  // Validate mode-specific fields
  if (exercise.mode === 'reps') {
    if (exercise.reps_min === undefined || exercise.reps_min === null) {
      errors.push('reps_min is required for reps mode');
    } else if (exercise.reps_min < 1) {
      errors.push('reps_min must be >= 1');
    }

    if (exercise.reps_max === undefined || exercise.reps_max === null) {
      errors.push('reps_max is required for reps mode');
    } else if (exercise.reps_max < 1 || exercise.reps_max > 50) {
      errors.push('reps_max must be between 1 and 50');
    }

    if (
      exercise.reps_min !== undefined &&
      exercise.reps_max !== undefined &&
      exercise.reps_min > exercise.reps_max
    ) {
      errors.push('reps_min must be <= reps_max');
    }

    if (exercise.duration_sec_min !== undefined || exercise.duration_sec_max !== undefined) {
      errors.push('duration_sec fields must be null for reps mode');
    }
  } else if (exercise.mode === 'timed') {
    if (exercise.duration_sec_min === undefined || exercise.duration_sec_min === null) {
      errors.push('duration_sec_min is required for timed mode');
    } else if (exercise.duration_sec_min < 5) {
      errors.push('duration_sec_min must be >= 5');
    }

    if (exercise.duration_sec_max === undefined || exercise.duration_sec_max === null) {
      errors.push('duration_sec_max is required for timed mode');
    } else if (exercise.duration_sec_max < 5 || exercise.duration_sec_max > 3600) {
      errors.push('duration_sec_max must be between 5 and 3600');
    }

    if (
      exercise.duration_sec_min !== undefined &&
      exercise.duration_sec_max !== undefined &&
      exercise.duration_sec_min > exercise.duration_sec_max
    ) {
      errors.push('duration_sec_min must be <= duration_sec_max');
    }

    if (exercise.reps_min !== undefined || exercise.reps_max !== undefined) {
      errors.push('reps fields must be null for timed mode');
    }
  }

  // Validate primary_muscles
  if (exercise.primary_muscles) {
    const invalidMuscles = validateMuscleKeys(exercise.primary_muscles, availableMuscles);
    if (invalidMuscles.length > 0) {
      errors.push(`Invalid primary_muscles: ${invalidMuscles.join(', ')}`);
    }
  }

  // Validate and clamp implicit_hits
  if (exercise.implicit_hits) {
    const validated = validateAndClampImplicitHits(exercise.implicit_hits, availableMuscles);
    // Note: This function clamps values, but we're just checking validation here
    // The actual clamping should be done when saving
  }

  if (__DEV__ && errors.length > 0) {
    devError('validation', new Error('Custom exercise target validation failed'), { errors });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

