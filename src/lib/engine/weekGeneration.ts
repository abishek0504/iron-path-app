/**
 * Week generation engine
 * Handles AI-based workout week generation with in-flight fatigue simulation.
 *
 * This module uses:
 * - v2_ai_recommended_exercises (allow-list + priority)
 * - listMergedExercises (primary_muscles + implicit_hits)
 * - v2_exercise_prescriptions (target bands for TargetSets)
 * - getMuscleStressStats (last 48h performed stress as starting state)
 *
 * The core idea is a greedy selector that simulates incremental fatigue
 * as it chooses exercises, using the same biomechanical model as the
 * Dashboard/heatmap and the bands used by selectExerciseTargets.
 */

import { supabase } from '../supabase/client';
import { devLog, devError } from '../utils/logger';
import type { FullTemplate } from '../supabase/queries/templates';
import type { UserProfile } from '../../stores/userStore';
import { listMergedExercises } from '../supabase/queries/exercises';
import {
  getMuscleStressStats,
  type MuscleStressMap,
} from '../supabase/queries/workouts';
import { getPrescriptionsForExercises } from '../supabase/queries/prescriptions';

/**
 * Constants for fatigue simulation.
 *
 * ESTIMATED_STIMULUS is the assumed effort per set (~RPE 8).
 * MAX_FATIGUE_PER_MUSCLE normalizes recent + simulated stress into [0,1].
 * Thresholds map this fraction into green / yellow / red zones.
 */
const ESTIMATED_STIMULUS = 0.7;
const MAX_FATIGUE_PER_MUSCLE = 10;
const GREEN_THRESHOLD = 0.5; // 0–50% stress
const RED_THRESHOLD = 0.85; // >85% stress = hard stop

type FatigueZone = 'green' | 'yellow' | 'red';

interface ExerciseStressProfile {
  exerciseId: string;
  targetSets: number;
  perMuscleWeights: Record<string, number>; // normalized so sum = 1
  basePriority: number;
}

/**
 * Simulated fatigue state used during AI generation.
 * This is ephemeral and NEVER written to the database.
 */
class SimulatedFatigueState {
  private fatigue: MuscleStressMap;

  constructor(initial: MuscleStressMap) {
    // Copy so we never mutate the input map
    this.fatigue = { ...initial };
  }

  getFatigue(): MuscleStressMap {
    return this.fatigue;
  }

  /**
   * Register a chosen exercise, adding its estimated stress into the map.
   */
  registerExercise(profile: ExerciseStressProfile): void {
    const exerciseTotalStress = profile.targetSets * ESTIMATED_STIMULUS;

    for (const [muscleKey, weight] of Object.entries(profile.perMuscleWeights)) {
      const delta = exerciseTotalStress * weight;
      this.fatigue[muscleKey] = (this.fatigue[muscleKey] || 0) + delta;
    }
  }

  /**
   * Compute fatigue zone for a candidate exercise based on the worst
   * normalized stress fraction across all muscles it hits.
   */
  getZoneForExercise(profile: ExerciseStressProfile): {
    zone: FatigueZone;
    worstFraction: number;
  } {
    let worstFraction = 0;

    for (const muscleKey of Object.keys(profile.perMuscleWeights)) {
      const current = this.fatigue[muscleKey] || 0;
      const fraction = Math.max(
        0,
        Math.min(1, current / MAX_FATIGUE_PER_MUSCLE),
      );
      if (fraction > worstFraction) {
        worstFraction = fraction;
      }
    }

    let zone: FatigueZone;
    if (worstFraction <= GREEN_THRESHOLD) {
      zone = 'green';
    } else if (worstFraction <= RED_THRESHOLD) {
      zone = 'yellow';
    } else {
      zone = 'red';
    }

    return { zone, worstFraction };
  }
}

/**
 * Generate exercise IDs for a week template.
 *
 * Uses:
 * - v2_ai_recommended_exercises as base candidates (allow-list + priority).
 * - listMergedExercises for biomechanics (primary_muscles + implicit_hits).
 * - getPrescriptionsForExercises for TargetSets bands (same bands used by
 *   selectExerciseTargets for progressive overload; see targetSelection.ts
 *   and V2_ARCHITECTURE.md for band semantics).
 * - getMuscleStressStats over the last 48h as the initial fatigue map.
 *
 * The selection loop is pure TypeScript (no SQL) and uses a greedy
 * Score = BasePriority - FatiguePenalty heuristic with:
 * - Green zone (<=50% stress): no penalty.
 * - Yellow zone (50–85%): 0.5 * BasePriority penalty.
 * - Red zone (>85%): effectively infinite penalty (hard stop).
 */
