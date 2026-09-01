import { listMergedExercisesCached } from '../../cache/exerciseCache';
import { devError, devLog } from '../../utils/logger';
import type { WorkoutExportRow } from '../../workout/workoutExport';
import { supabase } from '../client';

const SESSION_PAGE = 200;
const SET_PAGE = 1000;

export async function fetchCompletedWorkoutExport(userId: string): Promise<WorkoutExportRow[]> {
  const sessions: {
    id: string;
    day_name: string | null;
    started_at: string;
    completed_at: string | null;
  }[] = [];

  for (let from = 0; ; from += SESSION_PAGE) {
    const { data, error } = await supabase
      .from('v2_workout_sessions')
      .select('id, day_name, started_at, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true })
      .range(from, from + SESSION_PAGE - 1);
    if (error) {
      if (__DEV__) devError('workout-export', error, { action: 'sessions' });
      throw error;
    }
    if (!data?.length) break;
    sessions.push(...data);
    if (data.length < SESSION_PAGE) break;
  }

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const exercises: {
    id: string;
    session_id: string;
    exercise_id: string | null;
    custom_exercise_id: string | null;
  }[] = [];

  for (let i = 0; i < sessionIds.length; i += SESSION_PAGE) {
    const chunk = sessionIds.slice(i, i + SESSION_PAGE);
    const { data, error } = await supabase
      .from('v2_session_exercises')
      .select('id, session_id, exercise_id, custom_exercise_id')
      .in('session_id', chunk);
    if (error) {
      if (__DEV__) devError('workout-export', error, { action: 'exercises' });
      throw error;
    }
    if (data) exercises.push(...data);
  }

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const nameIds = [
    ...new Set(
      exercises.flatMap((e) => [e.exercise_id, e.custom_exercise_id].filter(Boolean) as string[]),
    ),
  ];
  const merged = nameIds.length > 0 ? await listMergedExercisesCached(userId, nameIds) : [];
  const nameById = new Map(merged.map((m) => [m.id, m.name]));

  const exerciseIds = exercises.map((e) => e.id);
  const sets: {
    session_exercise_id: string;
    set_number: number;
    weight: number | null;
    reps: number | null;
    duration_sec: number | null;
    notes: string | null;
    rpe: number | null;
    rir: number | null;
    set_type: string | null;
  }[] = [];

  for (let i = 0; i < exerciseIds.length; i += SET_PAGE) {
    const chunk = exerciseIds.slice(i, i + SET_PAGE);
    const { data, error } = await supabase
      .from('v2_session_sets')
      .select('session_exercise_id, set_number, weight, reps, duration_sec, notes, rpe, rir, set_type')
      .in('session_exercise_id', chunk)
      .order('set_number', { ascending: true });
    if (error) {
      if (__DEV__) devError('workout-export', error, { action: 'sets' });
      throw error;
    }
    if (data) sets.push(...data);
  }

  const rows: WorkoutExportRow[] = [];
  for (const set of sets) {
    const exercise = exerciseById.get(set.session_exercise_id);
    if (!exercise) continue;
    const session = sessionById.get(exercise.session_id);
    if (!session) continue;
    const durationMin =
      session.started_at && session.completed_at
        ? String(
            Math.max(
              0,
              Math.round(
                (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) /
                  60000,
              ),
            ),
          )
        : '';
    const exerciseKey = exercise.exercise_id || exercise.custom_exercise_id || '';
    rows.push({
      date: session.completed_at ? session.completed_at.slice(0, 10) : '',
      workoutName: session.day_name || 'Workout',
      durationMin,
      exerciseName: nameById.get(exerciseKey) || 'Exercise',
      setOrder: set.set_number,
      weight: set.weight != null ? String(set.weight) : '',
      reps: set.reps != null ? String(set.reps) : '',
      seconds: set.duration_sec != null ? String(set.duration_sec) : '',
      notes: set.notes ?? '',
      rpe: set.rpe != null ? String(set.rpe) : '',
      rir: set.rir != null ? String(set.rir) : '',
      setType: set.set_type ?? 'normal',
    });
  }

  if (__DEV__) {
    const dates = rows.map((r) => r.date).filter(Boolean);
    devLog('workout-export', {
      action: 'fetch_done',
      sessionCount: sessions.length,
      setCount: rows.length,
      dateSpan: dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null,
    });
  }

  return rows;
}
