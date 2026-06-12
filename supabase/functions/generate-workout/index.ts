/**
 * Edge Function: Generate Workout (OpenAI-powered)
 *
 * Generates exercise selections WITH prescribed targets (sets/reps/weight/RPE)
 * for a single template day. The LLM only ever sees an allow-listed exercise
 * catalog (`v2_ai_recommended_exercises`), and every ID it returns is validated
 * against that allow-list before being sent to the client. Targets are bounds-
 * checked server-side; invalid targets are nulled (client falls back to
 * prescription-based targets) rather than failing the whole generation.
 *
 * Per-request user context (computed fresh, never persisted):
 *   - profile (experience, equipment, split, workout days, weights, units)
 *   - muscle freshness (RPE/RIR-driven, last 48h)
 *   - per-exercise history (last performed, top set, last set, avg RPE) from
 *     completed sessions in the last 60 days, warmups excluded
 *   - split compliance: which training day of the week this is
 *
 * The OpenAI API key (`OPENAI_API_KEY`) lives only as a Supabase Function
 * secret — it is never shipped in the mobile bundle.
 *
 * Request body (JSON):
 *   {
 *     templateId: string  (uuid, must be owned by the caller)
 *     dayName: string     (display name, e.g. "Monday", informs the LLM intent)
 *     sessionsPerDay: int (1..6)
 *     constraints?: {     (all optional — defaults mean "let the AI decide")
 *       dayFocus: string | null            (e.g. "Push", "Upper")
 *       exercisesPerSession: int | null    (2..8; null = auto)
 *       intensity: 'light' | 'standard' | 'hard'
 *       emphasizeMuscles: string[]
 *       avoidMuscles: string[]
 *       stretchCount: int                  (0..5; append stretches from stretch catalog)
 *     }
 *   }
 *
 * Response (JSON):
 *   {
 *     sessions: AiExercisePlan[][]  // grouped by session (length === sessionsPerDay)
 *     model: string                 // model identifier used (or 'none' on fallback)
 *     source: 'openai' | 'fallback'
 *   }
 *
 * Status codes:
 *   200  success (source may be 'fallback' — sessions will be empty)
 *   400  bad request (missing/invalid params)
 *   401  invalid or missing JWT
 *   402  paywall_required (free tier — no AI access)
 *   403  template not owned by the caller
 *   429  weekly quota exceeded (pro subscribers)
 *   500  unexpected server error
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================================
// Constants
// ============================================================================

/** Pro subscribers: max AI generations per rolling 7 days. Recorded in v2_ai_generations. */
const PRO_WEEKLY_QUOTA = 40;

const PRO_ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Hard upper bound on sessionsPerDay (defense-in-depth). */
const MAX_SESSIONS_PER_DAY = 6;

/** Hard upper bound on exercises returned per session — keeps prompts small and bounds DB inserts. */
const MAX_EXERCISES_PER_SESSION = 8;

/** Cap on allow-list exercises embedded in the LLM prompt — matches the local engine (`weekGeneration.ts` limit 50). Sending the full 340-exercise catalog causes the model to return invalid IDs or too few exercises, failing server validation. */
const CATALOG_PROMPT_LIMIT = 50;

/** Minimum exercises per session — prevents the LLM from returning empty lists. */
const MIN_EXERCISES_PER_SESSION = 2;

/** Tolerance around a user-requested exercise count during validation (auto mode only). */
const EXERCISE_COUNT_TOLERANCE = 1;

/**
 * Static stretch holds by experience — two rounds per stretch, hold duration
 * within prescription bands (beginner 30–45s, intermediate 45–60s, advanced 45–90s).
 * Two shorter holds beat one long hold for post-workout cooldown.
 */
const STRETCH_TARGETS_BY_EXPERIENCE: Record<
  string,
  { sets: number; duration_sec: number }
> = {
  beginner: { sets: 2, duration_sec: 40 },
  intermediate: { sets: 2, duration_sec: 50 },
  advanced: { sets: 2, duration_sec: 60 },
};

/** Upper bound on user-requested stretches per session. */
const MAX_STRETCH_COUNT = 5;

/** Cap on user-supplied emphasize/avoid muscle entries (defense-in-depth). */
const MAX_CONSTRAINT_MUSCLES = 12;

/** Lookback window for recent muscle freshness — must match the engine's 48h window. */
const FRESHNESS_LOOKBACK_HOURS = 48;

/** Lookback window for per-exercise performance history fed to the LLM. */
const HISTORY_LOOKBACK_DAYS = 60;

/** Cap on history rows fetched — bounds both DB load and prompt tokens. */
const HISTORY_MAX_SETS = 300;

/** Default OpenAI model. Overridable via `OPENAI_MODEL` env. */
const DEFAULT_MODEL = 'gpt-5-nano';

/** Hard timeout for the OpenAI call so a slow upstream can't hold the function open. */
const OPENAI_TIMEOUT_MS = 30_000;

/** Bounds for AI-prescribed targets. Mirror v2_session_sets CHECK constraints. */
const TARGET_BOUNDS = {
  sets: { min: 1, max: 10 },
  reps: { min: 1, max: 50 },
  weight: { min: 0, max: 2000 },
  durationSec: { min: 5, max: 3600 },
  rpe: { min: 5, max: 10 },
} as const;

// ============================================================================
// Types
// ============================================================================

interface GenerateRequestBody {
  templateId?: unknown;
  dayName?: unknown;
  sessionsPerDay?: unknown;
  constraints?: unknown;
}

