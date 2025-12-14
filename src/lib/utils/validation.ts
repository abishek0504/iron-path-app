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

