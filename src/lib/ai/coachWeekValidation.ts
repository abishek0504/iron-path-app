/**
 * Client-side week-plan checks used by tests. The Edge Function applies the
 * same focus filter via finalizeAiSessions.
 */

import { exerciseMatchesDayFocus, type FocusableExercise } from './dayFocus';

export const COACH_MIN_EXERCISES_PER_DAY = 2;

export interface CoachWeekExercise extends FocusableExercise {
  id: string;
}

export interface CoachWeekPlanDay {
  dayName: string;
  dayFocus: string | null;
  exercises: CoachWeekExercise[];
}

export function sanitizeCoachWeekDay(day: CoachWeekPlanDay): CoachWeekExercise[] {
  return day.exercises.filter((exercise) =>
    exerciseMatchesDayFocus(exercise, day.dayFocus),
  );
}

export function finalizeCoachWeekPlan(
  days: CoachWeekPlanDay[],
): { ok: true; days: CoachWeekPlanDay[] } | { ok: false; reason: string } {
  const sanitized: CoachWeekPlanDay[] = [];

  for (const day of days) {
    const exercises = sanitizeCoachWeekDay(day);
    if (exercises.length < COACH_MIN_EXERCISES_PER_DAY) {
      return {
        ok: false,
        reason: `too_few_exercises: ${day.dayName} had ${exercises.length} on-focus exercises`,
      };
    }
    sanitized.push({ ...day, exercises });
  }

  return { ok: true, days: sanitized };
}