/** User-chosen constraints from the pre-generation form (all optional). */
interface DayConstraints {
  dayFocus: string | null;
  exercisesPerSession: number | null;
  intensity: 'light' | 'standard' | 'hard';
  emphasizeMuscles: string[];
  avoidMuscles: string[];
  stretchCount: number;
}

interface AllowListedExercise {
  id: string;
  name: string;
  primary_muscles: string[];
  equipment_needed: string[] | null;
  is_timed: boolean;
  is_stretch: boolean;
  movement_pattern: string | null;
  priority_order: number;
}

interface UserContext {
  experience_level: string;
  equipment_access: string[];
  days_per_week: number | null;
  preferred_training_style: string | null;
  workout_days: string[];
  use_imperial: boolean;
  current_weight: number | null;
  goal_weight: number | null;
}

/** One exercise as prescribed by the LLM (targets may be nulled by validation). */
interface AiExercisePlan {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  duration_sec: number | null;
  weight: number | null;
  target_rpe: number | null;
}

/** Compact per-exercise performance summary fed to the LLM. */
interface ExerciseHistorySummary {
  last_performed: string;
  last_set: { weight: number | null; reps: number | null; duration_sec: number | null; rpe: number | null };
  top_set: { weight: number | null; reps: number | null; duration_sec: number | null };
  avg_rpe: number | null;
  recent_set_count: number;
}

interface AuditRow {
  user_id: string;
  template_id: string | null;
  day_name: string | null;
  sessions_per_day: number | null;
  exercise_count: number | null;
  model: string | null;
  source: 'openai' | 'fallback' | 'error';
  latency_ms: number | null;
  error_code: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isProSubscriber(
  profile: { subscription_tier: string; subscription_expires_at: string | null } | null,
): boolean {
  if (!profile || profile.subscription_tier !== 'pro') return false;
  if (!profile.subscription_expires_at) return true;
  return new Date(profile.subscription_expires_at).getTime() > Date.now();
}

function asPositiveInt(value: unknown, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * Sanitize the user-supplied dayName before embedding in the LLM prompt.
 * We strip control chars and cap length to defang prompt-injection attempts;
 * this is just intent context (not a security boundary on its own — the
 * allow-list validation downstream is the real boundary).
 */
function sanitizeDayName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Workout';
  // deno-lint-ignore no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return cleaned.slice(0, 64) || 'Workout';
}

/** Strip control chars and cap length on a free-text constraint value. */
function sanitizeConstraintText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string') return null;
  // deno-lint-ignore no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return cleaned.slice(0, maxLength) || null;
}

function sanitizeMuscleList(raw: unknown): string[] {
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
function parseConstraints(raw: unknown): DayConstraints {
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

// ============================================================================
// OpenAI call
// ============================================================================

/**
 * Strict JSON Schema for OpenAI structured outputs. All properties are
 * required with nullable types expressing optionality (strict-mode rule).
 * Session/exercise counts are enforced by the prompt + server validation
 * rather than minItems/maxItems for maximum strict-mode compatibility.
 */
function buildResponseSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['sessions'],
    properties: {
      sessions: {
        type: 'array',
        description: 'One array per session; each entry is an exercise prescription.',
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['exercise_id', 'sets', 'reps', 'duration_sec', 'weight', 'target_rpe'],
            properties: {
              exercise_id: {
                type: 'string',
                description: 'Exercise ID copied verbatim from the catalog.',
              },
              sets: { type: 'integer', description: 'Number of working sets (1-10).' },
              reps: {
                type: ['integer', 'null'],
                description: 'Target reps per set (1-50). Null for timed exercises.',
              },
              duration_sec: {
                type: ['integer', 'null'],
                description: 'Target hold/work duration in seconds (5-3600). Only for timed exercises.',
              },
              weight: {
                type: ['number', 'null'],
                description: 'Target working weight in the same unit as the history values. Null for bodyweight.',
              },
              target_rpe: {
                type: ['number', 'null'],
                description: 'Target RPE for working sets (5-10).',
              },
            },
          },
        },
      },
    },
  };
}

