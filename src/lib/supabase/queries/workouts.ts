/**
 * Workout queries
 * Handles workout sessions and sets (performed truth)
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id?: string;
  day_name?: string;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  completed_at?: string;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  sort_order: number;
}

export interface SessionSet {
  id: string;
  session_exercise_id: string;
  set_number: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  rir?: number;
  duration_sec?: number;
  rest_sec?: number;
  notes?: string;
  performed_at: string;
}

/**
 * Create a new workout session
 */
export async function createWorkoutSession(
  userId: string,
  templateId?: string,
  dayName?: string
): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', { 
      action: 'createWorkoutSession', 
      userId, 
      templateId, 
      dayName 
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .insert({
        user_id: userId,
        template_id: templateId,
        day_name: dayName,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, templateId, dayName });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, templateId, dayName });
    }
    return null;
  }
}

/**
 * Get active session for user
 */
export async function getActiveSession(userId: string): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getActiveSession', userId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId });
    }
    return null;
  }
}

/**
 * Complete a workout session
 */
export async function completeWorkoutSession(sessionId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', { action: 'completeWorkoutSession', sessionId });
  }

  try {
    const { error } = await supabase
      .from('v2_workout_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { sessionId });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return false;
  }
}

/**
 * Save a set to a session exercise
 */
export async function saveSessionSet(
  sessionExerciseId: string,
  setNumber: number,
  setData: {
    reps?: number;
    weight?: number;
    rpe?: number;
    rir?: number;
    duration_sec?: number;
    rest_sec?: number;
    notes?: string;
  }
): Promise<SessionSet | null> {
  if (__DEV__) {
    devLog('workout-query', { 
      action: 'saveSessionSet', 
      sessionExerciseId, 
      setNumber,
      hasReps: setData.reps !== undefined,
      hasDuration: setData.duration_sec !== undefined
    });
  }

  try {
    // Check if set already exists
    const { data: existing } = await supabase
      .from('v2_session_sets')
      .select('id')
      .eq('session_exercise_id', sessionExerciseId)
      .eq('set_number', setNumber)
      .maybeSingle();

    if (existing) {
      // Update existing set
      const { data, error } = await supabase
        .from('v2_session_sets')
        .update(setData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        if (__DEV__) {
          devError('workout-query', error, { sessionExerciseId, setNumber });
        }
        return null;
      }

      return data;
    } else {
      // Create new set
      const { data, error } = await supabase
        .from('v2_session_sets')
        .insert({
          session_exercise_id: sessionExerciseId,
          set_number: setNumber,
          ...setData,
        })
        .select()
        .single();

      if (error) {
        if (__DEV__) {
          devError('workout-query', error, { sessionExerciseId, setNumber });
        }
        return null;
      }

      return data;
    }
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionExerciseId, setNumber });
    }
    return null;
  }
}

/**
 * Get completed sessions in a date range (inclusive)
 * Filters by completed_at timestamp to accurately count completed workouts
 */
export async function getSessionsInRange(
  userId: string,
  startIso: string,
  endIso: string
): Promise<WorkoutSession[]> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSessionsInRange', userId, startIso, endIso });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)
      .order('completed_at', { ascending: false });

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, startIso, endIso });
      }
      return [];
    }

    return data || [];
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, startIso, endIso });
    }
    return [];
  }
}

/**
 * Get recent completed sessions
 */
export async function getRecentSessions(
  userId: string,
  limit = 5
): Promise<WorkoutSession[]> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getRecentSessions', userId, limit });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, limit });
      }
      return [];
    }

    return data || [];
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, limit });
    }
    return [];
  }
}

export interface SessionStats {
  totalSets: number;
  avgWeight: number | null;
  avgReps: number | null;
  avgRPE: number | null;
  avgDuration: number | null;
}

/**
 * Get aggregated set statistics for a session
 * Returns averages for weight, reps, RPE, and duration
 */
