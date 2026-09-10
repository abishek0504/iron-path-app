export const COACH_SESSION_MINUTE_OPTIONS = [30, 45, 60, 75, 90] as const;
export const COACH_EXERCISE_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;
export const DEFAULT_COACH_SESSION_MINUTES = 60;
export const DEFAULT_COACH_EXERCISES_PER_SESSION = 6;
export const MAX_COACH_NOTES_LENGTH = 1000;

export function clampCoachSessionMinutes(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (COACH_SESSION_MINUTE_OPTIONS as readonly number[]).includes(value)
  ) {
    return value;
  }
  return DEFAULT_COACH_SESSION_MINUTES;
}

export function clampCoachExercisesPerSession(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (COACH_EXERCISE_COUNT_OPTIONS as readonly number[]).includes(value)
  ) {
    return value;
  }
  return DEFAULT_COACH_EXERCISES_PER_SESSION;
}
