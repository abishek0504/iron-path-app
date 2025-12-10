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

  // Build lookup for available exercises (by lowercased name) to reuse metadata such as density, is_unilateral, is_timed.
  const availableLookup = new Map<string, any>();
  (availableExercises || []).forEach((ex: any) => {
    if (ex?.name) {
      availableLookup.set(String(ex.name).toLowerCase(), ex);
    }
  });

  const isBodyweightExercise = (ex: any): boolean => {
    const name = (ex?.name || '').toLowerCase();
    const equip = (ex?.equipment_needed || ex?.equipment || []) as string[];
    const lowerEquip = Array.isArray(equip) ? equip.map((e) => (e || '').toLowerCase()) : [];
    // Treat typical calisthenics implements as bodyweight (rings, bars, parallettes)
    const bwImplements = ['pull-up bar', 'pull up bar', 'bar', 'rings', 'parallettes', 'dip bar', 'doorframe bar'];
    const hasBwImplementOnly = lowerEquip.length > 0 && lowerEquip.every((e) => bwImplements.some((b) => e.includes(b)));
    if (lowerEquip.length === 0 || lowerEquip.includes('bodyweight') || lowerEquip.includes('bodyweight/weighted') || hasBwImplementOnly) return true;
    const bwNames = [
      'pull up','pull-up','pullup','chin up','chin-up',
      'push up','push-up','pushup','dip','dips','sit up','sit-up','situp',
      'crunch','crunches','plank','planks','burpee','burpees','mountain climber','mountain climbers',
      'bodyweight squat','air squat','lunge','lunges','jumping jack','jumping jacks','pistol squat',
      'handstand push up','handstand push-up','muscle up','muscle-up','handstand','planche','front lever'
    ];
    return bwNames.some((k) => name.includes(k));
  };

  const isBloatExercise = (ex: any): boolean => {
    const name = (ex?.name || '').toLowerCase();
    return (
      name.includes('air squat') ||
      name === 'squat (air)' ||
      name.includes('wall sit') ||
      name.includes('towel row') ||
      name.includes('band pull-apart') ||
      name.includes('band pull apart') ||
      name.includes('arm circle')
    );
  };

  const inferDensity = (ex: any): number => {
    if (ex?.density_score != null) return Number(ex.density_score);
    const equip = (ex?.equipment_needed || ex?.equipment || []) as string[];
    const lowerEquip = Array.isArray(equip) ? equip.map((e) => (e || '').toLowerCase()) : [];
    const mp = (ex?.movement_pattern || '').toLowerCase();
    const name = (ex?.name || '').toLowerCase();
    const isMachine = lowerEquip.some((e) => e.includes('machine')) || name.includes('machine');

    const compoundNamePatterns = [
      'squat','deadlift','rdl','hip thrust','hinge','lunge','split squat','step up','step-up','pistol',
      'pull up','pull-up','chin up','chin-up','row','press','bench','ohp','overhead press','push up','push-up',
      'dip','muscle up','muscle-up','snatch','clean','jerk','thruster','carry','farmer','suitcase','yoke','walk'
    ];
    const nameLooksCompound = compoundNamePatterns.some((k) => name.includes(k));
    const isCompoundPattern = ['squat', 'hinge', 'push_vert', 'pull_vert', 'push_horiz', 'pull_horiz', 'lunge', 'carry'].includes(mp);

    if ((isCompoundPattern || nameLooksCompound) && !isMachine) return 9;
    if (isMachine) return 4;
    return 6; // unknown defaults to mid so it can survive if needed
  };

  const isUnilateral = (ex: any): boolean => {
    if (ex?.is_unilateral === true) return true;
    const name = (ex?.name || '').toLowerCase();
    return ['single', 'unilateral', 'pistol', 'split', 'one-arm', 'one arm', 'one-leg', 'one leg'].some((k) => name.includes(k));
  };

  const isSkill = (ex: any): boolean => {
    const diff = (ex?.difficulty || '').toLowerCase();
    const name = (ex?.name || '').toLowerCase();
    return diff === 'hard' || diff === 'elite' || name.includes('handstand') || name.includes('planche') || name.includes('front lever') || name.includes('maltese');
  };

  const GOLDEN_STANDARDS = {
    weighted_compound: { setsMin: 3, setsMax: 4, repsMin: 5, repsMax: 8, restMin: 90, restMax: 150 },
    weighted_accessory: { setsMin: 2, setsMax: 3, repsMin: 8, repsMax: 15, restMin: 60, restMax: 90 },
    bw_endurance: { setsMin: 3, setsMax: 4, repsMin: 15, repsMax: 25, restMin: 45, restMax: 60 },
    bw_midrange: { setsMin: 3, setsMax: 4, repsMin: 6, repsMax: 12, restMin: 60, restMax: 90 },
    bw_skill: { setsMin: 3, setsMax: 5, repsMin: 3, repsMax: 6, restMin: 60, restMax: 120 },
  };

  const clampToRange = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, Math.round(value)));
  };

  const applyGoldenStandard = (exercise: any): any => {
    const ex = { ...exercise };
    const name = (ex.name || '').toLowerCase();
    const meta = availableLookup.get(name) || {};

    const isTimed = Boolean(
      ex.is_timed ||
      ex.target_duration_sec != null ||
      (Array.isArray(ex.sets) && ex.sets.some((s: any) => s.duration != null))
    );

    // If timed, only clamp rest modestly
    if (isTimed) {
      const restClamped = clampToRange(ex.rest_time_sec ?? 60, 30, 120);
      ex.rest_time_sec = restClamped;
      if (Array.isArray(ex.sets)) {
        ex.sets = ex.sets.map((s: any, i: number) => ({
          ...s,
          index: i + 1,
          rest_time_sec: clampToRange(s.rest_time_sec ?? restClamped, 30, 120),
        }));
      }
      return ex;
    }

    const bodyweight = isBodyweightExercise(ex);
    const skillMove = isSkill(ex);
    const mp = (ex.movement_pattern || meta.movement_pattern || '').toLowerCase();
    const isEnduranceBW =
      bodyweight &&
      (name.includes('lunge') ||
        name.includes('squat') ||
        name.includes('step up') ||
        name.includes('step-up') ||
        name.includes('split squat') ||
        name.includes('rear foot'));

    const isCompoundWeighted =
      !bodyweight &&
      (
        ['squat', 'hinge', 'push', 'pull', 'lunge', 'carry'].some((p) => mp.includes(p)) ||
        name.includes('squat') || name.includes('deadlift') || name.includes('rdl') ||
        name.includes('press') || name.includes('row') || name.includes('pull up') || name.includes('pull-up') ||
        name.includes('chin up') || name.includes('chin-up') || name.includes('dip')
      );

    let standard = GOLDEN_STANDARDS.weighted_accessory;
    if (bodyweight) {
      if (skillMove) {
        standard = GOLDEN_STANDARDS.bw_skill;
      } else if (isEnduranceBW) {
        standard = GOLDEN_STANDARDS.bw_endurance;
      } else {
        standard = GOLDEN_STANDARDS.bw_midrange;
      }
    } else if (isCompoundWeighted) {
      standard = GOLDEN_STANDARDS.weighted_compound;
    }

    const sets = clampToRange(
      ex.target_sets || (Array.isArray(ex.sets) ? ex.sets.length : standard.setsMin),
      standard.setsMin,
      standard.setsMax,
    );
    const reps = clampToRange(ex.target_reps || standard.repsMin, standard.repsMin, standard.repsMax);
    const rest = clampToRange(ex.rest_time_sec || standard.restMin, standard.restMin, standard.restMax);

    ex.target_sets = sets;
    ex.target_reps = reps;
    ex.rest_time_sec = rest;

    if (Array.isArray(ex.sets)) {
      // trim or extend sets to match golden range
      const trimmed = ex.sets.slice(0, sets).map((s: any, i: number) => ({
        ...s,
        index: i + 1,
        reps: reps,
        weight: s.weight ?? (bodyweight ? 0 : null),
        rest_time_sec: clampToRange(s.rest_time_sec ?? rest, standard.restMin, standard.restMax),
      }));
      while (trimmed.length < sets) {
        trimmed.push({
          index: trimmed.length + 1,
          reps,
          weight: bodyweight ? 0 : null,
          rest_time_sec: rest,
        });
      }
      ex.sets = trimmed;
    } else {
      ex.sets = Array.from({ length: sets }, (_, i) => ({
        index: i + 1,
        reps,
        weight: bodyweight ? 0 : null,
        rest_time_sec: rest,
      }));
    }

    return ex;
  };

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
  // Prune low-density junk before processing
  const densityFiltered = newExercises.filter((ex: any) => {
    if (isBloatExercise(ex)) return false;
    const meta = availableLookup.get((ex?.name || '').toLowerCase());
    const density = inferDensity({ ...meta, ...ex });
    return density >= 8;
  });

  if (__DEV__) {
    console.log('[generateDaySessionWithAI] AI returned', newExercises.length, 'exercises; kept high-density', densityFiltered.length);
    if (densityFiltered.length === 0) {
      const missingPattern = newExercises.filter((e: any) => !e?.movement_pattern).length;
      const missingEquip = newExercises.filter((e: any) => !e?.equipment_needed && !e?.equipment).length;
      const missingDensity = newExercises.filter((e: any) => e?.density_score == null).length;
      console.warn('[generateDaySessionWithAI] Density filter removed all exercises.', {
        sampleNames: newExercises.slice(0, 5).map((e: any) => e?.name),
        missingMovementPattern: missingPattern,
        missingEquipment: missingEquip,
        missingDensityScore: missingDensity,
        total: newExercises.length,
      });
    }
  }

  // Fallback: if everything was filtered out, keep top 4 by inferred density to avoid empty sessions
  let filteredExercises = densityFiltered;
  if (filteredExercises.length === 0) {
    filteredExercises = [...newExercises]
      .map((ex: any) => {
        const meta = availableLookup.get((ex?.name || '').toLowerCase());
        return { ex, density: inferDensity({ ...meta, ...ex }) };
      })
      .sort((a, b) => b.density - a.density)
      .slice(0, 4)
      .map((item) => item.ex);
    if (__DEV__) {
      console.warn('[generateDaySessionWithAI] Fallback engaged: retained top', filteredExercises.length, 'by inferred density.');
    }
  }

  // Ensure minimum exercise count by pulling high-density fallbacks from available list (no bloat)
  const minExercises = 6;
  const maxExercises = 12;
  const targetExercises = Math.min(
    maxExercises,
    Math.max(minExercises, Math.ceil((timeConstraintMin || 30) / 6))
  );
  if (filteredExercises.length < targetExercises) {
    const existingNames = new Set<string>(
      [...filteredExercises, ...existingExercises].map((e: any) => (e?.name || '').toLowerCase())
    );
    const candidates = (availableExercises || [])
      .filter((ex: any) => {
        const n = (ex?.name || '').toLowerCase();
        if (!n || existingNames.has(n)) return false;
        if (isBloatExercise(ex)) return false;
        const density = inferDensity({ ...ex });
        return density >= 8;
      })
      .map((ex: any) => ({ ex, density: inferDensity({ ...ex }) }))
      .sort((a, b) => b.density - a.density);

    for (const cand of candidates) {
      if (filteredExercises.length >= targetExercises) break;
      const n = (cand.ex?.name || '').toLowerCase();
      if (existingNames.has(n)) continue;
      filteredExercises.push(cand.ex);
      existingNames.add(n);
    }

    if (__DEV__) {
      console.warn('[generateDaySessionWithAI] Added high-density fallbacks to meet target count', {
        finalCount: filteredExercises.length,
        targetExercises,
      });
    }
  }

  const buildProcessedExercise = (ex: any): any => {
    // 1. Normalize First
    let processed = normalizeExercise(ex);
    
    // 2. Apply Volume Templates
    processed = applyVolumeTemplate(processed);
    // 2b. Enforce Golden Standards
    processed = applyGoldenStandard(processed);
    
    // 3. Infer Movement Patterns
    if (!processed.movement_pattern) {
      processed.movement_pattern = inferMovementPattern(processed.name);
    }
    
    // Ensure target_reps is a number (not string)
    if (typeof processed.target_reps === 'string') {
      const match = processed.target_reps.match(/\d+/);
      processed.target_reps = match ? parseInt(match[0], 10) : 10;
    }
    
    // Prepare lookups
    const exerciseName = (processed.name || '').toLowerCase();
    const meta = availableLookup.get(exerciseName) || {};
    const metaTimed = meta?.is_timed;
    const metaDuration = meta?.target_duration_sec || meta?.default_duration_sec;
    const metaRest = meta?.rest_time_sec;
    const numSetsInitial = processed.target_sets || (Array.isArray(processed.sets) ? processed.sets.length : 0) || 3;
    let targetReps = processed.target_reps || 10;
    let restTime = processed.rest_time_sec || metaRest || 60;
    
    // Check if exercise is bodyweight or timed
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
    
    // Check if it's a timed exercise (prefer metadata, then patterns)
    const isTimed = Boolean(
      metaTimed ||
      processed.is_timed ||
      processed.target_duration_sec != null ||
      exerciseName.includes('stretch') || 
      exerciseName.includes('mobility') ||
      exerciseName.includes('plank') ||
      exerciseName.includes('hold') ||
      exerciseName.includes('cardio') ||
      exerciseName.includes('interval')
    );
    // Ensure duration exists for timed
    if (isTimed && (processed.target_duration_sec == null || Number.isNaN(processed.target_duration_sec))) {
      processed.target_duration_sec = metaDuration || 60;
    }

    // Bodyweight volume guard (non-skill)
    const isSkillMove = isSkill(processed);
    let numSets = numSetsInitial;
    if (isBodyweight && !isSkillMove) {
      numSets = Math.min(numSetsInitial, 4);
      targetReps = Math.max(targetReps, 10);
      restTime = Math.min(Math.max(restTime, 60), 90);
    }
    
    if (isTimed) {
      const duration = processed.target_duration_sec ?? metaDuration ?? 60;
      processed.sets = Array.from({ length: numSets }, (_, i) => ({
        index: i + 1,
        duration,
        rest_time_sec: Math.min(restTime || 60, 90),
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
  };

  const processedExercises = filteredExercises.map(buildProcessedExercise);

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
  let allExercises = [...existingExercises, ...exercisesWithProgression];

  // Reorder skills/handstand to start
  const skills = allExercises.filter((ex) => isSkill(ex));
  const nonSkills = allExercises.filter((ex) => !isSkill(ex));
  allExercises = [...skills, ...nonSkills];

  // Ensure at least one unilateral
  const hasUnilateral = allExercises.some((ex) => isUnilateral(ex));
  if (!hasUnilateral) {
    const candidate = (availableExercises || []).find(
      (ex) => isUnilateral(ex) && inferDensity(ex) >= 8
    );
    if (candidate) {
      const normalized = normalizeExercise(candidate);
      normalized.target_sets = normalized.target_sets || 3;
      normalized.target_reps = normalized.target_reps || 8;
      normalized.rest_time_sec = normalized.rest_time_sec || 60;
      normalized.sets = Array.from({ length: normalized.target_sets }, (_, i) => ({
        index: i + 1,
        reps: normalized.target_reps,
        weight: isBodyweightExercise(candidate) ? 0 : null,
        rest_time_sec: normalized.rest_time_sec,
      }));
      allExercises.push(normalized);
    }
  }

  // Prune low-density items (unless user-locked existing)
  allExercises = allExercises.filter((ex) => {
    const meta = availableLookup.get((ex?.name || '').toLowerCase());
    const density = inferDensity({ ...meta, ...ex });
    if (existingExercises.includes(ex)) return true;
    return density >= 8;
  });

  // Final sanity: if nothing remains, surface a hard failure with context
  if (allExercises.length === 0) {
    if (__DEV__) {
      console.error('[generateDaySessionWithAI] No exercises after post-processing.', {
        newExercisesCount: newExercises.length,
        processedCount: processedExercises.length,
        existingCount: existingExercises.length,
      });
    }
    throw new Error('No exercises could be generated after filtering. Check density/metadata on exercises or relax filters.');
  }

  // Fill-to-ceiling: Add sets to Tier 1 compounds (no filler) until near ceiling, then compress if needed.
  const isTier1Name = (name: string): boolean => {
    const n = name.toLowerCase();
    return (
      n.includes('squat') ||
      n.includes('deadlift') ||
      n.includes('bench') ||
      (n.includes('row') && !n.includes('upright')) ||
      (n.includes('press') && (n.includes('overhead') || n.includes('shoulder') || n.includes('bench'))) ||
      (n.includes('pull') && (n.includes('up') || n.includes('down'))) ||
      n.includes('dip') ||
      n.includes('muscle up') ||
      n.includes('muscle-up') ||
      n.includes('hinge') ||
      n.includes('lunge')
    );
  };

  const ceilingSec = timeConstraintMin * 60;
  let totalDurationSec = estimateDayDuration(allExercises);

  // If we're far below the ceiling, add more high-density candidates (processed) until we approach ~95% of the ceiling or hit 10 items
  if (ceilingSec > 0 && totalDurationSec < ceilingSec * 0.9) {
    const existingNames = new Set<string>(allExercises.map((e) => (e?.name || '').toLowerCase()));
    const candidates = (availableExercises || [])
      .filter((ex: any) => {
        const n = (ex?.name || '').toLowerCase();
        if (!n || existingNames.has(n)) return false;
        if (isBloatExercise(ex)) return false;
        const density = inferDensity({ ...ex });
        return density >= 8;
      })
      .map((ex: any) => ({ ex, density: inferDensity({ ...ex }) }))
      .sort((a, b) => b.density - a.density);

    let added = 0;
    for (const cand of candidates) {
      if (allExercises.length >= maxExercises) break;
      if (totalDurationSec >= ceilingSec * 0.95) break;
      const processed = buildProcessedExercise(cand.ex);
      allExercises.push(processed);
      existingNames.add((cand.ex?.name || '').toLowerCase());
      totalDurationSec = estimateDayDuration(allExercises);
      added += 1;
    }
    if (__DEV__ && added > 0) {
      console.warn('[generateDaySessionWithAI] Added extra high-density exercises to approach ceiling', {
        added,
        totalDurationSec,
        ceilingSec,
      });
    }
  }

  if (totalDurationSec < ceilingSec && ceilingSec > 0) {
    // Try to add sets to Tier 1 exercises, cap sets at 6, stop once within 95-100% of ceiling
    let iterations = 0;
    while (totalDurationSec < ceilingSec * 0.97 && iterations < 12) {
      // Find first Tier 1 exercise with sets < 6
      const idx = allExercises.findIndex(
        (ex) =>
          ex?.name &&
          isTier1Name(ex.name) &&
          inferDensity({ ...availableLookup.get((ex.name || '').toLowerCase()), ...ex }) >= 8 &&
          // don't bloat bodyweight accessories
          !(isBodyweightExercise(ex) && ['easy','beginner','medium','intermediate'].includes(String(ex.difficulty || '').toLowerCase())) &&
          ((ex.target_sets || (Array.isArray(ex.sets) ? ex.sets.length : 0)) < 4),
      );
      if (idx === -1) break;
      const ex = { ...allExercises[idx] };
      const currentSets = ex.target_sets || (Array.isArray(ex.sets) ? ex.sets.length : 0) || 3;
      const nextSets = Math.min(currentSets + 1, 4);
      const rest = ex.rest_time_sec || (Array.isArray(ex.sets) && ex.sets[0]?.rest_time_sec) || 60;
      const isTimed = Array.isArray(ex.sets) && ex.sets.some((s: any) => s.duration != null);
      const lastSet = Array.isArray(ex.sets) && ex.sets.length > 0 ? ex.sets[ex.sets.length - 1] : null;
      const newSet = isTimed
        ? {
            index: nextSets,
            duration: lastSet?.duration ?? ex.target_duration_sec ?? 60,
            rest_time_sec: rest,
          }
        : {
            index: nextSets,
            reps: lastSet?.reps ?? ex.target_reps ?? 8,
            weight: lastSet?.weight ?? null,
            rest_time_sec: rest,
          };
      ex.target_sets = nextSets;
      ex.sets = Array.isArray(ex.sets) ? [...ex.sets, newSet] : [newSet];
      allExercises[idx] = ex;

      totalDurationSec = estimateDayDuration(allExercises);
      iterations += 1;
      if (totalDurationSec >= ceilingSec) break;
    }
  }

  // Step 6: Constraint-Based Duration Logic (Fill then Compress)
  if (totalDurationSec > ceilingSec) {
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


