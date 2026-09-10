/** Shared constants for generate-workout. */

/** Pro subscribers: max successful AI generations per rolling 7 days. */
export const PRO_WEEKLY_QUOTA = 40;

/** Successful LLM commits that count toward the rolling quota. */
export const AI_QUOTA_SOURCES = ['openai', 'openai_week'] as const;

/** Retry OpenAI when the model returns structurally invalid output (not on HTTP errors). */
export const MAX_LLM_VALIDATION_ATTEMPTS = 2;

export const PRO_ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Hard upper bound on sessionsPerDay (defense-in-depth). */
export const MAX_SESSIONS_PER_DAY = 6;

/** Hard upper bound on exercises returned per session — keeps prompts small and bounds DB inserts. */
export const MAX_EXERCISES_PER_SESSION = 8;

/** Cap on allow-list exercises embedded in the LLM prompt. Sending the full catalog causes invalid IDs or too few exercises. */
export const CATALOG_PROMPT_LIMIT = 50;

/** Fetch more allow-list rows than the prompt cap so focus filtering still leaves a full catalog. */
export const CATALOG_FETCH_LIMIT = 200;

/** Minimum exercises per session — prevents the LLM from returning empty lists. */
export const MIN_EXERCISES_PER_SESSION = 2;

/** Tolerance around a user-requested exercise count during validation (auto mode only). */
export const EXERCISE_COUNT_TOLERANCE = 1;

/**
 * Static stretch holds by experience — two rounds per stretch, hold duration
 * within prescription bands (beginner 30–45s, intermediate 45–60s, advanced 45–90s).
 * Two shorter holds beat one long hold for post-workout cooldown.
 */
export const STRETCH_TARGETS_BY_EXPERIENCE: Record<
  string,
  { sets: number; duration_sec: number }
> = {
  beginner: { sets: 2, duration_sec: 40 },
  intermediate: { sets: 2, duration_sec: 50 },
  advanced: { sets: 2, duration_sec: 60 },
};

/** Upper bound on user-requested stretches per session. */
export const MAX_STRETCH_COUNT = 5;

/** Cap on user-supplied emphasize/avoid muscle entries (defense-in-depth). */
export const MAX_CONSTRAINT_MUSCLES = 12;

/** Lookback window for recent muscle freshness — must match the engine's 48h window. */
export const FRESHNESS_LOOKBACK_HOURS = 48;

/** Lookback window for per-exercise performance history fed to the LLM. */
export const HISTORY_LOOKBACK_DAYS = 60;

/** Cap on history rows fetched — bounds both DB load and prompt tokens. */
export const HISTORY_MAX_SETS = 300;

/** Default OpenAI model. Overridable via `OPENAI_MODEL` env. */
export const DEFAULT_MODEL = 'gpt-5.6-luna';

/** Hard timeout for the OpenAI call so a slow upstream can't hold the function open. */
export const OPENAI_TIMEOUT_MS = 30_000;

/** Bounds for AI-prescribed targets. Reps have a floor only — logged sets are uncapped. */
export const TARGET_BOUNDS = {
  sets: { min: 1, max: 10 },
  reps: { min: 1 },
  weight: { min: 0, max: 2000 },
  durationSec: { min: 5, max: 3600 },
  rpe: { min: 5, max: 10 },
} as const;
