/**
 * TTL + SWR cache for session range queries and today's sessions.
 * Call invalidateSessionsInRangeForUser when a session is completed or deleted.
 */

import { getSessionsInRange, getSessionsForToday, type WorkoutSession } from '../supabase/queries/workouts';
import { deleteCachePrefix, getOrSetCached, peekCache, setCacheValue } from './ttlCache';
import { readDiskCache, removeDiskCachePrefix, writeDiskCache } from './diskCache';

const TTL_MS = 90 * 1000;
const STALE_MS = 10 * 60 * 1000;
const TODAY_TTL_MS = 60 * 1000;
const TODAY_STALE_MS = 5 * 60 * 1000;

function rangeKey(userId: string, startIso: string, endIso: string) {
  return `sessionsInRange:${userId}:${startIso}:${endIso}`;
}

function todayKey(userId: string, dayStartIso: string, dayEndIsoExclusive: string) {
  return `sessionsToday:${userId}:${dayStartIso}:${dayEndIsoExclusive}`;
}

export function getSessionsInRangeCached(
  userId: string,
  startIso: string,
  endIso: string
): Promise<WorkoutSession[]> {
  const key = rangeKey(userId, startIso, endIso);
  return getOrSetCached(key, () => getSessionsInRange(userId, startIso, endIso), {
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
  });
}

export async function getSessionsForTodayCached(
  userId: string,
  dayStartIso: string,
  dayEndIsoExclusive: string
): Promise<WorkoutSession[]> {
  const key = todayKey(userId, dayStartIso, dayEndIsoExclusive);

  if (peekCache<WorkoutSession[]>(key) === undefined) {
    const fromDisk = await readDiskCache<WorkoutSession[]>(key);
    if (fromDisk !== undefined) {
      setCacheValue(key, fromDisk, { ttlMs: 0, staleMs: TODAY_STALE_MS });
    }
  }

  return getOrSetCached(
    key,
    async () => {
      const value = await getSessionsForToday(userId, dayStartIso, dayEndIsoExclusive);
      void writeDiskCache(key, value);
      return value;
    },
    { ttlMs: TODAY_TTL_MS, staleMs: TODAY_STALE_MS }
  );
}

/** Call when a session is completed or deleted for this user. */
export function invalidateSessionsInRangeForUser(userId: string): void {
  deleteCachePrefix(`sessionsInRange:${userId}:`);
  deleteCachePrefix(`sessionsToday:${userId}:`);
  void removeDiskCachePrefix(`sessionsInRange:${userId}:`);
  void removeDiskCachePrefix(`sessionsToday:${userId}:`);
}
