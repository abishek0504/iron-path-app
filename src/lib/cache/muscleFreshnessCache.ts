/**
 * In-memory cache for muscle freshness raw data (muscle_key, last_trained_at).
 * TTL 5 min to reduce DB egress while allowing periodic refetch.
 * Call invalidateMuscleFreshnessCache after completing a workout.
 */

import { supabase } from '../supabase/client';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export type MuscleFreshnessRow = {
  muscle_key: string;
  last_trained_at: string | null;
};

type CacheEntry = { value: MuscleFreshnessRow[]; expiresAt: number };

const cache = new Map<string, CacheEntry>();

export async function getMuscleFreshnessRawCached(userId: string): Promise<MuscleFreshnessRow[]> {
  const now = Date.now();
  const entry = cache.get(userId);
  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  const { data, error } = await supabase
    .from('v2_muscle_freshness')
    .select('muscle_key, last_trained_at')
    .eq('user_id', userId);

  if (error) throw error;
  const rows: MuscleFreshnessRow[] = (data || []).map((r) => ({
    muscle_key: r.muscle_key,
    last_trained_at: r.last_trained_at ?? null,
  }));

  cache.set(userId, { value: rows, expiresAt: now + TTL_MS });
  return rows;
}

/** Call after completing a workout so the next view refetches. */
export function invalidateMuscleFreshnessCache(userId: string): void {
  cache.delete(userId);
}
