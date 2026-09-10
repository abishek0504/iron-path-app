import type {
  AllowListedExercise,
  AiExercisePlan,
  ExerciseHistorySummary,
  UserContext,
} from '../generate-workout/types.ts';
import { WEEK_OPENAI_TIMEOUT_MS } from './constants.ts';
import {
  buildWeekResponseSchema,
  buildWeekSystemPrompt,
  buildWeekUserPrompt,
  type WeekDayCatalog,
} from './prompts.ts';
import type { WeekSplitDayInput } from './types.ts';

export interface WeekOpenAiDay {
  day_name: string;
  sessions: AiExercisePlan[][];
}

export async function callWeekOpenAi(params: {
  apiKey: string;
  model: string;
  dayCatalogs: WeekDayCatalog[];
  user: UserContext;
  weekSplit: WeekSplitDayInput[];
  splitLabel: string;
  weekStartDate: string;
  todayWeekday: string;
  recentStress: Record<string, number>;
  history: Record<string, ExerciseHistorySummary>;
  recentExercises: { id: string; name: string; source: string }[];
  requestId: string;
  mode: 'auto' | 'regenerate';
}): Promise<{ days: WeekOpenAiDay[]; model: string }> {
  const requestBody: Record<string, unknown> = {
    model: params.model,
    messages: [
      {
        role: 'system',
        content: buildWeekSystemPrompt({
          dayCount: params.dayCatalogs.length,
          exercisesPerSession: params.user.exercises_per_session,
          sessionMinutes: params.user.session_minutes,
        }),
      },
      { role: 'user', content: buildWeekUserPrompt(params) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'workout_week',
        strict: true,
        schema: buildWeekResponseSchema(),
      },
    },
  };

  if (/^(gpt-5|o\d)/i.test(params.model)) {
    requestBody.reasoning_effort = 'low';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEEK_OPENAI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
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

  const daysRaw = (parsed as { days?: unknown })?.days;
  if (!Array.isArray(daysRaw)) {
    throw new Error('OpenAI response missing "days" array');
  }

  const days: WeekOpenAiDay[] = [];
  for (const item of daysRaw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const dayName = typeof obj.day_name === 'string' ? obj.day_name : '';
    const sessionsRaw = obj.sessions;
    if (!Array.isArray(sessionsRaw)) continue;
    const sessions: AiExercisePlan[][] = [];
    for (const group of sessionsRaw) {
      if (!Array.isArray(group)) continue;
      const entries: AiExercisePlan[] = [];
      for (const exercise of group) {
        if (!exercise || typeof exercise !== 'object') continue;
        const row = exercise as Record<string, unknown>;
        if (typeof row.exercise_id !== 'string' || row.exercise_id.length === 0) continue;
        entries.push({
          exercise_id: row.exercise_id,
          sets: typeof row.sets === 'number' ? row.sets : null,
          reps: typeof row.reps === 'number' ? row.reps : null,
          duration_sec: typeof row.duration_sec === 'number' ? row.duration_sec : null,
          weight: typeof row.weight === 'number' ? row.weight : null,
          target_rpe: typeof row.target_rpe === 'number' ? row.target_rpe : null,
        });
      }
      sessions.push(entries);
    }
    days.push({ day_name: dayName, sessions });
  }

  const usedModel: string = typeof json?.model === 'string' ? json.model : params.model;
  return { days, model: usedModel };
}

export type { AllowListedExercise };
