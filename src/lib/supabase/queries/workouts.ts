/**
 * Workout queries
 * Handles workout sessions and sets (performed truth)
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import {
  getDateBoundsForDayName,
  getLocalDayKey,
  WEEK_DAYS,
  MS_PER_DAY_MS,
} from '../../utils/date';
import { formatDurationCompact } from '../../utils/formatDuration';
import { estimateOneRepMaxLbs } from '../../analytics/progression';
import { buildWarmupLadder } from '../../workout/warmupGenerator';
import { selectExerciseTargets } from '../../engine/targetSelection';
import { writeCompletedWorkoutToHealth } from '../../health/healthIntegration';
import { consumeWorkoutHealthBuffer } from '../../health/workoutHealthBuffer';
import { upsertDailyWorkoutStatsForSession } from './analytics';
import { invalidateAnalyticsCache } from '../../cache/analyticsCache';
import type { TemplateSlot } from './templates';

/**
 * Defensive caps on aggregate-style queries. These exist to bound query payload + memory in
 * pathological cases (corrupt data, very long-time users, malicious replication). Realistic
 * upper bounds: ~365 sessions/yr, ~30 sets/session, ~50 customs/user.
 */
const MAX_YTD_SESSIONS = 1000;
const MAX_YTD_SESSION_EXERCISES = 20000;
const MAX_YTD_SETS = 100000;
const MAX_SESSIONS_IN_RANGE = 1000;
const MAX_UNIQUE_COMBO_SETS = 5000;

/**
 * Abandon unstarted active sessions from earlier local days so leftovers do not
 * confuse getActiveSession / watch handoff. Same-day actives are kept (multi-workout).
 * Mirrors watch standalone's abandon-before-create, scoped to stale rows only.
 */
async function abandonStaleUnstartedActiveSessions(
  userId: string,
  keepLocalDayKey: string,
): Promise<void> {
  const { data: actives, error } = await supabase
    .from('v2_workout_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error || !actives?.length) {
    if (error && __DEV__) {
      devError('workout-query', error, { action: 'abandonStaleUnstarted_list', userId });
    }
    return;
  }

  const staleIds = actives
    .filter((s) => getLocalDayKey(new Date(s.started_at)) !== keepLocalDayKey)
    .map((s) => s.id);
  if (staleIds.length === 0) return;

  const { data: exercises } = await supabase
    .from('v2_session_exercises')
    .select('id, session_id')
    .in('session_id', staleIds);

  const exerciseIds = (exercises || []).map((e) => e.id);
  const sessionsWithPerformed = new Set<string>();
  if (exerciseIds.length > 0) {
    const { data: performed } = await supabase
      .from('v2_session_sets')
      .select('session_exercise_id')
      .in('session_exercise_id', exerciseIds)
      .not('performed_at', 'is', null);
    const exerciseToSession = new Map(
      (exercises || []).map((e) => [e.id, e.session_id] as const),
    );
    for (const row of performed || []) {
      const sessionId = exerciseToSession.get(row.session_exercise_id);
      if (sessionId) sessionsWithPerformed.add(sessionId);
    }
  }

  const abandonIds = staleIds.filter((id) => !sessionsWithPerformed.has(id));
  if (abandonIds.length === 0) return;

  const { error: abandonError } = await supabase
    .from('v2_workout_sessions')
    .update({
      status: 'abandoned',
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .in('id', abandonIds);

  if (abandonError) {
    if (__DEV__) {
      devError('workout-query', abandonError, {
        action: 'abandonStaleUnstarted',
        userId,
        abandonIds,
      });
    }
    return;
  }

  if (__DEV__) {
    devLog('workout-query', {
      action: 'abandonStaleUnstarted',
      userId,
      abandonedCount: abandonIds.length,
      keepLocalDayKey,
    });
  }
}

async function isSessionOwnedByUser(sessionId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('v2_workout_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  return data != null;
}

async function isSessionExerciseOwnedByUser(sessionExerciseId: string, userId: string): Promise<boolean> {
  const { data: exercise } = await supabase
    .from('v2_session_exercises')
    .select('session_id')
    .eq('id', sessionExerciseId)
    .maybeSingle();
  if (!exercise?.session_id) return false;
  return isSessionOwnedByUser(exercise.session_id, userId);
}

async function isSessionSetOwnedByUser(setId: string, userId: string): Promise<boolean> {
  const { data: setRow } = await supabase
    .from('v2_session_sets')
    .select('session_exercise_id')
    .eq('id', setId)
    .maybeSingle();
  if (!setRow?.session_exercise_id) return false;
  return isSessionExerciseOwnedByUser(setRow.session_exercise_id, userId);
}

export type SessionControlDevice = 'phone' | 'watch';

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id?: string;
  day_name?: string;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  completed_at?: string;
  /** Which device owns progression + writes for this session. */
  control_device?: SessionControlDevice;
  origin?: 'auto' | 'manual';
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  sort_order: number;
  superset_group?: number | null;
  rest_sec?: number | null;
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

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
  set_type?: SetType;
  notes?: string;
  performed_at: string;
}

/**
 * Create a new workout session.
 * @param startedAt - Optional ISO timestamp; when provided (e.g. for planned days), the session is scheduled for that time. Defaults to now.
 * @param origin - 'auto' for planner auto-materialized sessions (deduped by a partial unique index), 'manual' for user/feature-initiated sessions (unconstrained). Defaults to 'manual'.
 * @param controlDevice - Which device owns progression/writes. Defaults to 'phone'.
 */
export async function createWorkoutSession(
  userId: string,
  templateId?: string,
  dayName?: string,
  startedAt?: string,
  origin: 'auto' | 'manual' = 'manual',
  controlDevice: SessionControlDevice = 'phone',
): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'createWorkoutSession',
      userId,
      templateId,
      dayName,
      startedAt: startedAt ?? 'now',
      origin,
      controlDevice,
    });
  }

  try {
    const resolvedStartedAt = startedAt ?? new Date().toISOString();
    await abandonStaleUnstartedActiveSessions(
      userId,
      getLocalDayKey(new Date(resolvedStartedAt)),
    );

    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .insert({
        user_id: userId,
        template_id: templateId,
        day_name: dayName,
        status: 'active',
        started_at: resolvedStartedAt,
        origin,
        control_device: controlDevice,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation: typically auto-per-day dedup (origin='auto').
      // Caller should re-fetch the winning session.
      if (error.code === '23505') {
        if (__DEV__) {
          devLog('workout-query', {
            action: 'createWorkoutSession_dedup',
            userId,
            dayName,
            origin,
            controlDevice,
          });
        }
        return null;
      }
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
 * Create a workout session and seed it from template slots (routine exercises + prefilled sets).
 * Used when the planner auto-materializes a day or when the user adds the first workout of the day.
 */
export async function materializeWorkoutFromTemplateSlots(input: {
  userId: string;
  templateId: string;
  dayName: string;
  slots: TemplateSlot[];
  startedAt?: string;
  experience?: string;
  origin?: 'auto' | 'manual';
}): Promise<WorkoutSession | null> {
  const { userId, templateId, dayName, slots, startedAt, experience = 'beginner', origin = 'manual' } = input;
  if (slots.length === 0) return null;

  const session = await createWorkoutSession(userId, templateId, dayName, startedAt, origin);
  if (!session) return null;

  const sessionExercises: { id: string; exercise_id?: string; custom_exercise_id?: string }[] = [];
  const targetsMap = new Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>();

  for (const slot of slots) {
    const exerciseId = slot.exercise_id || slot.custom_exercise_id;
    if (!exerciseId) continue;

    const { data: se, error: seErr } = await supabase
      .from('v2_session_exercises')
      .insert({
        session_id: session.id,
        exercise_id: slot.exercise_id || null,
        custom_exercise_id: slot.custom_exercise_id || null,
        sort_order: slot.sort_order,
        superset_group: slot.superset_group ?? null,
        rest_sec: slot.rest_sec ?? null,
      })
      .select()
      .single();

    if (seErr || !se) {
      if (__DEV__) {
        devError('workout-query', seErr || new Error('Failed to create session exercise'), {
          sessionId: session.id,
          slotId: slot.id,
        });
      }
      continue;
    }

    sessionExercises.push(se);

    const target = await selectExerciseTargets(
      { exerciseId: slot.exercise_id || undefined, customExerciseId: slot.custom_exercise_id || undefined },
      userId,
      { experience: slot.experience || experience },
      0,
    );
    if (target) {
      targetsMap.set(exerciseId, {
        sets: target.sets,
        reps: target.reps,
        duration_sec: target.duration_sec,
        weight: target.weight,
      });
    }
  }

  if (sessionExercises.length > 0 && targetsMap.size > 0) {
    await prefillSessionSets(session.id, sessionExercises, targetsMap);
  }

  return session;
}

/**
 * Get completed_at of the most recent completed session (for Smart Refresh target freshness).
 */
export async function getLastCompletedWorkoutAt(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.completed_at) return null;
    return data.completed_at;
  } catch {
    return null;
  }
}

/**
 * Get id of the most recent completed session (for muscle freshness backfill).
 */
export async function getLastCompletedSessionId(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) return null;
    return data.id;
  } catch {
    return null;
  }
}

