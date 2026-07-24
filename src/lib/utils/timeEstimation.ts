/**
 * Session time estimation.
 *
 * Implements the formula documented in documentation/ALGORITHMS.md
 * ("Time Estimation Formula"). All inputs (`setup_buffer_sec`,
 * `avg_time_per_set_sec`, `is_unilateral`) exist on every master exercise and
 * on custom exercises.
 *
 *   exercise_time_sec = Tsetup + (S * Tset * U)
 *     S     = target set count
 *     Tset  = avg_time_per_set_sec (already includes inter-set rest)
 *     Tsetup= setup_buffer_sec (one-time overhead)
 *     U     = 2 if unilateral (both sides), else 1
 *
 *   session_time_sec = Σ exercise_time_sec
 */

/** Minimal exercise timing shape (subset of MergedExercise / catalog rows). */
export interface ExerciseTimingInput {
  setup_buffer_sec: number;
  avg_time_per_set_sec: number;
  is_unilateral: boolean;
}

/** One exercise plus the number of sets prescribed for it in the session. */
export interface SessionExerciseTimingInput extends ExerciseTimingInput {
  sets: number;
}

/** Estimated time for a single exercise, in seconds. Never negative. */
export function estimateExerciseTimeSec(exercise: SessionExerciseTimingInput): number {
  const sets = Math.max(0, Math.floor(exercise.sets));
  const setupBuffer = Math.max(0, exercise.setup_buffer_sec ?? 0);
  const timePerSet = Math.max(0, exercise.avg_time_per_set_sec ?? 0);
  const sideMultiplier = exercise.is_unilateral ? 2 : 1;
  return setupBuffer + sets * timePerSet * sideMultiplier;
}

/** Estimated total time for a session (sum of its exercises), in seconds. */
export function estimateSessionTimeSec(exercises: SessionExerciseTimingInput[]): number {
  return exercises.reduce((total, ex) => total + estimateExerciseTimeSec(ex), 0);
}

/** Convenience: session time rounded to whole minutes (min 1 when non-empty). */
export function estimateSessionTimeMinutes(exercises: SessionExerciseTimingInput[]): number {
  const seconds = estimateSessionTimeSec(exercises);
  if (seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}
