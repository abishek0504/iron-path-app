/** HTTP handler for generate-workout. */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  CATALOG_FETCH_LIMIT,
  CATALOG_PROMPT_LIMIT,
  DEFAULT_MODEL,
  FRESHNESS_LOOKBACK_HOURS,
  HISTORY_LOOKBACK_DAYS,
  HISTORY_MAX_SETS,
  MAX_LLM_VALIDATION_ATTEMPTS,
  MAX_SESSIONS_PER_DAY,
  MIN_EXERCISES_PER_SESSION,
  AI_QUOTA_SOURCES,
  PRO_ROLLING_WINDOW_MS,
  PRO_WEEKLY_QUOTA,
} from './constants.ts';
import {
  exerciseHitsAvoidedMuscles,
  filterExercisesByDayFocus,
} from './dayFocus.ts';
import {
  asPositiveInt,
  isProSubscriber,
  isUuid,
  jsonResponse,
  normalizeJobId,
  parseConstraints,
  sanitizeDayName,
  toPublicFallbackReason,
} from './helpers.ts';
import {
  clampCoachExercisesPerSession,
  clampCoachSessionMinutes,
  sanitizeCoachNotes,
} from './coachNotes.ts';
import { computeTrainingDayPosition, summarizeHistory, type HistorySetRow } from './history.ts';
import {
  commitGenerationJob,
  getGenerationJob,
  markJobFailed,
  markJobGenerated,
  purgeExpiredJobs,
  upsertPendingJob,
} from './jobs.ts';
import { callOpenAi } from './openai.ts';
import type {
  AllowListedExercise,
  AiExercisePlan,
  AuditRow,
  GenerateRequestBody,
  UserContext,
} from './types.ts';
import { finalizeAiSessions } from './validation.ts';

