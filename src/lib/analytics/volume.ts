import type { AnalyticsSetRow, ExerciseMeta, TrendGranularity, TrendPoint } from './types';
import { aggregateIntoBuckets } from './dateBuckets';

export function isWorkingSet(set: AnalyticsSetRow): boolean {
  return set.performed_at != null && set.set_type !== 'warmup';
}

/** Volume in lbs (weight × reps). Timed/bodyweight sets contribute 0. */
export function setVolumeLbs(set: AnalyticsSetRow): number {
  if (!isWorkingSet(set)) return 0;
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (w <= 0 || r <= 0) return 0;
  return w * r;
}

export function sumVolumeLbs(sets: AnalyticsSetRow[]): number {
  return sets.reduce((sum, s) => sum + setVolumeLbs(s), 0);
}

export type MuscleVolumeEntry = {
  muscle: string;
  volumeLbs: number;
};

/**
 * Allocate session volume across primary muscles + implicit hits (same weighting as stress model).
 */
export function muscleGroupVolumeSplit(
  sets: AnalyticsSetRow[],
  metaByExerciseKey: Map<string, ExerciseMeta>,
): MuscleVolumeEntry[] {
  const totals = new Map<string, number>();

  for (const set of sets) {
    const vol = setVolumeLbs(set);
    if (vol <= 0) continue;

    const key = set.exercise_id ?? set.custom_exercise_id;
    if (!key) continue;
    const meta = metaByExerciseKey.get(key);
    if (!meta || meta.is_stretch) continue;

    const muscleWeights = new Map<string, number>();
    if (Array.isArray(meta.primary_muscles)) {
      for (const m of meta.primary_muscles) {
        if (m) muscleWeights.set(m, (muscleWeights.get(m) ?? 0) + 1);
      }
    }
    if (meta.implicit_hits) {
      for (const [m, w] of Object.entries(meta.implicit_hits)) {
        if (w > 0) muscleWeights.set(m, (muscleWeights.get(m) ?? 0) + w);
      }
    }

    const weightSum = Array.from(muscleWeights.values()).reduce((a, b) => a + b, 0);
    if (weightSum <= 0) continue;

    for (const [muscle, w] of muscleWeights) {
      totals.set(muscle, (totals.get(muscle) ?? 0) + vol * (w / weightSum));
    }
  }

  return Array.from(totals.entries())
    .map(([muscle, volumeLbs]) => ({ muscle, volumeLbs }))
    .sort((a, b) => b.volumeLbs - a.volumeLbs);
}

export function buildVolumeTrend(
  sessions: { completedAt: string; volumeLbs: number }[],
  granularity: TrendGranularity,
): TrendPoint[] {
  return aggregateIntoBuckets(
    sessions.map((s) => ({ dateIso: s.completedAt, value: s.volumeLbs })),
    granularity,
  );
}