export async function getSessionStats(sessionId: string): Promise<SessionStats | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSessionStats', sessionId });
  }

  try {
    // Get all session exercises for this session
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from('v2_session_exercises')
      .select('id')
      .eq('session_id', sessionId);

    if (exercisesError) {
      if (__DEV__) {
        devError('workout-query', exercisesError, { sessionId, step: 'sessionExercises' });
      }
      return null;
    }

    if (!sessionExercises || sessionExercises.length === 0) {
      return {
        totalSets: 0,
        avgWeight: null,
        avgReps: null,
        avgRPE: null,
        avgDuration: null,
      };
    }

    const sessionExerciseIds = sessionExercises.map(se => se.id);

    // Get all sets for these exercises
    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('weight, reps, rpe, duration_sec')
      .in('session_exercise_id', sessionExerciseIds)
      .not('performed_at', 'is', null); // Only completed sets

    if (setsError) {
      if (__DEV__) {
        devError('workout-query', setsError, { sessionId, step: 'sets' });
      }
      return null;
    }

    if (!sets || sets.length === 0) {
      return {
        totalSets: 0,
        avgWeight: null,
        avgReps: null,
        avgRPE: null,
        avgDuration: null,
      };
    }

    // Calculate averages
    const weights = sets.map(s => s.weight).filter((w): w is number => w !== null && w !== undefined);
    const reps = sets.map(s => s.reps).filter((r): r is number => r !== null && r !== undefined);
    const rpes = sets.map(s => s.rpe).filter((r): r is number => r !== null && r !== undefined);
    const durations = sets.map(s => s.duration_sec).filter((d): d is number => d !== null && d !== undefined);

    const avgWeight = weights.length > 0
      ? weights.reduce((sum, w) => sum + w, 0) / weights.length
      : null;
    const avgReps = reps.length > 0
      ? reps.reduce((sum, r) => sum + r, 0) / reps.length
      : null;
    const avgRPE = rpes.length > 0
      ? rpes.reduce((sum, r) => sum + r, 0) / rpes.length
      : null;
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getSessionStats_result',
        sessionId,
        totalSets: sets.length,
        avgWeight,
        avgReps,
        avgRPE,
        avgDuration,
      });
    }

    return {
      totalSets: sets.length,
      avgWeight,
      avgReps,
      avgRPE,
      avgDuration,
    };
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return null;
  }
}

export interface TopPR {
  set_id: string;
  session_id: string;
  session_exercise_id: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  weight?: number;
  reps?: number;
  duration_sec?: number;
  performed_at?: string;
  reps_at_pr_weight?: number[];
}

export interface ExerciseHistory {
  sets: Array<{
    id: string;
    session_exercise_id: string;
    set_number: number;
    reps?: number;
    weight?: number;
    rpe?: number;
    rir?: number;
    duration_sec?: number;
    performed_at: string;
  }>;
  lastRPE: number | null;
  lastRIR: number | null;
  lastWeight: number | null;
  lastReps: number | null;
  lastDuration: number | null;
  avgRPE: number | null;
}

export type MuscleStressMap = Record<string, number>;

/**
 * Get top PR sets (weight-based and duration-based) for a user's recent sessions
 * Returns hybrid PRs: both weight-based (reps exercises) and duration-based (timed exercises)
 */
