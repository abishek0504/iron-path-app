/**
 * Muscle Recovery & Fatigue Tracking Utilities
 * 
 * Calculates muscle group fatigue based on volume (sets × reps × weight)
 * and applies time-based decay to track recovery state.
 * 
 * Recovery is calculated as a percentage (0-100%) where:
 * - 0% = Fully fatigued (just worked)
 * - 100% = Fully recovered (ready for heavy work)
 * 
 * Fatigue decays over time based on muscle group recovery rates.
 */

export interface MuscleGroupVolume {
  muscleGroup: string;
  volume: number; // Total volume: sets × reps × weight
  timestamp: Date;
}

export interface MuscleRecoveryState {
  muscleGroup: string;
  recoveryPercent: number; // 0-100, where 100 = fully recovered
  lastWorkedAt: Date | null;
  totalVolume: number; // Cumulative volume from recent workouts
}

/**
 * Standard recovery rates (hours to 50% recovery) for different muscle groups
 * Based on exercise science research
 */
const RECOVERY_RATES: Record<string, number> = {
  // Large muscle groups (slower recovery)
  'legs': 48, // 2 days
  'back': 48,
  'chest': 48,
  'glutes': 48,
  'hamstrings': 48,
  'quadriceps': 48,
  'calves': 24,
  
  // Medium muscle groups
  'shoulders': 36,
  'triceps': 24,
  'biceps': 24,
  'forearms': 24,
  
  // Small muscle groups (faster recovery)
  'abs': 24,
  'core': 24,
  'traps': 24,
  
  // Default for unknown muscle groups
  'default': 36,
};

/**
 * Calculate recovery percentage for a muscle group
 * Uses exponential decay: recovery = 100 * (1 - e^(-t/τ))
 * where t = hours since last workout, τ = recovery rate
 * 
 * @param lastWorkedAt - Timestamp of last workout targeting this muscle
 * @param muscleGroup - Name of muscle group
 * @returns Recovery percentage (0-100)
 */
export function calculateRecovery(
  lastWorkedAt: Date | null,
  muscleGroup: string
): number {
  if (!lastWorkedAt) {
    return 100; // Never worked = fully recovered
  }

  const now = new Date();
  const hoursSinceWorkout = (now.getTime() - lastWorkedAt.getTime()) / (1000 * 60 * 60);
  
  // Get recovery rate for this muscle group (default to 36 hours)
  const recoveryRate = RECOVERY_RATES[muscleGroup.toLowerCase()] || RECOVERY_RATES['default'];
  
  // Exponential decay formula: recovery = 100 * (1 - e^(-t/τ))
  // This gives us a smooth curve from 0% (just worked) to 100% (fully recovered)
  const recovery = 100 * (1 - Math.exp(-hoursSinceWorkout / recoveryRate));
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(recovery * 100) / 100));
}

/**
 * Calculate volume for a muscle group from workout sets
 * Volume = sum of (sets × reps × weight) for all sets targeting that muscle
 * 
 * @param sets - Array of sets with weight, reps, and muscle groups
 * @param muscleGroup - Target muscle group
 * @returns Total volume for that muscle group
 */
export function calculateMuscleVolume(
  sets: Array<{
    weight: number | null;
    reps: number | null;
    muscleGroups?: string[] | null;
  }>,
  muscleGroup: string
): number {
  let totalVolume = 0;
  const muscleGroupLower = muscleGroup.toLowerCase();

  for (const set of sets) {
    if (!set.muscleGroups || set.muscleGroups.length === 0) {
      continue; // Skip sets without muscle group data
    }

    // Check if this set targets the muscle group (case-insensitive)
    const targetsMuscle = set.muscleGroups.some(
      mg => mg.toLowerCase() === muscleGroupLower
    );

    if (targetsMuscle && set.weight && set.reps) {
      const volume = set.weight * set.reps;
      totalVolume += volume;
    }
  }

  return totalVolume;
}

/**
 * Calculate recovery state for all muscle groups from workout history
 * 
 * @param workoutHistory - Array of workouts with sets and timestamps
 * @returns Map of muscle group -> recovery state
 */
export function calculateAllMuscleRecovery(
  workoutHistory: Array<{
    sets: Array<{
      weight: number | null;
      reps: number | null;
      muscleGroups?: string[] | null;
    }>;
    performedAt: Date;
  }>
): Map<string, MuscleRecoveryState> {
  const recoveryMap = new Map<string, MuscleRecoveryState>();
  const muscleGroupLastWorked = new Map<string, Date>();
  const muscleGroupTotalVolume = new Map<string, number>();

  // Process workouts in chronological order (oldest first)
  const sortedWorkouts = [...workoutHistory].sort(
    (a, b) => a.performedAt.getTime() - b.performedAt.getTime()
  );

  // Collect all unique muscle groups and track last worked time
  for (const workout of sortedWorkouts) {
    const muscleGroupsInWorkout = new Set<string>();

    for (const set of workout.sets) {
      if (!set.muscleGroups || set.muscleGroups.length === 0) {
        continue;
      }

      for (const muscleGroup of set.muscleGroups) {
        const mgLower = muscleGroup.toLowerCase();
        muscleGroupsInWorkout.add(mgLower);

        // Update last worked time (most recent workout wins)
        if (!muscleGroupLastWorked.has(mgLower) || 
            workout.performedAt > (muscleGroupLastWorked.get(mgLower) || new Date(0))) {
          muscleGroupLastWorked.set(mgLower, workout.performedAt);
        }

        // Accumulate volume
        if (set.weight && set.reps) {
          const currentVolume = muscleGroupTotalVolume.get(mgLower) || 0;
          muscleGroupTotalVolume.set(mgLower, currentVolume + (set.weight * set.reps));
        }
      }
    }
  }

  // Calculate recovery state for each muscle group
  for (const [muscleGroup, lastWorkedAt] of muscleGroupLastWorked.entries()) {
    const recoveryPercent = calculateRecovery(lastWorkedAt, muscleGroup);
    const totalVolume = muscleGroupTotalVolume.get(muscleGroup) || 0;

    recoveryMap.set(muscleGroup, {
      muscleGroup,
      recoveryPercent,
      lastWorkedAt,
      totalVolume,
    });
  }

  return recoveryMap;
}

/**
 * Get recovery color for visualization (heatmap)
 * Red = low recovery (0-33%), Yellow = medium (34-66%), Green = high (67-100%)
 * 
 * @param recoveryPercent - Recovery percentage (0-100)
 * @returns Hex color code
 */
export function getRecoveryColor(recoveryPercent: number): string {
  if (recoveryPercent >= 67) {
    return '#22c55e'; // Green (fully recovered)
  } else if (recoveryPercent >= 34) {
    return '#f97316'; // Orange (partially recovered)
  } else {
    return '#ef4444'; // Red (fatigued)
  }
}

/**
 * Get recovery label for display
 * 
 * @param recoveryPercent - Recovery percentage (0-100)
 * @returns Human-readable label
 */
export function getRecoveryLabel(recoveryPercent: number): string {
  if (recoveryPercent >= 80) {
    return 'Fully Recovered';
  } else if (recoveryPercent >= 50) {
    return 'Mostly Recovered';
  } else if (recoveryPercent >= 25) {
    return 'Partially Recovered';
  } else {
    return 'Fatigued';
  }
}

