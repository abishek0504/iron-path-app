/**
 * AI prompt builders for workout generation
 * Creates structured, comprehensive prompts using all available profile data
 */

import { formatWeight, formatHeight } from './unitConversion';
import {
  deriveStyleAndComponentsFromProfile,
  describeComponentsForPrompt,
} from './trainingPreferences';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Get experience level guidelines for prompt
 */
const getExperienceGuidelines = (experienceLevel: string | null | undefined): string => {
  if (!experienceLevel) {
    return 'Intermediate level training (moderate volume, balanced approach)';
  }

  const level = experienceLevel.toLowerCase();
  
  if (level.includes('brand new') || level.includes('new to')) {
    return 'BEGINNER: Lower volume (2-3 sets per exercise), focus on form and technique, full-body or upper/lower splits, 8-12 reps per set, longer rest periods (90-120 seconds), emphasis on learning proper movement patterns';
  } else if (level.includes('less than 1 year')) {
    return 'BEGINNER-INTERMEDIATE: Moderate volume (3-4 sets per exercise), continue focusing on form, can use push/pull/legs or upper/lower splits, 8-15 reps per set, rest periods 60-90 seconds';
  } else if (level.includes('1–2 years') || level.includes('1-2 years')) {
    return 'INTERMEDIATE: Moderate to higher volume (3-5 sets per exercise), can use specialized splits (push/pull/legs, body part splits), 6-12 reps per set, rest periods 60-90 seconds, can introduce more advanced techniques';
  } else if (level.includes('2–4 years') || level.includes('2-4 years')) {
    return 'INTERMEDIATE-ADVANCED: Higher volume (4-5 sets per exercise), specialized splits, varied rep ranges (4-15), rest periods 60-120 seconds, can include advanced techniques and periodization';
  } else if (level.includes('4+ years') || level.includes('4+')) {
    return 'ADVANCED: High volume (4-6 sets per exercise), highly specialized splits, varied rep ranges (3-20), optimized rest periods, advanced techniques, periodization, and intensity methods';
  }
  
  return 'Intermediate level training (moderate volume, balanced approach)';
};

/**
 * Get goal-specific considerations for prompt
 */
const getGoalConsiderations = (goal: string | null | undefined): string => {
  if (!goal) {
    return '';
  }

  const goalLower = goal.toLowerCase();
  
  if (goalLower.includes('lose weight') || goalLower.includes('weight loss')) {
    return 'GOAL: Weight Loss - Include higher rep ranges (12-20), incorporate cardio elements, circuit-style training options, focus on calorie burn and metabolic stress';
  } else if (goalLower.includes('build muscle') || goalLower.includes('muscle gain') || goalLower.includes('hypertrophy')) {
    return 'GOAL: Muscle Building - Focus on hypertrophy rep ranges (8-12), progressive overload emphasis, volume accumulation, adequate rest for recovery';
  } else if (goalLower.includes('lift heavier') || goalLower.includes('strength')) {
    return 'GOAL: Strength - Lower rep ranges (3-6), higher intensity, longer rest periods (2-5 minutes), focus on compound movements, progressive overload on weight';
  } else if (goalLower.includes('lean') || goalLower.includes('defined') || goalLower.includes('definition')) {
    return 'GOAL: Lean & Defined - Combination approach: moderate rep ranges (8-15), include both strength and hypertrophy work, some metabolic conditioning, balanced volume';
  }
  
  return '';
};

/**
 * Build comprehensive prompt for full weekly workout plan generation
 * 
 * @param profile - User profile data
 * @param availableExercises - List of available exercise names
 * @param coverageAnalysis - Optional coverage analysis results to include in prompt
 * @param recoveryAnalysis - Optional recovery analysis results to include in prompt
 * @param missedWorkouts - Optional missed workouts data
 * @param currentWeekSchedule - Optional current week schedule to build upon or replace
 * @param personalRecords - Optional PRs by exercise name
 * @param exerciseHistory - Optional previous weights/reps by exercise name
 */