/**
 * Invoke update-muscle-freshness Edge Function (used after completing a workout and for heatmap backfill).
 */
export async function invokeUpdateMuscleFreshness(
  userId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const { error: fnError } = await supabase.functions.invoke('update-muscle-freshness', {
      body: { user_id: userId, session_id: sessionId },
    });
    if (fnError) {
      if (__DEV__) {
        devError('workout-query', fnError, {
          action: 'invoke_update_muscle_freshness_failed',
          sessionId,
        });
      }
      return false;
    }
    if (__DEV__) {
      devLog('workout-query', { action: 'invoke_update_muscle_freshness_ok', sessionId });
    }
    return true;
  } catch (invokeError) {
    if (__DEV__) {
      devError('workout-query', invokeError, {
        action: 'invoke_update_muscle_freshness_exception',
        sessionId,
      });
    }
    return false;
  }
}

/**
 * Get a session by id (for multi-workout-per-day when opening a specific workout)
 */
export async function getSessionById(
  userId: string,
  sessionId: string
): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSessionById', userId, sessionId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, sessionId });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, sessionId });
    }
    return null;
  }
}

/**
 * Delete a workout session and all its exercises/sets.
 * Order: session_sets (via session_exercise_ids) -> session_exercises -> session.
 * Explicit order ensures RLS allows all deletes; DB CASCADE would work for session->exercises
 * but we delete children first so any RLS on child tables is satisfied.
 */
