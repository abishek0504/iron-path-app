/**
 * Classify session exercises as routine (weekly template) vs day-only.
 * Matching is by exercise_id / custom_exercise_id quota against template slots.
 */

import { devLog } from '../utils/logger';

export type RoutineExerciseRef = {
  id: string;
  exercise_id?: string | null;
  custom_exercise_id?: string | null;
};

export type RoutineSlotRef = {
  exercise_id?: string | null;
  custom_exercise_id?: string | null;
};

export function exerciseKey(
  ref: { exercise_id?: string | null; custom_exercise_id?: string | null },
): string | null {
  return ref.exercise_id || ref.custom_exercise_id || null;
}

/**
 * Returns session-exercise ids that are covered by the day's template slot quota.
 * Walks sessions in order; within each session, exercises in the order provided.
 * First N occurrences of each exercise key match N template slots; extras are day-only.
 */
export function computeRoutineSessionExerciseIds(
  templateSlots: RoutineSlotRef[],
  sessionsWithExercises: { exercises: RoutineExerciseRef[] }[],
): Set<string> {
  const templateCountByExercise = new Map<string, number>();
  for (const slot of templateSlots) {
    const key = exerciseKey(slot);
    if (key) templateCountByExercise.set(key, (templateCountByExercise.get(key) ?? 0) + 1);
  }

  const usedCountByExercise = new Map<string, number>();
  const routineIds = new Set<string>();

  for (const { exercises } of sessionsWithExercises) {
    for (const se of exercises) {
      const key = exerciseKey(se);
      if (!key) continue;
      const templateCount = templateCountByExercise.get(key) ?? 0;
      const used = usedCountByExercise.get(key) ?? 0;
      if (used < templateCount) {
        routineIds.add(se.id);
        usedCountByExercise.set(key, used + 1);
      }
    }
  }

  return routineIds;
}

/** Label for day-only extras: "Today Only" on today, otherwise "This day only". */
export function dayOnlyBadgeLabel(isToday: boolean): string {
  return isToday ? 'Today Only' : 'This day only';
}

export function logRoutineClassificationDiagnostics(input: {
  module: string;
  dayName: string;
  templateSlots: RoutineSlotRef[];
  sessionsWithExercises: { exercises: RoutineExerciseRef[] }[];
  routineIds: Set<string>;
}): void {
  if (!__DEV__) return;

  const slotKeys = input.templateSlots
    .map(exerciseKey)
    .filter((k): k is string => k != null);
  const sessionKeys = input.sessionsWithExercises.flatMap(({ exercises }) =>
    exercises.map(exerciseKey).filter((k): k is string => k != null),
  );
  const totalSessionExercises = input.sessionsWithExercises.reduce(
    (n, s) => n + s.exercises.length,
    0,
  );

  devLog(input.module, {
    action: 'routineClassification',
    dayName: input.dayName,
    slotCount: input.templateSlots.length,
    uniqueSlotKeys: new Set(slotKeys).size,
    sessionCount: input.sessionsWithExercises.length,
    sessionExerciseCount: totalSessionExercises,
    uniqueSessionKeys: new Set(sessionKeys).size,
    routineCount: input.routineIds.size,
    dayOnlyCount: totalSessionExercises - input.routineIds.size,
  });
}
