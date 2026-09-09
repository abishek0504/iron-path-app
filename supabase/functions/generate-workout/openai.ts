/** OpenAI chat completion call. */

import { OPENAI_TIMEOUT_MS } from './constants.ts';
import { buildResponseSchema, buildSystemPrompt, buildUserPrompt } from './prompts.ts';
import type {
  AllowListedExercise,
  AiExercisePlan,
  DayConstraints,
  ExerciseHistorySummary,
  UserContext,
} from './types.ts';

export interface OpenAiResult {
  sessions: AiExercisePlan[][];
  model: string;
}

export async function callOpenAi(params: {
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
