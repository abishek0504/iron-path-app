/**
 * Progressive Overload Automation Utilities
 * 
 * Analyzes workout history to determine if user is ready for weight progression.
 * Uses success rate (met/exceeded target) and RPE data to suggest weight increases.
 */

import { calculate1RM, getBest1RM } from './oneRepMax';

export interface SetData {
  weight: number | null;
  reps: number | null;
  scheduled_reps: number | null; // Target reps
  rpe?: number | null; // Rate of Perceived Exertion (1-10)
}

export interface ProgressionRecommendation {
  exerciseName: string;
  currentWeight: number | null;
  suggestedWeight: number | null;
  increasePercent: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate success rate for an exercise over recent workouts
 * Success = met or exceeded target reps/weight
 * 
 * @param recentSets - Array of recent sets for an exercise
 * @param isTimed - Whether exercise is timed (uses duration instead of reps)
 * @returns Success rate as percentage (0-100)
 */
export function calculateSuccessRate(
  recentSets: SetData[],
  isTimed: boolean = false
): number {
  if (!recentSets || recentSets.length === 0) {
    return 0;
  }

  let successCount = 0;
  let validSets = 0;

  for (const set of recentSets) {
    if (isTimed) {
      // For timed exercises, compare duration (stored in reps field)
      // Success = achieved duration >= target duration
      if (set.reps !== null && set.scheduled_reps !== null) {
        validSets++;
        if (set.reps >= set.scheduled_reps) {
          successCount++;
        }
      }
    } else {
      // For rep exercises, compare reps
      // Success = achieved reps >= target reps
      if (set.reps !== null && set.scheduled_reps !== null) {
        validSets++;
        if (set.reps >= set.scheduled_reps) {
          successCount++;
        }
      }
    }
  }

  if (validSets === 0) {
    return 0;
  }

  return Math.round((successCount / validSets) * 100);
}

/**
 * Calculate average RPE from recent sets
 * 
 * @param recentSets - Array of recent sets with RPE data
 * @returns Average RPE, or null if no RPE data available
 */
export function calculateAverageRPE(recentSets: SetData[]): number | null {
  if (!recentSets || recentSets.length === 0) {
    return null;
  }

  const rpeValues = recentSets
    .map(set => set.rpe)
    .filter((rpe): rpe is number => rpe !== null && rpe !== undefined && rpe > 0);

  if (rpeValues.length === 0) {
    return null;
  }

  const sum = rpeValues.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / rpeValues.length) * 100) / 100;
}

/**
 * Determine if user is ready for weight progression
 * 
 * Criteria:
 * - Success rate >= 80% (met target in most recent workouts)
 * - Average RPE <= 7 (sets felt relatively easy, if RPE data available)
 * - At least 3 recent workouts with this exercise
 * 
 * @param recentSets - Array of recent sets for an exercise
 * @param isTimed - Whether exercise is timed
 * @returns True if ready for progression
 */
export function isReadyForProgression(
  recentSets: SetData[],
  isTimed: boolean = false
): boolean {
  if (!recentSets || recentSets.length < 3) {
    return false; // Need at least 3 workouts to make recommendation
  }

  const successRate = calculateSuccessRate(recentSets, isTimed);
  if (successRate < 80) {
    return false; // Not consistently meeting targets
  }

  // If RPE data is available, check that sets weren't too hard
  const avgRPE = calculateAverageRPE(recentSets);
  if (avgRPE !== null && avgRPE > 7) {
    return false; // Sets felt too hard, don't increase weight yet
  }

  return true;
}

/**
 * Calculate suggested weight increase
 * 
 * Progression guidelines:
 * - Small muscle groups (biceps, triceps): 2.5-5 lbs
 * - Medium muscle groups (shoulders): 5-10 lbs
 * - Large muscle groups (chest, back, legs): 5-15 lbs
 * - Percentage-based: 2.5-5% increase
 * 
 * @param currentWeight - Current weight being used
 * @param exerciseName - Name of exercise (to determine muscle group size)
 * @returns Suggested new weight
 */
export function calculateWeightIncrease(
  currentWeight: number,
  exerciseName: string
): number {
  if (!currentWeight || currentWeight <= 0) {
    return 0;
  }

  // Determine muscle group size from exercise name
  const nameLower = exerciseName.toLowerCase();
  let increasePercent = 0.025; // Default 2.5%

  if (nameLower.includes('bicep') || nameLower.includes('tricep') || 
      nameLower.includes('curl') || nameLower.includes('extension')) {
    increasePercent = 0.025; // 2.5% for small muscle groups
  } else if (nameLower.includes('shoulder') || nameLower.includes('press') && 
             !nameLower.includes('bench') && !nameLower.includes('leg')) {
    increasePercent = 0.035; // 3.5% for medium muscle groups
  } else {
    increasePercent = 0.05; // 5% for large muscle groups (chest, back, legs)
  }

  const increase = currentWeight * increasePercent;
  
  // Round to nearest 2.5 lbs (standard plate increments)
  const roundedIncrease = Math.round(increase / 2.5) * 2.5;
  
  return Math.max(2.5, roundedIncrease); // Minimum 2.5 lbs increase
}

/**
 * Generate progression recommendation for an exercise
 * 
 * @param exerciseName - Name of exercise
 * @param recentSets - Array of recent sets for this exercise
 * @param isTimed - Whether exercise is timed
 * @returns Progression recommendation, or null if not ready
 */
export function generateProgressionRecommendation(
  exerciseName: string,
  recentSets: SetData[],
  isTimed: boolean = false
): ProgressionRecommendation | null {
  if (!recentSets || recentSets.length === 0) {
    return null;
  }

  // Get current weight (most recent non-null weight)
  let currentWeight: number | null = null;
  for (let i = recentSets.length - 1; i >= 0; i--) {
    if (recentSets[i].weight !== null && recentSets[i].weight > 0) {
      currentWeight = recentSets[i].weight;
      break;
    }
  }

  if (!currentWeight) {
    return null; // Can't recommend progression without weight data
  }

  // Check if ready for progression
  if (!isReadyForProgression(recentSets, isTimed)) {
    return null;
  }

  const successRate = calculateSuccessRate(recentSets, isTimed);
  const avgRPE = calculateAverageRPE(recentSets);
  const weightIncrease = calculateWeightIncrease(currentWeight, exerciseName);
  const suggestedWeight = currentWeight + weightIncrease;
  const increasePercent = (weightIncrease / currentWeight) * 100;

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (recentSets.length >= 5 && successRate >= 90 && (avgRPE === null || avgRPE <= 6)) {
    confidence = 'high';
  } else if (recentSets.length < 3 || successRate < 85) {
    confidence = 'low';
  }

  // Generate reason
  let reason = `Met target ${successRate}% of the time`;
  if (avgRPE !== null) {
    reason += ` with average RPE of ${avgRPE.toFixed(1)}`;
  }
  reason += `. Ready for ${increasePercent.toFixed(1)}% increase.`;

  return {
    exerciseName,
    currentWeight,
    suggestedWeight: Math.round(suggestedWeight * 100) / 100,
    increasePercent: Math.round(increasePercent * 100) / 100,
    reason,
    confidence,
  };
}