export async function getTopPRs(
  userId: string,
  limit = 3
): Promise<TopPR[]> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getTopPRs', userId, limit });
  }

  try {
    // Step 1: all completed session ids (bounded for perf)
    const { data: sessions, error: sessionsError } = await supabase
      .from('v2_workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(500);

    if (sessionsError) {
      if (__DEV__) {
        devError('workout-query', sessionsError, { userId, limit, step: 'sessions' });
      }
      return [];
    }

    const sessionIds = (sessions || []).map((s) => s.id);
    if (!sessionIds.length) return [];

    // Step 2: session exercises for those sessions
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id, session_id')
      .in('session_id', sessionIds);

    if (exercisesError) {
      if (__DEV__) {
        devError('workout-query', exercisesError, { userId, limit, step: 'session-exercises' });
      }
      return [];
    }

    const sessionExerciseIds = (sessionExercises || []).map((e) => e.id);
    if (!sessionExerciseIds.length) return [];

    const exerciseMap = new Map(
      (sessionExercises || []).map((e) => [e.id, e])
    );

    // Step 3: Fetch sets for PR computation (completed only)
    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('id, session_exercise_id, weight, reps, duration_sec, performed_at')
      .in('session_exercise_id', sessionExerciseIds)
      .not('performed_at', 'is', null);

    if (setsError) {
      if (__DEV__) {
        devError('workout-query', setsError, { userId, limit, step: 'sets' });
      }
      return [];
    }

    const rows = sets || [];
    if (!rows.length) return [];

    type PrAccumulator = {
      set_id: string;
      session_exercise_id: string;
      session_id: string;
      exercise_id?: string;
      custom_exercise_id?: string;
      maxWeight: number;
      performed_at?: string;
      repsAtMax: Set<number>;
    };

    // One PR per exercise: highest weight lifetime (for reps-based sets)
    const byExercise = new Map<string, PrAccumulator>();
    for (const row of rows) {
      const ex = exerciseMap.get(row.session_exercise_id);
      if (!ex) continue;
      const exerciseKey = ex.exercise_id || ex.custom_exercise_id;
      if (!exerciseKey) continue;

      const w = typeof row.weight === 'number' ? row.weight : row.weight == null ? null : Number(row.weight);
      const reps = typeof row.reps === 'number' ? row.reps : row.reps == null ? null : Number(row.reps);
      if (w == null) continue; // only weight PRs for now

      const existing = byExercise.get(exerciseKey);
      if (!existing || w > existing.maxWeight) {
        const repsSet = new Set<number>();
        if (reps != null && !Number.isNaN(reps)) repsSet.add(reps);
        byExercise.set(exerciseKey, {
          set_id: row.id,
          session_exercise_id: row.session_exercise_id,
          session_id: ex.session_id,
          exercise_id: ex.exercise_id || undefined,
          custom_exercise_id: ex.custom_exercise_id || undefined,
          maxWeight: w,
          performed_at: row.performed_at || undefined,
          repsAtMax: repsSet,
        });
      } else if (w === existing.maxWeight) {
        if (reps != null && !Number.isNaN(reps)) existing.repsAtMax.add(reps);
      }
    }

    const prs = Array.from(byExercise.values())
      .sort((a, b) => b.maxWeight - a.maxWeight)
      .slice(0, limit)
      .map((p) => ({
        set_id: p.set_id,
        session_exercise_id: p.session_exercise_id,
        session_id: p.session_id,
        exercise_id: p.exercise_id,
        custom_exercise_id: p.custom_exercise_id,
        weight: p.maxWeight,
        reps_at_pr_weight: Array.from(p.repsAtMax).sort((a, b) => b - a),
        performed_at: p.performed_at,
      }));

    return prs;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, limit, step: 'top-prs' });
    }
    return [];
  }
}

/**
 * Get recent exercise history for progressive overload
 * Returns safe empty object when no data to avoid engine crashes
 */
