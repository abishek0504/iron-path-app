/**
 * Client wrapper for the `generate-workout` Edge Function.
 *
 * This is an AI-only feature: it calls the OpenAI API (server-side) and
 * returns the generated sessions on success. Each session entry carries the
 * AI-prescribed targets (sets/reps/weight/duration/RPE); targets may be null
 * when the server nulled an out-of-bounds prescription, in which case the
 * caller falls back to prescription-based targets. If the model is
 * overloaded, times out, returns an invalid response, or the Edge Function is
 * unreachable, we surface an `ai_unavailable` result so the caller can show a
 * "try again later" message — we intentionally do NOT silently substitute the
 * local deterministic engine, because the user explicitly asked for an AI
 * generation.
 *
 * The Edge Function is the only path that touches the OpenAI API key — the
 * key lives as a Supabase Function secret and never ships in the mobile
 * bundle.
 */

import { supabase } from '../supabase/client';
import { devLog, devError } from '../utils/logger';
import type { FullTemplate } from '../supabase/queries/templates';
import type { UserProfile } from '../../stores/userStore';

/**
 * User-chosen constraints from the pre-generation form. All fields have
 * "let the AI decide" defaults so the Edge Function treats the whole object
 * as optional.
 */
export interface DayConstraints {
  /** Split-day focus (e.g. "Push", "Upper"). null = let AI decide. */
  dayFocus: string | null;
  /** Exact exercises per session (2..8). null = AI decides (auto). */
  exercisesPerSession: number | null;
  intensity: 'light' | 'standard' | 'hard';
  emphasizeMuscles: string[];
  avoidMuscles: string[];
  /** 0..5. Plumbing only until the exercise catalog gains a stretch flag. */
  stretchCount: number;
}

export const DEFAULT_DAY_CONSTRAINTS: DayConstraints = {
  dayFocus: null,
  exercisesPerSession: null,
  intensity: 'standard',
  emphasizeMuscles: [],
  avoidMuscles: [],
  stretchCount: 0,
};

/** One exercise as prescribed by the AI. Targets are null when unavailable. */
export interface AiSessionExercise {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  duration_sec: number | null;
  weight: number | null;
  target_rpe: number | null;
}

export type GenerateAiDayResult =
  | {
      source: 'openai';
      sessions: AiSessionExercise[][];
      model: string;
    }
  | {
      source: 'rest';
      sessions: AiSessionExercise[][];
    }
  | {
      source: 'paywall_required';
    }
  | {
      source: 'quota_exceeded';
    }
  | {
      source: 'auth_error';
    }
  | {
      // The AI could not produce a valid result (overloaded, busy, timed out,
      // invalid response) or the Edge Function was unreachable.
      source: 'ai_unavailable';
      reason: string;
    };

interface EdgeResponse {
  sessions?: AiSessionExercise[][];
  source?: 'openai' | 'fallback';
  model?: string;
  fallbackReason?: string;
}

interface EdgeError {
  error?: string;
  code?: string;
}

/**
 * Read structured error body from a non-2xx Edge Function response.
 * supabase-js v2 wraps failures in `FunctionsHttpError` with `error.context`.
 */
async function tryReadHttpError(
  error: unknown,
): Promise<{ status: number; body: EdgeError } | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: Response }).context;
  if (!ctx || typeof ctx.status !== 'number') return null;
  try {
    const body = (await ctx.json()) as EdgeError;
    return { status: ctx.status, body };
  } catch {
    return { status: ctx.status, body: {} };
  }
}

export async function generateAiDay(args: {
  template: FullTemplate;
  userId: string;
  profile: UserProfile | null;
  dayIndex: number;
  sessionsPerDay: number;
  constraints?: DayConstraints;
}): Promise<GenerateAiDayResult> {
  const { template, dayIndex, sessionsPerDay } = args;
  const constraints = args.constraints ?? DEFAULT_DAY_CONSTRAINTS;

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
      constraints,
    });
  }

  try {
    const { data, error } = await supabase.functions.invoke<EdgeResponse>(
      'generate-workout',
      {
        body: {
          templateId,
          dayName,
          sessionsPerDay,
          constraints,
        },
      },
    );

    if (error) {
      const httpInfo = await tryReadHttpError(error);

      if (httpInfo?.status === 402) {
        if (__DEV__) {
          devLog('ai-generate', { action: 'paywall_required' });
        }
        return { source: 'paywall_required' };
      }

      if (httpInfo?.status === 429) {
        if (__DEV__) {
          devLog('ai-generate', { action: 'quota_exceeded' });
        }
        return { source: 'quota_exceeded' };
      }

      if (httpInfo?.status === 401 || httpInfo?.status === 403) {
        if (__DEV__) {
          devLog('ai-generate', { action: 'auth_error', status: httpInfo.status });
        }
        return { source: 'auth_error' };
      }

      if (__DEV__) {
        devError('ai-generate', error, {
          step: 'invoke',
          status: httpInfo?.status ?? null,
        });
      }
      return { source: 'ai_unavailable', reason: 'edge_error' };
    }

    if (data?.source === 'openai' && Array.isArray(data.sessions) && data.sessions.length > 0) {
      if (__DEV__) {
        devLog('ai-generate', {
          action: 'openai_success',
          model: data.model ?? null,
          sessions: data.sessions.length,
          totalExercises: data.sessions.reduce((acc, g) => acc + g.length, 0),
        });
      }
      return {
        source: 'openai',
        sessions: data.sessions,
        model: data.model ?? 'unknown',
      };
    }

    if (__DEV__) {
      devLog('ai-generate', {
        action: 'ai_unavailable',
        reason: data?.fallbackReason ?? 'edge_fallback',
      });
    }
    return {
      source: 'ai_unavailable',
      reason: data?.fallbackReason ?? 'edge_fallback',
    };
  } catch (err) {
    if (__DEV__) {
      devError('ai-generate', err, { step: 'invoke_catch' });
    }
    return { source: 'ai_unavailable', reason: 'edge_unreachable' };
  }
}
