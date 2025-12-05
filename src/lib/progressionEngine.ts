import type { ExerciseHistoryMetrics } from './progressionMetrics';

export interface ProgressionInput {
  profile: any;
  exercise: any;
  metrics: ExerciseHistoryMetrics;
  personalRecord?: { weight: number; reps: number | null } | null; // Optional PR from user_exercises
}

export interface ProgressionSuggestion {
  suggestedSets: number;
  suggestedReps: number | null;
  suggestedWeight: number | null;
  note?: string;
}

const getBaseSets = (exercise: any): number => {
  if (typeof exercise.target_sets === 'number' && exercise.target_sets > 0) {
    return exercise.target_sets;
  }
  if (Array.isArray(exercise.sets) && exercise.sets.length > 0) {
    return exercise.sets.length;
  }
  return 3;
};

const getBaseReps = (exercise: any): number | null => {
  if (typeof exercise.target_reps === 'number') {
    return exercise.target_reps;
  }
  if (typeof exercise.target_reps === 'string') {
    const match = exercise.target_reps.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  if (Array.isArray(exercise.sets) && exercise.sets[0]?.reps != null) {
    const r = exercise.sets[0].reps;
    if (typeof r === 'number') return r;
  }
  return null;
};

const isBodyweightExerciseBySets = (exercise: any): boolean => {
  if (!Array.isArray(exercise.sets)) return false;
  // Treat explicit 0 weight as bodyweight. Null/undefined means unknown and should
  // still receive a suggested external load.
  return exercise.sets.every((set: any) => set.weight === 0);
};

const inferMovementCategory = (exercise: any): 'upper' | 'lower' | 'other' => {
  const name = (exercise.name || '').toLowerCase();
  if (!name) return 'other';
  if (
    name.includes('squat') ||
    name.includes('deadlift') ||
    name.includes('lunge') ||
    name.includes('leg') ||
    name.includes('hip') ||
    name.includes('glute')
  ) {
    return 'lower';
  }
  if (
    name.includes('press') ||
    name.includes('row') ||
    name.includes('curl') ||
    name.includes('extension') ||
    name.includes('pulldown') ||
    name.includes('pull-down') ||
    name.includes('pull up') ||
    name.includes('bench')
  ) {
    return 'upper';
  }
  return 'other';
};

const getHeuristicStartingWeight = (profile: any, exercise: any): number | null => {
  const category = inferMovementCategory(exercise);
  const currentWeightKg = typeof profile.current_weight === 'number' ? profile.current_weight : null;

  // Database stores kg; UI uses lbs. For a conservative heuristic we'll use
  // small absolute loads rather than tight bodyweight scaling.
  if (category === 'upper') {
    return 25; // ~55 lbs total for barbell / moderate dumbbells
  }

  if (category === 'lower') {
    return 50; // modest lower-body load
  }

  if (currentWeightKg && currentWeightKg > 0) {
    return Math.max(15, Math.round(currentWeightKg * 0.3));
  }

  // Fallback conservative absolute load when no profile data is available.
  return 20;
};

export const computeProgressionSuggestion = (input: ProgressionInput): ProgressionSuggestion => {
  const { profile, exercise, metrics } = input;

  const baseSets = getBaseSets(exercise);
  const baseReps = getBaseReps(exercise);
  const isBodyweight = isBodyweightExerciseBySets(exercise);

  // Bodyweight exercises don't need load progression
  if (isBodyweight) {
    return {
      suggestedSets: baseSets,
      suggestedReps: baseReps,
      suggestedWeight: 0,
    };
  }

  const lastSuccessfulWeight =
    metrics.lastSuccessful && typeof metrics.lastSuccessful.weight === 'number'
      ? metrics.lastSuccessful.weight
      : null;
  const lastWeight =
    metrics.lastLog && typeof metrics.lastLog.weight === 'number' ? metrics.lastLog.weight : null;

  // Use PR if available and higher than recent logs (PR takes precedence for baseline)
  const prWeight = input.personalRecord?.weight && input.personalRecord.weight > 0
    ? input.personalRecord.weight
    : null;

  // Baseline: PR > lastSuccessful > lastWeight > heuristic
  let baselineWeight = prWeight ?? lastSuccessfulWeight ?? lastWeight ?? null;
  let note: string | undefined;

  if (baselineWeight == null || baselineWeight <= 0) {
    baselineWeight = getHeuristicStartingWeight(profile, exercise);
    note = 'On-ramp: conservative starting weight';
  } else if (prWeight && prWeight > (lastSuccessfulWeight ?? 0)) {
    // If using PR that's higher than recent logs, use a conservative percentage of PR
    baselineWeight = prWeight * 0.85; // Start at 85% of PR for safety
    note = `Based on PR: ${prWeight} lbs (starting at 85% for safety)`;
  }

  let suggestedWeight = baselineWeight ?? null;
  let suggestedSets = baseSets;

  if (baselineWeight != null && baselineWeight > 0 && metrics.hasHistory) {
    if (metrics.trend === 'progressing') {
      const increment = Math.max(2.5, baselineWeight * 0.025);
      suggestedWeight = baselineWeight + increment;
      note = `Progression: +${increment.toFixed(1)} from last working weight`;
    } else if (metrics.trend === 'struggling') {
      const reduced = baselineWeight * 0.9;
      suggestedWeight = Math.max(5, reduced);
      suggestedSets = Math.max(2, baseSets - 1);
      note = 'Deload: reduced load and/or volume after recent struggles';
    }
  }

  if (__DEV__) {
    console.log('[progressionEngine] suggestion', {
      exercise: exercise.name,
      trend: metrics.trend,
      baseSets,
      baseReps,
      baselineWeight,
      suggestedWeight,
      suggestedSets,
      note,
    });
  }

  return {
    suggestedSets,
    suggestedReps: baseReps,
    suggestedWeight: suggestedWeight ?? null,
    note,
  };
};