export async function getExerciseHistory(
  exerciseId: string,
  userId: string,
  limit = 5
): Promise<ExerciseHistory> {
  const empty: ExerciseHistory = {
    sets: [],
    lastRPE: null,
    lastRIR: null,
    lastWeight: null,
    lastReps: null,
    lastDuration: null,
    avgRPE: null,
  };

  if (__DEV__) {
    devLog('workout-query', {
      action: 'getExerciseHistory',
      exerciseId,
      userId,
      limit,
    });
  }

  try {
    const { data, error } = await supabase
      .from('v2_session_sets')
      .select(
        `
          id,
          session_exercise_id,
          set_number,
          reps,
          weight,
          rpe,
          rir,
          duration_sec,
          performed_at,
          v2_session_exercises!inner(
            exercise_id,
            custom_exercise_id,
            session_id,
            v2_workout_sessions!inner(user_id, status)
          )
        `
      )
      .eq('v2_session_exercises.v2_workout_sessions.user_id', userId)
      .eq('v2_session_exercises.v2_workout_sessions.status', 'completed')
      .or(`exercise_id.eq.${exerciseId},custom_exercise_id.eq.${exerciseId}`, { foreignTable: 'v2_session_exercises' })
      .not('performed_at', 'is', null)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { exerciseId, userId, limit });
      }
      return empty;
    }

    const sets =
      (data || []).map((set) => ({
        id: set.id,
        session_exercise_id: set.session_exercise_id,
        set_number: set.set_number,
        reps: set.reps ?? undefined,
        weight: set.weight ?? undefined,
        rpe: set.rpe ?? undefined,
        rir: set.rir ?? undefined,
        duration_sec: set.duration_sec ?? undefined,
        performed_at: set.performed_at,
      })) || [];

    if (!sets.length) {
      return empty;
    }

    const last = sets[0];
    const rpeValues = sets
      .map((s) => s.rpe)
      .filter((val): val is number => val !== undefined && val !== null);
    const avgRPE =
      rpeValues.length > 0
        ? rpeValues.reduce((sum, val) => sum + val, 0) / rpeValues.length
        : null;

    const result: ExerciseHistory = {
      sets,
      lastRPE: last.rpe ?? null,
      lastRIR: last.rir ?? null,
      lastWeight: last.weight ?? null,
      lastReps: last.reps ?? null,
      lastDuration: last.duration_sec ?? null,
      avgRPE,
    };

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getExerciseHistory_result',
        exerciseId,
        userId,
        setCount: sets.length,
        lastPerformedAt: last.performed_at,
        avgRPE,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { exerciseId, userId, limit });
    }
    return empty;
  }
}

/**
 * Get muscle stress stats for a user over a date range
 * Aggregates stress per muscle using V2 stimulus * normalized muscle weight
 */