export async function deleteSessionWithExercises(
  userId: string,
  sessionId: string
): Promise<{ error: Error | null }> {
  if (__DEV__) {
    devLog('workout-query', { action: 'deleteSessionWithExercises', userId, sessionId });
  }

  try {
    const { data: sessionExerciseIds } = await supabase
      .from('v2_session_exercises')
      .select('id')
      .eq('session_id', sessionId);

    const ids = (sessionExerciseIds || []).map((r) => r.id);
    if (ids.length > 0) {
      const { error: setsError } = await supabase
        .from('v2_session_sets')
        .delete()
        .in('session_exercise_id', ids);

      if (setsError) {
        if (__DEV__) devError('workout-query', setsError, { action: 'deleteSessionWithExercises_sets', sessionId });
        return { error: setsError };
      }
    }

    const { error: exError } = await supabase
      .from('v2_session_exercises')
      .delete()
      .eq('session_id', sessionId);

    if (exError) {
      if (__DEV__) devError('workout-query', exError, { action: 'deleteSessionWithExercises_exercises', sessionId });
      return { error: exError };
    }

    const { error: sessionError } = await supabase
      .from('v2_workout_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (sessionError) {
      if (__DEV__) devError('workout-query', sessionError, { action: 'deleteSessionWithExercises_session', sessionId });
      return { error: sessionError };
    }

    if (__DEV__) devLog('workout-query', { action: 'deleteSessionWithExercises_ok', sessionId });
    return { error: null };
  } catch (error) {
    if (__DEV__) devError('workout-query', error, { action: 'deleteSessionWithExercises_exception', sessionId });
    return { error: error instanceof Error ? error : new Error(String(error)) };
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
 * Get all sessions for a given day (active + completed), ordered by started_at ascending.
 * Used for multi-workout-per-day: each session is one "workout" in the UI.
 */
export async function getSessionsForToday(
  userId: string,
  dayStartIso: string,
  dayEndIsoExclusive: string
): Promise<WorkoutSession[]> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSessionsForToday', userId, dayStartIso, dayEndIsoExclusive });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('id, user_id, template_id, day_name, status, started_at, completed_at')
      .eq('user_id', userId)
      .gte('started_at', dayStartIso)
      .lt('started_at', dayEndIsoExclusive)
      .order('started_at', { ascending: true });

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, dayStartIso, dayEndIsoExclusive });
      }
      return [];
    }

    return data || [];
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, dayStartIso, dayEndIsoExclusive });
    }
    return [];
  }
}

/** Explicit set rows for syncTemplateSlotToSessionsForDay (user-configured sets, incl. warmups). */
export interface ExplicitSlotSet {
  set_number: number;
  weight?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  set_type?: SetType;
}

/**
 * Sync a new template slot to existing sessions for a given day.
 * When adding to template (manual or AI), existing sessions for that day get the exercise too
 * so manual and generated flows stay unified.
 * When `explicitSets` is provided (e.g. user configured sets in the exercise detail screen),
 * those rows are inserted verbatim instead of engine-prefilled targets.
 */
export async function syncTemplateSlotToSessionsForDay(
  userId: string,
  dayName: string,
  input: {
    exerciseId?: string;
    customExerciseId?: string;
    experience?: string;
    explicitSets?: ExplicitSlotSet[];
  }
): Promise<number> {
  const { startIso, endIsoExclusive } = getDateBoundsForDayName(dayName);
  const sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
  if (sessions.length === 0) return 0;

  const exerciseId = input.exerciseId;
  const customExerciseId = input.customExerciseId;
  const experience = input.experience || 'beginner';
  const explicitSets = input.explicitSets;

  const targetsMap = new Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>();
  if (!explicitSets || explicitSets.length === 0) {
    const target = await selectExerciseTargets(
      { exerciseId, customExerciseId },
      userId,
      { experience },
      0
    );
    if (!target) return 0;
    const key = exerciseId || customExerciseId;
    if (key) targetsMap.set(key, { sets: target.sets, reps: target.reps, duration_sec: target.duration_sec, weight: target.weight });
  }

  // Single batched query for current max(sort_order) per session, replacing a per-session
  // SELECT round-trip. Supabase JS does not support GROUP BY directly; we fetch the candidate
  // rows once and tally in JS. This is cheap because each session has at most a few dozen exercises.
  const sessionIds = sessions.map((s) => s.id);
  const maxSortBySession = new Map<string, number>();
  const { data: existingRows, error: existingErr } = await supabase
    .from('v2_session_exercises')
    .select('session_id, sort_order')
    .in('session_id', sessionIds);
  if (existingErr && __DEV__) {
    devError('workout-query', existingErr, { dayName, action: 'syncTemplateSlot_existing' });
  }
  for (const row of existingRows || []) {
    const prev = maxSortBySession.get(row.session_id) ?? 0;
    if ((row.sort_order ?? 0) > prev) {
      maxSortBySession.set(row.session_id, row.sort_order ?? 0);
    }
  }

  // Insert one v2_session_exercises row per session in a single batch, then prefill in parallel.
  const insertRows = sessions.map((session) => ({
    session_id: session.id,
    exercise_id: exerciseId || null,
    custom_exercise_id: customExerciseId || null,
    sort_order: (maxSortBySession.get(session.id) ?? 0) + 1,
  }));

  const { data: insertedRows, error: insertErr } = await supabase
    .from('v2_session_exercises')
    .insert(insertRows)
    .select();
  if (insertErr || !insertedRows) {
    if (__DEV__) {
      devError('workout-query', insertErr || new Error('Failed to insert session exercises'), {
        dayName,
        action: 'syncTemplateSlot_insert',
      });
    }
    return 0;
  }

  if (explicitSets && explicitSets.length > 0) {
    const setRows = insertedRows.flatMap((se) =>
      explicitSets.map((s) => ({
        session_exercise_id: se.id,
        set_number: s.set_number,
        weight: s.weight ?? null,
        reps: s.reps ?? null,
        duration_sec: s.duration_sec ?? null,
        rest_sec: s.rest_sec ?? null,
        set_type: s.set_type ?? 'normal',
        rpe: null,
        rir: null,
        notes: null,
      }))
    );
    const { error: setsErr } = await supabase.from('v2_session_sets').insert(setRows);
    if (setsErr && __DEV__) {
      devError('workout-query', setsErr, { dayName, action: 'syncTemplateSlot_explicitSets' });
    }
  } else {
    await Promise.all(
      insertedRows.map((se) => prefillSessionSets(se.session_id, [se], targetsMap)),
    );
  }
  if (__DEV__) {
    devLog('workout-query', {
      action: 'syncTemplateSlotToSessionsForDay',
      dayName,
      sessionCount: sessions.length,
      exerciseId: exerciseId || customExerciseId,
      explicitSetCount: explicitSets?.length ?? 0,
    });
  }
  return sessions.length;
}

/**
 * Complete a workout session
 */
