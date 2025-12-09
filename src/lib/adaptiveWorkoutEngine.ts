import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildFullPlanPrompt, buildDaySessionPrompt } from './aiPrompts';
import { extractJSON, JSONParseError } from './jsonParser';
import { ensureAllDays, validateWeekSchedule, normalizeExercise, validateAndNormalizeExercises } from './workoutValidation';
import { applyVolumeTemplate } from './volumeTemplates';
import { getCachedModel, clearModelCache } from './geminiModels';
import { applySmartCompression, estimateDayDuration } from './smartCompression';
import { inferMovementPattern } from './movementPatterns';
import { analyzeCoverage } from './coverageAnalysis';
import { analyzeRecovery } from './recoveryHeuristics';
import { computeProgressionSuggestion } from './progressionEngine';
import { computeExerciseHistoryMetrics } from './progressionMetrics';
import { estimateExerciseDuration } from './timeEstimation';
import type { MuscleRecoveryState } from './muscleRecovery';

type NamedExercise = { name: string; is_timed?: boolean | null };

export interface GenerateWeekScheduleParams {
  profile: any;
  masterExercises: NamedExercise[];
  userExercises: NamedExercise[];
  apiKey: string;
  durationTargetMin?: number | null; // Week-level duration target in minutes
  durationMode?: 'target' | 'max'; // 'target' = fill duration, 'max' = stay within duration
  recentLogs?: Array<{
    exercise_name: string;
    performed_at: string;
    weight: number;
    reps: number;
  }>; // Recent workout logs for coverage/recovery analysis
  missedWorkouts?: Array<{
    day: string;
    scheduled_at: string; // Date when workout was scheduled
    exercises_planned: number;
    exercises_completed: number;
  }>; // Missed/incomplete workouts for AI awareness
  currentPlan?: any; // Current active plan's week_schedule to analyze and build upon
  personalRecords?: Map<string, { weight: number; reps: number | null }>; // PRs by exercise name
  exerciseHistory?: Map<string, Array<{ weight: number; reps: number; performed_at: string }>>; // Previous weights/reps by exercise
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
  const { 
    profile, 
    masterExercises, 
    userExercises, 
    apiKey, 
    recentLogs = [], 
    missedWorkouts = [],
    currentPlan,
    personalRecords = new Map(),
    exerciseHistory = new Map(),
    durationMode = 'target',
  } = params;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = await getCachedModel(apiKey);

  if (__DEV__) {
    console.log('[adaptiveWorkoutEngine] Using Gemini model:', modelName);
    console.log('[adaptiveWorkoutEngine] Input params:', {
      hasCurrentPlan: !!currentPlan,
      recentLogsCount: recentLogs.length,
      prsCount: personalRecords.size,
      historyCount: exerciseHistory.size,
    });
  }

  const model = genAI.getGenerativeModel({ model: modelName });

  const availableExerciseNames = [
    ...(masterExercises || []).map((ex) => ex.name),
    ...(userExercises || []).map((ex) => ex.name),
  ].filter(Boolean);

  // Extract current week schedule from plan if available
  let currentWeekSchedule: any = null;
  if (currentPlan?.plan_data) {
    // Check for week-specific data first, then fallback to template
    const weekKey = getCurrentWeekKey();
    if (currentPlan.plan_data.weeks?.[weekKey]?.week_schedule) {
      currentWeekSchedule = currentPlan.plan_data.weeks[weekKey].week_schedule;
    } else if (currentPlan.plan_data.week_schedule) {
      currentWeekSchedule = currentPlan.plan_data.week_schedule;
    }
  }

  // Analyze coverage from current plan and recent logs
  let coverageAnalysis: { recommendations: string[] } | undefined;
  if (currentWeekSchedule || recentLogs.length > 0) {
    const coverageResult = analyzeCoverage(currentWeekSchedule || {}, recentLogs);
    if (coverageResult.recommendations.length > 0) {
      coverageAnalysis = {
        recommendations: coverageResult.recommendations,
      };
    } else {
      // Fallback to generic guidance if no specific recommendations
      coverageAnalysis = {
        recommendations: [
          'Consider balancing movement patterns across the week: squat, hinge, push (vertical & horizontal), pull (vertical & horizontal), and single-leg movements.',
        ],
      };
    }
  }

