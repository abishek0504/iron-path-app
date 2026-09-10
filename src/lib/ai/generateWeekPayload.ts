import { getSplitLabel, type DayFocusMap } from '../constants/trainingSplits';
import { buildCoachWeekSplit, type CoachWeekDay, type CoachWeekMode } from './coachWeek';
import { clampCoachExercisesPerSession, clampCoachSessionMinutes } from './coachPrefs';

export function buildGenerateWeekInvokeBody(args: {
  templateId: string;
  idempotencyKey: string;
  mode: CoachWeekMode;
  weekStartDate: string;
  days: CoachWeekDay[];
  profile: {
    workout_days?: string[] | null;
    preferred_training_style?: string | null;
    ai_coach_day_focus?: DayFocusMap | null;
    ai_coach_session_minutes?: number | null;
    ai_coach_exercises_per_session?: number | null;
  } | null | undefined;
}) {
  const workoutDays = args.profile?.workout_days ?? [];
  const splitValue = args.profile?.preferred_training_style ?? null;
  return {
    idempotencyKey: args.idempotencyKey,
    templateId: args.templateId,
    mode: args.mode,
    weekStartDate: args.weekStartDate,
    splitLabel: getSplitLabel(splitValue) ?? splitValue,
    weekSplit: buildCoachWeekSplit(
      workoutDays,
      splitValue,
      args.profile?.ai_coach_day_focus ?? {},
    ),
    sessionMinutes: clampCoachSessionMinutes(args.profile?.ai_coach_session_minutes),
    exercisesPerSession: clampCoachExercisesPerSession(
      args.profile?.ai_coach_exercises_per_session,
    ),
    days: args.days.map((day) => ({
      dayId: day.dayId,
      dayName: day.dayName,
      dayIndex: day.dayIndex,
      trainingDayIndex: day.trainingDayIndex,
      dayFocus: day.dayFocus,
      sessionStartIso: day.sessionStartIso,
      sessionEndIsoExclusive: day.sessionEndIsoExclusive,
    })),
  };
}