export const buildFullPlanPrompt = (
  profile: any,
  availableExercises: string[] = [],
  coverageAnalysis?: { recommendations: string[] },
  recoveryAnalysis?: { warnings: string[]; recommendations: string[] },
  missedWorkouts?: Array<{ day: string; scheduled_at: string; exercises_planned: number; exercises_completed: number }>,
  currentWeekSchedule?: any,
  personalRecords?: Map<string, { weight: number; reps: number | null }>,
  exerciseHistory?: Map<string, Array<{ weight: number; reps: number; performed_at: string }>>,
  durationTargetMin?: number | null,
  durationMode?: 'target' | 'max'
): string => {
  const useImperial = profile.use_imperial !== false; // Default to true
  const weightStr = formatWeight(profile.current_weight, useImperial);
  const heightStr = formatHeight(profile.height, useImperial);
  
  let goalWeightStr = '';
  if (profile.goal_weight) {
    goalWeightStr = formatWeight(profile.goal_weight, useImperial);
  }

  const experienceGuidelines = getExperienceGuidelines(profile.experience_level);
  const goalConsiderations = getGoalConsiderations(profile.goal);
  const { style: trainingStyle, components } = deriveStyleAndComponentsFromProfile(profile);
  const componentDescription = describeComponentsForPrompt(trainingStyle, components);
  
  // Format equipment list for prompt
  const formatEquipmentForPrompt = (equipment: any[]): string => {
    if (!equipment || equipment.length === 0) {
      return 'Full gym access (all equipment available)';
    }
    return equipment.map((eq: any) => {
      if (typeof eq === 'string') {
        return eq;
      } else if (eq && typeof eq === 'object' && 'name' in eq) {
        return eq.name;
      }
      return '';
    }).filter(Boolean).join(', ');
  };

  const equipmentStr = formatEquipmentForPrompt(profile.equipment_access || []);

  const daysPerWeek = profile.days_per_week || 3;
  const durationTarget = durationTargetMin || 45;
  const mode = durationMode || 'target';
  
  // Time is a ceiling (no filler). Fill with high-density compounds, then compress if needed.
  const goldilocksText = `CRITICAL: The user has set a TIME CEILING of ${durationTarget} minutes per workout session. Generate the best possible workout within this ceiling. Prefer high-density compounds; if short, add sets to Tier 1 compounds (no junk isolation). If over, compress intelligently (supersets/reduce sets), never add filler.`;

  // Build exercise list section
  let exerciseListSection = '';
  if (availableExercises.length > 0) {
    exerciseListSection = `\nAVAILABLE EXERCISES FROM DATABASE:\n${availableExercises.join(', ')}\n\nIMPORTANT: You MUST prefer exercises from this list. Only create custom exercises if none from the list are suitable for the specific muscle group or movement pattern needed.\nDENSITY GUARDRAIL: If density_score is missing, infer density:\n- Compound + Barbell/Dumbbell/Bodyweight => High Density (~9)\n- Machine/Isolation => Low Density (~4)\nSelect exercises with inferred or known density >= 8.`;
  }

  // Build current plan section if it exists
  let currentPlanSection = '';
  if (currentWeekSchedule) {
    const daysWithExercises: string[] = [];
    Object.keys(currentWeekSchedule).forEach(day => {
      const dayData = currentWeekSchedule[day];
      if (dayData?.exercises && Array.isArray(dayData.exercises) && dayData.exercises.length > 0) {
        const exerciseNames = dayData.exercises.map((ex: any) => ex.name).filter(Boolean).join(', ');
        daysWithExercises.push(`${day}: ${exerciseNames}`);
      }
    });
    
    if (daysWithExercises.length > 0) {
      currentPlanSection = `\nCURRENT WORKOUT PLAN:\nThe user currently has this week's plan:\n${daysWithExercises.join('\n')}\n\nIMPORTANT: When generating the new plan:\n- If exercises are already in the plan and working well, consider keeping them with their current durations/weights\n- For timed exercises, preserve their target_duration_sec values if they exist\n- You can adjust, add, or replace exercises as needed, but be mindful of what the user has already set up\n- The target duration is ${durationTarget} minutes - ensure the new plan fills this duration appropriately\n`;
    }
  }

  // Build PR section
  let prSection = '';
  if (personalRecords && personalRecords.size > 0) {
    const prList: string[] = [];
    personalRecords.forEach((pr, exerciseName) => {
      const useImperial = profile.use_imperial !== false;
      const weightStr = formatWeight(pr.weight, useImperial);
      if (pr.reps) {
        prList.push(`${exerciseName}: ${weightStr} for ${pr.reps} reps`);
      } else {
        prList.push(`${exerciseName}: ${weightStr}`);
      }
    });
    if (prList.length > 0) {
      prSection = `\nPERSONAL RECORDS (PRs):\nThe user's current personal records:\n${prList.join('\n')}\n\nIMPORTANT: Use these PRs to understand the user's strength levels. When programming exercises, consider:\n- Starting weights should be conservative relative to PRs (typically 70-85% of PR weight for working sets)\n- Progression should aim to eventually challenge or exceed these PRs over time\n- PRs indicate the user's maximum capabilities, so program accordingly\n`;
    }
  }

  // Build exercise history section
  let historySection = '';
  if (exerciseHistory && exerciseHistory.size > 0) {
    const historyList: string[] = [];
    exerciseHistory.forEach((logs, exerciseName) => {
      if (logs.length > 0) {
        // Get most recent 3-5 logs
        const recent = logs.slice(0, Math.min(5, logs.length));
        const useImperial = profile.use_imperial !== false;
        const recentStr = recent.map(log => {
          const weightStr = formatWeight(log.weight, useImperial);
          return `${weightStr} x ${log.reps}`;
        }).join(', ');
        historyList.push(`${exerciseName}: ${recentStr}`);
      }
    });
    if (historyList.length > 0) {
      historySection = `\nRECENT WORKOUT HISTORY:\nThe user's recent weights and reps for exercises:\n${historyList.join('\n')}\n\nIMPORTANT: Use this history to:\n- Understand progression patterns (are they increasing, maintaining, or struggling?)\n- Set appropriate starting weights that build on recent performance\n- Identify exercises where the user may need deloading or progression\n- Maintain consistency with what the user has been doing successfully\n`;
    }
  }

  let prompt = `Generate a comprehensive weekly workout plan in JSON format.

USER PROFILE:
- Age: ${profile.age || 'N/A'} years old
- Gender: ${profile.gender || 'Not specified'}
- Current Weight: ${weightStr}
${goalWeightStr ? `- Goal Weight: ${goalWeightStr}` : ''}
- Height: ${heightStr}
- Training Goal: ${profile.goal || 'General fitness'}
- Training Frequency: ${profile.days_per_week || 'N/A'} days per week
- Equipment Access: ${equipmentStr}
- Experience Level: ${profile.experience_level || 'Not specified'}

TRAINING GUIDELINES:
${experienceGuidelines}
${goalConsiderations ? `\n${goalConsiderations}` : ''}

WORKOUT COMPONENT PREFERENCES:
${componentDescription}

TIME GUIDELINES:
- ${goldilocksText}
${mode === 'target' 
  ? `- Each workout session should aim to be approximately ${durationTarget} minutes long\n- If you generate a workout that's shorter than ${durationTarget} minutes, add more exercises or increase sets/reps to reach the target\n- Balance exercise selection to fill the duration while maintaining proper recovery and intensity`
  : `- Each workout session must NOT exceed ${durationTarget} minutes\n- Prioritize the most effective exercises for the user's goals\n- Optimize volume and exercise selection to maximize results within the time constraint\n- Quality over quantity - focus on compound movements and essential exercises`}

