/**
 * Shared set-type cycle, labels, and drop/failure helpers used by add-exercise,
 * session edit, and active workout flows.
 */

import type { SetType } from '../supabase/queries/workouts';

export const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
};

/** Fraction of prior-set weight applied when cycling a set to drop. */
export const DROP_WEIGHT_FRACTION = 0.8;

/** Multiplier applied to resolved rest after a failure set. */
export const FAILURE_REST_MULTIPLIER = 1.5;

/** Default RPE when completing a failure set with no user-set RPE. */
export const FAILURE_DEFAULT_RPE = 10;

export function cycleSetType(current: SetType | null | undefined): SetType {
  const idx = SET_TYPE_CYCLE.indexOf(current ?? 'normal');
  const safeIdx = idx >= 0 ? idx : 0;
  return SET_TYPE_CYCLE[(safeIdx + 1) % SET_TYPE_CYCLE.length];
}

/**
 * Suggest a drop-set weight from the prior set. Returns null when prior weight
 * is missing or non-positive (bodyweight / unset).
 */
export function suggestDropWeight(prevWeight: number | null | undefined): number | null {
  if (prevWeight == null || !(prevWeight > 0)) return null;
  const suggested = prevWeight * DROP_WEIGHT_FRACTION;
  // Keep one decimal for plate-friendly display without inventing precision.
  return Math.round(suggested * 10) / 10;
}

/**
 * Rest duration after completing a set, before starting the next.
 * - Next set is drop → no rest.
 * - Completed set is failure → at least 1.5× base rest.
 */
export function restAfterSet(opts: {
  completedType?: SetType | null;
  nextType?: SetType | null;
  baseRestSec: number;
}): number {
  if (opts.nextType === 'drop') return 0;
  const base = Math.max(0, opts.baseRestSec);
  if (opts.completedType === 'failure') {
    return Math.max(base, Math.round(base * FAILURE_REST_MULTIPLIER));
  }
  return base;
}
