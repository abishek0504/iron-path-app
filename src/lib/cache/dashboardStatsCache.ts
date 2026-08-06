/**
 * TTL + SWR cache for dashboard stats and user profile.
 * Profile is disk-persisted for cold-start hydration.
 * Call invalidateProfileCache after updateUserProfile.
 */

import {
  getYearToDateStats,
  getStreak,
  getCachedTopPRs,
  getRecentSessions,
  type YearToDateStats,
  type TopPR,
  type WorkoutSession,
} from '../supabase/queries/workouts';
import { getUserProfile } from '../supabase/queries/users';
import { getWeightHistory, type WeightLog } from '../supabase/queries/weight';
import type { UserProfile } from '../../stores/userStore';
import { deleteCacheKey, deleteCachePrefix, getOrSetCached, peekCache, setCacheValue } from './ttlCache';
import { readDiskCache, removeDiskCache, writeDiskCache } from './diskCache';

const TTL_MS = 90 * 1000;
const STALE_MS = 10 * 60 * 1000;
const PROFILE_TTL_MS = 5 * 60 * 1000;
const PROFILE_STALE_MS = 60 * 60 * 1000;

function profileKey(userId: string) {
  return `profile:${userId}`;
}

export function getYearToDateStatsCached(userId: string): Promise<YearToDateStats> {
  return getOrSetCached(`yearStats:${userId}`, () => getYearToDateStats(userId), {
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
  });
}

export function getStreakCached(userId: string): Promise<number> {
  return getOrSetCached(`streak:${userId}`, () => getStreak(userId), {
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
  });
}

export function getCachedTopPRsCached(userId: string, limit: number): Promise<TopPR[]> {
  return getOrSetCached(`topPrs:${userId}:${limit}`, () => getCachedTopPRs(userId, limit), {
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
  });
}

export function getRecentSessionsCached(userId: string, limit: number): Promise<WorkoutSession[]> {
  return getOrSetCached(`recentSessions:${userId}:${limit}`, () => getRecentSessions(userId, limit), {
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
  });
}

export async function getUserProfileCached(userId: string): Promise<UserProfile | null> {
  const key = profileKey(userId);

  if (peekCache<UserProfile | null>(key) === undefined) {
    const fromDisk = await readDiskCache<UserProfile | null>(key);
    if (fromDisk !== undefined) {
      setCacheValue(key, fromDisk, { ttlMs: 0, staleMs: PROFILE_STALE_MS });
    }
  }

  return getOrSetCached(
    key,
    async () => {
      const value = await getUserProfile(userId);
      void writeDiskCache(key, value);
      return value;
    },
    { ttlMs: PROFILE_TTL_MS, staleMs: PROFILE_STALE_MS }
  );
}

export function peekUserProfileCached(userId: string): UserProfile | null | undefined {
  return peekCache(profileKey(userId));
}

/** Call after updateUserProfile so the next fetch returns fresh data. */
export function invalidateProfileCache(userId: string): void {
  const key = profileKey(userId);
  deleteCacheKey(key);
  void removeDiskCache(key);
}

export function getWeightHistoryCached(userId: string, limit = 90): Promise<WeightLog[]> {
  return getOrSetCached(`weightHistory:${userId}:${limit}`, () => getWeightHistory(userId, limit), {
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
  });
}

/** Call after insertWeightLog so the next fetch returns fresh data. */
export function invalidateWeightCache(userId: string): void {
  deleteCachePrefix(`weightHistory:${userId}:`);
}

/** Call after unit conversion so dashboard volume/PRs refetch in the new unit. */
export function invalidateWorkoutStatsCache(userId: string): void {
  deleteCacheKey(`yearStats:${userId}`);
  deleteCacheKey(`streak:${userId}`);
  deleteCachePrefix(`topPrs:${userId}:`);
  deleteCachePrefix(`recentSessions:${userId}:`);
}