${coverageAnalysis && coverageAnalysis.recommendations.length > 0
  ? `\nMOVEMENT PATTERN COVERAGE ANALYSIS:\n${coverageAnalysis.recommendations.join('\n')}\n`
  : ''}

${recoveryAnalysis && (recoveryAnalysis.warnings.length > 0 || recoveryAnalysis.recommendations.length > 0)
  ? `\nRECOVERY CONSIDERATIONS:\n${[...recoveryAnalysis.warnings, ...recoveryAnalysis.recommendations].join('\n')}\n`
  : ''}

${currentPlanSection}

${prSection}

${historySection}

${missedWorkouts && missedWorkouts.length > 0
  ? `\nMISSED/INCOMPLETE WORKOUTS ANALYSIS:\nThe user has ${missedWorkouts.length} missed or incomplete workout(s) from recent weeks:\n${missedWorkouts.map(mw => `- ${mw.day}: Planned ${mw.exercises_planned} exercises, completed ${mw.exercises_completed} (${mw.exercises_planned - mw.exercises_completed} missed)`).join('\n')}\n\nIMPORTANT: Consider these patterns when generating the new plan:\n- If user consistently misses certain days, consider adjusting schedule or reducing volume on those days\n- If user completes partial workouts, consider breaking workouts into smaller, more manageable sessions\n- Account for any patterns in missed exercises (e.g., always skipping leg day, or struggling with long sessions)\n`
  : ''}

