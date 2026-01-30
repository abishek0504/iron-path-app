/**
 * Short-TTL in-memory cache for getSessionsInRange.
 * Reduces refetches when revisiting the same week/month on the Progress tab.
 * Call invalidateSessionsInRangeForUser when a session is completed or deleted.
 */

import { getSessionsInRange, type WorkoutSession } from '../supabase/queries/workouts';

const TTL_MS = 90 * 1000; // 90 seconds

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

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

export function getSessionsInRangeCached(
  userId: string,
  startIso: string,
  endIso: string
): Promise<WorkoutSession[]> {
  const key = `sessionsInRange:${userId}:${startIso}:${endIso}`;
  return getOrSet(key, () => getSessionsInRange(userId, startIso, endIso));
}

/** Call when a session is completed or deleted for this user. */
export function invalidateSessionsInRangeForUser(userId: string): void {
  const prefix = `sessionsInRange:${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