function buildSystemPrompt(
  sessionsPerDay: number,
  constraints: DayConstraints,
  stretchCount: number,
): string {
  const exerciseCountRule = constraints.exercisesPerSession !== null
    ? `- Each session must contain exactly ${constraints.exercisesPerSession} exercises (the user explicitly requested this count).`
    : `- Each session must contain ${MIN_EXERCISES_PER_SESSION}-${MAX_EXERCISES_PER_SESSION} exercises.`;

  const hardRules = [
    'HARD RULES (violations make the output unusable):',
    `- Output exactly ${sessionsPerDay} session(s).`,
    exerciseCountRule,
    '- Use ONLY exercise IDs from the provided catalog. Copy the IDs verbatim. Never invent exercises.',
    '- Do not repeat the same exercise within or across sessions for this day.',
  ];

  if (constraints.dayFocus) {
    hardRules.push(
      `- The user explicitly chose "${constraints.dayFocus}" as today's split-day focus. Every exercise must fit that focus — this overrides the inferred training day position in SPLIT CONTEXT.`,
    );
  } else {
    hardRules.push(
      '- Comply with the user\'s preferred training split: the SPLIT CONTEXT tells you which training day of the week this is. Choose muscles/movements that match that split day (e.g. training day 1 of Push/Pull/Legs = push exercises only).',
    );
  }

  if (constraints.avoidMuscles.length > 0) {
    hardRules.push(
      `- NEVER select exercises whose primary muscles include any of: ${constraints.avoidMuscles.join(', ')} (the user marked these as sore/injured).`,
    );
  }

  hardRules.push(
    '- Respect muscle freshness: scores are 0-100 where lower = more fatigued. Avoid loading muscles with low freshness.',
    '- Only choose exercises whose equipment the user has access to.',
  );

  if (stretchCount > 0) {
    hardRules.push(
      `- Append exactly ${stretchCount} stretch/mobility exercise(s) per session from the STRETCH CATALOG (IDs prefixed in catalog). Stretches are in addition to strength exercises — do not count them toward the strength exercise count.`,
    );
  }

  const selectionGuidance: string[] = [];
  if (constraints.emphasizeMuscles.length > 0) {
    selectionGuidance.push(
      `- Bias exercise selection toward these muscles (without violating the split focus): ${constraints.emphasizeMuscles.join(', ')}.`,
    );
  }

  const intensityGuidance =
    constraints.intensity === 'light'
      ? '- The user requested a LIGHT day (recovery/deload): prescribe target RPE 5-6, moderate volume, and hold or reduce loads relative to history.'
      : constraints.intensity === 'hard'
        ? '- The user requested a HARD day: prescribe target RPE 8-9 on key lifts, with a heavy top set on the main compound movement where history supports it.'
        : '- Standard intensity: prescribe target RPE 7-8 on working sets.';

  return [
    'You are an expert strength-and-conditioning coach generating one day of training.',
    '',
    ...hardRules,
    ...(selectionGuidance.length > 0 ? ['', 'SELECTION GUIDANCE:', ...selectionGuidance] : []),
    '',
    'PRESCRIPTION RULES (progressive overload):',
    intensityGuidance,
    '- For each exercise, prescribe working sets, and reps (or duration_sec for timed exercises), plus weight and target RPE.',
    '- Use the EXERCISE HISTORY block: progress conservatively from the last performance.',
    '  * If the last average RPE was below 8, nudge weight or reps up slightly.',
    '  * If the last average RPE was 9 or higher, hold or slightly reduce the load.',
    '  * Never jump weight more than ~10% in one step.',
    '- Weight must be in the same unit as the history values (the user context says whether the user uses imperial units).',
    '- If there is no history for an exercise, prescribe a conservative starting target appropriate for the user\'s experience level; leave weight null if you cannot estimate it safely.',
    '- Timed exercises (is_timed=true) get duration_sec and null reps; rep exercises get reps and null duration_sec.',
    '- Bodyweight exercises get null weight.',
    '- STRETCHES (from STRETCH CATALOG): prescribe exactly 2 working sets, duration_sec 40–60 s per hold (beginner ~40, intermediate ~50, advanced ~60), null weight, null target_rpe. Stretches are not scored with RPE and do not use progressive overload.',
    `- sets must be ${TARGET_BOUNDS.sets.min}-${TARGET_BOUNDS.sets.max}, reps ${TARGET_BOUNDS.reps.min}-${TARGET_BOUNDS.reps.max}, duration_sec ${TARGET_BOUNDS.durationSec.min}-${TARGET_BOUNDS.durationSec.max}, target_rpe ${TARGET_BOUNDS.rpe.min}-${TARGET_BOUNDS.rpe.max}.`,
  ].join('\n');
}

function buildUserPrompt(params: {
  catalog: AllowListedExercise[];
  stretchCatalog: AllowListedExercise[];
  user: UserContext;
  dayName: string;
  sessionsPerDay: number;
  constraints: DayConstraints;
  recentStress: Record<string, number>;
  history: Record<string, ExerciseHistorySummary>;
  trainingDayPosition: string | null;
}): string {
  const {
    catalog,
    stretchCatalog,
    user,
    dayName,
    sessionsPerDay,
    constraints,
    recentStress,
    history,
    trainingDayPosition,
  } = params;

  const catalogPayload = catalog.map((ex) => ({
    id: ex.id,
    name: ex.name,
    muscles: ex.primary_muscles,
    equipment: ex.equipment_needed ?? [],
    movement_pattern: ex.movement_pattern,
    is_timed: ex.is_timed,
  }));

  const stretchPayload = stretchCatalog.map((ex) => ({
    id: ex.id,
    name: ex.name,
    muscles: ex.primary_muscles,
    is_timed: ex.is_timed,
  }));

  const blocks = [
    `Generate ${sessionsPerDay} session(s) for the day named "${dayName}".`,
    '',
    'USER CONTEXT:',
    JSON.stringify({
      experience_level: user.experience_level,
      equipment_access: user.equipment_access,
      days_per_week: user.days_per_week,
      current_weight: user.current_weight,
      goal_weight: user.goal_weight,
      uses_imperial_units: user.use_imperial,
    }),
    '',
    'USER CONSTRAINTS (explicit choices for today — follow these over inferred context):',
    JSON.stringify({
      day_focus: constraints.dayFocus ?? 'let AI decide',
      exercises_per_session: constraints.exercisesPerSession ?? 'auto',
      intensity: constraints.intensity,
      emphasize_muscles: constraints.emphasizeMuscles,
      avoid_muscles: constraints.avoidMuscles,
      stretch_count: constraints.stretchCount,
    }),
    '',
    'SPLIT CONTEXT:',
    JSON.stringify({
      preferred_split: user.preferred_training_style ?? 'no preference',
      workout_days: user.workout_days,
      requested_day: dayName,
      training_day_position: trainingDayPosition ?? 'unknown',
    }),
    '',
    'RECENT MUSCLE FRESHNESS (key -> 0..100, lower means more fatigued):',
    JSON.stringify(recentStress),
    '',
    `EXERCISE HISTORY (last ${HISTORY_LOOKBACK_DAYS} days, warmups excluded; weight unit matches uses_imperial_units):`,
    JSON.stringify(history),
    '',
    'EXERCISE CATALOG (allow-list — choose only from these IDs):',
    JSON.stringify(catalogPayload),
  ];

  if (stretchPayload.length > 0) {
    blocks.push(
      '',
      'STRETCH CATALOG (use only for stretch/mobility additions when stretch_count > 0):',
      JSON.stringify(stretchPayload),
    );
  }

  return blocks.join('\n');
}