${profile.workout_feedback ? `\nUSER FEEDBACK TO CONSIDER:\n${profile.workout_feedback}\n` : ''}

The response must be STRICTLY valid JSON in this exact format:
{
  "week_schedule": {
    "Monday": {
      "exercises": [
        {
          "name": "Bench Press",
          "target_sets": 3,
          "target_reps": 10,
          "rest_time_sec": 90,
          "notes": "Keep elbows tucked and squeeze scapula at top"
        }
      ]
    },
    "Tuesday": {
      "exercises": [...]
    },
    "Wednesday": {
      "exercises": [...]
    },
    "Thursday": {
      "exercises": [...]
    },
    "Friday": {
      "exercises": [...]
    },
    "Saturday": {
      "exercises": [...]
    },
    "Sunday": {
      "exercises": [...]
    }
  }
}

REQUIREMENTS:
1. CRITICAL: The user wants to train ${daysPerWeek} days per week. You MUST only generate workouts for exactly ${daysPerWeek} days. The remaining days should have empty exercises arrays.
2. Choose the best ${daysPerWeek} days based on recovery and muscle group balance (e.g., for 3 days: Monday/Wednesday/Friday or Tuesday/Thursday/Saturday; for 4 days: Monday/Tuesday/Thursday/Friday; etc.)
3. Include ALL 7 days (Monday through Sunday) in the response, but only ${daysPerWeek} should have exercises.
${exerciseListSection}
4. Follow the experience level guidelines for volume, intensity, and rep ranges.
5. Consider the user's goal when selecting exercises and rep ranges.
6. CRITICAL EQUIPMENT REQUIREMENT: You MUST only use exercises that can be performed with the available equipment: ${equipmentStr}
   - If the user has NO equipment selected (bodyweight only), you MUST only use bodyweight exercises (no dumbbells, barbells, machines, cables, etc.)
   - If the user has specific equipment, you MUST verify that each exercise's required equipment is in the list above
   - Exercises that require equipment NOT in the list above are FORBIDDEN
   - When in doubt, prefer bodyweight alternatives
7. Include technique tips and focus points in the "notes" field for each exercise.
8. Ensure proper rest periods based on experience level and exercise intensity.
9. Create a balanced program that targets all major muscle groups throughout the ${daysPerWeek} workout days.
${goalWeightStr ? `10. Consider the weight difference (current: ${weightStr}, goal: ${goalWeightStr}) when designing the program.` : ''}
11. Do NOT guess exact barbell/dumbbell weights. Focus on appropriate relative difficulty, set/rep schemes, and rest times. A separate progression engine will assign concrete loads from the user's workout history.

