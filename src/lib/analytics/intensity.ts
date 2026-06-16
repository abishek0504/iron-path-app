import type { AnalyticsSetRow, TrendGranularity, TrendPoint } from './types';
import { bucketKeyForDate, formatBucketLabel } from './dateBuckets';
import { aggregateIntoBuckets } from './dateBuckets';
import { isWorkingSet } from './volume';

const RPE_THRESHOLD = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Effort signal 0–1 from RPE or RIR (matches fatigue model). */
export function setStimulus(set: AnalyticsSetRow): number {
  if (!isWorkingSet(set)) return 0;

  if (set.rpe != null) {
    return clamp((set.rpe - RPE_THRESHOLD) / 5, 0, 1);
  }
  if (set.rir != null) {
    const estRpe = clamp(10 - set.rir, 1, 10);
    return clamp((estRpe - RPE_THRESHOLD) / 5, 0, 1);
  }
  return 0.6;
}

export function effectiveRpe(set: AnalyticsSetRow): number | null {
  if (!isWorkingSet(set)) return null;
  if (set.rpe != null) return set.rpe;
  if (set.rir != null) return clamp(10 - set.rir, 1, 10);
  return null;
}

export type IntensitySummary = {
  workingSetCount: number;
  avgRpe: number | null;
  failureCount: number;
  dropCount: number;
  warmupCount: number;
};

export function summarizeIntensity(sets: AnalyticsSetRow[]): IntensitySummary {
  const working = sets.filter(isWorkingSet);
  const rpes = working.map(effectiveRpe).filter((r): r is number => r != null);
  return {
    workingSetCount: working.length,
    avgRpe: rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    failureCount: sets.filter((s) => s.performed_at && s.set_type === 'failure').length,
    dropCount: sets.filter((s) => s.performed_at && s.set_type === 'drop').length,
    warmupCount: sets.filter((s) => s.performed_at && s.set_type === 'warmup').length,
  };
}

export function buildAvgRpeTrend(
  sessions: { completedAt: string; avgRpe: number | null }[],
  granularity: TrendGranularity,
): TrendPoint[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const s of sessions) {
    if (s.avgRpe == null) continue;
    const key = bucketKeyForDate(s.completedAt, granularity);
    const prev = map.get(key) ?? { sum: 0, count: 0 };
    map.set(key, { sum: prev.sum + s.avgRpe, count: prev.count + 1 });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketKey, { sum, count }]) => ({
      bucketKey,
      label: formatBucketLabel(bucketKey, granularity),
      value: sum / count,
    }));
}

export function buildSessionCountTrend(
  sessions: { completedAt: string }[],
  granularity: TrendGranularity,
): TrendPoint[] {
  return aggregateIntoBuckets(
    sessions.map((s) => ({ dateIso: s.completedAt, value: 1 })),
    granularity,
  );
}
