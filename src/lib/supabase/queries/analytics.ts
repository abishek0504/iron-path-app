/**
 * Workout analytics queries — fetches performed truth and delegates aggregation
 * to src/lib/analytics pure functions.
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import type { TrendGranularity, TrendPoint, ExerciseMeta, AnalyticsSetRow } from '../../analytics/types';
import {
  buildVolumeTrend,
  sumVolumeLbs,
  muscleGroupVolumeSplit,
} from '../../analytics/volume';
import {
  summarizeIntensity,
  buildAvgRpeTrend,
  buildSessionCountTrend,
} from '../../analytics/intensity';
import { summarizeDuration } from '../../analytics/duration';
import { totalTrainingLoad, buildTrainingLoadTrend } from '../../analytics/load';
import { bestSetForProgression, type PRTimelineEntry } from '../../analytics/progression';
import { toLocalDateKey } from '../../analytics/dateBuckets';
import type { TopPR } from './workouts';

const MAX_SESSIONS_IN_RANGE = 500;
const MAX_SETS_FETCH = 50000;

export type SessionSummary = {
  sessionId: string;
  completedAt: string;
  startedAt: string;
  dayName?: string | null;
  volumeLbs: number;
  workingSets: number;
  avgRpe: number | null;
  wallClockSec: number;
  activeSec: number;
  trainingLoad: number;
  muscleGroups: string[];
};

export type ExerciseRankEntry = {
  exerciseKey: string;
  exerciseId?: string;
  customExerciseId?: string;
  name: string;
  sessionCount: number;
  volumeLbs: number;
  lastPerformedAt: string;
};

export type ExerciseTrendPoint = {
  sessionId: string;
  completedAt: string;
  volumeLbs: number;
  bestWeightLbs: number | null;
  bestReps: number | null;
  estimated1RmLbs: number | null;
  avgRpe: number | null;
};

type RawSetRow = {
  weight: number | null;
  reps: number | null;
  duration_sec: number | null;
  rpe: number | null;
  rir: number | null;
  set_type: string | null;
  rest_sec: number | null;
  performed_at: string | null;
  session_exercise_id: string;
  session_exercises: {
    id: string;
    exercise_id: string | null;
    custom_exercise_id: string | null;
    session_id: string;
  };
};

async function fetchExerciseMeta(
  masterIds: Set<string>,
  customIds: Set<string>,
): Promise<Map<string, ExerciseMeta>> {
  const map = new Map<string, ExerciseMeta>();

  const [masterRes, customRes] = await Promise.all([
    masterIds.size
      ? supabase
          .from('v2_exercises')
          .select('id, name, primary_muscles, implicit_hits, is_stretch')
          .in('id', Array.from(masterIds))
      : Promise.resolve({ data: [] as ExerciseMeta[], error: null }),
    customIds.size
      ? supabase
          .from('v2_user_custom_exercises')
          .select('id, name, primary_muscles, implicit_hits')
          .in('id', Array.from(customIds))
      : Promise.resolve({ data: [] as ExerciseMeta[], error: null }),
  ]);

  for (const ex of masterRes.data ?? []) {
    map.set(ex.id, ex as ExerciseMeta);
  }
  for (const ex of customRes.data ?? []) {
    map.set(ex.id, { ...ex, is_stretch: false } as ExerciseMeta);
  }
  return map;
}

function mapRawSet(row: RawSetRow): AnalyticsSetRow {
  const se = row.session_exercises;
  return {
    weight: row.weight,
    reps: row.reps,
    duration_sec: row.duration_sec,
    rpe: row.rpe,
    rir: row.rir,
    set_type: row.set_type,
    rest_sec: row.rest_sec,
    performed_at: row.performed_at,
    session_exercise_id: row.session_exercise_id,
    exercise_id: se?.exercise_id,
    custom_exercise_id: se?.custom_exercise_id,
    session_id: se?.session_id,
  };
}

async function fetchSetsForSessions(sessionIds: string[]): Promise<RawSetRow[]> {
  if (sessionIds.length === 0) return [];

  const { data: sessionExercises, error: seError } = await supabase
    .from('v2_session_exercises')
    .select('id')
    .in('session_id', sessionIds);

  if (seError || !sessionExercises?.length) return [];

  const seIds = sessionExercises.map((se) => se.id);
  const { data: sets, error: setsError } = await supabase
    .from('v2_session_sets')
    .select(
      `
        weight, reps, duration_sec, rpe, rir, set_type, rest_sec, performed_at,
        session_exercise_id,
        session_exercises!inner(id, exercise_id, custom_exercise_id, session_id)
      `,
    )
    .in('session_exercise_id', seIds)
    .not('performed_at', 'is', null)
    .limit(MAX_SETS_FETCH);

  if (setsError) return [];
  return (sets ?? []) as unknown as RawSetRow[];
}

export async function getSessionSummariesInRange(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<SessionSummary[]> {
  if (__DEV__) {
    devLog('analytics', { action: 'getSessionSummariesInRange', userId, startIso, endIso });
  }

  try {
    const { data: sessions, error } = await supabase
      .from('v2_workout_sessions')
      .select('id, started_at, completed_at, day_name')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)
      .order('completed_at', { ascending: true })
      .limit(MAX_SESSIONS_IN_RANGE);

    if (error || !sessions?.length) return [];

    const sessionIds = sessions.map((s) => s.id);
    const rawSets = await fetchSetsForSessions(sessionIds);

    const masterIds = new Set<string>();
    const customIds = new Set<string>();
    for (const row of rawSets) {
      const se = row.session_exercises;
      if (se?.exercise_id) masterIds.add(se.exercise_id);
      if (se?.custom_exercise_id) customIds.add(se.custom_exercise_id);
    }
    const metaMap = await fetchExerciseMeta(masterIds, customIds);

    const setsBySession = new Map<string, AnalyticsSetRow[]>();
    for (const row of rawSets) {
      const sid = row.session_exercises?.session_id;
      if (!sid) continue;
      const list = setsBySession.get(sid) ?? [];
      list.push(mapRawSet(row));
      setsBySession.set(sid, list);
    }

    return sessions.map((session) => {
      const sets = setsBySession.get(session.id) ?? [];
      const intensity = summarizeIntensity(sets);
      const duration = summarizeDuration(
        session.started_at,
        session.completed_at!,
        sets,
      );
      const muscleSplit = muscleGroupVolumeSplit(sets, metaMap);
      return {
        sessionId: session.id,
        completedAt: session.completed_at!,
        startedAt: session.started_at,
        dayName: session.day_name,
        volumeLbs: sumVolumeLbs(sets),
        workingSets: intensity.workingSetCount,
        avgRpe: intensity.avgRpe,
        wallClockSec: duration.wallClockSec,
        activeSec: duration.activeSec,
        trainingLoad: totalTrainingLoad(sets, metaMap),
        muscleGroups: muscleSplit.slice(0, 6).map((m) => m.muscle),
      };
    });
  } catch (err) {
    if (__DEV__) devError('analytics', err, { action: 'getSessionSummariesInRange' });
    return [];
  }
}

export type AnalyticsTrendsBundle = {
  volumeTrend: TrendPoint[];
  sessionCountTrend: TrendPoint[];
  avgRpeTrend: TrendPoint[];
  trainingLoadTrend: TrendPoint[];
  summaries: SessionSummary[];
};

export async function getAnalyticsTrends(
  userId: string,
  startIso: string,
  endIso: string,
  granularity: TrendGranularity,
): Promise<AnalyticsTrendsBundle> {
  const summaries = await getSessionSummariesInRange(userId, startIso, endIso);

  if (__DEV__) {
    devLog('analytics', {
      action: 'getAnalyticsTrends',
      sessionCount: summaries.length,
      granularity,
      startIso,
      endIso,
    });
  }

  return {
    summaries,
    volumeTrend: buildVolumeTrend(
      summaries.map((s) => ({ completedAt: s.completedAt, volumeLbs: s.volumeLbs })),
      granularity,
    ),
    sessionCountTrend: buildSessionCountTrend(
      summaries.map((s) => ({ completedAt: s.completedAt })),
      granularity,
    ),
    avgRpeTrend: buildAvgRpeTrend(
      summaries.map((s) => ({ completedAt: s.completedAt, avgRpe: s.avgRpe })),
      granularity,
    ),
    trainingLoadTrend: buildTrainingLoadTrend(
      summaries.map((s) => ({ completedAt: s.completedAt, load: s.trainingLoad })),
      granularity,
    ),
  };
}

export async function getVolumeTrend(
  userId: string,
  startIso: string,
  endIso: string,
  granularity: TrendGranularity,
): Promise<TrendPoint[]> {
  const bundle = await getAnalyticsTrends(userId, startIso, endIso, granularity);
  return bundle.volumeTrend;
}

export async function getMuscleGroupBreakdown(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<{ muscle: string; volumeLbs: number }[]> {
  const summaries = await getSessionSummariesInRange(userId, startIso, endIso);
  const totals = new Map<string, number>();
  for (const s of summaries) {
    for (const m of s.muscleGroups) {
      totals.set(m, (totals.get(m) ?? 0) + s.volumeLbs / Math.max(s.muscleGroups.length, 1));
    }
  }
  return Array.from(totals.entries())
    .map(([muscle, volumeLbs]) => ({ muscle, volumeLbs }))
    .sort((a, b) => b.volumeLbs - a.volumeLbs);
}

export async function getExerciseRankings(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<ExerciseRankEntry[]> {
  try {
    const { data: sessions, error } = await supabase
      .from('v2_workout_sessions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)
      .limit(MAX_SESSIONS_IN_RANGE);

    if (error || !sessions?.length) return [];

    const sessionIds = sessions.map((s) => s.id);
    const completedBySession = new Map(sessions.map((s) => [s.id, s.completed_at!]));

    const { data: sessionExercises, error: seError } = await supabase
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id, session_id')
      .in('session_id', sessionIds);

    if (seError || !sessionExercises?.length) return [];

    const seIds = sessionExercises.map((se) => se.id);
    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('weight, reps, set_type, performed_at, session_exercise_id')
      .in('session_exercise_id', seIds)
      .not('performed_at', 'is', null)
      .neq('set_type', 'warmup');

    if (setsError) return [];

    const seMap = new Map(sessionExercises.map((se) => [se.id, se]));
    const agg = new Map<
      string,
      { exerciseId?: string; customExerciseId?: string; volumeLbs: number; sessions: Set<string>; lastAt: string }
    >();

    for (const set of sets ?? []) {
      const se = seMap.get(set.session_exercise_id);
      if (!se) continue;
      const key = se.exercise_id ?? se.custom_exercise_id;
      if (!key) continue;
      const w = set.weight ?? 0;
      const r = set.reps ?? 0;
      const vol = w > 0 && r > 0 ? w * r : 0;
      const completedAt = completedBySession.get(se.session_id) ?? set.performed_at!;
      const prev = agg.get(key) ?? {
        exerciseId: se.exercise_id ?? undefined,
        customExerciseId: se.custom_exercise_id ?? undefined,
        volumeLbs: 0,
        sessions: new Set<string>(),
        lastAt: completedAt,
      };
      prev.volumeLbs += vol;
      prev.sessions.add(se.session_id);
      if (completedAt > prev.lastAt) prev.lastAt = completedAt;
      agg.set(key, prev);
    }

    const masterIds = new Set<string>();
    const customIds = new Set<string>();
    for (const [, v] of agg) {
      if (v.exerciseId) masterIds.add(v.exerciseId);
      if (v.customExerciseId) customIds.add(v.customExerciseId);
    }
    const metaMap = await fetchExerciseMeta(masterIds, customIds);

    return Array.from(agg.entries())
      .map(([exerciseKey, v]) => ({
        exerciseKey,
        exerciseId: v.exerciseId,
        customExerciseId: v.customExerciseId,
        name: metaMap.get(exerciseKey)?.name ?? 'Exercise',
        sessionCount: v.sessions.size,
        volumeLbs: v.volumeLbs,
        lastPerformedAt: v.lastAt,
      }))
      .sort((a, b) => b.volumeLbs - a.volumeLbs);
  } catch (err) {
    if (__DEV__) devError('analytics', err, { action: 'getExerciseRankings' });
    return [];
  }
}

export async function getExerciseTrend(
  userId: string,
  exerciseKey: string,
  startIso: string,
  endIso: string,
): Promise<ExerciseTrendPoint[]> {
  try {
    const { data: sessions, error } = await supabase
      .from('v2_workout_sessions')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)
      .order('completed_at', { ascending: true })
      .limit(MAX_SESSIONS_IN_RANGE);

    if (error || !sessions?.length) return [];

    const sessionIds = sessions.map((s) => s.id);
    const { data: sessionExercises, error: seError } = await supabase
      .from('v2_session_exercises')
      .select('id, session_id')
      .in('session_id', sessionIds)
      .or(`exercise_id.eq.${exerciseKey},custom_exercise_id.eq.${exerciseKey}`);

    if (seError || !sessionExercises?.length) return [];

    const seIds = sessionExercises.map((se) => se.id);
    const seToSession = new Map(sessionExercises.map((se) => [se.id, se.session_id]));
    const completedBySession = new Map(sessions.map((s) => [s.id, s.completed_at!]));

    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('weight, reps, rpe, rir, set_type, performed_at, session_exercise_id')
      .in('session_exercise_id', seIds)
      .not('performed_at', 'is', null);

    if (setsError) return [];

    const bySession = new Map<string, typeof sets>();
    for (const set of sets ?? []) {
      const sid = seToSession.get(set.session_exercise_id);
      if (!sid) continue;
      const list = bySession.get(sid) ?? [];
      list.push(set);
      bySession.set(sid, list);
    }

    const points: ExerciseTrendPoint[] = [];
    for (const [sessionId, sessionSets] of bySession) {
      const completedAt = completedBySession.get(sessionId);
      if (!completedAt) continue;

      let volumeLbs = 0;
      for (const s of sessionSets) {
        if (s.set_type === 'warmup') continue;
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        if (w > 0 && r > 0) volumeLbs += w * r;
      }

      const best = bestSetForProgression(sessionSets);
      const rpes = sessionSets
        .filter((s) => s.set_type !== 'warmup' && s.rpe != null)
        .map((s) => s.rpe as number);
      const avgRpe = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

      points.push({
        sessionId,
        completedAt,
        volumeLbs,
        bestWeightLbs: best?.weightLbs ?? null,
        bestReps: best?.reps ?? null,
        estimated1RmLbs: best?.e1rm ?? null,
        avgRpe,
      });
    }

    return points.sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    );
  } catch (err) {
    if (__DEV__) devError('analytics', err, { action: 'getExerciseTrend' });
    return [];
  }
}

export async function getPRTimeline(
  userId: string,
  exerciseKey?: string,
  limit = 50,
): Promise<PRTimelineEntry[]> {
  try {
    let query = supabase
      .from('v2_user_exercise_prs')
      .select(
        'exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, performed_at, session_id',
      )
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (exerciseKey) {
      query = query.or(`exercise_id.eq.${exerciseKey},custom_exercise_id.eq.${exerciseKey}`);
    }

    const { data, error } = await query;
    if (error || !data?.length) return [];

    const masterIds = new Set(data.map((r) => r.exercise_id).filter(Boolean) as string[]);
    const customIds = new Set(data.map((r) => r.custom_exercise_id).filter(Boolean) as string[]);
    const metaMap = await fetchExerciseMeta(masterIds, customIds);

    return data.map((row) => {
      const key = row.exercise_id ?? row.custom_exercise_id ?? '';
      const prType = (row.pr_type ?? 'weight') as TopPR['pr_type'];
      let value = 0;
      if (prType === 'weight') value = row.weight ?? 0;
      else if (prType === 'reps_only') value = row.reps ?? 0;
      else value = row.duration_sec ?? 0;

      return {
        exerciseKey: key,
        exerciseName: metaMap.get(key)?.name,
        prType: prType ?? 'weight',
        value,
        performedAt: row.performed_at ?? '',
        sessionId: row.session_id ?? '',
      };
    });
  } catch (err) {
    if (__DEV__) devError('analytics', err, { action: 'getPRTimeline' });
    return [];
  }
}

export type SessionHealthMetrics = {
  activeEnergyKcal: number | null;
  energySource: string | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  activeDurationSec: number | null;
  totalVolumeKg: number | null;
};

export async function getSessionHealthMetrics(
  sessionId: string,
): Promise<SessionHealthMetrics | null> {
  try {
    const { data, error } = await supabase
      .from('v2_session_health_metrics')
      .select(
        'active_energy_kcal, energy_source, avg_heart_rate_bpm, max_heart_rate_bpm, active_duration_sec, total_volume_kg',
      )
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      activeEnergyKcal: data.active_energy_kcal,
      energySource: data.energy_source,
      avgHeartRateBpm: data.avg_heart_rate_bpm,
      maxHeartRateBpm: data.max_heart_rate_bpm,
      activeDurationSec: data.active_duration_sec,
      totalVolumeKg: data.total_volume_kg,
    };
  } catch {
    return null;
  }
}

/** Upsert daily rollup after session completion (best-effort). */
export async function upsertDailyWorkoutStatsForSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  try {
    const { data: session } = await supabase
      .from('v2_workout_sessions')
      .select('completed_at')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!session?.completed_at) return;

    const [summary] = await getSessionSummariesInRange(
      userId,
      session.completed_at,
      session.completed_at,
    );
    if (!summary) return;

    const dateKey = toLocalDateKey(session.completed_at);

    const { data: existing } = await supabase
      .from('v2_daily_workout_stats')
      .select('session_count, total_volume_lbs, total_sets, avg_rpe, active_duration_sec, training_load')
      .eq('user_id', userId)
      .eq('date', dateKey)
      .maybeSingle();

    const prevCount = existing?.session_count ?? 0;
    const prevVol = existing?.total_volume_lbs ?? 0;
    const prevSets = existing?.total_sets ?? 0;
    const prevActive = existing?.active_duration_sec ?? 0;
    const prevLoad = existing?.training_load ?? 0;
    const prevRpe = existing?.avg_rpe;

    let newAvgRpe = summary.avgRpe;
    if (prevRpe != null && summary.avgRpe != null && prevCount > 0) {
      newAvgRpe = (prevRpe * prevCount + summary.avgRpe) / (prevCount + 1);
    } else if (prevRpe != null && summary.avgRpe == null) {
      newAvgRpe = prevRpe;
    }

    await supabase.from('v2_daily_workout_stats').upsert({
      user_id: userId,
      date: dateKey,
      session_count: prevCount + 1,
      total_volume_lbs: prevVol + summary.volumeLbs,
      total_sets: prevSets + summary.workingSets,
      avg_rpe: newAvgRpe,
      active_duration_sec: prevActive + summary.activeSec,
      training_load: prevLoad + summary.trainingLoad,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (__DEV__) devError('analytics', err, { action: 'upsertDailyWorkoutStatsForSession', sessionId });
  }
}

export async function getTrainingLoadTrend(
  userId: string,
  startIso: string,
  endIso: string,
  granularity: TrendGranularity,
): Promise<TrendPoint[]> {
  const bundle = await getAnalyticsTrends(userId, startIso, endIso, granularity);
  return bundle.trainingLoadTrend;
}
