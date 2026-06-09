/**
 * Client wrapper for the `generate-workout` Edge Function.
 *
 * Tries Gemini (server-side) first; on any failure or invalid response we fall
 * back to the local deterministic engine so the user always gets a result. The
 * Edge Function is the only path that touches the Gemini API key — the key
 * lives as a Supabase Function secret and never ships in the mobile bundle.
 *
 * Returned shape is normalized to `string[][]` (array of sessions, each a list
 * of exercise IDs) so the caller's downstream code stays the same regardless of
 * which path produced the result.
 */

import { supabase } from '../supabase/client';
import { devLog, devError } from '../utils/logger';
import { generateDayForTemplate } from '../engine/weekGeneration';
import type { FullTemplate } from '../supabase/queries/templates';
import type { UserProfile } from '../../stores/userStore';

export type GenerateAiDayResult =
  | {
      source: 'gemini';
      sessions: string[][];
      model: string;
      remainingToday: number | null;
    }
  | {
      source: 'fallback';
      sessions: string[][];
      reason: string;
      remainingToday: number | null;
    }
  | {
      source: 'rest';
      sessions: string[][];
    }
  | {
      source: 'quota_exceeded';
      quota: number;
      retryAfterHours: number;
    }
  | {
      source: 'auth_error';
    }
  | {
      source: 'empty';
      reason: string;
    };

interface EdgeResponse {
  sessions?: string[][];
  source?: 'gemini' | 'fallback';
  model?: string;
  remainingToday?: number;
  fallbackReason?: string;
}

interface EdgeError {
  error?: string;
  quota?: number;
  retryAfterHours?: number;
}

/**
 * Normalize whatever the engine returns into `string[][]`.
 * The engine returns `string[]` (single session) when sessionsPerDay==1 and no
 * dayIndexOnly, and `string[][]` when called with dayIndex (which we always do
 * here). We defensively handle both shapes.
 */
function normalizeEngineResult(raw: string[] | string[][]): string[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'string') return [raw as string[]];
  return raw as string[][];
}

async function runLocalFallback(
  template: FullTemplate,
  userId: string,
  profile: UserProfile | null,
  dayIndex: number,
  sessionsPerDay: number,
): Promise<string[][]> {
  const raw = await generateDayForTemplate(template, userId, profile, dayIndex, {
    sessionsPerDay,
  });
  return normalizeEngineResult(raw);
}

/**
 * Detect a 429 response from the Edge Function. supabase-js v2 wraps non-2xx
 * responses in a `FunctionsHttpError`; the underlying Response is exposed via
 * `error.context`. We have to read the body to get the structured fields.
 */
async function tryReadQuotaError(
  error: unknown,
): Promise<{ status: number; body: EdgeError } | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: Response }).context;
  if (!ctx || typeof ctx.status !== 'number') return null;
  if (ctx.status !== 429) return { status: ctx.status, body: {} };
  try {
    const body = (await ctx.json()) as EdgeError;
    return { status: 429, body };
  } catch {
    return { status: 429, body: {} };
  }
}

export async function generateAiDay(args: {
  template: FullTemplate;
  userId: string;
  profile: UserProfile | null;
  dayIndex: number;
  sessionsPerDay: number;
}): Promise<GenerateAiDayResult> {
  const { template, userId, profile, dayIndex, sessionsPerDay } = args;

  if (sessionsPerDay <= 0) {
    return { source: 'rest', sessions: [] };
  }

  const day = template.days[dayIndex];
  const dayName = day?.day?.day_name ?? 'Workout';
  const templateId = template.template.id;

  if (__DEV__) {
    devLog('ai-generate', {
      action: 'invoke_edge',
      templateId,
      dayName,
      sessionsPerDay,
    });
  }

  // ----------------------------------------------------------------------
  // 1. Try the Edge Function (Gemini path)
  // ----------------------------------------------------------------------
  try {
    const { data, error } = await supabase.functions.invoke<EdgeResponse>(
      'generate-workout',
      {
        body: {
          templateId,
          dayName,
          sessionsPerDay,
        },
      },
    );

    if (error) {
      const httpInfo = await tryReadQuotaError(error);
      if (httpInfo?.status === 429) {
        if (__DEV__) {
          devLog('ai-generate', {
            action: 'quota_exceeded',
            quota: httpInfo.body.quota ?? null,
          });
        }
        return {
          source: 'quota_exceeded',
          quota: httpInfo.body.quota ?? 10,
          retryAfterHours: httpInfo.body.retryAfterHours ?? 24,
        };
      }

      // Auth failures must be surfaced to the user (re-login), not silently
      // masked by the local fallback engine.
      if (httpInfo?.status === 401 || httpInfo?.status === 403) {
        if (__DEV__) {
          devLog('ai-generate', { action: 'auth_error', status: httpInfo.status });
        }
        return { source: 'auth_error' };
      }

      // Non-quota error — log and fall through to local fallback.
      if (__DEV__) {
        devError('ai-generate', error, {
          step: 'invoke',
          status: httpInfo?.status ?? null,
        });
      }
    } else if (data) {
      if (data.source === 'gemini' && Array.isArray(data.sessions) && data.sessions.length > 0) {
        if (__DEV__) {
          devLog('ai-generate', {
            action: 'gemini_success',
            model: data.model ?? null,
            sessions: data.sessions.length,
            totalExercises: data.sessions.reduce((acc, g) => acc + g.length, 0),
          });
        }
        return {
          source: 'gemini',
          sessions: data.sessions,
          model: data.model ?? 'unknown',
          remainingToday: data.remainingToday ?? null,
        };
      }

      // Edge function returned a "fallback" sentinel (LLM unavailable, invalid
      // response, etc.). Run the local engine; we still have a valid quota
      // decrement on the server side.
      if (__DEV__) {
        devLog('ai-generate', {
          action: 'edge_fallback',
          reason: data.fallbackReason ?? null,
        });
      }
      const localSessions = await runLocalFallback(
        template,
        userId,
        profile,
        dayIndex,
        sessionsPerDay,
      );
      return {
        source: 'fallback',
        sessions: localSessions,
        reason: data.fallbackReason ?? 'edge_fallback',
        remainingToday: data.remainingToday ?? null,
      };
    }
  } catch (err) {
    if (__DEV__) {
      devError('ai-generate', err, { step: 'invoke_catch' });
    }
  }

  // ----------------------------------------------------------------------
  // 2. Local fallback (network failure or non-quota Edge error)
  // ----------------------------------------------------------------------
  try {
    const localSessions = await runLocalFallback(
      template,
      userId,
      profile,
      dayIndex,
      sessionsPerDay,
    );
    if (localSessions.length === 0 || localSessions.every((g) => g.length === 0)) {
      return { source: 'empty', reason: 'no_local_results' };
    }
    return {
      source: 'fallback',
      sessions: localSessions,
      reason: 'edge_unavailable',
      remainingToday: null,
    };
  } catch (err) {
    if (__DEV__) {
      devError('ai-generate', err, { step: 'local_fallback' });
    }
    return { source: 'empty', reason: 'local_engine_failed' };
  }
}
