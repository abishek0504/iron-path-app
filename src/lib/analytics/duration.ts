import type { AnalyticsSetRow } from './types';
import { isWorkingSet } from './volume';

export type DurationSummary = {
  wallClockSec: number;
  activeSec: number;
  restSec: number;
};

/** Wall-clock session duration from started/completed timestamps. */
export function wallClockDurationSec(startedAt: string, completedAt: string): number {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Active work time: sum of inter-set gaps from performed_at, minus declared rest_sec.
 * Falls back to wall-clock when performed_at is sparse.
 */
export function computeActiveDurationSec(sets: AnalyticsSetRow[]): number {
  const performed = sets
    .filter((s) => s.performed_at)
    .sort(
      (a, b) =>
        new Date(a.performed_at!).getTime() - new Date(b.performed_at!).getTime(),
    );

  if (performed.length === 0) return 0;

  let activeSec = 0;
  for (let i = 1; i < performed.length; i++) {
    const prev = performed[i - 1];
    const curr = performed[i];
    const gapSec =
      (new Date(curr.performed_at!).getTime() - new Date(prev.performed_at!).getTime()) / 1000;
    const rest = prev.rest_sec ?? 0;
    const workGap = Math.max(0, gapSec - rest);
    activeSec += workGap;
  }

  const workPerSet = performed.reduce((sum, s) => {
    if (s.duration_sec && s.duration_sec > 0) return sum + s.duration_sec;
    return sum + 30;
  }, 0);

  return Math.round(Math.max(activeSec, workPerSet * 0.5));
}

export function computeRestDurationSec(sets: AnalyticsSetRow[]): number {
  return sets
    .filter(isWorkingSet)
    .reduce((sum, s) => sum + (s.rest_sec ?? 0), 0);
}

export function summarizeDuration(
  startedAt: string,
  completedAt: string,
  sets: AnalyticsSetRow[],
): DurationSummary {
  const wallClockSec = wallClockDurationSec(startedAt, completedAt);
  const activeSec = computeActiveDurationSec(sets);
  const declaredRest = computeRestDurationSec(sets);
  const restSec = Math.max(declaredRest, wallClockSec - activeSec);
  return { wallClockSec, activeSec, restSec };
}
