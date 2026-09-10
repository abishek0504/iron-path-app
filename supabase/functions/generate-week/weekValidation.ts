import type { DayConstraints } from '../generate-workout/types.ts';
import type { AllowListedExercise, AiExercisePlan } from '../generate-workout/types.ts';
import { finalizeAiSessions } from '../generate-workout/validation.ts';
import type { GenerateWeekDayInput, WeekDayPlan } from './types.ts';
import type { WeekOpenAiDay } from './openai.ts';

const COACH_DAY_CONSTRAINTS: DayConstraints = {
  dayFocus: null,
  exercisesPerSession: null,
  intensity: 'standard',
  emphasizeMuscles: [],
  avoidMuscles: [],
  stretchCount: 0,
};

export function matchRawDaySessions(
  rawDays: WeekOpenAiDay[],
  requestedName: string,
): AiExercisePlan[][] | null {
  const lower = requestedName.trim().toLowerCase();
  const byName = rawDays.find((day) => day.day_name.trim().toLowerCase() === lower);
  return byName?.sessions ?? null;
}

export function finalizeCoachWeek(
  rawDays: WeekOpenAiDay[],
  requestedDays: GenerateWeekDayInput[],
  dayCatalogs: Map<string, AllowListedExercise[]>,
  catalogById: Map<string, AllowListedExercise>,
  experience: string,
  exercisesPerSession: number,
): { days: WeekDayPlan[]; reason: null } | { days: null; reason: string } {
  if (rawDays.length === 0) {
    return { days: null, reason: 'session_count_mismatch: empty week' };
  }

  const finalized: WeekDayPlan[] = [];

  for (const requested of requestedDays) {
    const catalog = dayCatalogs.get(requested.dayId) ?? [];
    const constraints: DayConstraints = {
      ...COACH_DAY_CONSTRAINTS,
      dayFocus: requested.dayFocus,
      exercisesPerSession,
    };
    const rawSessions = matchRawDaySessions(rawDays, requested.dayName);
    if (!rawSessions) {
      return {
        days: null,
        reason: `${requested.dayName}: day_name_mismatch`,
      };
    }
    const validated = finalizeAiSessions(
      rawSessions,
      catalog,
      [],
      catalogById,
      1,
      exercisesPerSession,
      0,
      experience,
      constraints,
    );
    if (!validated.sessions) {
      return {
        days: null,
        reason: `${requested.dayName}: ${validated.reason ?? 'validation_failed'}`,
      };
    }
    finalized.push({
      day_id: requested.dayId,
      sessions: validated.sessions,
    });
  }

  return { days: finalized, reason: null };
}
