import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildFullPlanPrompt } from './aiPrompts';
import { extractJSON, JSONParseError } from './jsonParser';
import { ensureAllDays, validateWeekSchedule, normalizeExercise } from './workoutValidation';
import { getCachedModel, clearModelCache } from './geminiModels';

type NamedExercise = { name: string; is_timed?: boolean | null };

export interface GenerateWeekScheduleParams {
  profile: any;
  masterExercises: NamedExercise[];
  userExercises: NamedExercise[];
  apiKey: string;
}

export interface GeneratedWeekScheduleResult {
  week_schedule: any;
}

/**
 * Core adaptive engine for generating a week_schedule via Gemini.
 * This intentionally mirrors the existing Planner generation behavior
 * so we can evolve the Tier logic and time estimation here without
 * touching the UI screens.
 */
export const generateWeekScheduleWithAI = async (
  params: GenerateWeekScheduleParams,
): Promise<GeneratedWeekScheduleResult> => {
  const { profile, masterExercises, userExercises, apiKey } = params;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = await getCachedModel(apiKey);

  if (__DEV__) {
    console.log('[adaptiveWorkoutEngine] Using Gemini model:', modelName);
  }

  const model = genAI.getGenerativeModel({ model: modelName });

  const availableExerciseNames = [
    ...(masterExercises || []).map((ex) => ex.name),
    ...(userExercises || []).map((ex) => ex.name),
  ].filter(Boolean);

  const prompt = buildFullPlanPrompt(profile, availableExerciseNames);

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let planData: any;
    try {
      planData = extractJSON(text);
    } catch (error: any) {
      if (error instanceof JSONParseError) {
        if (__DEV__) {
          console.error('[adaptiveWorkoutEngine] JSON extraction failed:', error.message);
        }
        throw new Error('Failed to parse AI response. The response format was unexpected. Please try again.');
      }
      throw error;
    }

    if (!planData || typeof planData !== 'object' || !planData.week_schedule) {
      throw new Error('Invalid plan structure: week_schedule is missing');
    }

    planData.week_schedule = ensureAllDays(planData.week_schedule);

    const validationErrors = validateWeekSchedule(planData.week_schedule);
    if (validationErrors.length > 0 && __DEV__) {
      console.warn('[adaptiveWorkoutEngine] Validation errors in generated week_schedule:', validationErrors);
    }

    // Normalize exercises and attach basic sets metadata, mirroring PlannerScreen.
    for (const day of Object.keys(planData.week_schedule)) {
      if (Array.isArray(planData.week_schedule[day].exercises)) {
        planData.week_schedule[day].exercises = planData.week_schedule[day].exercises.map((ex: any) => {
          const converted = normalizeExercise(ex);

          // Ensure target_reps is a number (not string)
          if (typeof converted.target_reps === 'string') {
            const match = converted.target_reps.match(/\d+/);
            converted.target_reps = match ? parseInt(match[0], 10) : 10;
          }

          const numSets = converted.target_sets || 3;
          const targetReps = converted.target_reps || 10;
          const restTime = converted.rest_time_sec || 60;

          const exerciseName = (converted.name || '').toLowerCase();
          const bodyweightNames = [
            'pull up',
            'pull-up',
            'pullup',
            'chin up',
            'chin-up',
            'push up',
            'push-up',
            'pushup',
            'dip',
            'dips',
            'sit up',
            'sit-up',
            'situp',
            'crunch',
            'crunches',
            'plank',
            'planks',
            'burpee',
            'burpees',
            'mountain climber',
            'mountain climbers',
            'bodyweight squat',
            'air squat',
            'lunge',
            'lunges',
            'jumping jack',
            'jumping jacks',
            'pistol squat',
            'handstand push up',
            'handstand push-up',
            'muscle up',
            'muscle-up',
          ];
          const isBodyweight = bodyweightNames.some((bw) => exerciseName.includes(bw));

          const masterTimed = (masterExercises || []).find(
            (me) => me.name.toLowerCase() === exerciseName && me.is_timed,
          );
          const userTimed = (userExercises || []).find(
            (ue) => ue.name.toLowerCase() === exerciseName && ue.is_timed,
          );
          const isTimed = !!(masterTimed || userTimed);

          if (isTimed && converted.target_duration_sec) {
            converted.sets = Array.from({ length: numSets }, (_, i) => ({
              index: i + 1,
              duration: converted.target_duration_sec,
              rest_time_sec: restTime,
            }));
          } else {
            converted.sets = Array.from({ length: numSets }, (_, i) => ({
              index: i + 1,
              reps: targetReps,
              weight: isBodyweight ? 0 : null,
              rest_time_sec: restTime,
            }));
          }

          return converted;
        });
      }
    }

    return { week_schedule: planData.week_schedule };
  } catch (error: any) {
    if (__DEV__) {
      console.error('[adaptiveWorkoutEngine] Error generating week schedule:', {
        message: error?.message,
        stack: error?.stack,
      });
    }

    if (error?.message && (error.message.includes('not found') || error.message.includes('404'))) {
      clearModelCache();
      if (__DEV__) {
        console.log('[adaptiveWorkoutEngine] Cleared model cache due to model not found error');
      }
    }

    throw error;
  }
};


