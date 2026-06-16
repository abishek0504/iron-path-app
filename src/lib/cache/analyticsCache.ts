/**
 * Short-TTL cache for analytics queries.
 */

import {
  getAnalyticsTrends,
  getExerciseRankings,
  getExerciseTrend,
  getPRTimeline,
  getSessionSummariesInRange,
  type AnalyticsTrendsBundle,
  type ExerciseRankEntry,
  type ExerciseTrendPoint,
  type SessionSummary,
} from '../supabase/queries/analytics';
import type { TrendGranularity, TrendPoint } from '../analytics/types';
import type { PRTimelineEntry } from '../analytics/progression';

const TTL_MS = 90 * 1000;

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

export function getAnalyticsTrendsCached(
  userId: string,
  startIso: string,
  endIso: string,
  granularity: TrendGranularity,
): Promise<AnalyticsTrendsBundle> {
  return getOrSet(
    `trends:${userId}:${startIso}:${endIso}:${granularity}`,
    () => getAnalyticsTrends(userId, startIso, endIso, granularity),
  );
}

export function getSessionSummariesInRangeCached(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<SessionSummary[]> {
  return getOrSet(`summaries:${userId}:${startIso}:${endIso}`, () =>
    getSessionSummariesInRange(userId, startIso, endIso),
  );
}

export function getExerciseRankingsCached(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<ExerciseRankEntry[]> {
  return getOrSet(`exerciseRank:${userId}:${startIso}:${endIso}`, () =>
    getExerciseRankings(userId, startIso, endIso),
  );
}

export function getExerciseTrendCached(
  userId: string,
  exerciseKey: string,
  startIso: string,
  endIso: string,
): Promise<ExerciseTrendPoint[]> {
  return getOrSet(`exTrend:${userId}:${exerciseKey}:${startIso}:${endIso}`, () =>
    getExerciseTrend(userId, exerciseKey, startIso, endIso),
  );
}

export function getPRTimelineCached(
  userId: string,
  exerciseKey?: string,
  limit = 50,
): Promise<PRTimelineEntry[]> {
  return getOrSet(`prTimeline:${userId}:${exerciseKey ?? 'all'}:${limit}`, () =>
    getPRTimeline(userId, exerciseKey, limit),
  );
}

export function invalidateAnalyticsCache(userId: string): void {
  const prefix = `:${userId}:`;
  for (const key of cache.keys()) {
    if (key.includes(prefix)) cache.delete(key);
  }
}
