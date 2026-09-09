/** Request parsing and small helpers. */

import {
  MAX_CONSTRAINT_MUSCLES,
  MAX_STRETCH_COUNT,
  MIN_EXERCISES_PER_SESSION,
  MAX_EXERCISES_PER_SESSION,
} from './constants.ts';
import type { DayConstraints } from './types.ts';

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function isProSubscriber(
  profile: { subscription_tier: string; subscription_expires_at: string | null } | null,
): boolean {
  if (!profile || profile.subscription_tier !== 'pro') return false;
  if (!profile.subscription_expires_at) return false;
  return new Date(profile.subscription_expires_at).getTime() > Date.now();
}

export function asPositiveInt(value: unknown, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * Normalize an idempotency key to a UUID for `v2_ai_generation_jobs.id`.
 * Mobile clients sometimes send `${Date.now()}-…` when `crypto.randomUUID`
 * is unavailable; hash those deterministically so retries stay idempotent.
 */
export async function normalizeJobId(value: unknown): Promise<string | null> {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isUuid(trimmed)) return trimmed;

  const data = new TextEncoder().encode(`ironpath-ai-job:${trimmed}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Sanitize the user-supplied dayName before embedding in the LLM prompt.
 * We strip control chars and cap length to defang prompt-injection attempts;
 * this is just intent context (not a security boundary on its own — the
 * allow-list validation downstream is the real boundary).
 */
export function sanitizeDayName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Workout';
  // deno-lint-ignore no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return cleaned.slice(0, 64) || 'Workout';
}

/** Strip control chars and cap length on a free-text constraint value. */
export function sanitizeConstraintText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string') return null;
  // deno-lint-ignore no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return cleaned.slice(0, maxLength) || null;
}

export function sanitizeMuscleList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  for (const item of raw) {
    const cleaned = sanitizeConstraintText(item, 32);
    if (cleaned) result.push(cleaned);
    if (result.length >= MAX_CONSTRAINT_MUSCLES) break;
  }
  return result;
}

/**
 * Parse + clamp the optional constraints object. Anything missing or invalid
 * degrades to "let the AI decide" rather than failing the request, so old
 * clients that don't send constraints keep working unchanged.
 */
export function parseConstraints(raw: unknown): DayConstraints {
  const defaults: DayConstraints = {
    dayFocus: null,
    exercisesPerSession: null,
    intensity: 'standard',
    emphasizeMuscles: [],
    avoidMuscles: [],
    stretchCount: 0,
  };
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const exercisesPerSession =
    typeof obj.exercisesPerSession === 'number' &&
    Number.isInteger(obj.exercisesPerSession) &&
    obj.exercisesPerSession >= MIN_EXERCISES_PER_SESSION &&
    obj.exercisesPerSession <= MAX_EXERCISES_PER_SESSION
      ? obj.exercisesPerSession
      : null;

  const intensity =
    obj.intensity === 'light' || obj.intensity === 'hard' ? obj.intensity : 'standard';

  const stretchCount =
    typeof obj.stretchCount === 'number' &&
    Number.isInteger(obj.stretchCount) &&
    obj.stretchCount >= 0 &&
    obj.stretchCount <= MAX_STRETCH_COUNT
      ? obj.stretchCount
      : 0;

  return {
    dayFocus: sanitizeConstraintText(obj.dayFocus, 48),
    exercisesPerSession,
    intensity,
    emphasizeMuscles: sanitizeMuscleList(obj.emphasizeMuscles),
    avoidMuscles: sanitizeMuscleList(obj.avoidMuscles),
    stretchCount,
  };
}

export function toPublicFallbackReason(internal: string | null): string {
  if (!internal) return 'generation_unavailable';
  if (internal === 'commit_failed') return 'commit_failed';
  if (internal === 'no_openai_key' || internal === 'openai_failed') return 'generation_unavailable';
  if (
    internal === 'allow_list_validation_failed' ||
    internal.includes('allow_list') ||
    internal.includes('session_count_mismatch') ||
    internal.includes('too_few_exercises')
  ) {
    return 'validation_failed';
  }
  return 'generation_unavailable';
}
