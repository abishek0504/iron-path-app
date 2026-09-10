/**
 * Client wrapper for the `generate-week` Edge Function (AI Coach).
 */

import { supabase } from '../supabase/client';
import { addAiGenerationBreadcrumb } from '../monitoring/aiGenerationBreadcrumb';
import { devLog, devError } from '../utils/logger';
import { mapGenerateWorkoutHttpError } from './generateWorkoutDay';
import { useUserStore } from '../../stores/userStore';
import { type CoachWeekDay, type CoachWeekMode } from './coachWeek';
import { buildGenerateWeekInvokeBody } from './generateWeekPayload';

export { buildGenerateWeekInvokeBody } from './generateWeekPayload';

export interface GenerateAiWeekResult {
  source: 'openai' | 'paywall_required' | 'quota_exceeded' | 'auth_error' | 'forbidden' | 'ai_unavailable';
  committed?: boolean;
  slotsCreated?: number;
  model?: string;
  reason?: string;
}

interface EdgeResponse {
  days?: unknown[];
  source?: 'openai' | 'fallback';
  model?: string;
  fallbackReason?: string;
  committed?: boolean;
  slotsCreated?: number;
}

interface EdgeError {
  error?: string;
  code?: string;
}

async function tryReadHttpError(
  error: unknown,
): Promise<{ status: number; body: EdgeError } | null> {
  if (!error || typeof error !== 'object') return null;
  const err = error as { context?: Response; status?: number };
  const response = err.context instanceof Response ? err.context : null;
  const status =
    typeof response?.status === 'number'
      ? response.status
      : typeof err.status === 'number'
        ? err.status
        : null;
  if (status === null) return null;
  try {
    const body = response ? ((await response.json()) as EdgeError) : {};
    return { status, body };
  } catch {
    return { status, body: {} };
  }
}

export async function generateAiWeek(args: {
  templateId: string;
  idempotencyKey: string;
  mode: CoachWeekMode;
  weekStartDate: string;
  days: CoachWeekDay[];
}): Promise<GenerateAiWeekResult> {
  const { templateId, idempotencyKey, mode, weekStartDate, days } = args;

  if (__DEV__) {
    devLog('ai-week', {
      action: 'invoke_edge',
      templateId,
      mode,
      weekStartDate,
      dayNames: days.map((day) => day.dayName),
      dayCount: days.length,
      idempotencyKeyPrefix: idempotencyKey.slice(0, 8),
    });
  }

  void addAiGenerationBreadcrumb({
    action: 'invoke_edge',
    idempotencyKeyPrefix: idempotencyKey.slice(0, 8),
    sessionsPerDay: days.length,
  });

  try {
    const { data, error } = await supabase.functions.invoke<EdgeResponse>('generate-week', {
      body: buildGenerateWeekInvokeBody({
        ...args,
        profile: useUserStore.getState().profile,
      }),
    });

    if (error) {
      const httpInfo = await tryReadHttpError(error);
      if (httpInfo) {
        const mapped = mapGenerateWorkoutHttpError(httpInfo.status);
        if (mapped) return { source: mapped };
      }
      if (__DEV__) {
        devError('ai-week', error, { step: 'invoke', status: httpInfo?.status ?? null });
      }
      return { source: 'ai_unavailable', reason: 'edge_error' };
    }

    if (data?.source === 'openai' && data.committed === true) {
      const slotsCreated = data.slotsCreated ?? 0;
      if (__DEV__) {
        devLog('ai-week', {
          action: 'openai_committed',
          model: data.model ?? null,
          slotsCreated,
          dayCount: days.length,
        });
      }
      void addAiGenerationBreadcrumb({
        action: 'openai_committed',
        committed: true,
        slotsCreated,
        model: data.model ?? 'unknown',
      });
      return {
        source: 'openai',
        committed: true,
        slotsCreated,
        model: data.model ?? 'unknown',
      };
    }

    return {
      source: 'ai_unavailable',
      reason: data?.fallbackReason ?? 'edge_fallback',
    };
  } catch (err) {
    if (__DEV__) {
      devError('ai-week', err, { step: 'invoke_catch' });
    }
    return { source: 'ai_unavailable', reason: 'edge_unreachable' };
  }
}
