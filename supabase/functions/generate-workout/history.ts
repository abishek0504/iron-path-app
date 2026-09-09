/** History aggregation and split-day position. */

import type { ExerciseHistorySummary } from './types.ts';

export interface HistorySetRow {
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rir: number | null;
  duration_sec: number | null;
  performed_at: string;
  v2_session_exercises: { exercise_id: string | null } | null;
}

/**
 * Collapse raw set rows (newest first) into one compact summary per exercise.
 * Only allow-listed exercises are kept so the prompt stays bounded.
 */
export function summarizeHistory(
  rows: HistorySetRow[],
  allowedIds: Set<string>,
): Record<string, ExerciseHistorySummary> {
  interface Acc {
    summary: ExerciseHistorySummary;
    rpeSum: number;
    rpeCount: number;
  }
  const byExercise = new Map<string, Acc>();

  for (const row of rows) {
    const exerciseId = row.v2_session_exercises?.exercise_id;
    if (!exerciseId || !allowedIds.has(exerciseId)) continue;

    // RIR is stored exclusively of RPE; convert so avg_rpe reflects both.
    const effectiveRpe = row.rpe ?? (row.rir !== null ? 10 - row.rir : null);

    let acc = byExercise.get(exerciseId);
    if (!acc) {
      // Rows are ordered newest-first, so the first row seen is the last set performed.
      acc = {
        summary: {
          last_performed: row.performed_at.slice(0, 10),
          last_set: {
            weight: row.weight,
            reps: row.reps,
            duration_sec: row.duration_sec,
            rpe: effectiveRpe,
          },
          top_set: { weight: row.weight, reps: row.reps, duration_sec: row.duration_sec },
          avg_rpe: null,
          recent_set_count: 0,
        },
        rpeSum: 0,
        rpeCount: 0,
      };
      byExercise.set(exerciseId, acc);
    }

    acc.summary.recent_set_count += 1;
    if (effectiveRpe !== null) {
      acc.rpeSum += effectiveRpe;
      acc.rpeCount += 1;
    }

    // Top set = heaviest weight; for unweighted work, longest duration or most reps.
    const top = acc.summary.top_set;
    const beatsByWeight = (row.weight ?? -1) > (top.weight ?? -1);
    const tiesWeight = (row.weight ?? -1) === (top.weight ?? -1);
    const beatsByVolume =
      (row.duration_sec ?? 0) > (top.duration_sec ?? 0) || (row.reps ?? 0) > (top.reps ?? 0);
    if (beatsByWeight || (tiesWeight && beatsByVolume)) {
      acc.summary.top_set = { weight: row.weight, reps: row.reps, duration_sec: row.duration_sec };
    }
  }

  const result: Record<string, ExerciseHistorySummary> = {};
  for (const [exerciseId, acc] of byExercise) {
    acc.summary.avg_rpe =
      acc.rpeCount > 0 ? Math.round((acc.rpeSum / acc.rpeCount) * 10) / 10 : null;
    result[exerciseId] = acc.summary;
  }
  return result;
}

/**
 * Compute "training day N of M this week" so the LLM can map the weekday onto
 * the user's split deterministically. Returns null when the day isn't one of
 * the user's configured workout days.
 */
export function computeTrainingDayPosition(dayName: string, workoutDays: string[]): string | null {
  if (workoutDays.length === 0) return null;
  const WEEK_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ordered = [...workoutDays].sort(
    (a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b),
  );
  const index = ordered.indexOf(dayName);
  if (index === -1) return null;
  return `training day ${index + 1} of ${ordered.length} this week`;
}