interface OpenAiResult {
  sessions: AiExercisePlan[][];
  model: string;
}

async function callOpenAi(params: {
  apiKey: string;
  model: string;
  catalog: AllowListedExercise[];
  stretchCatalog: AllowListedExercise[];
  user: UserContext;
  dayName: string;
  sessionsPerDay: number;
  constraints: DayConstraints;
  recentStress: Record<string, number>;
  history: Record<string, ExerciseHistorySummary>;
  trainingDayPosition: string | null;
}): Promise<OpenAiResult> {
  const { apiKey, model, sessionsPerDay, constraints, stretchCatalog } = params;
  const stretchCount = constraints.stretchCount > 0 && stretchCatalog.length > 0
    ? constraints.stretchCount
    : 0;

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(sessionsPerDay, constraints, stretchCount) },
      { role: 'user', content: buildUserPrompt(params) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'workout_day',
        strict: true,
        schema: buildResponseSchema(),
      },
    },
  };

  // Reasoning models (gpt-5*, o*) support reasoning_effort; keep latency low.
  // Non-reasoning models would reject the parameter.
  if (/^(gpt-5|o\d)/i.test(model)) {
    requestBody.reasoning_effort = 'low';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const message = json?.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`OpenAI refusal: ${String(message.refusal).slice(0, 200)}`);
  }
  const content: string | undefined = message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('OpenAI returned empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI response was not valid JSON');
  }

  const sessions = (parsed as { sessions?: unknown })?.sessions;
  if (!Array.isArray(sessions)) {
    throw new Error('OpenAI response missing "sessions" array');
  }

  const normalized: AiExercisePlan[][] = [];
  for (const group of sessions) {
    if (!Array.isArray(group)) continue;
    const entries: AiExercisePlan[] = [];
    for (const item of group) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      if (typeof obj.exercise_id !== 'string' || obj.exercise_id.length === 0) continue;
      entries.push({
        exercise_id: obj.exercise_id,
        sets: typeof obj.sets === 'number' ? obj.sets : null,
        reps: typeof obj.reps === 'number' ? obj.reps : null,
        duration_sec: typeof obj.duration_sec === 'number' ? obj.duration_sec : null,
        weight: typeof obj.weight === 'number' ? obj.weight : null,
        target_rpe: typeof obj.target_rpe === 'number' ? obj.target_rpe : null,
      });
    }
    normalized.push(entries);
  }

  const usedModel: string = typeof json?.model === 'string' ? json.model : model;
  return { sessions: normalized, model: usedModel };
}

// ============================================================================
// Validation
// ============================================================================