export async function generateWeekForTemplate(
  template: FullTemplate,
  userId: string,
  profile: UserProfile | null
): Promise<string[]> {
  if (__DEV__) {
    devLog('week-generation', {
      action: 'generateWeekForTemplate',
      templateId: template.template.id,
      dayCount: template.days.length,
    });
  }

  try {
    // 1) Load AI allow-list
    const { data: aiExercises, error: allowError } = await supabase
      .from('v2_ai_recommended_exercises')
      .select('exercise_id, priority_order')
      .eq('is_active', true)
      .order('priority_order', { ascending: true })
      .limit(50);

    if (allowError) {
      if (__DEV__) {
        devError('week-generation', allowError, {
          userId,
          step: 'allow-list',
        });
      }
      return [];
    }

    if (!aiExercises || aiExercises.length === 0) {
      if (__DEV__) {
        devLog('week-generation', { action: 'no_ai_exercises', userId });
      }
      return [];
    }

    const exerciseIds = aiExercises.map((row) => row.exercise_id);

    // 2) Load merged exercise metadata for biomechanics
    const mergedExercises = await listMergedExercises(userId, exerciseIds);
    const mergedMap = new Map(mergedExercises.map((ex) => [ex.id, ex]));

    // 3) Load current fatigue (performed truth) over the last 48h
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const currentStress = await getMuscleStressStats(userId, startIso, endIso);

    // 4) Load prescription bands for reps/timed
    const experience =
      profile?.experience_level && profile.experience_level.length > 0
        ? profile.experience_level
        : 'beginner';

    const repsIds: string[] = [];
    const timedIds: string[] = [];

    for (const exId of exerciseIds) {
      const meta = mergedMap.get(exId);
      if (!meta) continue;
      if (meta.is_timed) {
        timedIds.push(exId);
      } else {
        repsIds.push(exId);
      }
    }

    const [repsMap, timedMap] = await Promise.all([
      repsIds.length
        ? getPrescriptionsForExercises(repsIds, experience, 'reps')
        : Promise.resolve(new Map<string, any>()),
      timedIds.length
        ? getPrescriptionsForExercises(timedIds, experience, 'timed')
        : Promise.resolve(new Map<string, any>()),
    ]);

    // 5) Build ExerciseStressProfile per candidate
    const maxPriorityOrder = Math.max(
      ...aiExercises.map((row) => row.priority_order ?? 0),
      0
    );

    const profiles = new Map<string, ExerciseStressProfile>();
    const excluded: string[] = [];

    for (const row of aiExercises) {
      const exerciseId = row.exercise_id;
      const meta = mergedMap.get(exerciseId);
      if (!meta) {
        excluded.push(exerciseId);
        continue;
      }

      const isTimed = !!meta.is_timed;
      const rx = isTimed ? timedMap.get(exerciseId) : repsMap.get(exerciseId);

      if (!rx) {
        if (__DEV__) {
          devError(
            'week-generation',
            new Error('Missing prescription for AI exercise'),
            {
              exerciseId,
              experience,
              mode: isTimed ? 'timed' : 'reps',
            }
          );
        }
        excluded.push(exerciseId);
        continue;
      }

      const setsMin = rx.sets_min;
      const setsMax = rx.sets_max;

      if (
        typeof setsMin !== 'number' ||
        typeof setsMax !== 'number' ||
        setsMax < setsMin
      ) {
        excluded.push(exerciseId);
        continue;
      }

      const targetSets = Math.round((setsMin + setsMax) / 2);

      // Build muscle weights from primary_muscles + implicit_hits
      const weights = new Map<string, number>();

      if (Array.isArray(meta.primary_muscles)) {
        for (const m of meta.primary_muscles) {
          if (!m) continue;
          weights.set(m, (weights.get(m) || 0) + 1);
        }
      }

      if (meta.implicit_hits && typeof meta.implicit_hits === 'object') {
        for (const [m, w] of Object.entries(meta.implicit_hits)) {
          const val = typeof w === 'number' ? w : 0;
          if (val <= 0) continue;
          weights.set(m, (weights.get(m) || 0) + val);
        }
      }

      let total = 0;
      for (const w of weights.values()) {
        total += w;
      }

      if (total <= 0) {
        excluded.push(exerciseId);
        continue;
      }

      const perMuscleWeights: Record<string, number> = {};
      for (const [m, w] of weights.entries()) {
        perMuscleWeights[m] = w / total;
      }

      const basePriority =
        maxPriorityOrder + 1 - (row.priority_order ?? maxPriorityOrder);

      profiles.set(exerciseId, {
        exerciseId,
        targetSets,
        perMuscleWeights,
        basePriority,
      });
    }

    const sim = new SimulatedFatigueState(currentStress);
    const remaining = new Set<string>(Array.from(profiles.keys()));
    const result: string[] = [];

    // 6) Greedy fatigue-aware selection loop (pure TS, no SQL)
    while (remaining.size > 0) {
      let bestId: string | null = null;
      let bestScore = -Infinity;
      let anyNonRed = false;

      for (const id of remaining) {
        const profile = profiles.get(id);
        if (!profile) continue;

        const { zone } = sim.getZoneForExercise(profile);

        let fatiguePenalty: number;
        if (zone === 'green') {
          fatiguePenalty = 0;
          anyNonRed = true;
        } else if (zone === 'yellow') {
          fatiguePenalty = profile.basePriority * 0.5;
          anyNonRed = true;
        } else {
          // Red zone: hard stop for this candidate
          fatiguePenalty = Infinity;
        }

        if (!Number.isFinite(fatiguePenalty)) {
          continue;
        }

        const score = profile.basePriority - fatiguePenalty;

        if (score > bestScore) {
          bestScore = score;
          bestId = id;
        }
      }

      if (!bestId || bestScore === -Infinity || !anyNonRed) {
        // Nothing safe left to add
        break;
      }

      const chosenProfile = profiles.get(bestId);
      if (!chosenProfile) {
        remaining.delete(bestId);
        continue;
      }

      result.push(bestId);
      sim.registerExercise(chosenProfile);
      remaining.delete(bestId);
    }

    if (__DEV__) {
      devLog('week-generation', {
        action: 'generateWeekForTemplate_result',
        userId,
        templateId: template.template.id,
        candidateCount: exerciseIds.length,
        excludedCount: excluded.length,
        pickedCount: result.length,
        hasStress: Object.keys(currentStress).length > 0,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      devError('week-generation', error, {
        userId,
        templateId: template.template.id,
        step: 'generateWeekForTemplate_catch',
      });
    }
    return [];
  }
}