export async function getMuscleStressStats(
  userId: string,
  startIso: string,
  endIso: string
): Promise<MuscleStressMap> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'getMuscleStressStats',
      userId,
      startIso,
      endIso,
    });
  }

  const stress: MuscleStressMap = {};

  try {
    // Step A: fetch completed sessions within range first
    const { data: sessions, error: sessionsError } = await supabase
      .from('v2_workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso);

    if (sessionsError) {
      if (__DEV__) {
        devError('workout-query', sessionsError, {
          action: 'getMuscleStressStats_sessions',
          userId,
          startIso,
          endIso,
        });
      }
      return stress;
    }

    const sessionIds = (sessions || []).map((s) => s.id);
    if (!sessionIds.length) {
      return stress;
    }

    // Step B: fetch session exercises for these sessions
    const { data: sessionExercises, error: seError } = await supabase
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id, session_id')
      .in('session_id', sessionIds);

    if (seError) {
      if (__DEV__) {
        devError('workout-query', seError, {
          action: 'getMuscleStressStats_sessionExercises',
          userId,
          sessionIdsCount: sessionIds.length,
        });
      }
      return stress;
    }

    const sessionExerciseIds = (sessionExercises || []).map((se) => se.id);
    if (!sessionExerciseIds.length) {
      return stress;
    }

    // Step C: fetch sets for these session exercises
    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select(
        `
          id,
          session_exercise_id,
          reps,
          weight,
          rpe,
          rir,
          duration_sec,
          performed_at,
          session_exercises!inner(
            id,
            exercise_id,
            custom_exercise_id,
            session_id
          )
        `
      )
      .in('session_exercise_id', sessionExerciseIds);

    if (setsError) {
      if (__DEV__) {
        devError('workout-query', setsError, {
          action: 'getMuscleStressStats_sets',
          userId,
          startIso,
          endIso,
        });
      }
      return stress;
    }

    const rows = sets || [];
    if (!rows.length) {
      return stress;
    }

    // Create a map of session_exercise_id -> exercise metadata
    const seMap = new Map(
      (sessionExercises || []).map((se) => [
        se.id,
        { exercise_id: se.exercise_id, custom_exercise_id: se.custom_exercise_id },
      ])
    );

    // Collect exercise ids
    const masterIds = new Set<string>();
    const customIds = new Set<string>();

    for (const row of rows) {
      const se = seMap.get(row.session_exercise_id) || 
        (row.session_exercises as {
          exercise_id?: string | null;
          custom_exercise_id?: string | null;
        } | undefined);
      if (se?.exercise_id) {
        masterIds.add(se.exercise_id);
      }
      if (se?.custom_exercise_id) {
        customIds.add(se.custom_exercise_id);
      }
    }

    // Step B: fetch exercise metadata
    type ExerciseMeta = {
      id: string;
      primary_muscles: string[] | null;
      implicit_hits: Record<string, number> | null;
    };

    const [masterMetaResult, customMetaResult] = await Promise.all([
      masterIds.size
        ? supabase
            .from('v2_exercises')
            .select('id, primary_muscles, implicit_hits')
            .in('id', Array.from(masterIds))
        : Promise.resolve({ data: [] as any[], error: null }),
      customIds.size
        ? supabase
            .from('v2_user_custom_exercises')
            .select('id, primary_muscles, implicit_hits')
            .in('id', Array.from(customIds))
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    if (masterMetaResult.error || customMetaResult.error) {
      if (__DEV__) {
        devError('workout-query', masterMetaResult.error || customMetaResult.error, {
          action: 'getMuscleStressStats_meta',
          masterCount: masterIds.size,
          customCount: customIds.size,
        });
      }
      return stress;
    }

    const masterMeta = (masterMetaResult.data || []) as ExerciseMeta[];
    const customMeta = (customMetaResult.data || []) as ExerciseMeta[];

    const masterMap = new Map<string, ExerciseMeta>();
    for (const ex of masterMeta) {
      masterMap.set(ex.id, ex);
    }

    const customMap = new Map<string, ExerciseMeta>();
    for (const ex of customMeta) {
      customMap.set(ex.id, ex);
    }

    // Step C: aggregate stress per muscle
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    for (const row of rows) {
      const se = seMap.get(row.session_exercise_id) || 
        (row.session_exercises as {
          exercise_id?: string | null;
          custom_exercise_id?: string | null;
        } | undefined);

      const exerciseId = se?.exercise_id ?? undefined;
      const customExerciseId = se?.custom_exercise_id ?? undefined;

      const meta =
        (exerciseId && masterMap.get(exerciseId)) ||
        (customExerciseId && customMap.get(customExerciseId));

      if (!meta) {
        continue;
      }

      // Stimulus
      const rpe: number | null =
        typeof row.rpe === 'number' ? row.rpe : row.rpe == null ? null : Number(row.rpe);
      const rir: number | null =
        typeof row.rir === 'number' ? row.rir : row.rir == null ? null : Number(row.rir);

      let stimulus: number;
      if (rpe != null) {
        stimulus = clamp((rpe - 5) / 5, 0, 1);
      } else if (rir != null) {
        const estRpe = 10 - rir;
        stimulus = clamp((estRpe - 5) / 5, 0, 1);
      } else {
        stimulus = 0.6;
      }

      // Muscle weights
      const muscleWeights = new Map<string, number>();

      if (Array.isArray(meta.primary_muscles)) {
        for (const m of meta.primary_muscles) {
          if (!m) continue;
          muscleWeights.set(m, (muscleWeights.get(m) || 0) + 1);
        }
      }

      if (meta.implicit_hits && typeof meta.implicit_hits === 'object') {
        for (const [m, w] of Object.entries(meta.implicit_hits)) {
          const weight = typeof w === 'number' ? w : 0;
          if (weight <= 0) continue;
          muscleWeights.set(m, (muscleWeights.get(m) || 0) + weight);
        }
      }

      let totalW = 0;
      for (const w of muscleWeights.values()) {
        totalW += w;
      }
      if (totalW <= 0) continue;

      for (const [muscleKey, w] of muscleWeights.entries()) {
        const p = w / totalW;
        stress[muscleKey] = (stress[muscleKey] || 0) + stimulus * p;
      }
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getMuscleStressStats_result',
        userId,
        startIso,
        endIso,
        setCount: rows.length,
        muscleCount: Object.keys(stress).length,
      });
    }

    return stress;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, {
        action: 'getMuscleStressStats_catch',
        userId,
        startIso,
        endIso,
      });
    }
    return stress;
  }
}

