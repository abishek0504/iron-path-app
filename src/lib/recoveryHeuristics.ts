/**
 * Recovery Heuristics Module
 * 
 * Tracks last heavy session dates per movement pattern and provides
 * recommendations to avoid scheduling heavy sessions too close together.
 * 
 * Based on exercise science: heavy compound movements need 48-72 hours
 * recovery for the same movement pattern.
 */

import type { MovementPattern } from './movementPatterns';
import { inferMovementPattern } from './movementPatterns';

export interface PatternRecoveryState {
  pattern: MovementPattern;
  lastHeavySessionDate: Date | null;
  hoursSinceLastHeavy: number | null;
  isRecovered: boolean;
  minRecoveryHours: number;
}

export interface RecoveryHeuristicsResult {
  patternStates: Map<MovementPattern, PatternRecoveryState>;
  warnings: string[];
  recommendations: string[];
}

/**
 * Minimum recovery hours per movement pattern.
 * Heavy compound movements need more recovery than accessories.
 */
const MIN_RECOVERY_HOURS: Record<MovementPattern, number> = {
  squat: 48,
  hinge: 72, // Deadlifts need more recovery
  lunge: 48,
  push_vert: 48,
  push_horiz: 48,
  pull_vert: 48,
  pull_horiz: 48,
  carry: 24,
  null: 24, // Default for unknown patterns
};

/**
 * Determines if an exercise is "heavy" based on tier and weight.
 * Tier 1 compounds are considered heavy by default.
 */
const isHeavyExercise = (exercise: any): boolean => {
  // Tier 1 compounds are always heavy
  // Check if exercise name suggests it's a compound movement
  const name = (exercise.name || '').toLowerCase();
  const heavyKeywords = [
    'squat',
    'deadlift',
    'bench',
    'press',
    'row',
    'pull up',
    'pull-up',
    'hip thrust',
  ];

  return heavyKeywords.some((keyword) => name.includes(keyword));
};

/**
 * Analyzes recovery state for movement patterns based on recent workout logs.
 * 
 * @param recentLogs - Recent workout logs (last 2 weeks) with exercise names and timestamps
 * @param currentWeekSchedule - Current week schedule to check for potential conflicts
 * @returns Recovery analysis with pattern states and recommendations
 */
export const analyzeRecovery = (
  recentLogs: Array<{
    exercise_name: string;
    performed_at: string;
    weight: number;
    reps: number;
  }> = [],
  currentWeekSchedule?: any
): RecoveryHeuristicsResult => {
  const patternStates = new Map<MovementPattern, PatternRecoveryState>();
  const allPatterns: MovementPattern[] = [
    'squat',
    'hinge',
    'lunge',
    'push_vert',
    'push_horiz',
    'pull_vert',
    'pull_horiz',
    'carry',
  ];

  const now = new Date();

  // Initialize all patterns
  allPatterns.forEach((pattern) => {
    patternStates.set(pattern, {
      pattern,
      lastHeavySessionDate: null,
      hoursSinceLastHeavy: null,
      isRecovered: true,
      minRecoveryHours: MIN_RECOVERY_HOURS[pattern] || 48,
    });
  });

  // Find last heavy session for each pattern from logs
  recentLogs.forEach((log) => {
    const pattern = inferMovementPattern(log.exercise_name);
    if (!pattern) return;

    const state = patternStates.get(pattern);
    if (!state) return;

    const logDate = new Date(log.performed_at);
    
    // Consider it "heavy" if weight > 0 and reps are in strength range (1-8)
    const isHeavy = log.weight > 0 && log.reps >= 1 && log.reps <= 8;

    if (isHeavy) {
      if (!state.lastHeavySessionDate || logDate > state.lastHeavySessionDate) {
        state.lastHeavySessionDate = logDate;
        const hoursSince = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60);
        state.hoursSinceLastHeavy = hoursSince;
        state.isRecovered = hoursSince >= state.minRecoveryHours;
      }
    }
  });

  // Check current week schedule for potential conflicts
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (currentWeekSchedule) {
    const days = Object.keys(currentWeekSchedule);
    const scheduledPatterns = new Map<MovementPattern, Array<{ day: string; exerciseName: string }>>();

    days.forEach((day) => {
      const dayData = currentWeekSchedule[day];
      if (dayData?.exercises && Array.isArray(dayData.exercises)) {
        dayData.exercises.forEach((ex: any) => {
          const pattern = ex.movement_pattern
            ? (ex.movement_pattern as MovementPattern)
            : inferMovementPattern(ex.name);

          if (pattern && isHeavyExercise(ex)) {
            const scheduled = scheduledPatterns.get(pattern) || [];
            scheduled.push({ day, exerciseName: ex.name });
            scheduledPatterns.set(pattern, scheduled);
          }
        });
      }
    });

    // Check for recovery conflicts
    scheduledPatterns.forEach((scheduled, pattern) => {
      const state = patternStates.get(pattern);
      if (!state || !state.lastHeavySessionDate) return;

      const hoursSince = state.hoursSinceLastHeavy || 0;
      if (hoursSince < state.minRecoveryHours) {
        const daysSince = Math.round(hoursSince / 24);
        const minDays = Math.round(state.minRecoveryHours / 24);
        
        warnings.push(
          `${pattern} pattern was worked ${daysSince} day(s) ago but is scheduled again. Minimum recovery: ${minDays} days.`
        );

        recommendations.push(
          `Consider moving ${scheduled.map((s) => s.exerciseName).join(', ')} to a later day or using lighter variations.`
        );
      }
    });
  }

  // Generate general recommendations for patterns that haven't been worked recently
  patternStates.forEach((state, pattern) => {
    if (!state.lastHeavySessionDate && pattern !== null) {
      const daysSince = state.hoursSinceLastHeavy
        ? Math.round(state.hoursSinceLastHeavy / 24)
        : null;

      if (daysSince === null || daysSince > 7) {
        recommendations.push(
          `Consider adding a ${pattern.replace('_', ' ')} exercise - hasn't been worked in over a week.`
        );
      }
    }
  });

  return {
    patternStates,
    warnings,
    recommendations,
  };
};

/**
 * Checks if a specific exercise can be safely scheduled based on recovery.
 * 
 * @param exercise - Exercise to check
 * @param patternStates - Current recovery states for all patterns
 * @returns true if exercise can be safely scheduled, false if recovery conflict exists
 */
export const canScheduleExercise = (
  exercise: any,
  patternStates: Map<MovementPattern, PatternRecoveryState>
): { canSchedule: boolean; reason?: string } => {
  const pattern = exercise.movement_pattern
    ? (exercise.movement_pattern as MovementPattern)
    : inferMovementPattern(exercise.name);

  if (!pattern) {
    return { canSchedule: true }; // Unknown patterns are always allowed
  }

  const state = patternStates.get(pattern);
  if (!state) {
    return { canSchedule: true };
  }

  if (!isHeavyExercise(exercise)) {
    return { canSchedule: true }; // Light exercises don't need recovery check
  }

  if (!state.lastHeavySessionDate) {
    return { canSchedule: true }; // Never worked = safe to schedule
  }

  const hoursSince = state.hoursSinceLastHeavy || 0;
  if (hoursSince < state.minRecoveryHours) {
    const daysSince = Math.round(hoursSince / 24);
    const minDays = Math.round(state.minRecoveryHours / 24);
    return {
      canSchedule: false,
      reason: `${pattern} pattern was worked ${daysSince} day(s) ago. Needs ${minDays} days recovery.`,
    };
  }

  return { canSchedule: true };
};

