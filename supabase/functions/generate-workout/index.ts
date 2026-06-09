/**
 * Edge Function: Generate Workout (Gemini-powered)
 *
 * Generates a list of exercise IDs for a single template day. The LLM only ever
 * sees an allow-listed exercise catalog (`v2_ai_recommended_exercises`), and
 * every ID it returns is validated against that allow-list before being sent to
 * the client. If validation fails or the LLM call errors out, we return a
 * `fallback` signal so the client can run its deterministic engine instead.
 *
 * The Gemini API key (`GEMINI_API_KEY`) lives only as a Supabase Function
 * secret — it is never shipped in the mobile bundle.
 *
 * Request body (JSON):
 *   {
 *     templateId: string  (uuid, must be owned by the caller)
 *     dayName: string     (display name, e.g. "Push", informs the LLM intent)
 *     sessionsPerDay: int (1..6)
 *   }
 *
 * Response (JSON):
 *   {
 *     sessions: string[][]   // exercise IDs grouped by session (length === sessionsPerDay)
 *     model: string          // model identifier used (or 'none' on fallback)
 *     source: 'gemini' | 'fallback'
 *     remainingToday: int    // generations remaining in the user's daily quota
 *   }
 *
 * Status codes:
 *   200  success (source may be 'fallback' — client should still consume `sessions` if non-empty)
 *   400  bad request (missing/invalid params)
 *   401  invalid or missing JWT
 *   403  template not owned by the caller
 *   429  daily quota exceeded
 *   500  unexpected server error
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================================
// Constants
// ============================================================================

/** Per-user daily quota for AI generations. Recorded in v2_ai_generations. */
const DAILY_QUOTA = 10;

/** Hard upper bound on sessionsPerDay (defense-in-depth; also enforced in DB engine). */
const MAX_SESSIONS_PER_DAY = 6;

/** Hard upper bound on exercises returned per session — keeps prompts small and bounds DB inserts. */
const MAX_EXERCISES_PER_SESSION = 8;

/** Minimum exercises per session — prevents the LLM from returning empty lists. */
const MIN_EXERCISES_PER_SESSION = 2;

/** Lookback window for recent muscle freshness — must match the engine's 48h window. */
const FRESHNESS_LOOKBACK_HOURS = 48;

/** Default Gemini model. Overridable via `GEMINI_MODEL` env. */
const DEFAULT_MODEL = 'gemini-2.0-flash';

/** Hard timeout for the Gemini call so a slow upstream can't hold the function open. */
const GEMINI_TIMEOUT_MS = 15_000;

// ============================================================================
// Types
// ============================================================================

interface GenerateRequestBody {
  templateId?: unknown;
  dayName?: unknown;
  sessionsPerDay?: unknown;
}

interface AllowListedExercise {
  id: string;
  name: string;
  primary_muscles: string[];
  equipment_needed: string[] | null;
  is_timed: boolean;
  movement_pattern: string | null;
  priority_order: number;
}

interface UserContext {
  experience_level: string;
  equipment_access: string[];
  days_per_week: number | null;
  preferred_training_style: string | null;
}

