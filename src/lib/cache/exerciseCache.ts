/**
 * TTL + SWR cache for listMergedExercises.
 * Master catalog is largely static; customs/overrides invalidate via customExerciseMutations.
 */

import { listMergedExercises } from '../supabase/queries/exercises';
import type { MergedExercise } from '../supabase/queries/exercises';
import { deleteCachePrefix, getOrSetCached, peekCache, setCacheValue } from './ttlCache';
import { readDiskCache, removeDiskCachePrefix, writeDiskCache } from './diskCache';

export type { MergedExercise };

/** Longer fresh window — master catalog changes rarely; customs invalidate explicitly. */
const TTL_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

function cacheKey(userId: string, exerciseIds: string[] | undefined): string {
  if (!exerciseIds || exerciseIds.length === 0) {
    return `mergedExercises:${userId}:all`;
  }
  const sorted = [...exerciseIds].sort();
  return `mergedExercises:${userId}:${sorted.join(',')}`;
}

export async function listMergedExercisesCached(
  userId: string,
  exerciseIds?: string[]
): Promise<MergedExercise[]> {
  const key = cacheKey(userId, exerciseIds);

  if (peekCache<MergedExercise[]>(key) === undefined) {
    const fromDisk = await readDiskCache<MergedExercise[]>(key);
    if (fromDisk !== undefined) {
      setCacheValue(key, fromDisk, { ttlMs: 0, staleMs: STALE_MS });
    }
  }

  return getOrSetCached(
    key,
    async () => {
      const value = await listMergedExercises(userId, exerciseIds);
      // Only persist the full catalog (most useful for cold start / picker).
      if (!exerciseIds || exerciseIds.length === 0) {
        void writeDiskCache(key, value);
      }
      return value;
    },
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}

export function peekMergedExercisesCached(
  userId: string,
  exerciseIds?: string[]
): MergedExercise[] | undefined {
  return peekCache(cacheKey(userId, exerciseIds));
}

/** Called by customExerciseMutations after create/update/delete. */
export function invalidateMergedExercisesForUser(userId: string): void {
  deleteCachePrefix(`mergedExercises:${userId}:`);
  void removeDiskCachePrefix(`mergedExercises:${userId}:`);
}
