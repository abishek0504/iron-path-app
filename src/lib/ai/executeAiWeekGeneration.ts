/**
 * AI Coach week generation pipeline.
 */

import { invalidateTemplate } from '../cache/templateCache';
import { invalidateSessionsInRangeForUser } from '../cache/sessionsCache';
import { useUIStore } from '../../stores/uiStore';
import { updateUserProfile } from '../supabase/queries/users';
import { useUserStore } from '../../stores/userStore';
import { devLog, devError } from '../utils/logger';
import { addAiGenerationBreadcrumb } from '../monitoring/aiGenerationBreadcrumb';
import { generateAiWeek } from './generateWorkoutWeek';
import type { CoachWeekDay, CoachWeekMode } from './coachWeek';
import { clampCoachExercisesPerSession, clampCoachSessionMinutes } from './coachPrefs';

export type AiWeekGenerationResult =
  | { ok: true; slotsCreated: number }
  | {
      ok: false;
      code:
        | 'paywall_required'
        | 'quota_exceeded'
        | 'auth_error'
        | 'forbidden'
        | 'ai_unavailable'
        | 'no_slots'
        | 'unknown';
      message?: string;
    };

export async function executeAiWeekGeneration(input: {
  userId: string;
  templateId: string;
  idempotencyKey: string;
  mode: CoachWeekMode;
  weekStartDate: string;
  days: CoachWeekDay[];
}): Promise<AiWeekGenerationResult> {
  const { userId, templateId, idempotencyKey, mode, weekStartDate, days } = input;

  if (__DEV__) {
    const profile = useUserStore.getState().profile;
    devLog('planner-ai-week', {
      action: 'executeAiWeekGeneration',
      templateId,
      mode,
      weekStartDate,
      dayNames: days.map((day) => day.dayName),
      dayCount: days.length,
      sessionMinutes: clampCoachSessionMinutes(profile?.ai_coach_session_minutes),
      exercisesPerSession: clampCoachExercisesPerSession(profile?.ai_coach_exercises_per_session),
    });
  }

  try {
    const result = await generateAiWeek({
      templateId,
      idempotencyKey,
      mode,
      weekStartDate,
      days,
    });

    if (result.source === 'paywall_required') return { ok: false, code: 'paywall_required' };
    if (result.source === 'quota_exceeded') return { ok: false, code: 'quota_exceeded' };
    if (result.source === 'auth_error') return { ok: false, code: 'auth_error' };
    if (result.source === 'forbidden') return { ok: false, code: 'forbidden' };
    if (result.source === 'ai_unavailable') {
      return { ok: false, code: 'ai_unavailable', message: result.reason ?? '' };
    }

    const slotsCreated = result.slotsCreated ?? 0;
    if (!result.committed || slotsCreated === 0) {
      return { ok: false, code: 'no_slots' };
    }

    await updateUserProfile(userId, { ai_coach_planned_week_start: weekStartDate });
    useUserStore.getState().updateProfile({ ai_coach_planned_week_start: weekStartDate });

    invalidateTemplate(templateId);
    invalidateSessionsInRangeForUser(userId);
    useUIStore.getState().setPlannerNeedsRefetch(true);

    void addAiGenerationBreadcrumb({
      action: 'execute_committed',
      slotsCreated,
      committed: true,
    });

    if (__DEV__) {
      devLog('planner-ai-week', {
        action: 'executeAiWeekGeneration_committed',
        templateId,
        weekStartDate,
        slotsCreated,
        dayCount: days.length,
      });
    }

    return { ok: true, slotsCreated };
  } catch (error) {
    if (__DEV__) {
      devError('planner-ai-week', error, { action: 'executeAiWeekGeneration', templateId });
    }
    return { ok: false, code: 'unknown' };
  }
}