EXERCISE FORMAT REQUIREMENTS:
Each exercise must have this EXACT structure:
- "name": string (prefer from available exercises list)
- "target_sets": number (typically 3-5 based on experience level)
- "target_reps": number (not a string, e.g., 10 not "8-12")
- "rest_time_sec": number (rest time in seconds between sets)
- "notes": string (technique tips, can be empty string "")

Return ONLY the JSON object, no other text.`;

  return prompt;
};

/**
 * Build prompt for supplementary exercises generation
 */
export const buildSupplementaryPrompt = (
  profile: any,
  day: string,
  existingExercises: any[],
  availableExercises: string[] = []
): string => {
  const useImperial = profile.use_imperial !== false;
  const weightStr = formatWeight(profile.current_weight, useImperial);
  const heightStr = formatHeight(profile.height, useImperial);
  
  let goalWeightStr = '';
  if (profile.goal_weight) {
    goalWeightStr = formatWeight(profile.goal_weight, useImperial);
  }

  const experienceGuidelines = getExperienceGuidelines(profile.experience_level);
  const goalConsiderations = getGoalConsiderations(profile.goal);
  
  // Format equipment list for prompt
  const formatEquipmentForPrompt = (equipment: any[]): string => {
    if (!equipment || equipment.length === 0) {
      return 'Full gym access (all equipment available)';
    }
    return equipment.map((eq: any) => {
      if (typeof eq === 'string') {
        return eq;
      } else if (eq && typeof eq === 'object' && 'name' in eq) {
        return eq.name;
      }
      return '';
    }).filter(Boolean).join(', ');
  };

  const equipmentStr = formatEquipmentForPrompt(profile.equipment_access || []);

  const existingNames = existingExercises.map((e: any) => e.name).filter(Boolean);
  const existingList = existingNames.length > 0 ? existingNames.join(', ') : 'None';

  // Build exercise list section
  let exerciseListSection = '';
  if (availableExercises.length > 0) {
    exerciseListSection = `\nAVAILABLE EXERCISES FROM DATABASE:\n${availableExercises.join(', ')}\n\nIMPORTANT: You MUST prefer exercises from this list. Only create custom exercises if none from the list are suitable.\nDENSITY GUARDRAIL: If density_score is missing, infer density:\n- Compound + Barbell/Dumbbell/Bodyweight => High Density (~9)\n- Machine/Isolation => Low Density (~4)\nSelect exercises with inferred or known density >= 8.`;
  }

  // Analyze existing exercises for muscle groups and movement patterns
  let exerciseAnalysis = '';
  if (existingNames.length > 0) {
    exerciseAnalysis = `\nEXISTING EXERCISES ANALYSIS:\nThe user already has these exercises for ${day}: ${existingList}\n`;
    exerciseAnalysis += 'Generate exercises that COMPLEMENT these existing exercises. Consider:\n';
    exerciseAnalysis += '- Different muscle groups or angles\n';
    exerciseAnalysis += '- Opposing muscle groups (if existing are push, add pull; if legs, add upper body)\n';
    exerciseAnalysis += '- Different movement patterns (if existing are compound, add isolation; if isolation, add compound)\n';
    exerciseAnalysis += '- Exercise variety and balance\n';
  }

  let prompt = `Generate supplementary exercises for ${day} workout in JSON format.

USER PROFILE:
- Age: ${profile.age || 'N/A'} years old
- Gender: ${profile.gender || 'Not specified'}
- Current Weight: ${weightStr}
${goalWeightStr ? `- Goal Weight: ${goalWeightStr}` : ''}
- Height: ${heightStr}
- Training Goal: ${profile.goal || 'General fitness'}
- Training Frequency: ${profile.days_per_week || 'N/A'} days per week
- Equipment Access: ${equipmentStr}
- Experience Level: ${profile.experience_level || 'Not specified'}

TRAINING GUIDELINES:
${experienceGuidelines}
${goalConsiderations ? `\n${goalConsiderations}` : ''}
${exerciseAnalysis}
${profile.workout_feedback ? `\nUSER FEEDBACK TO CONSIDER:\n${profile.workout_feedback}\n` : ''}