/**
 * Prefill session sets with progressive overload targets
 * Creates v2_session_sets rows for planned set count with prefilled reps/weight/duration
 * These are "starting targets" that the user edits, NOT "already performed" values
 */
export async function prefillSessionSets(
  sessionId: string,
  sessionExercises: Array<{
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
  }>,
  targets: Map<string, {
    sets: number;
    reps?: number;
    duration_sec?: number;
    weight?: number;
  }>
): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'prefillSessionSets',
      sessionId,
      exerciseCount: sessionExercises.length,
      targetCount: targets.size,
    });
  }

  try {
    // Create sets for each session exercise
    for (const sessionExercise of sessionExercises) {
      const exerciseRef = {
        exerciseId: sessionExercise.exercise_id || undefined,
        customExerciseId: sessionExercise.custom_exercise_id || undefined,
      };

      const exerciseKey = exerciseRef.exerciseId || exerciseRef.customExerciseId;
      if (!exerciseKey) continue;

      const target = targets.get(exerciseKey);
      if (!target) continue;

      // Create sets for the planned set count
      for (let setNumber = 1; setNumber <= target.sets; setNumber++) {
        const { error } = await supabase
          .from('v2_session_sets')
          .insert({
            session_exercise_id: sessionExercise.id,
            set_number: setNumber,
            reps: target.reps || null,
            weight: target.weight || null,
            duration_sec: target.duration_sec || null,
            // RPE/RIR are null initially (user fills these during workout)
            rpe: null,
            rir: null,
            rest_sec: null,
            notes: null,
          });

        if (error) {
          if (__DEV__) {
            devError('workout-query', error, {
              sessionId,
              sessionExerciseId: sessionExercise.id,
              setNumber,
            });
          }
          return false;
        }
      }
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'prefillSessionSets_result',
        sessionId,
        setsCreated: sessionExercises.reduce((sum, se) => {
          const exerciseId = se.exercise_id || se.custom_exercise_id;
          const target = exerciseId ? targets.get(exerciseId) : null;
          return sum + (target?.sets || 0);
        }, 0),
      });
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return false;
  }
}

/**
 * Mark a set as complete with optimistic update
 * Used by swipe-to-complete gesture in active workout
 */
export async function markSetComplete(
  setId: string,
  values: { reps?: number; weight?: number; duration_sec?: number; rpe?: number }
): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'markSetComplete',
      setId,
      hasReps: values.reps !== undefined,
      hasDuration: values.duration_sec !== undefined,
      hasRpe: values.rpe !== undefined,
    });
  }

  try {
    const { error } = await supabase
      .from('v2_session_sets')
      .update({
        ...values,
        performed_at: new Date().toISOString(), // CRITICAL: Mark as complete
      })
      .eq('id', setId);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { setId, values });
      }
      return false;
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'markSetComplete:success',
        setId,
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { setId });
    }
    return false;
  }
}

/**
 * Get session with exercises and sets
 * Used by active workout screen
 * Fetches notes from template slots if session was created from a template
 */
