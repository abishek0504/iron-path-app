import { supabase } from '../supabase/client';
import { devError } from '../utils/logger';

export async function listSessionIdsWithPerformedWork(sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();

  const { data: exercises, error: exerciseError } = await supabase
    .from('v2_session_exercises')
    .select('id, session_id')
    .in('session_id', sessionIds);

  if (exerciseError) {
    if (__DEV__) {
      devError('coach-week', exerciseError, { action: 'listSessionIdsWithPerformedWork_exercises' });
    }
    return new Set();
  }

  const exerciseIds = (exercises ?? []).map((row) => row.id);
  if (exerciseIds.length === 0) return new Set();

  const { data: performed, error: setError } = await supabase
    .from('v2_session_sets')
    .select('session_exercise_id')
    .in('session_exercise_id', exerciseIds)
    .not('performed_at', 'is', null);

  if (setError) {
    if (__DEV__) {
      devError('coach-week', setError, { action: 'listSessionIdsWithPerformedWork_sets' });
    }
    return new Set();
  }

  const exerciseToSession = new Map((exercises ?? []).map((row) => [row.id, row.session_id] as const));
  const sessionIdsWithWork = new Set<string>();
  for (const row of performed ?? []) {
    const sessionId = exerciseToSession.get(row.session_exercise_id);
    if (sessionId) sessionIdsWithWork.add(sessionId);
  }
  return sessionIdsWithWork;
}
