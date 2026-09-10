/**
 * Pure helpers for AI Coach week planning: which training days to generate
 * and which split focus each day gets.
 */

import {
  resolveDayFocus,
  type DayFocusMap,
} from '../constants/trainingSplits';
import {
  WEEK_DAYS,
  getDateBoundsForDayName,
  getLocalWeekSundayKey,
} from '../utils/date';

export type CoachWeekMode = 'auto' | 'regenerate';

export interface CoachWeekDayInput {
  dayId: string;
  dayName: string;
  dayIndex: number;
  /** True when the day already has completed work or performed sets. */
  hasProtectedSession: boolean;
  /** True when any session already exists for this weekday in the current week. */
  hasSession: boolean;
  /** True when the template day already has at least one slot. */
  hasSlots: boolean;
}

export interface CoachWeekDay {
  dayId: string;
  dayName: string;
  dayIndex: number;
  dayFocus: string | null;
  trainingDayIndex: number;
  sessionStartIso: string;
  sessionEndIsoExclusive: string;
}

export function protectedCoachDayNames(
  sessions: { id: string; day_name?: string | null; status: string }[],
  sessionIdsWithPerformedWork: Set<string>,
): Set<string> {
  const names = new Set<string>();
  for (const session of sessions) {
    const dayName = session.day_name;
    if (!dayName) continue;
    if (session.status === 'completed' || sessionIdsWithPerformedWork.has(session.id)) {
      names.add(dayName);
    }
  }
  return names;
}

export function sessionCoachDayNames(
  sessions: { day_name?: string | null }[],
): Set<string> {
  const names = new Set<string>();
  for (const session of sessions) {
    if (session.day_name) names.add(session.day_name);
  }
  return names;
}

export function shouldSkipMaterializeForCoach(args: {
  coachEnabled: boolean;
  plannedWeekStart: string | null | undefined;
  weekSundayKey: string;
}): boolean {
  return args.coachEnabled && args.plannedWeekStart !== args.weekSundayKey;
}

export function shouldReplaceCoachLeftovers(args: {
  mode: CoachWeekMode;
  plannedWeekStart: string | null | undefined;
  weekSundayKey: string;
}): boolean {
  return args.mode === 'regenerate' || args.plannedWeekStart !== args.weekSundayKey;
}

export function orderWorkoutDays(workoutDays: string[]): string[] {
  const allowed = new Set<string>(WEEK_DAYS);
  const unique = new Set<string>();
  for (const day of workoutDays) {
    if (allowed.has(day)) unique.add(day);
  }
  return [...unique].sort(
    (a, b) =>
      WEEK_DAYS.indexOf(a as (typeof WEEK_DAYS)[number]) -
      WEEK_DAYS.indexOf(b as (typeof WEEK_DAYS)[number]),
  );
}

export function buildCoachWeekDays(args: {
  now: Date;
  mode: CoachWeekMode;
  replaceLeftovers: boolean;
  workoutDays: string[];
  splitValue: string | null | undefined;
  dayFocusMap?: DayFocusMap | null;
  templateDays: CoachWeekDayInput[];
}): CoachWeekDay[] {
  const orderedWorkoutDays = orderWorkoutDays(args.workoutDays);
  if (orderedWorkoutDays.length === 0) return [];

  const workoutIndex = new Map(
    orderedWorkoutDays.map((name, index) => [name, index]),
  );

  const result: CoachWeekDay[] = [];

  for (const templateDay of args.templateDays) {
    const trainingDayIndex = workoutIndex.get(templateDay.dayName);
    if (trainingDayIndex === undefined) continue;

    const weekdayIndex = WEEK_DAYS.indexOf(
      templateDay.dayName as (typeof WEEK_DAYS)[number],
    );
    if (weekdayIndex < 0) continue;

    if (templateDay.hasProtectedSession) continue;
    if (templateDay.hasSession && templateDay.hasSlots && !args.replaceLeftovers) continue;

    const bounds = getDateBoundsForDayName(templateDay.dayName, args.now);
    result.push({
      dayId: templateDay.dayId,
      dayName: templateDay.dayName,
      dayIndex: templateDay.dayIndex,
      dayFocus: resolveDayFocus({
        splitValue: args.splitValue,
        dayName: templateDay.dayName,
        trainingDayIndex,
        overrides: args.dayFocusMap,
      }),
      trainingDayIndex,
      sessionStartIso: bounds.startIso,
      sessionEndIsoExclusive: bounds.endIsoExclusive,
    });
  }

  return result.sort((a, b) => a.trainingDayIndex - b.trainingDayIndex);
}

export function buildCoachWeekSplit(
  workoutDays: string[],
  splitValue: string | null | undefined,
  dayFocusMap?: DayFocusMap | null,
): {
  dayName: string;
  dayFocus: string | null;
  trainingDayIndex: number;
  trainingDayPosition: string;
}[] {
  const ordered = orderWorkoutDays(workoutDays);
  return ordered.map((dayName, trainingDayIndex) => ({
    dayName,
    dayFocus: resolveDayFocus({
      splitValue,
      dayName,
      trainingDayIndex,
      overrides: dayFocusMap,
    }),
    trainingDayIndex,
    trainingDayPosition: `training day ${trainingDayIndex + 1} of ${ordered.length} this week`,
  }));
}

export function shouldAutoPlanCoachWeek(args: {
  coachEnabled: boolean;
  daysToGenerate: number;
}): boolean {
  if (!args.coachEnabled) return false;
  return args.daysToGenerate > 0;
}

export { getLocalWeekSundayKey };