export async function getSessionWithSets(sessionId: string): Promise<{
  session: WorkoutSession | null;
  exercises: Array<{
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
    sort_order: number;
    notes?: string;
    sets: SessionSet[];
  }>;
} | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSessionWithSets', sessionId });
  }

  try {
    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      if (__DEV__) {
        devError('workout-query', sessionError, { sessionId });
      }
      return null;
    }

    // Fetch exercises
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id, sort_order')
      .eq('session_id', sessionId)
      .order('sort_order', { ascending: true });

    if (exercisesError) {
      if (__DEV__) {
        devError('workout-query', exercisesError, { sessionId });
      }
      return { session, exercises: [] };
    }

    const sessionExerciseIds = (sessionExercises || []).map(se => se.id);

    // Fetch sets for all exercises
    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('*')
      .in('session_exercise_id', sessionExerciseIds)
      .order('set_number', { ascending: true });

    if (setsError) {
      if (__DEV__) {
        devError('workout-query', setsError, { sessionId });
      }
      return { session, exercises: [] };
    }

    // Fetch notes from template slots if session has a template_id
    const notesMap = new Map<string, string>();
    if (session?.template_id && session?.day_name) {
      try {
        // Get template day
        const { data: templateDay } = await supabase
          .from('v2_template_days')
          .select('id')
          .eq('template_id', session.template_id)
          .eq('day_name', session.day_name)
          .maybeSingle();

        if (templateDay) {
          // Get template slots for this day
          const { data: templateSlots } = await supabase
            .from('v2_template_slots')
            .select('exercise_id, custom_exercise_id, notes')
            .eq('day_id', templateDay.id);

          if (templateSlots) {
            // Map notes by exercise_id or custom_exercise_id
            for (const slot of templateSlots) {
              if (slot.notes) {
                const key = slot.exercise_id || slot.custom_exercise_id;
                if (key) {
                  notesMap.set(key, slot.notes);
                }
              }
            }
          }
        }
      } catch (notesError) {
        // Non-critical: if notes fetch fails, continue without notes
        if (__DEV__) {
          devLog('workout-query', {
            action: 'getSessionWithSets_notes_fetch_failed',
            sessionId,
            error: notesError,
          });
        }
      }
    }

    // Group sets by exercise and attach notes
    const exercises = (sessionExercises || []).map(se => {
      const exerciseKey = se.exercise_id || se.custom_exercise_id;
      const notes = exerciseKey ? notesMap.get(exerciseKey) : undefined;

      return {
        id: se.id,
        exercise_id: se.exercise_id || undefined,
        custom_exercise_id: se.custom_exercise_id || undefined,
        sort_order: se.sort_order,
        notes: notes || undefined,
        sets: (sets || []).filter(s => s.session_exercise_id === se.id),
      };
    });

    return { session, exercises };
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return null;
  }
}

/**
 * Get last 7 days of session structure
 * Returns array of day structures with exercises
 */
export async function getLast7DaysSessionStructure(
  userId: string
): Promise<Array<{ dayName: string; exercises: Array<{ exerciseId?: string; customExerciseId?: string }> }>> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getLast7DaysSessionStructure', userId });
  }

  try {
    // Get completed sessions from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: sessions, error: sessionsError } = await supabase
      .from('v2_workout_sessions')
      .select('id, day_name, started_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: true });

    if (sessionsError) {
      if (__DEV__) {
        devError('workout-query', sessionsError, { userId });
      }
      return [];
    }

    if (!sessions || sessions.length === 0) {
      return [];
    }

    const sessionIds = sessions.map((s) => s.id);

    // Get all session exercises
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from('v2_session_exercises')
      .select('id, session_id, exercise_id, custom_exercise_id, sort_order')
      .in('session_id', sessionIds)
      .order('sort_order', { ascending: true });

    if (exercisesError) {
      if (__DEV__) {
        devError('workout-query', exercisesError, { userId, sessionIds });
      }
      return [];
    }

    if (!sessionExercises || sessionExercises.length === 0) {
      return [];
    }

    // Group by day_name and build structure
    const dayMap = new Map<string, Array<{ exerciseId?: string; customExerciseId?: string }>>();

    for (const session of sessions) {
      const dayName = session.day_name || 'Unknown';
      if (!dayMap.has(dayName)) {
        dayMap.set(dayName, []);
      }

      const dayExercises = sessionExercises
        .filter((se) => se.session_id === session.id)
        .map((se) => ({
          exerciseId: se.exercise_id || undefined,
          customExerciseId: se.custom_exercise_id || undefined,
        }));

      // Merge exercises for the same day (avoid duplicates)
      const existing = dayMap.get(dayName)!;
      for (const ex of dayExercises) {
        const exists = existing.some(
          (e) => e.exerciseId === ex.exerciseId && e.customExerciseId === ex.customExerciseId
        );
        if (!exists) {
          existing.push(ex);
        }
      }
    }

    // Convert to array format
    const result: Array<{ dayName: string; exercises: Array<{ exerciseId?: string; customExerciseId?: string }> }> = [];
    for (const [dayName, exercises] of dayMap.entries()) {
      result.push({ dayName, exercises });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId });
    }
    return [];
  }
}