export async function completeWorkoutSession(sessionId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', { action: 'completeWorkoutSession', sessionId });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return false;

    const { error } = await supabase
      .from('v2_workout_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { sessionId });
      }
      return false;
    }

    // Fallback: call Edge Function directly (DB trigger may not be configured)
    if (userId) {
      await invokeUpdateMuscleFreshness(userId, sessionId);
    } else if (__DEV__) {
      devLog('workout-query', {
        action: 'invoke_update_muscle_freshness_skipped_no_user',
        sessionId,
      });
    }

    const healthPayload = consumeWorkoutHealthBuffer(sessionId);
    void writeCompletedWorkoutToHealth(sessionId, healthPayload);
    void upsertDailyWorkoutStatsForSession(userId, sessionId);
    invalidateAnalyticsCache(userId);

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { sessionId });
    }
    return false;
  }
}

/**
 * A single performed set for a backlogged (manually logged, past-dated) workout.
 * Either `reps` (rep-based) or `duration_sec` (timed) must be provided, never both,
 * to satisfy the v2_session_sets reps-XOR-duration CHECK constraint.
 */
export interface BackloggedSetInput {
  reps?: number | null;
  weight?: number | null;
  duration_sec?: number | null;
  rpe?: number | null;
  set_type?: SetType;
  rest_sec?: number | null;
}

/** A performed exercise (master XOR custom) with its performed sets. */
export interface BackloggedExerciseInput {
  exercise_id?: string;
  custom_exercise_id?: string;
  sets: BackloggedSetInput[];
}

export interface CreateBackloggedWorkoutInput {
  /** ISO timestamp for the moment the workout was performed (started/completed/performed_at). */
  performedAtIso: string;
  exercises: BackloggedExerciseInput[];
}

/**
 * A backlogged workout dated within this many days of now is recent enough that current
 * muscle-recovery/freshness should be recomputed. Older backlogs are historical-only.
 */
const RECENT_BACKLOG_DAYS = 3;

/**
 * Create a completed, past-dated ("backlogged") workout in a single batch.
 *
 * Unlike the live workout flow (createWorkoutSession -> markSetComplete -> completeWorkoutSession),
 * this writes the chosen past timestamp directly to started_at/completed_at/performed_at so the
 * workout flows into every date-derived system: PRs (DB trigger on set insert), volume/trends,
 * the calendar, streaks, and progressive-overload history (getExerciseHistory orders by performed_at DESC).
 *
 * Muscle-freshness is only recomputed when the workout is recent (within RECENT_BACKLOG_DAYS),
 * since freshness models "now" recovery. HealthKit is intentionally not written (cannot backfill).
 *
 * @returns the new session id, or null on failure (any partial writes are rolled back).
 */
export async function createBackloggedWorkout(
  userId: string,
  input: CreateBackloggedWorkoutInput
): Promise<string | null> {
  const { performedAtIso, exercises } = input;

  const performedDate = new Date(performedAtIso);
  if (isNaN(performedDate.getTime())) {
    if (__DEV__) devError('workout-query', new Error('Invalid performedAtIso'), { performedAtIso });
    return null;
  }
  if (performedDate.getTime() > Date.now()) {
    if (__DEV__) devError('workout-query', new Error('performedAtIso is in the future'), { performedAtIso });
    return null;
  }

  const exercisesWithSets = exercises.filter(
    (ex) => (ex.exercise_id || ex.custom_exercise_id) && ex.sets.length > 0
  );
  if (exercisesWithSets.length === 0) {
    if (__DEV__) devError('workout-query', new Error('No exercises with sets'), { performedAtIso });
    return null;
  }

  const dayName = WEEK_DAYS[performedDate.getDay()];

  if (__DEV__) {
    const totalSets = exercisesWithSets.reduce((sum, ex) => sum + ex.sets.length, 0);
    devLog('workout-query', {
      action: 'createBackloggedWorkout',
      userId,
      performedAtIso,
      dayName,
      exerciseCount: exercisesWithSets.length,
      totalSets,
    });
  }

  let sessionId: string | null = null;

  try {
    const { data: session, error: sessionError } = await supabase
      .from('v2_workout_sessions')
      .insert({
        user_id: userId,
        template_id: null,
        day_name: dayName,
        status: 'completed',
        started_at: performedAtIso,
        completed_at: performedAtIso,
        origin: 'manual',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      if (__DEV__) devError('workout-query', sessionError || new Error('No session returned'), { performedAtIso });
      return null;
    }
    const createdSessionId: string = session.id;
    sessionId = createdSessionId;

    let sortOrder = 0;
    for (const exercise of exercisesWithSets) {
      const { data: sessionExercise, error: exerciseError } = await supabase
        .from('v2_session_exercises')
        .insert({
          session_id: createdSessionId,
          exercise_id: exercise.exercise_id || null,
          custom_exercise_id: exercise.custom_exercise_id || null,
          sort_order: sortOrder++,
        })
        .select('id')
        .single();

      if (exerciseError || !sessionExercise) {
        if (__DEV__) devError('workout-query', exerciseError || new Error('No session exercise returned'), { sessionId: createdSessionId });
        await deleteSessionWithExercises(userId, createdSessionId);
        return null;
      }

      const setRows = exercise.sets.map((set, index) => {
        const isTimed = set.duration_sec != null && set.duration_sec > 0;
        return {
          session_exercise_id: sessionExercise.id,
          set_number: index + 1,
          reps: isTimed ? null : set.reps ?? null,
          weight: set.weight ?? null,
          duration_sec: isTimed ? set.duration_sec : null,
          rpe: set.rpe ?? null,
          rir: null,
          rest_sec: set.rest_sec ?? null,
          set_type: set.set_type ?? 'normal',
          notes: null,
          performed_at: performedAtIso,
        };
      });

      const { error: setsError } = await supabase.from('v2_session_sets').insert(setRows);
      if (setsError) {
        if (__DEV__) devError('workout-query', setsError, { sessionId: createdSessionId, sessionExerciseId: sessionExercise.id });
        await deleteSessionWithExercises(userId, createdSessionId);
        return null;
      }
    }

    // Roll up analytics and refresh the analytics cache so Progress reflects the backlog.
    // The sessions-in-range cache is invalidated by the caller (matching the app's pattern).
    void upsertDailyWorkoutStatsForSession(userId, createdSessionId);
    invalidateAnalyticsCache(userId);

    // Only recompute current muscle freshness for recent backlogs.
    const ageMs = Date.now() - performedDate.getTime();
    const isRecent = ageMs <= RECENT_BACKLOG_DAYS * MS_PER_DAY_MS;
    if (isRecent) {
      void invokeUpdateMuscleFreshness(userId, createdSessionId);
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'createBackloggedWorkout_result',
        sessionId: createdSessionId,
        freshnessRecomputed: isRecent,
      });
    }

    return createdSessionId;
  } catch (error) {
    if (__DEV__) devError('workout-query', error, { action: 'createBackloggedWorkout_exception', performedAtIso });
    if (sessionId) {
      await deleteSessionWithExercises(userId, sessionId);
    }
    return null;
  }
}

