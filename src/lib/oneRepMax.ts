/**
 * One-Rep Max (1RM) Calculation Utilities
 * 
 * Uses the Brzycki formula to estimate 1RM from submaximal lifts:
 * 1RM = Weight × (36 / (37 - Reps))
 * 
 * This allows normalization across different rep ranges for progressive overload tracking.
 */

/**
 * Calculate estimated 1RM using Brzycki formula
 * @param weight - Weight lifted (in lbs or kg)
 * @param reps - Number of reps performed
 * @returns Estimated 1RM, or null if inputs are invalid
 */
export function calculate1RM(weight: number, reps: number): number | null {
  // Validate inputs
  if (!weight || weight <= 0 || !reps || reps <= 0) {
    return null;
  }

  // Brzycki formula: 1RM = Weight × (36 / (37 - Reps))
  // For reps >= 37, the formula breaks down, so we cap at 36
  if (reps >= 37) {
    return null; // Formula not valid for 37+ reps
  }

  const oneRM = weight * (36 / (37 - reps));
  return Math.round(oneRM * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate estimated 1RM from a rep range string (e.g., "8-12")
 * Uses the minimum reps in the range for conservative estimation
 * @param weight - Weight lifted
 * @param repRange - Rep range string like "8-12" or single number "10"
 * @returns Estimated 1RM, or null if inputs are invalid
 */
export function calculate1RMFromRange(weight: number, repRange: string): number | null {
  if (!weight || weight <= 0 || !repRange) {
    return null;
  }

  // Parse rep range (e.g., "8-12" -> 8, or "10" -> 10)
  const rangeMatch = repRange.match(/^(\d+)(?:-(\d+))?$/);
  if (!rangeMatch) {
    return null;
  }

  const minReps = parseInt(rangeMatch[1], 10);
  if (isNaN(minReps) || minReps <= 0) {
    return null;
  }

  return calculate1RM(weight, minReps);
}

/**
 * Calculate the weight needed for a specific rep count to match a target 1RM
 * Inverse of Brzycki formula: Weight = 1RM × ((37 - Reps) / 36)
 * @param target1RM - Target 1RM value
 * @param reps - Number of reps to perform
 * @returns Weight needed, or null if inputs are invalid
 */
export function calculateWeightFor1RM(target1RM: number, reps: number): number | null {
  if (!target1RM || target1RM <= 0 || !reps || reps <= 0) {
    return null;
  }

  if (reps >= 37) {
    return null; // Formula not valid for 37+ reps
  }

  const weight = target1RM * ((37 - reps) / 36);
  return Math.round(weight * 100) / 100; // Round to 2 decimal places
}

/**
 * Get the best (highest) estimated 1RM from an array of workout sets
 * @param sets - Array of sets with weight and reps
 * @returns Best estimated 1RM, or null if no valid sets
 */
export function getBest1RM(sets: Array<{ weight: number | null; reps: number | null }>): number | null {
  if (!sets || sets.length === 0) {
    return null;
  }

  let best1RM: number | null = null;

  for (const set of sets) {
    if (set.weight && set.reps && set.weight > 0 && set.reps > 0) {
      const oneRM = calculate1RM(set.weight, set.reps);
      if (oneRM && (!best1RM || oneRM > best1RM)) {
        best1RM = oneRM;
      }
    }
  }

  return best1RM;
}

/**
 * Calculate average 1RM from multiple sets (useful for tracking progress over time)
 * @param sets - Array of sets with weight and reps
 * @returns Average estimated 1RM, or null if no valid sets
 */
export function getAverage1RM(sets: Array<{ weight: number | null; reps: number | null }>): number | null {
  if (!sets || sets.length === 0) {
    return null;
  }

  const valid1RMs: number[] = [];

  for (const set of sets) {
    if (set.weight && set.reps && set.weight > 0 && set.reps > 0) {
      const oneRM = calculate1RM(set.weight, set.reps);
      if (oneRM) {
        valid1RMs.push(oneRM);
      }
    }
  }

  if (valid1RMs.length === 0) {
    return null;
  }

  const sum = valid1RMs.reduce((acc, val) => acc + val, 0);
  const average = sum / valid1RMs.length;
  return Math.round(average * 100) / 100; // Round to 2 decimal places
}

