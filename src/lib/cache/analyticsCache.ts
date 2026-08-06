/**
 * TTL + SWR cache for analytics queries.
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
import type { TrendGranularity } from '../analytics/types';
import type { PRTimelineEntry } from '../analytics/progression';
import { deleteCachePrefix, getOrSetCached } from './ttlCache';

const TTL_MS = 90 * 1000;
const STALE_MS = 10 * 60 * 1000;

export function getAnalyticsTrendsCached(
  userId: string,
  startIso: string,
  endIso: string,
  granularity: TrendGranularity
): Promise<AnalyticsTrendsBundle> {
  return getOrSetCached(
    `trends:${userId}:${startIso}:${endIso}:${granularity}`,
    () => getAnalyticsTrends(userId, startIso, endIso, granularity),
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}

export function getSessionSummariesInRangeCached(
  userId: string,
  startIso: string,
  endIso: string
): Promise<SessionSummary[]> {
  return getOrSetCached(
    `summaries:${userId}:${startIso}:${endIso}`,
    () => getSessionSummariesInRange(userId, startIso, endIso),
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}

export function getExerciseRankingsCached(
  userId: string,
  startIso: string,
  endIso: string
): Promise<ExerciseRankEntry[]> {
  return getOrSetCached(
    `exerciseRank:${userId}:${startIso}:${endIso}`,
    () => getExerciseRankings(userId, startIso, endIso),
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}

export function getExerciseTrendCached(
  userId: string,
  exerciseKey: string,
  startIso: string,
  endIso: string
): Promise<ExerciseTrendPoint[]> {
  return getOrSetCached(
    `exTrend:${userId}:${exerciseKey}:${startIso}:${endIso}`,
    () => getExerciseTrend(userId, exerciseKey, startIso, endIso),
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}

export function getPRTimelineCached(
  userId: string,
  exerciseKey?: string,
  limit = 50
): Promise<PRTimelineEntry[]> {
  return getOrSetCached(
    `prTimeline:${userId}:${exerciseKey ?? 'all'}:${limit}`,
    () => getPRTimeline(userId, exerciseKey, limit),
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}

export function invalidateAnalyticsCache(userId: string): void {
  deleteCachePrefix(`trends:${userId}:`);
  deleteCachePrefix(`summaries:${userId}:`);
  deleteCachePrefix(`exerciseRank:${userId}:`);
  deleteCachePrefix(`exTrend:${userId}:`);
  deleteCachePrefix(`prTimeline:${userId}:`);
}