/**
 * Mark a session as abandoned. Used when the user explicitly bails out of a workout
 * mid-session. Schema already supports this status; we set completed_at to capture when
 * the abandon happened (analytics) without changing the "completed" semantics elsewhere.
 *
 * Unlike completeWorkoutSession, we do NOT trigger muscle-freshness updates because the
 * user did not finish the planned stimulus.
 */
export async function abandonWorkoutSession(sessionId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', { action: 'abandonWorkoutSession', sessionId });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return false;

    const { error } = await supabase
      .from('v2_workout_sessions')
      .update({
        status: 'abandoned',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      if (__DEV__) devError('workout-query', error, { sessionId });
      return false;
    }
    return true;
  } catch (error) {
    if (__DEV__) devError('workout-query', error, { sessionId });
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
    set_type?: SetType;
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId || !(await isSessionExerciseOwnedByUser(sessionExerciseId, userId))) {
      return null;
    }

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

export interface YearToDateStats {
  daysWorkedOut: number;
  totalVolume: number;
}

/**
 * Get year-to-date stats: distinct days worked out and total volume (weight × reps) for the current year.
 */
export async function getYearToDateStats(userId: string): Promise<YearToDateStats> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const startIso = startOfYear.toISOString();
  const endIso = endOfYear.toISOString();

  if (__DEV__) {
    devLog('workout-query', { action: 'getYearToDateStats', userId, startIso, endIso });
  }

  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('v2_workout_sessions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)
      .limit(MAX_YTD_SESSIONS);

    if (sessionsError) {
      if (__DEV__) {
        devError('workout-query', sessionsError, { userId, action: 'getYearToDateStats_sessions' });
      }
      return { daysWorkedOut: 0, totalVolume: 0 };
    }

    const sessionList = sessions || [];
    const uniqueDates = new Set<string>();
    for (const s of sessionList) {
      if (s.completed_at) {
        uniqueDates.add(getLocalDayKey(new Date(s.completed_at)));
      }
    }

    const sessionIds = sessionList.map((s) => s.id);
    if (sessionIds.length === 0) {
      return { daysWorkedOut: uniqueDates.size, totalVolume: 0 };
    }

    const { data: sessionExercises, error: seError } = await supabase
      .from('v2_session_exercises')
      .select('id')
      .in('session_id', sessionIds)
      .limit(MAX_YTD_SESSION_EXERCISES);

    if (seError) {
      if (__DEV__) {
        devError('workout-query', seError, { userId, action: 'getYearToDateStats_sessionExercises' });
      }
      return { daysWorkedOut: uniqueDates.size, totalVolume: 0 };
    }

    const seIds = (sessionExercises || []).map((se) => se.id);
    if (seIds.length === 0) {
      return { daysWorkedOut: uniqueDates.size, totalVolume: 0 };
    }

    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('weight, reps')
      .in('session_exercise_id', seIds)
      .not('performed_at', 'is', null)
      .neq('set_type', 'warmup')
      .limit(MAX_YTD_SETS);

    if (setsError) {
      if (__DEV__) {
        devError('workout-query', setsError, { userId, action: 'getYearToDateStats_sets' });
      }
      return { daysWorkedOut: uniqueDates.size, totalVolume: 0 };
    }

    let totalVolume = 0;
    for (const row of sets || []) {
      const w = typeof row.weight === 'number' ? row.weight : row.weight != null ? Number(row.weight) : null;
      const r = typeof row.reps === 'number' ? row.reps : row.reps != null ? Number(row.reps) : null;
      if (w != null && r != null && !Number.isNaN(w) && !Number.isNaN(r)) {
        totalVolume += w * r;
      }
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getYearToDateStats_result',
        userId,
        daysWorkedOut: uniqueDates.size,
        totalVolume,
      });
    }

    return { daysWorkedOut: uniqueDates.size, totalVolume };
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, action: 'getYearToDateStats_catch' });
    }
    return { daysWorkedOut: 0, totalVolume: 0 };
  }
}

/**
 * Get current streak: consecutive days with at least one completed workout, counting backwards from today.
 */
