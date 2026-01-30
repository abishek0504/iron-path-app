/**
 * Short-TTL in-memory cache for listMergedExercises.
 * Reduces duplicate fetches when multiple screens need the same exercise names.
 * Invalidation is wired in customExerciseMutations (create/update/delete user custom exercises).
 */

import { listMergedExercises } from '../supabase/queries/exercises';
import type { MergedExercise } from '../supabase/queries/exercises';

export type { MergedExercise };

const TTL_MS = 90 * 1000; // 90 seconds

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

function cacheKey(userId: string, exerciseIds: string[] | undefined): string {
  if (!exerciseIds || exerciseIds.length === 0) {
    return `mergedExercises:${userId}:all`;
  }
  const sorted = [...exerciseIds].sort();
  return `mergedExercises:${userId}:${sorted.join(',')}`;
}

function getOrSet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return Promise.resolve(entry.value);
  }
  return fetcher().then((value) => {
    cache.set(key, { value, expiresAt: now + TTL_MS });
    return value;
  });
}

export function listMergedExercisesCached(
  userId: string,
  exerciseIds?: string[]
): Promise<MergedExercise[]> {
  const key = cacheKey(userId, exerciseIds);
  return getOrSet(key, () => listMergedExercises(userId, exerciseIds));
}

/** Called by customExerciseMutations after create/update/delete. Export for use there. */
export function invalidateMergedExercisesForUser(userId: string): void {
  const prefix = `mergedExercises:${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