interface AuditRow {
  user_id: string;
  template_id: string | null;
  day_name: string | null;
  sessions_per_day: number | null;
  exercise_count: number | null;
  model: string | null;
  source: 'gemini' | 'fallback' | 'error';
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

// ============================================================================
// Gemini call
// ============================================================================

/**
 * Build a compact, deterministic prompt for the LLM.
 *
 * Design decisions:
 *   * The exercise catalog is sent as JSON (id + name + muscles + equipment +
 *     is_timed + movement_pattern). IDs are the source of truth — the LLM is
 *     told to echo them verbatim.
 *   * Recent muscle stress is included so the LLM can avoid hammering tired
 *     muscles. Higher score = more recent fatigue.
 *   * The response schema is strict and mirrored in `generationConfig.responseSchema`.
 */
function buildGeminiRequest(params: {
  catalog: AllowListedExercise[];
  user: UserContext;
  dayName: string;
  sessionsPerDay: number;
  recentStress: Record<string, number>;
}): { contents: unknown[]; generationConfig: unknown } {
  const { catalog, user, dayName, sessionsPerDay, recentStress } = params;

  const catalogPayload = catalog.map((ex) => ({
    id: ex.id,
    name: ex.name,
    muscles: ex.primary_muscles,
    equipment: ex.equipment_needed ?? [],
    movement_pattern: ex.movement_pattern,
    is_timed: ex.is_timed,
  }));

  const promptText = [
    'You are a strength-training coach generating exercise selections for a single workout day.',
    '',
    'CONSTRAINTS (strict):',
    `- Output exactly ${sessionsPerDay} session(s).`,
    `- Each session must contain ${MIN_EXERCISES_PER_SESSION}-${MAX_EXERCISES_PER_SESSION} exercises.`,
    '- Use ONLY exercise IDs from the provided catalog. Echo the IDs verbatim.',
    '- Do not repeat the same exercise within or across sessions for this day.',
    '- Avoid muscles that already have high recent stress (closer to 100 = fresher; lower = more recently fatigued).',
    `- Bias selection toward the day intent: "${dayName}".`,
    '- Prefer the experience-appropriate progression for the lifter.',
    '',
    'USER CONTEXT:',
    JSON.stringify({
      experience_level: user.experience_level,
      equipment_access: user.equipment_access,
      days_per_week: user.days_per_week,
      preferred_training_style: user.preferred_training_style,
    }),
    '',
    'RECENT MUSCLE FRESHNESS (key -> 0..100, lower means more fatigued):',
    JSON.stringify(recentStress),
    '',
    'EXERCISE CATALOG (allow-list — choose only from these IDs):',
    JSON.stringify(catalogPayload),
    '',
    'Return JSON in the schema specified by the API contract.',
  ].join('\n');

  const generationConfig = {
    temperature: 0.4,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        sessions: {
          type: 'ARRAY',
          minItems: sessionsPerDay,
          maxItems: sessionsPerDay,
          items: {
            type: 'ARRAY',
            minItems: MIN_EXERCISES_PER_SESSION,
            maxItems: MAX_EXERCISES_PER_SESSION,
            items: { type: 'STRING' },
          },
        },
      },
      required: ['sessions'],
    },
  };

  return {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig,
  };
}

interface GeminiResult {
  sessions: string[][];
  model: string;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  catalog: AllowListedExercise[];
  user: UserContext;
  dayName: string;
  sessionsPerDay: number;
  recentStress: Record<string, number>;
}): Promise<GeminiResult> {
  const { apiKey, model } = params;
  const body = buildGeminiRequest(params);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const text: string | undefined =
    json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Gemini returned empty response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini response was not valid JSON');
  }

  const sessions = (parsed as { sessions?: unknown })?.sessions;
  if (!Array.isArray(sessions)) {
    throw new Error('Gemini response missing "sessions" array');
  }

  const normalized: string[][] = [];
  for (const group of sessions) {
    if (!Array.isArray(group)) continue;
    const ids = group.filter((v): v is string => typeof v === 'string' && v.length > 0);
    normalized.push(ids);
  }

  return { sessions: normalized, model };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Enforce the allow-list and dedupe within the day.
 *
 * Returns `null` if the result can't be salvaged (no valid IDs at all, or any
 * session ends up empty). Callers treat null as "fallback to local engine".
 */