export async function getStreak(userId: string): Promise<number> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 365);
  start.setHours(0, 0, 0, 0);
  const endIso = now.toISOString();
  const startIso = start.toISOString();

  if (__DEV__) {
    devLog('workout-query', { action: 'getStreak', userId, startIso, endIso });
  }

  try {
    const { data: sessions, error } = await supabase
      .from('v2_workout_sessions')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso);

    if (error) {
      if (__DEV__) {
        devError('workout-query', error, { userId, action: 'getStreak' });
      }
      return 0;
    }

    const dateSet = new Set<string>();
    for (const s of sessions || []) {
      if (s.completed_at) {
        dateSet.add(getLocalDayKey(new Date(s.completed_at)));
      }
    }

    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    let streakCount = 0;
    while (dateSet.has(getLocalDayKey(cursor))) {
      streakCount += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    if (__DEV__) {
      devLog('workout-query', { action: 'getStreak_result', userId, streakCount });
    }
    return streakCount;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, action: 'getStreak_catch' });
    }
    return 0;
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
      .select('id, user_id, template_id, day_name, status, started_at, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)
      .order('completed_at', { ascending: false })
      .limit(MAX_SESSIONS_IN_RANGE);

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
      .select('id, user_id, template_id, day_name, status, started_at, completed_at')
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
      .not('performed_at', 'is', null) // Only completed sets
      .neq('set_type', 'warmup'); // Warmups excluded from session averages

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

export type PRType = 'weight' | 'reps_only' | 'timed';

export interface TopPR {
  set_id: string;
  session_id: string;
  session_exercise_id: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  pr_type?: PRType;
  weight?: number;
  reps?: number;
  duration_sec?: number;
  performed_at?: string;
  reps_at_pr_weight?: number[];
}

/** Format duration in seconds for PR display: "45s" or "1:30". */
export function formatPrDuration(seconds: number): string {
  return formatDurationCompact(seconds);
}

/** Format a single PR for UI: weight×reps, "N reps", or timed duration. */
export function formatPRDisplay(p: TopPR, unitsLabel: string): string {
  if (p.pr_type === 'timed' && p.duration_sec != null) {
    return formatPrDuration(p.duration_sec);
  }
  if (p.pr_type === 'reps_only' && p.reps != null) {
    return `${p.reps} reps`;
  }
  if (p.weight != null) {
    const repPart = p.reps != null ? ` × ${p.reps}` : '';
    const base = `${p.weight} ${unitsLabel}${repPart}`;
    if (
      p.pr_type !== 'timed' &&
      p.pr_type !== 'reps_only' &&
      p.reps != null &&
      p.reps > 0 &&
      p.weight > 0
    ) {
      return `${base} · theoretical 1RM ${Math.round(estimateOneRepMaxLbs(p.weight, p.reps))}`;
    }
    return base;
  }
  if (p.reps != null) return `${p.reps} reps`;
  if (p.duration_sec != null) return formatPrDuration(p.duration_sec);
  return '—';
}

export type { ExerciseHistory } from './exerciseHistory';
export { getExerciseHistory } from './exerciseHistory';

export type MuscleStressMap = Record<string, number>;

const CACHED_PR_SELECT_FULL =
  'set_id, session_id, session_exercise_id, pr_type, weight, reps, duration_sec, performed_at, exercise_id, custom_exercise_id';
const CACHED_PR_SELECT_LEGACY =
  'set_id, session_id, session_exercise_id, weight, reps, performed_at, exercise_id, custom_exercise_id';

function mapCachedPrRows(rows: any[], legacy: boolean): TopPR[] {
  return rows.map((row: any) => ({
    set_id: row.set_id,
    session_id: row.session_id,
    session_exercise_id: row.session_exercise_id,
    exercise_id: row.exercise_id ?? undefined,
    custom_exercise_id: row.custom_exercise_id ?? undefined,
    pr_type: legacy ? 'weight' : (row.pr_type ?? undefined),
    weight: row.weight != null ? Number(row.weight) : undefined,
    reps: row.reps != null ? Number(row.reps) : undefined,
    duration_sec: legacy ? undefined : (row.duration_sec != null ? Number(row.duration_sec) : undefined),
    performed_at: row.performed_at ?? undefined,
  }));
}

/**
 * Get top PRs from cache (v2_user_exercise_prs).
 * Includes weight, reps_only (bodyweight), and timed PRs. Ordered by weight DESC, reps DESC, duration_sec DESC.
 * If the table lacks pr_type/duration_sec (older migration), falls back to legacy select and treats all as weight PRs.
 */
export async function getCachedTopPRs(
  userId: string,
  limit = 3
): Promise<TopPR[]> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getCachedTopPRs', userId, limit });
  }

  try {
    const { data, error } = await supabase
      .from('v2_user_exercise_prs')
      .select(CACHED_PR_SELECT_FULL)
      .eq('user_id', userId)
      .order('weight', { ascending: false, nullsFirst: false })
      .order('reps', { ascending: false, nullsFirst: false })
      .order('duration_sec', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      const isUndefinedColumn = (error as { code?: string })?.code === '42703';
      if (isUndefinedColumn) {
        const { data: legacyData, error: legacyError } = await supabase
          .from('v2_user_exercise_prs')
          .select(CACHED_PR_SELECT_LEGACY)
          .eq('user_id', userId)
          .order('weight', { ascending: false, nullsFirst: false })
          .order('reps', { ascending: false, nullsFirst: false })
          .limit(limit);
        if (legacyError) {
          if (__DEV__) {
            devError('workout-query', legacyError, { userId, limit, action: 'getCachedTopPRs_legacy' });
          }
          return [];
        }
        return mapCachedPrRows(legacyData || [], true);
      }
      if (__DEV__) {
        devError('workout-query', error, { userId, limit, action: 'getCachedTopPRs' });
      }
      return [];
    }

    return mapCachedPrRows(data || [], false);
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { userId, limit, action: 'getCachedTopPRs_catch' });
    }
    return [];
  }
}

/**
 * Get recent exercise history for progressive overload
 * Returns safe empty object when no data to avoid engine crashes
 */
/**
 * Get unique set/rep or set/duration combinations from history
 * Returns array of unique variations (e.g., "3×10", "3×12", "4×8")
 */
