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
 */
export const buildFullPlanPrompt = (
  profile: any,
  availableExercises: string[] = [],
  coverageAnalysis?: { recommendations: string[] },
  recoveryAnalysis?: { warnings: string[]; recommendations: string[] },
  missedWorkouts?: Array<{ day: string; scheduled_at: string; exercises_planned: number; exercises_completed: number }>
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
  const goldilocksText =
    'If the user does not specify a time constraint, aim for a per-session duration in the 45–60 minute Goldilocks zone. Prefer closer to 45 minutes when in doubt, while preserving Tier 1 compounds.';
  
  // Build exercise list section
  let exerciseListSection = '';
  if (availableExercises.length > 0) {
    exerciseListSection = `\nAVAILABLE EXERCISES FROM DATABASE:\n${availableExercises.join(', ')}\n\nIMPORTANT: You MUST prefer exercises from this list. Only create custom exercises if none from the list are suitable for the specific muscle group or movement pattern needed.`;
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

${coverageAnalysis && coverageAnalysis.recommendations.length > 0
  ? `\nMOVEMENT PATTERN COVERAGE ANALYSIS:\n${coverageAnalysis.recommendations.join('\n')}\n`
  : ''}

${recoveryAnalysis && (recoveryAnalysis.warnings.length > 0 || recoveryAnalysis.recommendations.length > 0)
  ? `\nRECOVERY CONSIDERATIONS:\n${[...recoveryAnalysis.warnings, ...recoveryAnalysis.recommendations].join('\n')}\n`
  : ''}

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
    exerciseListSection = `\nAVAILABLE EXERCISES FROM DATABASE:\n${availableExercises.join(', ')}\n\nIMPORTANT: You MUST prefer exercises from this list. Only create custom exercises if none from the list are suitable.`;
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