export async function handleGenerateWorkout(req: Request): Promise<Response> {
  const startedAt = Date.now();

  let auditUserId: string | null = null;
  let auditTemplateId: string | null = null;
  let auditDayName: string | null = null;
  let auditSessionsPerDay: number | null = null;
  let auditModel: string | null = null;

  // Service-role client used for ALL writes (audit log, admin reads). Created
  // up front so the catch handler can still record the failure.
  let serviceClient: ReturnType<typeof createClient> | null = null;

  let auditJobId: string | null = null;

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
        generation_job_id: row.generation_job_id ?? auditJobId,
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

    void purgeExpiredJobs(serviceClient);

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
      console.error('generate-workout validation failed: templateId must be a uuid');
      return jsonResponse({ error: 'templateId must be a uuid' }, 400);
    }
    auditTemplateId = templateId;

    const idempotencyKey = await normalizeJobId(body.idempotencyKey);
    if (!idempotencyKey) {
      console.error('generate-workout validation failed: idempotencyKey missing');
      return jsonResponse({ error: 'idempotencyKey is required' }, 400);
    }
    if (!isUuid(body.idempotencyKey)) {
      console.warn(
        'generate-workout: normalized non-uuid idempotencyKey to',
        idempotencyKey.slice(0, 8),
      );
    }
    auditJobId = idempotencyKey;

    const dayId = body.dayId;
    if (!isUuid(dayId)) {
      console.error('generate-workout validation failed: dayId must be a uuid');
      return jsonResponse({ error: 'dayId must be a uuid' }, 400);
    }

    const sessionStartIso = typeof body.sessionStartIso === 'string' ? body.sessionStartIso : null;
    const sessionEndIsoExclusive = typeof body.sessionEndIsoExclusive === 'string'
      ? body.sessionEndIsoExclusive
      : null;
    if (!sessionStartIso || !sessionEndIsoExclusive) {
      console.error('generate-workout validation failed: session ISO bounds required');
      return jsonResponse({ error: 'sessionStartIso and sessionEndIsoExclusive are required' }, 400);
    }

    const sessionsPerDay = asPositiveInt(body.sessionsPerDay, MAX_SESSIONS_PER_DAY);
    if (sessionsPerDay === null) {
      console.error('generate-workout validation failed: sessionsPerDay out of range');
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
    // 4. Idempotency job — skip OpenAI / return early when already committed.
    // ------------------------------------------------------------------------
    const existingJob = await getGenerationJob(serviceClient, idempotencyKey, userId);

    if (existingJob?.status === 'committed') {
      return jsonResponse({
        sessions: [],
        model: existingJob.model ?? 'unknown',
        source: 'openai',
        committed: true,
        slotsCreated: existingJob.slots_created,
      }, 200);
    }

    let resultSessions: AiExercisePlan[][] | null = null;
    let model = 'none';
    let lastError: string | null = null;
    let skipOpenAi = false;

    if (
      existingJob?.status === 'generated' &&
      Array.isArray(existingJob.sessions_json) &&
      existingJob.sessions_json.length > 0
    ) {
      skipOpenAi = true;
      resultSessions = existingJob.sessions_json as AiExercisePlan[][];
      model = existingJob.model ?? 'unknown';
      auditModel = model;
    } else if (
      existingJob?.status === 'failed' &&
      Array.isArray(existingJob.sessions_json) &&
      existingJob.sessions_json.length > 0
    ) {
      skipOpenAi = true;
      resultSessions = existingJob.sessions_json as AiExercisePlan[][];
      model = existingJob.model ?? 'unknown';
      auditModel = model;
      await markJobGenerated(serviceClient, idempotencyKey, resultSessions, model);
    }

    if (!skipOpenAi) {
      const upserted = await upsertPendingJob(serviceClient, {
        id: idempotencyKey,
        userId,
        templateId,
        dayId,
        dayName,
        sessionsPerDay,
        constraints: constraints as unknown as Record<string, unknown>,
        sessionStartIso,
        sessionEndIsoExclusive,
      });
      if (!upserted) {
        return jsonResponse({ error: 'Failed to create generation job' }, 500);
      }

      // ------------------------------------------------------------------------
      // 5. Subscription gate + pro weekly rate limit.
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
        .in('source', [...AI_QUOTA_SOURCES])
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
      // 6. Gather context (allow-list, profile, recent stress, set history).
      // ------------------------------------------------------------------------
      const historyCutoff = new Date(
        Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [allowListRes, stretchCatalogRes, profileLookup, freshnessRes, historyRes] = await Promise.all([
        serviceClient
          .from('v2_ai_recommended_exercises')
          .select('exercise_id, priority_order, v2_exercises(id, name, primary_muscles, equipment_needed, is_timed, is_stretch, movement_pattern)')
          .eq('is_active', true)
          .order('priority_order', { ascending: true })
          .limit(CATALOG_FETCH_LIMIT),
        constraints.stretchCount > 0
          ? serviceClient
            .from('v2_exercises')
            .select('id, name, primary_muscles, equipment_needed, is_timed, is_stretch, movement_pattern')
            .eq('is_stretch', true)
            .order('name', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        serviceClient
          .from('v2_profiles')
          .select('experience_level, equipment_access, days_per_week, preferred_training_style, workout_days, use_imperial, current_weight, goal_weight, goal, ai_coach_session_minutes, ai_coach_exercises_per_session, ai_coach_notes')
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
      let profileRes = profileLookup;
      if (profileRes.error) {
        const profileRetry = await serviceClient
          .from('v2_profiles')
          .select('experience_level, equipment_access, days_per_week, preferred_training_style, workout_days, use_imperial, current_weight, goal_weight, goal')
          .eq('id', userId)
          .maybeSingle();
        if (profileRetry.error) {
          return jsonResponse({ error: 'Failed to load profile' }, 500);
        }
        profileRes = profileRetry;
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

      const promptCatalog = filterExercisesByDayFocus(catalog, constraints.dayFocus)
        .filter((ex) => !exerciseHitsAvoidedMuscles(ex, constraints.avoidMuscles))
        .slice(0, CATALOG_PROMPT_LIMIT);

      if (promptCatalog.length < MIN_EXERCISES_PER_SESSION) {
        return jsonResponse(
          { error: 'Not enough allow-listed exercises for those constraints', code: 'focus_catalog_too_small' },
          400,
        );
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
        goal: string | null;
        ai_coach_session_minutes: number | null;
        ai_coach_exercises_per_session: number | null;
        ai_coach_notes: string | null;
      } | null;

      const notesResult = sanitizeCoachNotes(profileRow?.ai_coach_notes);
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
        goal: profileRow?.goal ?? null,
        session_minutes: clampCoachSessionMinutes(profileRow?.ai_coach_session_minutes),
        exercises_per_session: clampCoachExercisesPerSession(
          profileRow?.ai_coach_exercises_per_session,
        ),
        coach_notes: notesResult.ok ? notesResult.notes : null,
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
      // 7. Call OpenAI (if configured) → validate.
      // ------------------------------------------------------------------------
      if (openAiApiKey) {
        for (let attempt = 1; attempt <= MAX_LLM_VALIDATION_ATTEMPTS; attempt++) {
          try {
            const llm = await callOpenAi({
              apiKey: openAiApiKey,
              model: openAiModel,
              catalog: promptCatalog,
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
              promptCatalog,
              stretchCatalog,
              catalogById,
              sessionsPerDay,
              constraints.exercisesPerSession,
              constraints.stretchCount > 0 && stretchCatalog.length > 0 ? constraints.stretchCount : 0,
              userContext.experience_level,
              constraints,
            );
            if (validated.sessions) {
              resultSessions = validated.sessions;
              model = llm.model;
              break;
            }
            lastError = validated.reason ?? 'allow_list_validation_failed';
            console.error(
              `AI session validation failed (attempt ${attempt}/${MAX_LLM_VALIDATION_ATTEMPTS}):`,
              lastError,
            );
          } catch (err) {
            lastError = err instanceof Error ? err.message.slice(0, 200) : 'openai_failed';
            console.error(
              `OpenAI call failed (attempt ${attempt}/${MAX_LLM_VALIDATION_ATTEMPTS}):`,
              lastError,
            );
            break;
          }
        }
      } else {
        lastError = 'no_openai_key';
      }

      if (resultSessions) {
        const marked = await markJobGenerated(
          serviceClient,
          idempotencyKey,
          resultSessions,
          model,
        );
        if (!marked) {
          lastError = 'job_persist_failed';
          resultSessions = null;
        }
      }
    }

    const latencyMs = Date.now() - startedAt;

    if (resultSessions) {
      const commitResult = await commitGenerationJob(serviceClient, idempotencyKey);
      if (commitResult && commitResult.slotsCreated > 0) {
        const totalExercises = resultSessions.reduce((acc, group) => acc + group.length, 0);
        await writeAudit({
          template_id: auditTemplateId,
          day_name: auditDayName,
          sessions_per_day: auditSessionsPerDay,
          exercise_count: totalExercises,
          model: auditModel ?? model,
          source: 'openai',
          latency_ms: latencyMs,
          error_code: null,
          generation_job_id: idempotencyKey,
        });

        return jsonResponse({
          sessions: resultSessions,
          model,
          source: 'openai',
          committed: true,
          slotsCreated: commitResult.slotsCreated,
        }, 200);
      }

      await markJobFailed(serviceClient, idempotencyKey, 'commit_failed');
      return jsonResponse({
        sessions: [],
        model,
        source: 'fallback',
        fallbackReason: 'commit_failed',
      }, 200);
    }

    await writeAudit({
      template_id: auditTemplateId,
      day_name: auditDayName,
      sessions_per_day: auditSessionsPerDay,
      exercise_count: 0,
      model: auditModel,
      source: 'fallback',
      latency_ms: latencyMs,
      error_code: lastError,
      generation_job_id: idempotencyKey,
    });

    return jsonResponse(
      {
        sessions: [],
        model,
        source: 'fallback',
        ...(lastError ? { fallbackReason: toPublicFallbackReason(lastError) } : {}),
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
}