  // Analyze recovery from recent logs and current plan
  let recoveryAnalysis: { warnings: string[]; recommendations: string[] } | undefined;
  if (recentLogs.length > 0 || currentWeekSchedule) {
    const recoveryResult = analyzeRecovery(recentLogs, currentWeekSchedule);
    if (recoveryResult.warnings.length > 0 || recoveryResult.recommendations.length > 0) {
      recoveryAnalysis = {
        warnings: recoveryResult.warnings,
        recommendations: recoveryResult.recommendations,
      };
    }
  }

  const prompt = buildFullPlanPrompt(
    profile, 
    availableExerciseNames, 
    coverageAnalysis, 
    recoveryAnalysis, 
    missedWorkouts,
    currentWeekSchedule,
    personalRecords,
    exerciseHistory,
    params.durationTargetMin,
    durationMode
  );

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
        let dayExercises = planData.week_schedule[day].exercises.map((ex: any) => {
          // Normalize basic fields then apply deterministic volume template
          let converted = normalizeExercise(ex);
          
          // Infer and attach movement pattern if not already present
          if (!converted.movement_pattern) {
            converted.movement_pattern = inferMovementPattern(converted.name);
          }
          
          converted = applyVolumeTemplate(converted);

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

          // For timed exercises, ensure we have a duration
          if (isTimed) {
            // Preserve existing duration from current plan if available
            let duration = converted.target_duration_sec;
            
            // If no duration from AI or current plan, check user_exercises default
            if (!duration && userTimed && (userTimed as any).default_duration_sec) {
              duration = (userTimed as any).default_duration_sec;
            }
            
            // If still no duration, use a sensible default based on exercise type
            if (!duration || duration <= 0) {
              const nameLower = exerciseName;
              if (nameLower.includes('stretch') || nameLower.includes('mobility')) {
                duration = 60; // 1 minute for stretches
              } else if (nameLower.includes('plank') || nameLower.includes('hold')) {
                duration = 45; // 45 seconds for planks/holds
              } else if (nameLower.includes('cardio') || nameLower.includes('interval')) {
                duration = 300; // 5 minutes for cardio intervals
              } else {
                duration = 60; // Default 1 minute
              }
            }
            
            converted.target_duration_sec = duration;
            converted.sets = Array.from({ length: numSets }, (_, i) => ({
              index: i + 1,
              duration: duration,
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

        // Apply Smart Compression if duration target is provided
        // Only compress if mode is 'max' (for 'target' mode, AI should fill the duration)
        if (params.durationTargetMin != null && params.durationTargetMin > 0 && durationMode === 'max') {
          const compressionResult = applySmartCompression({
            exercises: dayExercises,
            durationTargetMin: params.durationTargetMin,
          });
          dayExercises = compressionResult.exercises;
          
          if (__DEV__ && compressionResult.wasCompressed) {
            console.log(`[adaptiveWorkoutEngine] Compressed ${day}`, {
              actions: compressionResult.compressionActions,
              estimatedMin: Math.round(compressionResult.estimatedDurationSec / 60),
              targetMin: params.durationTargetMin,
            });
          }
        }

        planData.week_schedule[day].exercises = dayExercises;
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

/**
 * Get current week key (YYYY-MM-DD format for Sunday of current week)
 */
function getCurrentWeekKey(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface GenerateDaySessionParams {
  profile: any;
  day: string;
  existingExercises: any[]; // Manual exercises locked by user
  timeConstraintMin: number; // Acts as CEILING only (not floor)
  availableExercises: any[]; // Filtered by equipment (must include muscle_groups)
  recentLogs: any[]; // From workout_logs (last 30 days) - may be empty for new users
  personalRecords: Map<string, { weight: number; reps: number | null }>; // May be empty
  muscleRecovery: Map<string, MuscleRecoveryState>; // From muscleRecovery.ts - may be empty
  exerciseHistory?: Map<string, Array<{ weight: number; reps: number; performed_at: string }>>; // Optional exercise history
  currentWeekSchedule?: any; // Optional current week schedule for context
  apiKey: string;
}

export interface GenerateDaySessionResult {
  session: {
    exercises: any[];
    target_duration_min?: number;
  };
  wasCompressed: boolean;
  compressionActions?: string[];
}

/**
 * Generate day session with AI - Hybrid Adaptive Engine
 * Analyzes existing exercises, fills gaps intelligently, applies progression, and compresses if needed
 */
export const generateDaySessionWithAI = async (
  params: GenerateDaySessionParams
): Promise<GenerateDaySessionResult> => {
  const {
    profile,
    day,
    existingExercises = [],
    timeConstraintMin,
    availableExercises,
    recentLogs = [],
    personalRecords = new Map(),
    muscleRecovery = new Map(),
    exerciseHistory = new Map(),
    currentWeekSchedule,
    apiKey,
  } = params;

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = await getCachedModel(apiKey);

  if (__DEV__) {
    console.log('[generateDaySessionWithAI] Starting generation', {
      day,
      existingExercisesCount: existingExercises.length,
      recentLogsCount: recentLogs.length,
      prsCount: personalRecords.size,
      recoveryCount: muscleRecovery.size,
      timeConstraintMin,
    });
  }

  const model = genAI.getGenerativeModel({ model: modelName });

  // Step 1: Layered Gap Analysis
  // a. Movement Pattern Analysis
  const coveredMovementPatterns = new Set<string>();
  existingExercises.forEach((ex: any) => {
    const pattern = ex.movement_pattern || inferMovementPattern(ex.name);
    if (pattern) {
      coveredMovementPatterns.add(pattern);
    }
  });

  const essentialPatterns = ['squat', 'hinge', 'push_horiz', 'pull_horiz', 'push_vert', 'pull_vert'];
  const missingMovementPatterns = essentialPatterns.filter(p => !coveredMovementPatterns.has(p));

  // b. Muscle Group Analysis
  // Note: muscle_groups might not be in existingExercises if not loaded
  // This is okay - gap analysis will work with what's available
  const coveredMuscleGroups = new Set<string>();
  existingExercises.forEach((ex: any) => {
    if (Array.isArray(ex.muscle_groups)) {
      ex.muscle_groups.forEach((mg: string) => {
        if (mg) coveredMuscleGroups.add(mg.toLowerCase());
      });
    }
  });

  // c. Recovery-Based Analysis
  const recoveryReadyMuscles: string[] = [];
  const recoveryFatiguedMuscles: string[] = [];
  
  if (muscleRecovery.size > 0) {
    muscleRecovery.forEach((state, muscleGroup) => {
      if (state.recoveryPercent > 80) {
        recoveryReadyMuscles.push(muscleGroup);
      } else if (state.recoveryPercent < 50) {
        recoveryFatiguedMuscles.push(muscleGroup);
      }
    });
  } else {
    // Empty recovery map = all muscles 100% recovered (new user)
    if (__DEV__) {
      console.log('[generateDaySessionWithAI] Empty recovery map - treating all muscles as 100% recovered');
    }
  }

  // d. Duration Calculation
  let currentEstimatedDuration = 0;
  if (existingExercises.length > 0) {
    currentEstimatedDuration = estimateDayDuration(existingExercises);
  }
  const remainingTime = (timeConstraintMin * 60) - currentEstimatedDuration;

  if (__DEV__) {
    console.log('[generateDaySessionWithAI] Gap analysis', {
      coveredPatterns: Array.from(coveredMovementPatterns),
      missingPatterns: missingMovementPatterns,
      coveredMuscleGroups: Array.from(coveredMuscleGroups),
      recoveryReady: recoveryReadyMuscles,
      recoveryFatigued: recoveryFatiguedMuscles,
      currentDurationSec: currentEstimatedDuration,
      remainingTimeSec: remainingTime,
    });
  }

  // Step 2: Build Enhanced Prompt
  const prompt = buildDaySessionPrompt({
    profile,
    day,
    existingExercises,
    availableExercises,
    coveredMovementPatterns: Array.from(coveredMovementPatterns),
    missingMovementPatterns,
    coveredMuscleGroups: Array.from(coveredMuscleGroups),
    recoveryReadyMuscles,
    recoveryFatiguedMuscles,
    remainingTimeSec: remainingTime,
    timeConstraintMin,
    exerciseHistory,
    personalRecords,
    currentWeekSchedule,
  });

  // Step 3: AI Generation & JSON Extraction
  let newExercises: any[];
  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    try {
      newExercises = extractJSON(text);
    } catch (error: any) {
      if (error instanceof JSONParseError) {
        if (__DEV__) {
          console.error('[generateDaySessionWithAI] JSON extraction failed:', error.message);
          console.error('[generateDaySessionWithAI] Original response:', error.originalText);
        }
        throw new Error('Failed to parse AI response. The response format was unexpected. Please try again.');
      }
      throw error;
    }

    // Validate array structure
    if (!Array.isArray(newExercises)) {
      throw new Error('Invalid response format: expected an array of exercises');
    }
  } catch (error: any) {
    if (error?.message && (error.message.includes('not found') || error.message.includes('404'))) {
      clearModelCache();
      if (__DEV__) {
        console.log('[generateDaySessionWithAI] Cleared model cache due to model not found error');
      }
    }
    throw error;
  }

  // Validate and normalize exercises
  const { valid, errors } = validateAndNormalizeExercises(newExercises);
  if (errors.length > 0) {
    if (__DEV__) {
      console.warn('[generateDaySessionWithAI] Validation errors:', errors);
    }
    if (valid.length === 0) {
      throw new Error('All generated exercises failed validation. Please try again.');
    }
    newExercises = valid;
  } else {
    newExercises = valid;
  }

  // Step 4: Exercise Processing (Correct Order)
  const processedExercises = newExercises.map((ex: any, idx: number) => {
    // 1. Normalize First
    let processed = normalizeExercise(ex);
    
    // 2. Apply Volume Templates
    processed = applyVolumeTemplate(processed);
    
    // 3. Infer Movement Patterns
    if (!processed.movement_pattern) {
      processed.movement_pattern = inferMovementPattern(processed.name);
    }
    
    // Ensure target_reps is a number (not string)
    if (typeof processed.target_reps === 'string') {
      const match = processed.target_reps.match(/\d+/);
      processed.target_reps = match ? parseInt(match[0], 10) : 10;
    }
    
    // Create sets array matching manual format
    const numSets = processed.target_sets || 3;
    const targetReps = processed.target_reps || 10;
    const restTime = processed.rest_time_sec || 60;
    
    // Check if exercise is bodyweight or timed
    const exerciseName = (processed.name || '').toLowerCase();
    const isBodyweight = [
      'pull up', 'pull-up', 'pullup', 'chin up', 'chin-up',
      'push up', 'push-up', 'pushup',
      'dip', 'dips', 'sit up', 'sit-up', 'situp',
      'crunch', 'crunches', 'plank', 'planks',
      'burpee', 'burpees', 'mountain climber', 'mountain climbers',
      'bodyweight squat', 'air squat', 'lunge', 'lunges',
      'jumping jack', 'jumping jacks', 'pistol squat',
      'handstand push up', 'handstand push-up', 'muscle up', 'muscle-up'
    ].some(bw => exerciseName.includes(bw));
    
    // Check if it's a timed exercise (from availableExercises metadata if available)
    // For now, we'll infer from name patterns
    const isTimed = exerciseName.includes('stretch') || 
                    exerciseName.includes('mobility') ||
                    exerciseName.includes('plank') ||
                    exerciseName.includes('hold') ||
                    exerciseName.includes('cardio') ||
                    exerciseName.includes('interval') ||
                    processed.target_duration_sec != null;
    
    if (isTimed && processed.target_duration_sec) {
      processed.sets = Array.from({ length: numSets }, (_, i) => ({
        index: i + 1,
        duration: processed.target_duration_sec,
        rest_time_sec: restTime
      }));
    } else {
      processed.sets = Array.from({ length: numSets }, (_, i) => ({
        index: i + 1,
        reps: targetReps,
        weight: isBodyweight ? 0 : null,
        rest_time_sec: restTime
      }));
    }
    
    return processed;
  });

  // Step 5: Progression Application (Handle Empty Logs)
  const exercisesWithProgression = processedExercises.map((ex: any) => {
    // Handle empty logs (new user case)
    if (recentLogs.length === 0) {
      // computeProgressionSuggestion already handles this gracefully
      // It will use heuristic starting weights from progressionEngine.ts
    }

    // If logs exist, apply progression
    const exerciseLogs = recentLogs.filter((log: any) => 
      log.exercise_name && log.exercise_name.toLowerCase() === ex.name.toLowerCase()
    );

    const metrics = computeExerciseHistoryMetrics(exerciseLogs);
    const pr = personalRecords.get(ex.name) || null;

    const suggestion = computeProgressionSuggestion({
      profile,
      exercise: ex,
      metrics,
      personalRecord: pr,
    });

    // Override AI's weight/reps with calculated values
    if (suggestion.suggestedWeight != null && suggestion.suggestedWeight > 0 && Array.isArray(ex.sets)) {
      ex.sets = ex.sets.map((set: any) => {
        const currentWeight = set.weight;
        if (
          currentWeight === null ||
          currentWeight === undefined ||
          Number.isNaN(currentWeight)
        ) {
          return { ...set, weight: suggestion.suggestedWeight };
        }
        return set;
      });
    }

    if (suggestion.suggestedReps != null && suggestion.suggestedReps > 0 && Array.isArray(ex.sets)) {
      ex.sets = ex.sets.map((set: any) => {
        if (set.reps === null || set.reps === undefined || Number.isNaN(set.reps)) {
          return { ...set, reps: suggestion.suggestedReps };
        }
        return set;
      });
      ex.target_reps = suggestion.suggestedReps;
    }

    return ex;
  });

  // Combine existing and new exercises
  const allExercises = [...existingExercises, ...exercisesWithProgression];

  // Step 6: Constraint-Based Duration Logic (De-Bloated)
  const totalDurationSec = estimateDayDuration(allExercises);

  if (totalDurationSec > timeConstraintMin * 60) {
    // EXCEEDS constraint - compress it
    const compressionResult = applySmartCompression({
      exercises: allExercises,
      durationTargetMin: timeConstraintMin,
    });

    if (__DEV__) {
      console.log('[generateDaySessionWithAI] Compressed workout', {
        beforeSec: totalDurationSec,
        afterSec: compressionResult.estimatedDurationSec,
        actions: compressionResult.compressionActions,
      });
    }

    return {
      session: {
        exercises: compressionResult.exercises,
        target_duration_min: timeConstraintMin,
      },
      wasCompressed: true,
      compressionActions: compressionResult.compressionActions,
    };
  } else {
    // WITHIN constraint - return as-is (don't bloat!)
    if (__DEV__) {
      console.log('[generateDaySessionWithAI] Workout within constraint', {
        totalDurationSec,
        timeConstraintSec: timeConstraintMin * 60,
      });
    }

    return {
      session: {
        exercises: allExercises,
        target_duration_min: timeConstraintMin,
      },
      wasCompressed: false,
      compressionActions: [],
    };
  }
};


