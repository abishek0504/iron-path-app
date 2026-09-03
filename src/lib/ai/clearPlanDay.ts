/**
 * Clears a plan day so AI generation replaces the existing workout
 * instead of appending another copy of the same lifts.
 */

import { supabase } from '../supabase/client';
import { getSessionsForToday } from '../supabase/queries/workouts';
import { getDateBoundsForDayName } from '../utils/date';
import { devError } from '../utils/logger';

export async function clearPlanDayForGeneration(params: {
  userId: string;
  dayId: string;
  dayName: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId, dayId, dayName } = params;

  const { error: slotErr } = await supabase
    .from('v2_template_slots')
    .delete()
    .eq('day_id', dayId);
  if (slotErr) {
    if (__DEV__) {
      devError('planner-ai', slotErr, { action: 'clearPlanDay_slots', dayId });
    }
    return { ok: false, message: 'Failed to replace the existing plan' };
  }

  const { startIso, endIsoExclusive } = getDateBoundsForDayName(dayName);
  const daySessions = await getSessionsForToday(userId, startIso, endIsoExclusive);

  for (const session of daySessions) {
    if (session.status !== 'active') continue;
    const { data: sessionExercises } = await supabase
      .from('v2_session_exercises')
      .select('id')
      .eq('session_id', session.id);
    const exerciseIds = (sessionExercises || []).map((row) => row.id);
    if (exerciseIds.length === 0) continue;

    const { data: performedSets } = await supabase
      .from('v2_session_sets')
      .select('session_exercise_id')
      .in('session_exercise_id', exerciseIds)
      .not('performed_at', 'is', null);
    const protectedIds = new Set((performedSets || []).map((row) => row.session_exercise_id));
    const deletableIds = exerciseIds.filter((id) => !protectedIds.has(id));
    if (deletableIds.length === 0) continue;

    await supabase.from('v2_session_sets').delete().in('session_exercise_id', deletableIds);
    await supabase.from('v2_session_exercises').delete().in('id', deletableIds);
  }

  const leftover = await getSessionsForToday(userId, startIso, endIsoExclusive);
  for (const session of leftover) {
    if (session.status !== 'active') continue;
    const { data: remaining } = await supabase
      .from('v2_session_exercises')
      .select('id')
      .eq('session_id', session.id)
      .limit(1);
    if ((remaining ?? []).length > 0) continue;
    await supabase.from('v2_workout_sessions').delete().eq('id', session.id);
  }

  return { ok: true };
}