export async function getUniqueSetRepCombinations(
  exerciseId: string,
  userId: string,
  mode: 'reps' | 'timed'
): Promise<{ sets: number; reps?: number; duration_sec?: number }[]> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'getUniqueSetRepCombinations',
      exerciseId,
      userId,
      mode,
    });
  }

  try {
    // Get all completed sets for this exercise
    const { data, error } = await supabase
      .from('v2_session_sets')
      .select(
        `
          session_exercise_id,
          reps,
          duration_sec,
          v2_session_exercises!inner(
            exercise_id,
            custom_exercise_id,
            session_id,
            v2_workout_sessions!inner(user_id, status, completed_at)
          )
        `
      )
      .eq('v2_session_exercises.v2_workout_sessions.user_id', userId)
      .eq('v2_session_exercises.v2_workout_sessions.status', 'completed')
      .or(`exercise_id.eq.${exerciseId},custom_exercise_id.eq.${exerciseId}`, { foreignTable: 'v2_session_exercises' })
      .not('performed_at', 'is', null)
      .neq('set_type', 'warmup') // planner variations reflect working sets only
      .limit(MAX_UNIQUE_COMBO_SETS);

    if (error || !data || data.length === 0) {
      if (__DEV__ && error) {
        devError('workout-query', error, { exerciseId, userId });
      }
      if (__DEV__) {
        devLog('workout-query', {
          action: 'getUniqueSetRepCombinations_noData',
          exerciseId,
          dataLength: data?.length ?? 0,
          error: error?.message,
        });
      }
      return [];
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getUniqueSetRepCombinations_rawData',
        exerciseId,
        totalSets: data.length,
        sampleData: data.slice(0, 3),
      });
    }

    // Group by session_exercise_id to count sets per exercise instance
    const sessionExerciseMap = new Map<string, { reps?: number; duration_sec?: number }[]>();
    
    for (const set of data) {
      const sessionExerciseId = set.session_exercise_id;
      if (!sessionExerciseId) continue;
      
      const key = sessionExerciseId;
      
      if (!sessionExerciseMap.has(key)) {
        sessionExerciseMap.set(key, []);
      }
      
      sessionExerciseMap.get(key)!.push({
        reps: set.reps ?? undefined,
        duration_sec: set.duration_sec ?? undefined,
      });
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getUniqueSetRepCombinations_grouped',
        exerciseId,
        sessionExerciseCount: sessionExerciseMap.size,
      });
    }

    // Find unique combinations: per (set_count, rep) or (set_count, duration) so e.g. 8,8,9 → 2×8 and 1×9
    const uniqueCombos = new Map<string, { sets: number; reps?: number; duration_sec?: number }>();

    for (const [, sets] of sessionExerciseMap) {
      if (mode === 'reps') {
        const byRep = new Map<number, number>();
        for (const s of sets) {
          const r = s.reps;
          if (r != null) {
            byRep.set(r, (byRep.get(r) ?? 0) + 1);
          }
        }
        for (const [repValue, count] of byRep) {
          const key = `${count}x${repValue}`;
          uniqueCombos.set(key, { sets: count, reps: repValue });
        }
      } else {
        const byDuration = new Map<number, number>();
        for (const s of sets) {
          const d = s.duration_sec;
          if (d != null) {
            byDuration.set(d, (byDuration.get(d) ?? 0) + 1);
          }
        }
        for (const [durationValue, count] of byDuration) {
          const key = `${count}x${durationValue}s`;
          uniqueCombos.set(key, { sets: count, duration_sec: durationValue });
        }
      }
    }

    const result = Array.from(uniqueCombos.values());
    
    if (__DEV__) {
      devLog('workout-query', {
        action: 'getUniqueSetRepCombinations_result',
        exerciseId,
        uniqueCount: result.length,
        combinations: result,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { exerciseId, userId });
    }
    return [];
  }
}

export interface PreviousPerformance {
  performed_at: string;
  sets: {
    set_number: number;
    weight?: number;
    reps?: number;
    duration_sec?: number;
    set_type?: SetType;
  }[];
}

/**
 * Get the user's most recent performance of an exercise: all completed working
 * sets from the latest session in which the exercise was performed. Used to
 * show "previous" values inline during set execution/logging (Hevy-style).
 */
