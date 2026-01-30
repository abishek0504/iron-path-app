/**
 * Short-TTL in-memory cache for dashboard stats.
 * Reduces refetches when switching back to the Dashboard tab.
 */

import {
  getYearToDateStats,
  getStreak,
  getCachedTopPRs,
  type YearToDateStats,
  type TopPR,
} from '../supabase/queries/workouts';

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

export function getYearToDateStatsCached(userId: string): Promise<YearToDateStats> {
  return getOrSet(`yearStats:${userId}`, () => getYearToDateStats(userId));
}

export function getStreakCached(userId: string): Promise<number> {
  return getOrSet(`streak:${userId}`, () => getStreak(userId));
}

export function getCachedTopPRsCached(userId: string, limit: number): Promise<TopPR[]> {
  return getOrSet(`topPrs:${userId}:${limit}`, () => getCachedTopPRs(userId, limit));
}
