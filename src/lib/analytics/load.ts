import type { AnalyticsSetRow, ExerciseMeta, TrendGranularity, TrendPoint } from './types';
import { bucketKeyForDate, formatBucketLabel } from './dateBuckets';
import { setStimulus } from './intensity';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Per-muscle stress for a single set (pure version of DB getMuscleStressStats logic). */
export function muscleStressForSet(
  set: AnalyticsSetRow,
  meta: ExerciseMeta | undefined,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!meta || meta.is_stretch) return result;

  const stimulus = setStimulus(set);
  if (stimulus <= 0) return result;

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

  const total = Array.from(muscleWeights.values()).reduce((a, b) => a + b, 0);
  if (total <= 0) return result;

  for (const [muscle, w] of muscleWeights) {
    result[muscle] = stimulus * (w / total);
  }
  return result;
}

export function totalTrainingLoad(
  sets: AnalyticsSetRow[],
  metaByKey: Map<string, ExerciseMeta>,
): number {
  let load = 0;
  for (const set of sets) {
    const key = set.exercise_id ?? set.custom_exercise_id;
    if (!key) continue;
    const stress = muscleStressForSet(set, metaByKey.get(key));
    load += Object.values(stress).reduce((a, b) => a + b, 0);
  }
  return clamp(load, 0, Number.MAX_SAFE_INTEGER);
}

export function buildTrainingLoadTrend(
  sessions: { completedAt: string; load: number }[],
  granularity: TrendGranularity,
): TrendPoint[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = bucketKeyForDate(s.completedAt, granularity);
    map.set(key, (map.get(key) ?? 0) + s.load);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketKey, value]) => ({
      bucketKey,
      label: formatBucketLabel(bucketKey, granularity),
      value,
    }));
}