export async function getPreviousExercisePerformance(
  exerciseId: string,
  userId: string
): Promise<PreviousPerformance | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getPreviousExercisePerformance', exerciseId, userId });
  }

  try {
    if (exerciseId) {
      const { data: stretchRow } = await supabase
        .from('v2_exercises')
        .select('is_stretch')
        .eq('id', exerciseId)
        .maybeSingle();
      if (stretchRow?.is_stretch) {
        return null;
      }
    }

    // Pull the most recent completed sets for this exercise (any session), newest
    // first, then keep only the sets belonging to the newest session exercise.
    const { data, error } = await supabase
      .from('v2_session_sets')
      .select(
        `
          session_exercise_id,
          set_number,
          weight,
          reps,
          duration_sec,
          set_type,
          performed_at,
          v2_session_exercises!inner(
            exercise_id,
            custom_exercise_id,
            v2_workout_sessions!inner(user_id, status)
          )
        `
      )
      .eq('v2_session_exercises.v2_workout_sessions.user_id', userId)
      .eq('v2_session_exercises.v2_workout_sessions.status', 'completed')
      .or(`exercise_id.eq.${exerciseId},custom_exercise_id.eq.${exerciseId}`, { foreignTable: 'v2_session_exercises' })
      .not('performed_at', 'is', null)
      .neq('set_type', 'warmup')
      .order('performed_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      if (__DEV__ && error) {
        devError('workout-query', error, { exerciseId, userId, action: 'getPreviousExercisePerformance' });
      }
      return null;
    }

    const latestSessionExerciseId = data[0].session_exercise_id;
    const sets = data
      .filter((s) => s.session_exercise_id === latestSessionExerciseId)
      .map((s) => ({
        set_number: s.set_number,
        weight: s.weight ?? undefined,
        reps: s.reps ?? undefined,
        duration_sec: s.duration_sec ?? undefined,
        set_type: (s.set_type ?? undefined) as SetType | undefined,
      }))
      .sort((a, b) => a.set_number - b.set_number);

    if (__DEV__) {
      devLog('workout-query', {
        action: 'getPreviousExercisePerformance_result',
        exerciseId,
        setCount: sets.length,
        performedAt: data[0].performed_at,
      });
    }

    return { performed_at: data[0].performed_at as string, sets };
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { exerciseId, userId, action: 'getPreviousExercisePerformance' });
    }
    return null;
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
      .in('session_exercise_id', sessionExerciseIds)
      .neq('set_type', 'warmup');

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
      is_stretch?: boolean;
    };

    const [masterMetaResult, customMetaResult] = await Promise.all([
      masterIds.size
        ? supabase
            .from('v2_exercises')
            .select('id, primary_muscles, implicit_hits, is_stretch')
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

      if (meta.is_stretch) {
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
  sessionExercises: {
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
  }[],
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
  values: {
    reps?: number;
    weight?: number;
    duration_sec?: number;
    rpe?: number;
    rir?: number;
    set_type?: SetType;
  }
): Promise<boolean> {
  if (__DEV__) {
    devLog('workout-query', {
      action: 'markSetComplete',
      setId,
      hasReps: values.reps !== undefined,
      hasDuration: values.duration_sec !== undefined,
      hasRpe: values.rpe !== undefined,
      hasRir: values.rir !== undefined,
    });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId || !(await isSessionSetOwnedByUser(setId, userId))) {
      return false;
    }

    const update: {
      reps?: number;
      weight?: number;
      duration_sec?: number;
      rpe?: number | null;
      rir?: number | null;
      set_type?: SetType;
      performed_at: string;
    } = {
      performed_at: new Date().toISOString(),
    };
    if (values.reps !== undefined) update.reps = values.reps;
    if (values.weight !== undefined) update.weight = values.weight;
    if (values.duration_sec !== undefined) update.duration_sec = values.duration_sec;
    if (values.set_type !== undefined) update.set_type = values.set_type;
    if (values.rir != null) {
      update.rir = values.rir;
      update.rpe = null;
    } else if (values.rpe != null) {
      update.rpe = values.rpe;
      update.rir = null;
    }

    const { error } = await supabase
      .from('v2_session_sets')
      .update(update)
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

export type InsertWarmupSetsResult =
  | { ok: true; warmupCount: number }
  | { ok: false; reason: 'unauthorized' | 'exists' | 'no_weight' | 'error' };

export async function insertWarmupSets(
  sessionExerciseId: string,
  workingWeight: number,
  useImperial: boolean,
): Promise<InsertWarmupSetsResult> {
  const ladder = buildWarmupLadder(workingWeight, useImperial);
  if (ladder.length === 0) {
    return { ok: false, reason: 'no_weight' };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId || !(await isSessionExerciseOwnedByUser(sessionExerciseId, userId))) {
      return { ok: false, reason: 'unauthorized' };
    }

    const { data: existing, error: existingError } = await supabase
      .from('v2_session_sets')
      .select('id, set_number, set_type')
      .eq('session_exercise_id', sessionExerciseId)
      .order('set_number', { ascending: true });

    if (existingError) {
      if (__DEV__) {
        devError('workout-query', existingError, { action: 'insertWarmupSets_load', sessionExerciseId });
      }
      return { ok: false, reason: 'error' };
    }

    if ((existing ?? []).some((set) => set.set_type === 'warmup')) {
      return { ok: false, reason: 'exists' };
    }

    const shift = ladder.length;
    const toShift = [...(existing ?? [])].sort((a, b) => b.set_number - a.set_number);
    for (const set of toShift) {
      const { error: shiftError } = await supabase
        .from('v2_session_sets')
        .update({ set_number: set.set_number + shift })
        .eq('id', set.id);
      if (shiftError) {
        if (__DEV__) {
          devError('workout-query', shiftError, { action: 'insertWarmupSets_shift', sessionExerciseId });
        }
        return { ok: false, reason: 'error' };
      }
    }

    const { error: insertError } = await supabase.from('v2_session_sets').insert(
      ladder.map((step, index) => ({
        session_exercise_id: sessionExerciseId,
        set_number: index + 1,
        weight: step.weight,
        reps: step.reps,
        set_type: 'warmup' as SetType,
        rpe: null,
        rir: null,
        performed_at: null,
      })),
    );

    if (insertError) {
      if (__DEV__) {
        devError('workout-query', insertError, { action: 'insertWarmupSets_insert', sessionExerciseId });
      }
      const toUnshift = [...toShift].sort((a, b) => a.set_number - b.set_number);
      for (const set of toUnshift) {
        const { error: rollbackError } = await supabase
          .from('v2_session_sets')
          .update({ set_number: set.set_number })
          .eq('id', set.id);
        if (rollbackError && __DEV__) {
          devError('workout-query', rollbackError, {
            action: 'insertWarmupSets_rollback',
            sessionExerciseId,
            setId: set.id,
          });
        }
      }
      return { ok: false, reason: 'error' };
    }

    if (__DEV__) {
      devLog('workout-query', {
        action: 'insertWarmupSets',
        sessionExerciseId,
        workingWeight,
        warmupCount: ladder.length,
      });
    }

    return { ok: true, warmupCount: ladder.length };
  } catch (error) {
    if (__DEV__) {
      devError('workout-query', error, { action: 'insertWarmupSets', sessionExerciseId });
    }
    return { ok: false, reason: 'error' };
  }
}

/**
 * Get session with exercises and sets
 * Used by active workout screen
 * Fetches notes from template slots if session was created from a template
 */
export async function getSessionWithSets(sessionId: string): Promise<{
  session: WorkoutSession | null;
  exercises: {
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
    sort_order: number;
    superset_group?: number | null;
    rest_sec?: number | null;
    notes?: string;
    sets: SessionSet[];
  }[];
} | null> {
  if (__DEV__) {
    devLog('workout-query', { action: 'getSessionWithSets', sessionId });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return null;

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('v2_workout_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
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
      .select('id, exercise_id, custom_exercise_id, sort_order, superset_group, rest_sec')
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
        superset_group: se.superset_group ?? null,
        rest_sec: se.rest_sec ?? null,
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
