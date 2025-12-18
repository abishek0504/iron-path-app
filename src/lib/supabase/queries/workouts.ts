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
    // Step 1: recent session ids (completed)
    const { data: sessions, error: sessionsError } = await supabase
      .from('v2_workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(50);

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

    // Step 3: Fetch weight-based PRs and duration-based PRs in parallel
    const [weightSetsResult, durationSetsResult] = await Promise.all([
      // Weight-based PRs: top sets by weight
      supabase
        .from('v2_session_sets')
        .select('id, session_exercise_id, weight, reps, duration_sec, performed_at')
        .in('session_exercise_id', sessionExerciseIds)
        .not('weight', 'is', null)
        .order('weight', { ascending: false, nullsFirst: false })
        .limit(limit * 2),
      // Duration-based PRs: top sets by duration
      supabase
        .from('v2_session_sets')
        .select('id, session_exercise_id, weight, reps, duration_sec, performed_at')
        .in('session_exercise_id', sessionExerciseIds)
        .not('duration_sec', 'is', null)
        .order('duration_sec', { ascending: false, nullsFirst: false })
        .limit(limit * 2),
    ]);

    if (weightSetsResult.error) {
      if (__DEV__) {
        devError('workout-query', weightSetsResult.error, { userId, limit, step: 'weight-sets' });
      }
    }

    if (durationSetsResult.error) {
      if (__DEV__) {
        devError('workout-query', durationSetsResult.error, { userId, limit, step: 'duration-sets' });
      }
    }

    // Combine both result sets
    const allSets = [
      ...(weightSetsResult.data || []),
      ...(durationSetsResult.data || []),
    ];

    // Convert to TopPR format and deduplicate by set_id
    const prMap = new Map<string, TopPR>();
    for (const set of allSets) {
      const ex = exerciseMap.get(set.session_exercise_id);
      if (!ex) continue;

      // Skip if we already have this set (deduplication)
      if (prMap.has(set.id)) continue;

      prMap.set(set.id, {
        set_id: set.id,
        session_exercise_id: set.session_exercise_id,
        session_id: ex.session_id,
        exercise_id: ex.exercise_id || undefined,
        custom_exercise_id: ex.custom_exercise_id || undefined,
        weight: set.weight || undefined,
        reps: set.reps || undefined,
        duration_sec: set.duration_sec || undefined,
        performed_at: set.performed_at,
      });
    }

    // Convert to array and sort by performed_at (most recent first) as tiebreaker
    // Since we can't directly compare weight vs duration, we prioritize by recency
    const prs = Array.from(prMap.values()).sort((a, b) => {
      const aTime = a.performed_at ? new Date(a.performed_at).getTime() : 0;
      const bTime = b.performed_at ? new Date(b.performed_at).getTime() : 0;
      return bTime - aTime; // Most recent first
    });

    // Return top limit items
    return prs.slice(0, limit);
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
          session_exercises!inner(
            exercise_id,
            custom_exercise_id,
            session_id,
            v2_workout_sessions!inner(user_id, status)
          )
        `
      )
      .eq('session_exercises.v2_workout_sessions.user_id', userId)
      .eq('session_exercises.v2_workout_sessions.status', 'completed')
      .or(
        `session_exercises.exercise_id.eq.${exerciseId},session_exercises.custom_exercise_id.eq.${exerciseId}`
      )
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
    // Step A: fetch sets joined to completed sessions within range
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
            session_id,
            v2_workout_sessions!inner(user_id, status, completed_at)
          )
        `
      )
      .eq('session_exercises.v2_workout_sessions.user_id', userId)
      .eq('session_exercises.v2_workout_sessions.status', 'completed')
      .not('session_exercises.v2_workout_sessions.completed_at', 'is', null)
      .gte('session_exercises.v2_workout_sessions.completed_at', startIso)
      .lte('session_exercises.v2_workout_sessions.completed_at', endIso);

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

    // Collect exercise ids
    const masterIds = new Set<string>();
    const customIds = new Set<string>();

    for (const row of rows) {
      const se = row.session_exercises as {
        exercise_id?: string | null;
        custom_exercise_id?: string | null;
      };
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
      const se = row.session_exercises as {
        exercise_id?: string | null;
        custom_exercise_id?: string | null;
      };

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