IMPORTANT: 
- DO NOT duplicate or replace existing exercises: ${existingList}
- Only add exercises that COMPLEMENT and work well with the existing exercises
- CRITICAL EQUIPMENT REQUIREMENT: You MUST only use exercises that can be performed with the available equipment: ${equipmentStr}
  - If the user has NO equipment selected (bodyweight only), you MUST only use bodyweight exercises (no dumbbells, barbells, machines, cables, etc.)
  - If the user has specific equipment, you MUST verify that each exercise's required equipment is in the list above
  - Exercises that require equipment NOT in the list above are FORBIDDEN
- Follow experience level guidelines for volume and rep ranges
${exerciseListSection}

EXERCISE FORMAT REQUIREMENTS:
Each exercise must have this EXACT structure:
- "name": string (prefer from available exercises list)
- "target_sets": number (typically 3-5 based on experience level)
- "target_reps": number (not a string, e.g., 10 not "8-12")
- "rest_time_sec": number (rest time in seconds between sets)
- "notes": string (technique tips, can be empty string "")

The response must be STRICTLY valid JSON array in this exact format:
[
  {
    "name": "Exercise Name",
    "target_sets": 3,
    "target_reps": 10,
    "rest_time_sec": 90,
    "notes": "Form tips and technique focus"
  }
]

