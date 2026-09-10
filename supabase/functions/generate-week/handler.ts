/** HTTP handler for generate-week (AI Coach). */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  AI_QUOTA_SOURCES,
  CATALOG_FETCH_LIMIT,
  DEFAULT_MODEL,
  FRESHNESS_LOOKBACK_HOURS,
  HISTORY_LOOKBACK_DAYS,
  HISTORY_MAX_SETS,
  MAX_LLM_VALIDATION_ATTEMPTS,
  MIN_EXERCISES_PER_SESSION,
  PRO_ROLLING_WINDOW_MS,
  PRO_WEEKLY_QUOTA,
} from '../generate-workout/constants.ts';
import { filterExercisesByDayFocus } from '../generate-workout/dayFocus.ts';
import {
  isProSubscriber,
  isUuid,
  jsonResponse,
  normalizeJobId,
  sanitizeConstraintText,
  sanitizeDayName,
  toPublicFallbackReason,
} from '../generate-workout/helpers.ts';
import { summarizeHistory, type HistorySetRow } from '../generate-workout/history.ts';
import type { AllowListedExercise, UserContext } from '../generate-workout/types.ts';
import {
  CATALOG_WEEK_PROMPT_LIMIT,
  MAX_WEEK_DAYS,
  RECENT_EXERCISE_LIMIT,
  RECENT_EXERCISE_LOOKBACK_DAYS,
} from './constants.ts';
import {
  commitWeekJob,
  getWeekJob,
  markWeekJobFailed,
  markWeekJobGenerated,
  purgeExpiredWeekJobs,
  upsertPendingWeekJob,
} from './jobs.ts';
import { callWeekOpenAi } from './openai.ts';
import type { WeekDayCatalog } from './prompts.ts';
import {
  clampCoachExercisesPerSession,
  clampCoachSessionMinutes,
  sanitizeCoachNotes,
} from '../generate-workout/coachNotes.ts';
import type { GenerateWeekDayInput, GenerateWeekRequestBody, WeekDayPlan, WeekSplitDayInput } from './types.ts';
import { finalizeCoachWeek } from './weekValidation.ts';
import { shouldReuseWeekJobSessions } from './weekJobReuse.ts';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseWeekDays(raw: unknown): GenerateWeekDayInput[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_WEEK_DAYS) return null;
  const days: GenerateWeekDayInput[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;
    if (!isUuid(obj.dayId)) return null;
    if (seen.has(obj.dayId)) return null;
    seen.add(obj.dayId);
    const sessionStartIso = typeof obj.sessionStartIso === 'string' ? obj.sessionStartIso : null;
    const sessionEndIsoExclusive =
      typeof obj.sessionEndIsoExclusive === 'string' ? obj.sessionEndIsoExclusive : null;
    if (!sessionStartIso || !sessionEndIsoExclusive) return null;
    const dayIndex =
      typeof obj.dayIndex === 'number' && Number.isInteger(obj.dayIndex) ? obj.dayIndex : days.length;
    const trainingDayIndex =
      typeof obj.trainingDayIndex === 'number' && Number.isInteger(obj.trainingDayIndex)
        ? obj.trainingDayIndex
        : days.length;
    days.push({
      dayId: obj.dayId,
      dayName: sanitizeDayName(obj.dayName),
      dayIndex,
      trainingDayIndex,
      dayFocus: sanitizeConstraintText(obj.dayFocus, 48),
      sessionStartIso,
      sessionEndIsoExclusive,
    });
  }

  return days;
}

function parseWeekSplit(raw: unknown): WeekSplitDayInput[] {
  if (!Array.isArray(raw)) return [];
  const days: WeekSplitDayInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const dayName = sanitizeDayName(obj.dayName);
    const trainingDayIndex =
      typeof obj.trainingDayIndex === 'number' && Number.isInteger(obj.trainingDayIndex)
        ? obj.trainingDayIndex
        : days.length;
    const trainingDayPosition =
      typeof obj.trainingDayPosition === 'string' && obj.trainingDayPosition.trim()
        ? obj.trainingDayPosition.trim().slice(0, 64)
        : `training day ${trainingDayIndex + 1} of ${raw.length} this week`;
    days.push({
      dayName,
      dayFocus: sanitizeConstraintText(obj.dayFocus, 48),
      trainingDayIndex,
      trainingDayPosition,
    });
  }
  return days;
}

function parseDayFocusMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [dayName, focus] of Object.entries(raw as Record<string, unknown>)) {
    const cleaned = sanitizeConstraintText(focus, 48);
    if (cleaned) result[dayName] = cleaned;
  }
  return result;
}

function isWeekStartDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function handleGenerateWeek(req: Request): Promise<Response> {
  const startedAt = Date.now();

  let auditUserId: string | null = null;
  let auditTemplateId: string | null = null;
  let auditModel: string | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;
  let auditJobId: string | null = null;

  const writeAudit = async (row: {
    day_name: string | null;
    sessions_per_day: number | null;
    exercise_count: number | null;
    source: 'openai_week' | 'fallback' | 'error';
    error_code: string | null;
  }) => {
    if (!serviceClient || !auditUserId) return;
    try {
      await serviceClient.from('v2_ai_generations').insert({
        user_id: auditUserId,
        template_id: auditTemplateId,
        day_name: row.day_name,
        sessions_per_day: row.sessions_per_day,
        exercise_count: row.exercise_count,
        model: auditModel,
        source: row.source,
        latency_ms: Date.now() - startedAt,
        error_code: row.error_code,
        week_job_id: auditJobId,
      });
    } catch (err) {
      console.error('Failed to write week audit row:', err);
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
    void purgeExpiredWeekJobs(serviceClient);

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

    let body: GenerateWeekRequestBody;
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

    const idempotencyKey = await normalizeJobId(body.idempotencyKey);
    if (!idempotencyKey) {
      return jsonResponse({ error: 'idempotencyKey is required' }, 400);
    }
    auditJobId = idempotencyKey;

    const mode = body.mode === 'regenerate' ? 'regenerate' : body.mode === 'auto' ? 'auto' : null;
    if (!mode) {
      return jsonResponse({ error: 'mode must be auto or regenerate' }, 400);
    }

    if (!isWeekStartDate(body.weekStartDate)) {
      return jsonResponse({ error: 'weekStartDate must be YYYY-MM-DD' }, 400);
    }

    const days = parseWeekDays(body.days);
    if (!days) {
      return jsonResponse({ error: 'days must be 1-7 unique template days with session bounds' }, 400);
    }

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

    const { data: templateDays, error: daysErr } = await serviceClient
      .from('v2_template_days')
      .select('id, template_id')
      .eq('template_id', templateId)
      .in('id', days.map((day) => day.dayId));

    if (daysErr || !templateDays || templateDays.length !== days.length) {
      return jsonResponse({ error: 'One or more days are not on this template' }, 403);
    }

    const existingJob = await getWeekJob(serviceClient, idempotencyKey, userId);
    if (existingJob?.status === 'committed') {
      return jsonResponse({
        days: [],
        model: existingJob.model ?? 'unknown',
        source: 'openai',
        committed: true,
        slotsCreated: existingJob.slots_created,
      }, 200);
    }

    let resultDays: WeekDayPlan[] | null = null;
    let model = 'none';
    let lastError: string | null = null;
    let skipOpenAi = false;
    const requestedExercisesPerSession = clampCoachExercisesPerSession(body.exercisesPerSession);

    if (
      shouldReuseWeekJobSessions({
        status: existingJob?.status,
        sessions: existingJob?.sessions_json,
        exercisesPerSession: requestedExercisesPerSession,
      })
    ) {
      skipOpenAi = true;
      resultDays = existingJob!.sessions_json;
      model = existingJob?.model ?? 'unknown';
      auditModel = model;
      if (existingJob?.status === 'failed' && resultDays) {
        await markWeekJobGenerated(serviceClient, idempotencyKey, resultDays, model);
      }
    }

    if (!skipOpenAi) {
      const upserted = await upsertPendingWeekJob(serviceClient, {
        id: idempotencyKey,
        userId,
        templateId,
        mode,
        weekStartDate: body.weekStartDate,
        days,
      });
      if (!upserted) {
        return jsonResponse({ error: 'Failed to create week job' }, 500);
      }

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
        return jsonResponse({ error: 'paywall_required', code: 'paywall_required' }, 402);
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
      if ((usedThisWeek ?? 0) >= PRO_WEEKLY_QUOTA) {
        return jsonResponse(
          { error: 'Weekly AI generation quota exceeded', code: 'weekly_quota_exceeded' },
          429,
        );
      }

      const historyCutoff = new Date(
        Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const recentCutoff = new Date(
        Date.now() - RECENT_EXERCISE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [allowListRes, profileLookup, freshnessRes, historyRes, recentRes, slotRes] = await Promise.all([
        serviceClient
          .from('v2_ai_recommended_exercises')
          .select('exercise_id, priority_order, v2_exercises(id, name, primary_muscles, equipment_needed, is_timed, is_stretch, movement_pattern)')
          .eq('is_active', true)
          .order('priority_order', { ascending: true })
          .limit(CATALOG_FETCH_LIMIT),
        serviceClient
          .from('v2_profiles')
          .select('experience_level, equipment_access, days_per_week, preferred_training_style, workout_days, use_imperial, current_weight, goal_weight, goal, ai_coach_session_minutes, ai_coach_exercises_per_session, ai_coach_day_focus, ai_coach_notes')
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
        serviceClient
          .from('v2_session_exercises')
          .select('exercise_id, v2_exercises(name), v2_workout_sessions!inner(user_id, status, started_at)')
          .eq('v2_workout_sessions.user_id', userId)
          .eq('v2_workout_sessions.status', 'completed')
          .gte('v2_workout_sessions.started_at', recentCutoff)
          .limit(RECENT_EXERCISE_LIMIT),
        serviceClient
          .from('v2_template_slots')
          .select('exercise_id, v2_exercises(name), v2_template_days!inner(template_id)')
          .eq('v2_template_days.template_id', templateId)
          .limit(RECENT_EXERCISE_LIMIT),
      ]);

      if (allowListRes.error || !allowListRes.data) {
        return jsonResponse({ error: 'Failed to load allow-list' }, 500);
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

      if (catalog.length === 0) {
        return jsonResponse({ error: 'AI exercise allow-list is empty' }, 500);
      }

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
        ai_coach_day_focus: Record<string, string> | null;
        ai_coach_notes: string | null;
      } | null;

      const notesResult = sanitizeCoachNotes(profileRow?.ai_coach_notes);
      const sessionMinutes = clampCoachSessionMinutes(
        profileRow?.ai_coach_session_minutes ?? body.sessionMinutes,
      );
      const exercisesPerSession = clampCoachExercisesPerSession(
        profileRow?.ai_coach_exercises_per_session ?? body.exercisesPerSession,
      );
      const profileFocusMap = parseDayFocusMap(profileRow?.ai_coach_day_focus);
      for (const day of days) {
        const pinned = profileFocusMap[day.dayName];
        if (pinned) day.dayFocus = pinned;
      }

      const catalogById = new Map(catalog.map((ex) => [ex.id, ex]));
      const dayCatalogs: WeekDayCatalog[] = [];
      const dayCatalogMap = new Map<string, AllowListedExercise[]>();

      for (const day of days) {
        const focused = filterExercisesByDayFocus(catalog, day.dayFocus)
          .slice(0, CATALOG_WEEK_PROMPT_LIMIT);
        if (focused.length < MIN_EXERCISES_PER_SESSION) {
          return jsonResponse(
            { error: 'Not enough allow-listed exercises for those constraints', code: 'focus_catalog_too_small' },
            400,
          );
        }
        dayCatalogs.push({ day, catalog: focused });
        dayCatalogMap.set(day.dayId, focused);
      }

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
        session_minutes: sessionMinutes,
        exercises_per_session: exercisesPerSession,
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
        new Set(catalogById.keys()),
      );

      const recentExercises: { id: string; name: string; source: string }[] = [];
      const seenRecent = new Set<string>();
      for (const row of (recentRes.data ?? []) as Array<{
        exercise_id: string | null;
        v2_exercises: { name: string } | null;
      }>) {
        if (!row.exercise_id || seenRecent.has(row.exercise_id)) continue;
        seenRecent.add(row.exercise_id);
        recentExercises.push({
          id: row.exercise_id,
          name: row.v2_exercises?.name ?? row.exercise_id,
          source: 'completed',
        });
      }
      if (mode !== 'regenerate') {
        for (const row of (slotRes.data ?? []) as Array<{
          exercise_id: string | null;
          v2_exercises: { name: string } | null;
        }>) {
          if (!row.exercise_id || seenRecent.has(row.exercise_id)) continue;
          seenRecent.add(row.exercise_id);
          recentExercises.push({
            id: row.exercise_id,
            name: row.v2_exercises?.name ?? row.exercise_id,
            source: 'planned',
          });
        }
      }

      if (openAiApiKey) {
        for (let attempt = 1; attempt <= MAX_LLM_VALIDATION_ATTEMPTS; attempt += 1) {
          try {
            const llm = await callWeekOpenAi({
              apiKey: openAiApiKey,
              model: openAiModel,
              dayCatalogs,
              user: userContext,
              weekSplit: parseWeekSplit(body.weekSplit),
              splitLabel: sanitizeConstraintText(body.splitLabel, 64)
                ?? userContext.preferred_training_style
                ?? 'no preference',
              weekStartDate: body.weekStartDate,
              todayWeekday: WEEKDAY_NAMES[new Date().getDay()] ?? 'Thursday',
              recentStress,
              history,
              recentExercises,
              requestId: idempotencyKey,
              mode,
            });
            auditModel = llm.model;
            const validated = finalizeCoachWeek(
              llm.days,
              days,
              dayCatalogMap,
              catalogById,
              userContext.experience_level,
              exercisesPerSession,
            );
            if (validated.days) {
              resultDays = validated.days;
              model = llm.model;
              break;
            }
            lastError = validated.reason ?? 'allow_list_validation_failed';
            console.error(
              `Week validation failed (attempt ${attempt}/${MAX_LLM_VALIDATION_ATTEMPTS}):`,
              lastError,
            );
          } catch (err) {
            lastError = err instanceof Error ? err.message.slice(0, 200) : 'openai_failed';
            console.error(
              `Week OpenAI call failed (attempt ${attempt}/${MAX_LLM_VALIDATION_ATTEMPTS}):`,
              lastError,
            );
            break;
          }
        }
      } else {
        lastError = 'no_openai_key';
      }

      if (resultDays) {
        const marked = await markWeekJobGenerated(serviceClient, idempotencyKey, resultDays, model);
        if (!marked) {
          lastError = 'job_persist_failed';
          resultDays = null;
        }
      }
    }

    if (resultDays) {
      const commitResult = await commitWeekJob(serviceClient, idempotencyKey);
      if (commitResult && commitResult.slotsCreated > 0) {
        const totalExercises = resultDays.reduce(
          (acc, day) => acc + day.sessions.reduce((sum, group) => sum + group.length, 0),
          0,
        );
        await writeAudit({
          day_name: 'week',
          sessions_per_day: days.length,
          exercise_count: totalExercises,
          source: 'openai_week',
          error_code: null,
        });
        return jsonResponse({
          days: resultDays,
          model,
          source: 'openai',
          committed: true,
          slotsCreated: commitResult.slotsCreated,
        }, 200);
      }

      await markWeekJobFailed(serviceClient, idempotencyKey, 'commit_failed');
      return jsonResponse({
        days: [],
        model,
        source: 'fallback',
        fallbackReason: 'commit_failed',
      }, 200);
    }

    await writeAudit({
      day_name: 'week',
      sessions_per_day: days.length,
      exercise_count: 0,
      source: 'fallback',
      error_code: lastError,
    });

    return jsonResponse({
      days: [],
      model,
      source: 'fallback',
      ...(lastError ? { fallbackReason: toPublicFallbackReason(lastError) } : {}),
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-week:', message);
    await writeAudit({
      day_name: 'week',
      sessions_per_day: null,
      exercise_count: 0,
      source: 'error',
      error_code: message.slice(0, 200),
    });
    return jsonResponse({ error: 'Generation failed' }, 500);
  }
}