function inRange(value: number | null, min: number, max: number): boolean {
  return value !== null && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validate one exercise prescription against the catalog entry. Returns the
 * plan with targets nulled if they are out of bounds or mismatch the exercise
 * mode — the exercise itself is kept so the client can fall back to
 * prescription-based targets instead of losing the whole generation.
 */
function sanitizeTargets(plan: AiExercisePlan, exercise: AllowListedExercise): AiExercisePlan {
  const nulled: AiExercisePlan = {
    exercise_id: plan.exercise_id,
    sets: null,
    reps: null,
    duration_sec: null,
    weight: null,
    target_rpe: null,
  };

  const sets =
    plan.sets !== null && Number.isInteger(plan.sets) &&
    inRange(plan.sets, TARGET_BOUNDS.sets.min, TARGET_BOUNDS.sets.max)
      ? plan.sets
      : null;
  if (sets === null) return nulled;

  let reps: number | null = null;
  let durationSec: number | null = null;
  if (exercise.is_timed) {
    if (
      plan.duration_sec === null || !Number.isInteger(plan.duration_sec) ||
      !inRange(plan.duration_sec, TARGET_BOUNDS.durationSec.min, TARGET_BOUNDS.durationSec.max)
    ) {
      return nulled;
    }
    durationSec = plan.duration_sec;
  } else {
    if (
      plan.reps === null || !Number.isInteger(plan.reps) ||
      !inRange(plan.reps, TARGET_BOUNDS.reps.min, TARGET_BOUNDS.reps.max)
    ) {
      return nulled;
    }
    reps = plan.reps;
  }

  const weight = inRange(plan.weight, TARGET_BOUNDS.weight.min, TARGET_BOUNDS.weight.max)
    ? plan.weight
    : null;
  const targetRpe = inRange(plan.target_rpe, TARGET_BOUNDS.rpe.min, TARGET_BOUNDS.rpe.max)
    ? plan.target_rpe
    : null;

  return {
    exercise_id: plan.exercise_id,
    sets,
    reps,
    duration_sec: durationSec,
    weight,
    target_rpe: targetRpe,
  };
}

function stretchTargetsForExperience(experience: string): {
  sets: number;
  duration_sec: number;
} {
  return STRETCH_TARGETS_BY_EXPERIENCE[experience] ?? STRETCH_TARGETS_BY_EXPERIENCE.beginner;
}

/** Overwrite LLM stretch targets with evidence-based static-hold defaults (no RPE). */
function applyStretchPrescription(plan: AiExercisePlan, experience: string): AiExercisePlan {
  const t = stretchTargetsForExperience(experience);
  return {
    exercise_id: plan.exercise_id,
    sets: t.sets,
    reps: null,
    duration_sec: t.duration_sec,
    weight: null,
    target_rpe: null,
  };
}

function emptyStrengthPlan(exerciseId: string): AiExercisePlan {
  return {
    exercise_id: exerciseId,
    sets: null,
    reps: null,
    duration_sec: null,
    weight: null,
    target_rpe: null,
  };
}

function sessionMuscleSet(strengthExercises: AllowListedExercise[]): Set<string> {
  const muscles = new Set<string>();
  for (const ex of strengthExercises) {
    for (const m of ex.primary_muscles) muscles.add(m);
  }
  return muscles;
}

function scoreStretchOverlap(stretch: AllowListedExercise, sessionMuscles: Set<string>): number {
  let score = 0;
  for (const m of stretch.primary_muscles) {
    if (sessionMuscles.has(m)) score += 1;
  }
  return score;
}

function pickStretchesForSession(
  stretchCatalog: AllowListedExercise[],
  count: number,
  sessionMuscles: Set<string>,
  seenAcrossDay: Set<string>,
): AllowListedExercise[] {
  if (count <= 0) return [];
  return stretchCatalog
    .filter((ex) => !seenAcrossDay.has(ex.id))
    .sort((a, b) => scoreStretchOverlap(b, sessionMuscles) - scoreStretchOverlap(a, sessionMuscles))
    .slice(0, count);
}

function pickStrengthForSession(
  catalog: AllowListedExercise[],
  count: number,
  seenAcrossDay: Set<string>,
): AllowListedExercise[] {
  if (count <= 0) return [];
  return catalog
    .filter((ex) => !ex.is_stretch && !seenAcrossDay.has(ex.id))
    .sort((a, b) => a.priority_order - b.priority_order)
    .slice(0, count);
}

/**
 * Enforce the allow-list, dedupe, pad to user-requested counts, and apply
 * stretch prescriptions. When the user picks an exact exercise or stretch
 * count, we pad deterministically if the LLM returns too few.
 */
function finalizeAiSessions(
  raw: AiExercisePlan[][],
  catalog: AllowListedExercise[],
  stretchCatalog: AllowListedExercise[],
  catalogById: Map<string, AllowListedExercise>,
  sessionsPerDay: number,
  requestedExercisesPerSession: number | null,
  stretchCount: number,
  experience: string,
): { sessions: AiExercisePlan[][]; reason: null } | { sessions: null; reason: string } {
  if (raw.length !== sessionsPerDay) {
    return {
      sessions: null,
      reason: `session_count_mismatch: got ${raw.length}, expected ${sessionsPerDay}`,
    };
  }

  const maxStrengthPerSession = requestedExercisesPerSession !== null
    ? requestedExercisesPerSession
    : MAX_EXERCISES_PER_SESSION;
  const minStrengthPerSession = requestedExercisesPerSession !== null
    ? requestedExercisesPerSession
    : MIN_EXERCISES_PER_SESSION;

  const seenAcrossDay = new Set<string>();
  const finalized: AiExercisePlan[][] = [];

  for (const group of raw) {
    const sessionExercises: AiExercisePlan[] = [];
    const sessionStrengthMeta: AllowListedExercise[] = [];
    let strengthCount = 0;
    let stretchInSession = 0;

    for (const plan of group) {
      const exercise = catalogById.get(plan.exercise_id);
      if (!exercise) continue;
      if (seenAcrossDay.has(plan.exercise_id)) continue;

      if (exercise.is_stretch) {
        if (stretchCount === 0 || stretchInSession >= stretchCount) continue;
        stretchInSession += 1;
        seenAcrossDay.add(plan.exercise_id);
        sessionExercises.push(applyStretchPrescription(plan, experience));
      } else {
        if (strengthCount >= maxStrengthPerSession) continue;
        strengthCount += 1;
        seenAcrossDay.add(plan.exercise_id);
        sessionStrengthMeta.push(exercise);
        sessionExercises.push(sanitizeTargets(plan, exercise));
      }
    }

    const sessionMuscles = sessionMuscleSet(sessionStrengthMeta);

    if (requestedExercisesPerSession !== null && strengthCount < requestedExercisesPerSession) {
      const need = requestedExercisesPerSession - strengthCount;
      const fillers = pickStrengthForSession(catalog, need, seenAcrossDay);
      if (fillers.length < need) {
        return {
          sessions: null,
          reason: `too_few_exercises: could only pad ${fillers.length}/${need} strength exercises`,
        };
      }
      for (const ex of fillers) {
        seenAcrossDay.add(ex.id);
        sessionStrengthMeta.push(ex);
        sessionExercises.push(emptyStrengthPlan(ex.id));
        strengthCount += 1;
        for (const m of ex.primary_muscles) sessionMuscles.add(m);
      }
    }

    if (stretchCount > 0 && stretchInSession < stretchCount) {
      const need = stretchCount - stretchInSession;
      const fillers = pickStretchesForSession(
        stretchCatalog,
        need,
        sessionMuscles,
        seenAcrossDay,
      );
      if (fillers.length < need) {
        return {
          sessions: null,
          reason: `too_few_stretches: could only pad ${fillers.length}/${need} stretches`,
        };
      }
      for (const ex of fillers) {
        seenAcrossDay.add(ex.id);
        sessionExercises.push(applyStretchPrescription(emptyStrengthPlan(ex.id), experience));
        stretchInSession += 1;
      }
    }

    if (strengthCount < minStrengthPerSession) {
      return {
        sessions: null,
        reason: `too_few_exercises: session had ${strengthCount} strength exercises, need ${minStrengthPerSession}`,
      };
    }

    if (requestedExercisesPerSession !== null && strengthCount !== requestedExercisesPerSession) {
      return {
        sessions: null,
        reason: `strength_count_mismatch: got ${strengthCount}, expected ${requestedExercisesPerSession}`,
      };
    }

    if (stretchCount > 0 && stretchInSession !== stretchCount) {
      return {
        sessions: null,
        reason: `stretch_count_mismatch: got ${stretchInSession}, expected ${stretchCount}`,
      };
    }

    if (requestedExercisesPerSession === null && strengthCount > MAX_EXERCISES_PER_SESSION) {
      return {
        sessions: null,
        reason: `too_many_exercises: session had ${strengthCount} strength exercises, max ${MAX_EXERCISES_PER_SESSION}`,
      };
    }

    finalized.push(sessionExercises);
  }

  return { sessions: finalized, reason: null };
}

// ============================================================================
// History aggregation
// ============================================================================

interface HistorySetRow {
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rir: number | null;
  duration_sec: number | null;
  performed_at: string;
  v2_session_exercises: { exercise_id: string | null } | null;
}

/**
 * Collapse raw set rows (newest first) into one compact summary per exercise.
 * Only allow-listed exercises are kept so the prompt stays bounded.
 */
function summarizeHistory(
  rows: HistorySetRow[],
  allowedIds: Set<string>,
): Record<string, ExerciseHistorySummary> {
  interface Acc {
    summary: ExerciseHistorySummary;
    rpeSum: number;
    rpeCount: number;
  }
  const byExercise = new Map<string, Acc>();

  for (const row of rows) {
    const exerciseId = row.v2_session_exercises?.exercise_id;
    if (!exerciseId || !allowedIds.has(exerciseId)) continue;

    // RIR is stored exclusively of RPE; convert so avg_rpe reflects both.
    const effectiveRpe = row.rpe ?? (row.rir !== null ? 10 - row.rir : null);

    let acc = byExercise.get(exerciseId);
    if (!acc) {
      // Rows are ordered newest-first, so the first row seen is the last set performed.
      acc = {
        summary: {
          last_performed: row.performed_at.slice(0, 10),
          last_set: {
            weight: row.weight,
            reps: row.reps,
            duration_sec: row.duration_sec,
            rpe: effectiveRpe,
          },
          top_set: { weight: row.weight, reps: row.reps, duration_sec: row.duration_sec },
          avg_rpe: null,
          recent_set_count: 0,
        },
        rpeSum: 0,
        rpeCount: 0,
      };
      byExercise.set(exerciseId, acc);
    }

    acc.summary.recent_set_count += 1;
    if (effectiveRpe !== null) {
      acc.rpeSum += effectiveRpe;
      acc.rpeCount += 1;
    }

    // Top set = heaviest weight; for unweighted work, longest duration or most reps.
    const top = acc.summary.top_set;
    const beatsByWeight = (row.weight ?? -1) > (top.weight ?? -1);
    const tiesWeight = (row.weight ?? -1) === (top.weight ?? -1);
    const beatsByVolume =
      (row.duration_sec ?? 0) > (top.duration_sec ?? 0) || (row.reps ?? 0) > (top.reps ?? 0);
    if (beatsByWeight || (tiesWeight && beatsByVolume)) {
      acc.summary.top_set = { weight: row.weight, reps: row.reps, duration_sec: row.duration_sec };
    }
  }

  const result: Record<string, ExerciseHistorySummary> = {};
  for (const [exerciseId, acc] of byExercise) {
    acc.summary.avg_rpe =
      acc.rpeCount > 0 ? Math.round((acc.rpeSum / acc.rpeCount) * 10) / 10 : null;
    result[exerciseId] = acc.summary;
  }
  return result;
}

/**
 * Compute "training day N of M this week" so the LLM can map the weekday onto
 * the user's split deterministically. Returns null when the day isn't one of
 * the user's configured workout days.
 */
function computeTrainingDayPosition(dayName: string, workoutDays: string[]): string | null {
  if (workoutDays.length === 0) return null;
  const WEEK_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ordered = [...workoutDays].sort(
    (a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b),
  );
  const index = ordered.indexOf(dayName);
  if (index === -1) return null;
  return `training day ${index + 1} of ${ordered.length} this week`;
}

// ============================================================================
// Main handler
// ============================================================================

Deno.serve(async (req) => {
  const startedAt = Date.now();

  let auditUserId: string | null = null;
  let auditTemplateId: string | null = null;
  let auditDayName: string | null = null;
  let auditSessionsPerDay: number | null = null;
  let auditModel: string | null = null;

  // Service-role client used for ALL writes (audit log, admin reads). Created
  // up front so the catch handler can still record the failure.
  let serviceClient: ReturnType<typeof createClient> | null = null;

  const writeAudit = async (row: Omit<AuditRow, 'user_id'>) => {
    if (!serviceClient || !auditUserId) return;
    try {
      await serviceClient.from('v2_ai_generations').insert({
        user_id: auditUserId,
        template_id: row.template_id,
        day_name: row.day_name,
        sessions_per_day: row.sessions_per_day,
        exercise_count: row.exercise_count,
        model: row.model,
        source: row.source,
        latency_ms: row.latency_ms,
        error_code: row.error_code,
      });
    } catch (err) {
      console.error('Failed to write audit row:', err);
    }
  };

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openAiModel = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ------------------------------------------------------------------------
    // 1. Auth — derive userId from JWT, never trust the body.
    // ------------------------------------------------------------------------
    const authHeader = req.headers.get('authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!bearer) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }
    const userId = userData.user.id;
    auditUserId = userId;

    // ------------------------------------------------------------------------
    // 2. Parse + validate body.
    // ------------------------------------------------------------------------
    let body: GenerateRequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const templateId = body.templateId;
    if (!isUuid(templateId)) {
      return jsonResponse({ error: 'templateId must be a uuid' }, 400);
    }
    auditTemplateId = templateId;

    const sessionsPerDay = asPositiveInt(body.sessionsPerDay, MAX_SESSIONS_PER_DAY);
    if (sessionsPerDay === null) {
      return jsonResponse(
        { error: `sessionsPerDay must be 1..${MAX_SESSIONS_PER_DAY}` },
        400,
      );
    }
    auditSessionsPerDay = sessionsPerDay;

    const dayName = sanitizeDayName(body.dayName);
    auditDayName = dayName;

    const constraints = parseConstraints(body.constraints);

    // ------------------------------------------------------------------------
    // 3. Verify template ownership before anything expensive.
    // ------------------------------------------------------------------------
    const { data: tmpl, error: tmplErr } = await serviceClient
      .from('v2_workout_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .maybeSingle();

    if (tmplErr) {
      return jsonResponse({ error: 'Failed to load template' }, 500);
    }
    if (!tmpl || (tmpl as { user_id: string | null }).user_id !== userId) {
      return jsonResponse({ error: 'Template not found or not owned by user' }, 403);
    }

    // ------------------------------------------------------------------------
    // 4. Subscription gate + pro weekly rate limit.
    // ------------------------------------------------------------------------
    const { data: subProfile, error: subErr } = await serviceClient
      .from('v2_profiles')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (subErr) {
      return jsonResponse({ error: 'Failed to load subscription' }, 500);
    }

    const isPro = isProSubscriber(subProfile as {
      subscription_tier: string;
      subscription_expires_at: string | null;
    } | null);

    if (!isPro) {
      return jsonResponse(
        { error: 'paywall_required', code: 'paywall_required' },
        402,
      );
    }

    const windowStart = new Date(Date.now() - PRO_ROLLING_WINDOW_MS).toISOString();
    const { count: usedThisWeek, error: countErr } = await serviceClient
      .from('v2_ai_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart);

    if (countErr) {
      return jsonResponse({ error: 'Failed to check quota' }, 500);
    }

    const used = usedThisWeek ?? 0;
    if (used >= PRO_WEEKLY_QUOTA) {
      return jsonResponse(
        {
          error: 'Weekly AI generation quota exceeded',
          code: 'weekly_quota_exceeded',
        },
        429,
      );
    }

    // ------------------------------------------------------------------------
    // 5. Gather context (allow-list, profile, recent stress, set history).
    // ------------------------------------------------------------------------
    const historyCutoff = new Date(
      Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [allowListRes, stretchCatalogRes, profileRes, freshnessRes, historyRes] = await Promise.all([
      serviceClient
        .from('v2_ai_recommended_exercises')
        .select('exercise_id, priority_order, v2_exercises(id, name, primary_muscles, equipment_needed, is_timed, is_stretch, movement_pattern)')
        .eq('is_active', true)
        .order('priority_order', { ascending: true })
        .limit(CATALOG_PROMPT_LIMIT),
      constraints.stretchCount > 0
        ? serviceClient
          .from('v2_exercises')
          .select('id, name, primary_muscles, equipment_needed, is_timed, is_stretch, movement_pattern')
          .eq('is_stretch', true)
          .order('name', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      serviceClient
        .from('v2_profiles')
        .select('experience_level, equipment_access, days_per_week, preferred_training_style, workout_days, use_imperial, current_weight, goal_weight')
        .eq('id', userId)
        .maybeSingle(),
      serviceClient
        .from('v2_muscle_freshness')
        .select('muscle_key, freshness, last_trained_at')
        .eq('user_id', userId)
        .gte('last_trained_at', new Date(Date.now() - FRESHNESS_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()),
      serviceClient
        .from('v2_session_sets')
        .select(
          'reps, weight, rpe, rir, duration_sec, performed_at, v2_session_exercises!inner(exercise_id, v2_workout_sessions!inner(user_id, status))',
        )
        .eq('v2_session_exercises.v2_workout_sessions.user_id', userId)
        .eq('v2_session_exercises.v2_workout_sessions.status', 'completed')
        .neq('set_type', 'warmup')
        .not('performed_at', 'is', null)
        .gte('performed_at', historyCutoff)
        .order('performed_at', { ascending: false })
        .limit(HISTORY_MAX_SETS),
    ]);

    if (allowListRes.error || !allowListRes.data) {
      return jsonResponse({ error: 'Failed to load allow-list' }, 500);
    }
    if (stretchCatalogRes.error) {
      return jsonResponse({ error: 'Failed to load stretch catalog' }, 500);
    }

    const catalog: AllowListedExercise[] = [];
    for (const row of allowListRes.data as Array<{
      exercise_id: string;
      priority_order: number | null;
      v2_exercises: {
        id: string;
        name: string;
        primary_muscles: string[];
        equipment_needed: string[] | null;
        is_timed: boolean;
        is_stretch: boolean;
        movement_pattern: string | null;
      } | null;
    }>) {
      const ex = row.v2_exercises;
      if (!ex || ex.is_stretch) continue;
      catalog.push({
        id: ex.id,
        name: ex.name,
        primary_muscles: Array.isArray(ex.primary_muscles) ? ex.primary_muscles : [],
        equipment_needed: ex.equipment_needed,
        is_timed: !!ex.is_timed,
        is_stretch: false,
        movement_pattern: ex.movement_pattern,
        priority_order: row.priority_order ?? 999,
      });
    }

    const stretchCatalog: AllowListedExercise[] = [];
    for (const ex of (stretchCatalogRes.data ?? []) as Array<{
      id: string;
      name: string;
      primary_muscles: string[];
      equipment_needed: string[] | null;
      is_timed: boolean;
      is_stretch: boolean;
      movement_pattern: string | null;
    }>) {
      stretchCatalog.push({
        id: ex.id,
        name: ex.name,
        primary_muscles: Array.isArray(ex.primary_muscles) ? ex.primary_muscles : [],
        equipment_needed: ex.equipment_needed,
        is_timed: !!ex.is_timed,
        is_stretch: true,
        movement_pattern: ex.movement_pattern,
        priority_order: 999,
      });
    }

    if (catalog.length === 0) {
      return jsonResponse({ error: 'AI exercise allow-list is empty' }, 500);
    }

    const catalogById = new Map<string, AllowListedExercise>(
      [...catalog, ...stretchCatalog].map((ex) => [ex.id, ex]),
    );
    const stretchIds = new Set(stretchCatalog.map((ex) => ex.id));
    const allowedIds = new Set<string>(catalogById.keys());

    const profileRow = (profileRes.data ?? null) as {
      experience_level: string | null;
      equipment_access: string[] | null;
      days_per_week: number | null;
      preferred_training_style: string | null;
      workout_days: string[] | null;
      use_imperial: boolean | null;
      current_weight: number | null;
      goal_weight: number | null;
    } | null;

    const userContext: UserContext = {
      experience_level: profileRow?.experience_level || 'beginner',
      equipment_access: Array.isArray(profileRow?.equipment_access)
        ? (profileRow!.equipment_access as string[])
        : [],
      days_per_week: profileRow?.days_per_week ?? null,
      preferred_training_style: profileRow?.preferred_training_style ?? null,
      workout_days: Array.isArray(profileRow?.workout_days)
        ? (profileRow!.workout_days as string[])
        : [],
      use_imperial: profileRow?.use_imperial ?? true,
      current_weight: profileRow?.current_weight ?? null,
      goal_weight: profileRow?.goal_weight ?? null,
    };

    const recentStress: Record<string, number> = {};
    if (freshnessRes.data) {
      for (const row of freshnessRes.data as Array<{ muscle_key: string; freshness: number }>) {
        recentStress[row.muscle_key] = row.freshness;
      }
    }

    const history = summarizeHistory(
      (historyRes.data ?? []) as unknown as HistorySetRow[],
      allowedIds,
    );
    for (const stretchId of stretchIds) {
      delete history[stretchId];
    }

    const trainingDayPosition = computeTrainingDayPosition(dayName, userContext.workout_days);

    // ------------------------------------------------------------------------
    // 6. Call OpenAI (if configured) → validate → fall back if needed.
    // ------------------------------------------------------------------------
    let resultSessions: AiExercisePlan[][] | null = null;
    let source: 'openai' | 'fallback' = 'fallback';
    let model = 'none';
    let lastError: string | null = null;

    if (openAiApiKey) {
      try {
        const llm = await callOpenAi({
          apiKey: openAiApiKey,
          model: openAiModel,
          catalog,
          stretchCatalog,
          user: userContext,
          dayName,
          sessionsPerDay,
          constraints,
          recentStress,
          history,
          trainingDayPosition,
        });
        auditModel = llm.model;
        const validated = finalizeAiSessions(
          llm.sessions,
          catalog,
          stretchCatalog,
          catalogById,
          sessionsPerDay,
          constraints.exercisesPerSession,
          constraints.stretchCount > 0 && stretchCatalog.length > 0 ? constraints.stretchCount : 0,
          userContext.experience_level,
        );
        if (validated.sessions) {
          resultSessions = validated.sessions;
          source = 'openai';
          model = llm.model;
        } else {
          lastError = validated.reason ?? 'allow_list_validation_failed';
          console.error('AI session validation failed:', lastError);
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message.slice(0, 200) : 'openai_failed';
        console.error('OpenAI call failed:', lastError);
      }
    } else {
      lastError = 'no_openai_key';
    }

    const latencyMs = Date.now() - startedAt;
    const totalExercises = resultSessions
      ? resultSessions.reduce((acc, group) => acc + group.length, 0)
      : 0;

    // Always record an audit row — fallback calls still count against the quota
    // so a misbehaving client can't repeatedly trigger the LLM by sending bad
    // inputs. Pure 4xx (auth/quota/validation) responses don't reach this branch.
    await writeAudit({
      template_id: auditTemplateId,
      day_name: auditDayName,
      sessions_per_day: auditSessionsPerDay,
      exercise_count: totalExercises,
      model: auditModel,
      source,
      latency_ms: latencyMs,
      error_code: source === 'fallback' ? lastError : null,
    });

    return jsonResponse(
      {
        sessions: resultSessions ?? [],
        model,
        source,
        ...(source === 'fallback' ? { fallbackReason: lastError } : {}),
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-workout:', message);
    await writeAudit({
      template_id: auditTemplateId,
      day_name: auditDayName,
      sessions_per_day: auditSessionsPerDay,
      exercise_count: 0,
      model: auditModel,
      source: 'error',
      latency_ms: Date.now() - startedAt,
      error_code: message.slice(0, 200),
    });
    return jsonResponse({ error: 'Generation failed' }, 500);
  }
});