function validateAgainstAllowList(
  raw: string[][],
  allowedIds: Set<string>,
  sessionsPerDay: number,
): string[][] | null {
  if (raw.length !== sessionsPerDay) return null;

  const seenAcrossDay = new Set<string>();
  const validated: string[][] = [];

  for (const group of raw) {
    const sessionExercises: string[] = [];
    for (const id of group) {
      if (!allowedIds.has(id)) continue;
      if (seenAcrossDay.has(id)) continue;
      seenAcrossDay.add(id);
      sessionExercises.push(id);
      if (sessionExercises.length >= MAX_EXERCISES_PER_SESSION) break;
    }
    if (sessionExercises.length < MIN_EXERCISES_PER_SESSION) return null;
    validated.push(sessionExercises);
  }

  return validated;
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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;

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
    // 4. Rate-limit check.
    // ------------------------------------------------------------------------
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: usedToday, error: countErr } = await serviceClient
      .from('v2_ai_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo);

    if (countErr) {
      return jsonResponse({ error: 'Failed to check quota' }, 500);
    }

    const used = usedToday ?? 0;
    if (used >= DAILY_QUOTA) {
      return jsonResponse(
        {
          error: 'Daily AI generation quota exceeded',
          quota: DAILY_QUOTA,
          remainingToday: 0,
          retryAfterHours: 24,
        },
        429,
      );
    }
    const remainingTodayBefore = DAILY_QUOTA - used;

    // ------------------------------------------------------------------------
    // 5. Gather context (allow-list, profile, recent stress).
    // ------------------------------------------------------------------------
    const [allowListRes, profileRes, freshnessRes] = await Promise.all([
      serviceClient
        .from('v2_ai_recommended_exercises')
        .select('exercise_id, priority_order, v2_exercises(id, name, primary_muscles, equipment_needed, is_timed, movement_pattern)')
        .eq('is_active', true)
        .order('priority_order', { ascending: true })
        .limit(80),
      serviceClient
        .from('v2_profiles')
        .select('experience_level, equipment_access, days_per_week, preferred_training_style')
        .eq('id', userId)
        .maybeSingle(),
      serviceClient
        .from('v2_muscle_freshness')
        .select('muscle_key, freshness, last_trained_at')
        .eq('user_id', userId)
        .gte('last_trained_at', new Date(Date.now() - FRESHNESS_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()),
    ]);

    if (allowListRes.error || !allowListRes.data) {
      return jsonResponse({ error: 'Failed to load allow-list' }, 500);
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
        movement_pattern: string | null;
      } | null;
    }>) {
      const ex = row.v2_exercises;
      if (!ex) continue;
      catalog.push({
        id: ex.id,
        name: ex.name,
        primary_muscles: Array.isArray(ex.primary_muscles) ? ex.primary_muscles : [],
        equipment_needed: ex.equipment_needed,
        is_timed: !!ex.is_timed,
        movement_pattern: ex.movement_pattern,
        priority_order: row.priority_order ?? 999,
      });
    }

    if (catalog.length === 0) {
      return jsonResponse({ error: 'AI exercise allow-list is empty' }, 500);
    }

    const allowedIds = new Set<string>(catalog.map((ex) => ex.id));

    const profileRow = (profileRes.data ?? null) as {
      experience_level: string | null;
      equipment_access: string[] | null;
      days_per_week: number | null;
      preferred_training_style: string | null;
    } | null;

    const userContext: UserContext = {
      experience_level: profileRow?.experience_level || 'beginner',
      equipment_access: Array.isArray(profileRow?.equipment_access)
        ? (profileRow!.equipment_access as string[])
        : [],
      days_per_week: profileRow?.days_per_week ?? null,
      preferred_training_style: profileRow?.preferred_training_style ?? null,
    };

    const recentStress: Record<string, number> = {};
    if (freshnessRes.data) {
      for (const row of freshnessRes.data as Array<{ muscle_key: string; freshness: number }>) {
        recentStress[row.muscle_key] = row.freshness;
      }
    }

    // ------------------------------------------------------------------------
    // 6. Call Gemini (if configured) → validate → fall back if needed.
    // ------------------------------------------------------------------------
    let resultSessions: string[][] | null = null;
    let source: 'gemini' | 'fallback' = 'fallback';
    let model = 'none';
    let lastError: string | null = null;

    if (geminiApiKey) {
      try {
        const llm = await callGemini({
          apiKey: geminiApiKey,
          model: geminiModel,
          catalog,
          user: userContext,
          dayName,
          sessionsPerDay,
          recentStress,
        });
        auditModel = llm.model;
        const validated = validateAgainstAllowList(llm.sessions, allowedIds, sessionsPerDay);
        if (validated) {
          resultSessions = validated;
          source = 'gemini';
          model = llm.model;
        } else {
          lastError = 'allow_list_validation_failed';
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message.slice(0, 200) : 'gemini_failed';
        console.error('Gemini call failed:', lastError);
      }
    } else {
      lastError = 'no_gemini_key';
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
        remainingToday: Math.max(0, remainingTodayBefore - 1),
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
