/**
 * In-memory cache for exercise prescriptions (near-static curated data).
 */

import {
  getPrescriptionsForExercises,
  type ExercisePrescription,
} from '../supabase/queries/prescriptions';
import { getOrSetCached } from './ttlCache';

const TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_MS = 24 * 60 * 60 * 1000;

function cacheKey(exerciseIds: string[], experience: string, mode: string): string {
  const sorted = [...exerciseIds].sort().join(',');
  return `prescriptions:${experience}:${mode}:${sorted}`;
}

export function getPrescriptionsForExercisesCached(
  exerciseIds: string[],
  experience: string,
  mode: 'reps' | 'timed'
): Promise<Map<string, ExercisePrescription>> {
  if (exerciseIds.length === 0) {
    return Promise.resolve(new Map());
  }
  const key = cacheKey(exerciseIds, experience, mode);
  return getOrSetCached(
    key,
    async () => {
      const map = await getPrescriptionsForExercises(exerciseIds, experience, mode);
      // Maps don't JSON well for disk; keep memory-only. Bundled catalog covers cold start later.
      return map;
    },
    { ttlMs: TTL_MS, staleMs: STALE_MS }
  );
}
