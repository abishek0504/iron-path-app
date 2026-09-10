/**
 * Test helper: empty the user's weekly template and unfinished sessions
 * so Planner / AI Coach can be regenerated from a blank week.
 */

import { invalidateSessionsInRangeForUser } from '../cache/sessionsCache';
import { invalidateProfileCache, invalidateWorkoutStatsCache } from '../cache/dashboardStatsCache';
import { invalidateTemplate, invalidateTemplates } from '../cache/templateCache';
import { clearPendingAiWeekGeneration } from '../ai/aiWeekGenerationRecovery';
import { supabase } from '../supabase/client';
import { updateUserProfile } from '../supabase/queries/users';
import { deleteSessionWithExercises } from '../supabase/queries/workouts';
import { useUIStore } from '../../stores/uiStore';
import { useUserStore } from '../../stores/userStore';
import { devError, devLog } from '../utils/logger';

export type ClearWeeklyPlanResult =
  | { ok: true; templateCount: number; dayCount: number; slotsCleared: boolean; sessionsCleared: number }
  | { ok: false; message: string };

export async function clearUserWeeklyPlan(userId: string): Promise<ClearWeeklyPlanResult> {
  if (__DEV__) {
    devLog('planner-clear', { action: 'clearUserWeeklyPlan', userId });
  }

  try {
    const { data: templates, error: templateErr } = await supabase
      .from('v2_workout_templates')
      .select('id')
      .eq('user_id', userId);

    if (templateErr) {
      if (__DEV__) {
        devError('planner-clear', templateErr, { action: 'load_templates', userId });
      }
      return { ok: false, message: 'Failed to load your plan' };
    }

    const templateIds = (templates ?? []).map((row) => row.id);
    let dayCount = 0;
    let slotsCleared = true;

    if (templateIds.length > 0) {
      const { data: days, error: dayErr } = await supabase
        .from('v2_template_days')
        .select('id')
        .in('template_id', templateIds);

      if (dayErr) {
        if (__DEV__) {
          devError('planner-clear', dayErr, { action: 'load_days', userId, templateCount: templateIds.length });
        }
        return { ok: false, message: 'Failed to load plan days' };
      }

      const dayIds = (days ?? []).map((row) => row.id);
      dayCount = dayIds.length;

      if (dayIds.length > 0) {
        const { error: slotErr } = await supabase
          .from('v2_template_slots')
          .delete()
          .in('day_id', dayIds);

        if (slotErr) {
          if (__DEV__) {
            devError('planner-clear', slotErr, { action: 'clear_slots', userId, dayCount });
          }
          slotsCleared = false;
        }
      }
    }

    const { data: activeSessions, error: sessionErr } = await supabase
      .from('v2_workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (sessionErr) {
      if (__DEV__) {
        devError('planner-clear', sessionErr, { action: 'load_active_sessions', userId });
      }
      return { ok: false, message: 'Failed to load unfinished workouts' };
    }

    let sessionsCleared = 0;
    for (const session of activeSessions ?? []) {
      const { error } = await deleteSessionWithExercises(userId, session.id);
      if (error) {
        if (__DEV__) {
          devError('planner-clear', error, { action: 'delete_active_session', sessionId: session.id });
        }
        continue;
      }
      sessionsCleared += 1;
    }

    if (!slotsCleared) {
      return { ok: false, message: 'Failed to clear planned exercises' };
    }

    const profileOk = await updateUserProfile(userId, { ai_coach_planned_week_start: null });
    if (profileOk) {
      useUserStore.getState().updateProfile({ ai_coach_planned_week_start: null });
      invalidateProfileCache(userId);
    }

    await clearPendingAiWeekGeneration();
    invalidateTemplates(userId);
    for (const templateId of templateIds) {
      invalidateTemplate(templateId);
    }
    invalidateSessionsInRangeForUser(userId);
    invalidateWorkoutStatsCache(userId);
    useUIStore.getState().setPlannerNeedsRefetch(true);
    useUIStore.getState().setWorkoutNeedsRefetch(true);

    if (__DEV__) {
      devLog('planner-clear', {
        action: 'clearUserWeeklyPlan_ok',
        templateCount: templateIds.length,
        dayCount,
        sessionsCleared,
        profileReset: profileOk,
      });
    }

    return {
      ok: true,
      templateCount: templateIds.length,
      dayCount,
      slotsCleared,
      sessionsCleared,
    };
  } catch (error) {
    if (__DEV__) {
      devError('planner-clear', error, { action: 'clearUserWeeklyPlan', userId });
    }
    return { ok: false, message: 'Failed to clear your plan' };
  }
}