Return ONLY the JSON array, no other text.`;

  return prompt;
};

/**
 * Build prompt for day session generation with comprehensive context
 */
export const buildDaySessionPrompt = (params: {
  profile: any;
  day: string;
  existingExercises: any[];
  availableExercises: string[];
  coveredMovementPatterns: string[];
  missingMovementPatterns: string[];
  coveredMuscleGroups: string[];
  recoveryReadyMuscles: string[];
  recoveryFatiguedMuscles: string[];
  remainingTimeSec: number;
  timeConstraintMin: number;
  exerciseHistory?: Map<string, Array<{ weight: number; reps: number; performed_at: string }>>;
  personalRecords?: Map<string, { weight: number; reps: number | null }>;
  currentWeekSchedule?: any;
}): string => {
  const {
    profile,
    day,
    existingExercises,
    availableExercises,
    coveredMovementPatterns,
    missingMovementPatterns,
    coveredMuscleGroups,
    recoveryReadyMuscles,
    recoveryFatiguedMuscles,
    remainingTimeSec,
    timeConstraintMin,
    exerciseHistory = new Map(),
    personalRecords = new Map(),
    currentWeekSchedule,
  } = params;

  const useImperial = profile.use_imperial !== false;
  const weightStr = formatWeight(profile.current_weight, useImperial);
  const heightStr = formatHeight(profile.height, useImperial);
  
  let goalWeightStr = '';
  if (profile.goal_weight) {
    goalWeightStr = formatWeight(profile.goal_weight, useImperial);
  }

  const experienceGuidelines = getExperienceGuidelines(profile.experience_level);
  const goalConsiderations = getGoalConsiderations(profile.goal);
  const { style: trainingStyle, components } = deriveStyleAndComponentsFromProfile(profile);
  const componentDescription = describeComponentsForPrompt(trainingStyle, components);

  // Format equipment list for prompt
  const formatEquipmentForPrompt = (equipment: any[]): string => {
    if (!equipment || equipment.length === 0) {
      return 'Full gym access (all equipment available)';
    }
    return equipment.map((eq: any) => {
      if (typeof eq === 'string') {
        return eq;
      } else if (eq && typeof eq === 'object' && 'name' in eq) {
        return eq.name;
      }
      return '';
    }).filter(Boolean).join(', ');
  };

  const equipmentStr = formatEquipmentForPrompt(profile.equipment_access || []);

  // Build existing exercises list
  const existingNames = existingExercises.map((e: any) => e.name).filter(Boolean);
  const existingList = existingNames.length > 0 ? existingNames.join(', ') : 'None';

  // Build exercise list section
  let exerciseListSection = '';
  if (availableExercises.length > 0) {
    exerciseListSection = `\nAVAILABLE EXERCISES FROM DATABASE:\n${availableExercises.join(', ')}\n\nIMPORTANT: You MUST prefer exercises from this list. Only create custom exercises if none from the list are suitable.`;
  }

  // Build gap analysis section
  let gapAnalysisSection = '';
  
  if (existingNames.length > 0) {
    gapAnalysisSection = `\nEXISTING EXERCISES FOR ${day}:\n${existingList}\n\nGAP ANALYSIS:\n`;
    
    // Movement pattern gaps
    if (coveredMovementPatterns.length > 0) {
      gapAnalysisSection += `- Covered movement patterns: ${coveredMovementPatterns.join(', ')}\n`;
    }
    if (missingMovementPatterns.length > 0) {
      gapAnalysisSection += `- Missing movement patterns: ${missingMovementPatterns.join(', ')}\n`;
    }
    
    // Muscle group gaps
    if (coveredMuscleGroups.length > 0) {
      gapAnalysisSection += `- Covered muscle groups: ${coveredMuscleGroups.join(', ')}\n`;
    }
    
    // Recovery status
    if (recoveryReadyMuscles.length > 0) {
      gapAnalysisSection += `- Recovery-ready muscles (>80%): ${recoveryReadyMuscles.join(', ')} - prioritize exercises targeting these\n`;
    }
    if (recoveryFatiguedMuscles.length > 0) {
      gapAnalysisSection += `- Fatigued muscles (<50%): ${recoveryFatiguedMuscles.join(', ')} - avoid heavy work on these\n`;
    }
    
    gapAnalysisSection += '\nINSTRUCTIONS:\n';
    gapAnalysisSection += '- Generate exercises that COMPLEMENT existing exercises\n';
    gapAnalysisSection += '- Do NOT duplicate existing exercises or repeat movement patterns already covered\n';
    
    // Tier-specific instructions
    if (components.include_tier1_compounds && !components.include_tier2_accessories) {
      gapAnalysisSection += '- For Tier 1-only preference: Add Tier 1 exercises to cover missing movement patterns (squat, hinge, push, pull)\n';
      gapAnalysisSection += '- Do NOT repeat Tier 1 patterns if already present\n';
    } else {
      gapAnalysisSection += '- Add complementary Tier 2/3 exercises to fill gaps\n';
    }
  } else {
    gapAnalysisSection = `\nNo existing exercises for ${day}. Generate a complete workout.\n`;
  }

  // Build exercise history section
  let historySection = '';
  if (exerciseHistory && exerciseHistory.size > 0) {
    const historyList: string[] = [];
    exerciseHistory.forEach((logs, exerciseName) => {
      if (logs.length > 0) {
        const recent = logs.slice(0, Math.min(5, logs.length));
        const recentStr = recent.map(log => {
          const weightStr = formatWeight(log.weight, useImperial);
          return `${weightStr} x ${log.reps}`;
        }).join(', ');
        historyList.push(`${exerciseName}: ${recentStr}`);
      }
    });
    if (historyList.length > 0) {
      historySection = `\nRECENT WORKOUT HISTORY:\nThe user's recent weights and reps for exercises:\n${historyList.join('\n')}\n\nIMPORTANT: Use this history to understand progression patterns and set appropriate starting weights.\n`;
    }
  }

  // Build PR section
  let prSection = '';
  if (personalRecords && personalRecords.size > 0) {
    const prList: string[] = [];
    personalRecords.forEach((pr, exerciseName) => {
      const weightStr = formatWeight(pr.weight, useImperial);
      if (pr.reps) {
        prList.push(`${exerciseName}: ${weightStr} for ${pr.reps} reps`);
      } else {
        prList.push(`${exerciseName}: ${weightStr}`);
      }
    });
    if (prList.length > 0) {
      prSection = `\nPERSONAL RECORDS (PRs):\nThe user's current personal records:\n${prList.join('\n')}\n\nIMPORTANT: Use these PRs to understand strength levels. Starting weights should be conservative relative to PRs (typically 70-85% of PR weight for working sets).\n`;
    }
  }

  // Build current plan section
  let currentPlanSection = '';
  if (currentWeekSchedule) {
    const daysWithExercises: string[] = [];
    Object.keys(currentWeekSchedule).forEach(dayKey => {
      const dayData = currentWeekSchedule[dayKey];
      if (dayData?.exercises && Array.isArray(dayData.exercises) && dayData.exercises.length > 0) {
        const exerciseNames = dayData.exercises.map((ex: any) => ex.name).filter(Boolean).join(', ');
        daysWithExercises.push(`${dayKey}: ${exerciseNames}`);
      }
    });
    
    if (daysWithExercises.length > 0) {
      currentPlanSection = `\nCURRENT WEEK PLAN CONTEXT:\nThe user's current week schedule:\n${daysWithExercises.join('\n')}\n\nConsider this context when generating exercises to ensure balance across the week.\n`;
    }
  }

  const remainingTimeMin = Math.round(remainingTimeSec / 60);

  let prompt = `Generate supplementary exercises for ${day} workout in JSON format.

USER PROFILE:
- Age: ${profile.age || 'N/A'} years old
- Gender: ${profile.gender || 'Not specified'}
- Current Weight: ${weightStr}
${goalWeightStr ? `- Goal Weight: ${goalWeightStr}` : ''}
- Height: ${heightStr}
- Training Goal: ${profile.goal || 'General fitness'}
- Training Frequency: ${profile.days_per_week || 'N/A'} days per week
- Equipment Access: ${equipmentStr}
- Experience Level: ${profile.experience_level || 'Not specified'}

TRAINING GUIDELINES:
${experienceGuidelines}
${goalConsiderations ? `\n${goalConsiderations}` : ''}

WORKOUT COMPONENT PREFERENCES:
${componentDescription}

TIME CONSTRAINT:
CRITICAL: Generate the best possible workout that fits within ${timeConstraintMin} minutes. This is a MAXIMUM constraint - prioritize quality over quantity. Do NOT add filler exercises just to fill time.
${remainingTimeSec > 0 ? `- Remaining time budget: approximately ${remainingTimeMin} minutes\n` : ''}
${remainingTimeSec <= 0 ? '- WARNING: Existing exercises already exceed or meet time constraint. Generate only essential complementary exercises if needed.\n' : ''}

${gapAnalysisSection}

${currentPlanSection}

${prSection}

${historySection}

${profile.workout_feedback ? `\nUSER FEEDBACK TO CONSIDER:\n${profile.workout_feedback}\n` : ''}

IMPORTANT: 
- DO NOT duplicate or replace existing exercises: ${existingList}
- Only add exercises that COMPLEMENT and work well with the existing exercises
- CRITICAL EQUIPMENT REQUIREMENT: You MUST only use exercises that can be performed with the available equipment: ${equipmentStr}
  - If the user has NO equipment selected (bodyweight only), you MUST only use bodyweight exercises (no dumbbells, barbells, machines, cables, etc.)
  - If the user has specific equipment, you MUST verify that each exercise's required equipment is in the list above
  - Exercises that require equipment NOT in the list above are FORBIDDEN
- Follow experience level guidelines for volume and rep ranges
${exerciseListSection}

EXERCISE FORMAT REQUIREMENTS:
Each exercise must have this EXACT structure:
- "name": string (prefer from available exercises list)
- "target_sets": number (typically 3-5 based on experience level)
- "target_reps": number (not a string, e.g., 10 not "8-12")
- "rest_time_sec": number (rest time in seconds between sets)
- "notes": string (technique tips, can be empty string "")

The response must be STRICTLY valid JSON array in this exact format:
[
  {
    "name": "Exercise Name",
    "target_sets": 3,
    "target_reps": 10,
    "rest_time_sec": 90,
    "notes": "Form tips and technique focus"
  }
]

Return ONLY the JSON array, no other text.`;

  return prompt;
};

