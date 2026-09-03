/**
 * Day-focus matching for AI generation.
 * Used to keep Push days on push movements (not Hip Thrust) and to
 * drop repeats of the same exercise identity.
 */

export interface FocusableExercise {
  id?: string;
  name?: string;
  movement_pattern: string | null;
  primary_muscles: string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_/,-]+/g, ' ').replace(/\s+/g, ' ');
}

const MUSCLE_GROUPS: Record<string, string[]> = {
  chest: ['chest', 'upper chest', 'lower chest'],
  back: ['lats', 'upper back', 'lower back', 'traps'],
  shoulders: ['anterior deltoids', 'lateral deltoids', 'posterior deltoids'],
  arms: ['biceps', 'triceps', 'forearms'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves', 'soleus'],
  core: ['abs', 'obliques', 'transverse abdominis'],
};

type FocusRule = {
  patterns?: string[];
  muscleKeys?: string[];
};

const FOCUS_RULES: Record<string, FocusRule> = {
  push: {
    patterns: ['push'],
    muscleKeys: [
      'chest',
      'upper chest',
      'lower chest',
      'anterior deltoids',
      'lateral deltoids',
      'triceps',
    ],
  },
  pull: {
    patterns: ['pull'],
    muscleKeys: [
      'lats',
      'upper back',
      'traps',
      'biceps',
      'posterior deltoids',
      'forearms',
    ],
  },
  legs: {
    patterns: ['squat', 'hinge', 'lunge'],
    muscleKeys: [
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'adductors',
      'hip flexors',
      'soleus',
    ],
  },
  upper: {
    patterns: ['push', 'pull'],
    muscleKeys: [
      'chest',
      'upper chest',
      'lower chest',
      'lats',
      'upper back',
      'traps',
      'anterior deltoids',
      'lateral deltoids',
      'posterior deltoids',
      'biceps',
      'triceps',
      'forearms',
    ],
  },
  lower: {
    patterns: ['squat', 'hinge', 'lunge'],
    muscleKeys: [
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'adductors',
      'hip flexors',
      'soleus',
    ],
  },
  'full body': {},
  torso: {
    patterns: ['push', 'pull'],
    muscleKeys: ['chest', 'upper chest', 'lower chest', 'lats', 'upper back', 'traps'],
  },
  limbs: {
    muscleKeys: [
      'biceps',
      'triceps',
      'forearms',
      'quads',
      'hamstrings',
      'glutes',
      'calves',
    ],
  },
};

function resolveFocusKey(raw: string): string {
  const n = normalize(raw);
  if (n === 'hamstrings' || n === 'glutes' || n === 'quads' || n === 'calves') return n;
  if (n === 'chest' || n === 'back' || n === 'shoulders' || n === 'arms') return n;
  if (n.includes('full body')) return 'full body';
  if (n.includes('shoulders') && n.includes('arm')) return 'shoulders + arms';
  if (n.includes('chest') && n.includes('back')) return 'chest + back';
  if (n.includes('hamstring') && n.includes('glute')) return 'hamstrings + glutes';
  if (n.includes('push')) return 'push';
  if (n.includes('pull')) return 'pull';
  if (n.includes('upper')) return 'upper';
  if (n.includes('lower')) return 'lower';
  if (n.includes('deadlift')) return 'deadlift';
  if (n.includes('squat') && !n.includes('leg')) return 'squat';
  if (n.includes('leg')) return 'legs';
  if (n.includes('bench')) return 'bench';
  if (n.includes('torso')) return 'torso';
  if (n.includes('limb')) return 'limbs';
  if (n.includes('chest')) return 'chest';
  if (n.includes('back')) return 'back';
  if (n.includes('shoulder')) return 'shoulders';
  if (n.includes('arm')) return 'arms';
  if (n.includes('quad')) return 'quads';
  if (n.includes('hamstring')) return 'hamstrings';
  if (n.includes('glute')) return 'glutes';
  return n;
}

function exerciseHitsKeys(exercise: FocusableExercise, keys: string[]): boolean {
  const pattern = normalize(exercise.movement_pattern ?? '');
  const muscles = exercise.primary_muscles.map(normalize);
  return keys.some((key) => {
    const k = normalize(key);
    if (pattern === k || pattern.includes(k)) return true;
    return muscles.some((m) => m === k || m.includes(k) || k.includes(m));
  });
}

function ruleForFocus(focusKey: string): FocusRule | null {
  if (focusKey === 'full body') return {};
  if (focusKey === 'shoulders + arms') {
    return {
      muscleKeys: [...(MUSCLE_GROUPS.shoulders ?? []), ...(MUSCLE_GROUPS.arms ?? [])],
    };
  }
  if (focusKey === 'chest + back') {
    return {
      patterns: ['push', 'pull'],
      muscleKeys: [...(MUSCLE_GROUPS.chest ?? []), ...(MUSCLE_GROUPS.back ?? [])],
    };
  }
  if (focusKey === 'hamstrings + glutes') {
    return {
      patterns: ['hinge'],
      muscleKeys: [...(MUSCLE_GROUPS.hamstrings ?? []), ...(MUSCLE_GROUPS.glutes ?? [])],
    };
  }
  if (focusKey === 'bench') {
    return { patterns: ['push'], muscleKeys: MUSCLE_GROUPS.chest };
  }
  if (focusKey === 'deadlift') {
    return { patterns: ['hinge'], muscleKeys: ['hamstrings', 'glutes', 'lower back'] };
  }
  if (focusKey === 'squat') {
    return { patterns: ['squat'], muscleKeys: MUSCLE_GROUPS.quads };
  }
  if (MUSCLE_GROUPS[focusKey]) {
    return { muscleKeys: MUSCLE_GROUPS[focusKey] };
  }
  return FOCUS_RULES[focusKey] ?? null;
}

export function exerciseMatchesDayFocus(
  exercise: FocusableExercise,
  dayFocus: string | null | undefined,
): boolean {
  if (!dayFocus) return true;
  const focusKey = resolveFocusKey(dayFocus);
  if (focusKey === 'full body') return true;

  if (focusKey.includes(' + ')) {
    return focusKey.split(' + ').some((part) => exerciseMatchesDayFocus(exercise, part.trim()));
  }

  const rule = ruleForFocus(focusKey);
  if (!rule) {
    return exerciseHitsKeys(exercise, [focusKey]);
  }
  if ((!rule.patterns || rule.patterns.length === 0) && (!rule.muscleKeys || rule.muscleKeys.length === 0)) {
    return true;
  }
  if (rule.patterns && exerciseHitsKeys(exercise, rule.patterns)) return true;
  if (rule.muscleKeys && exerciseHitsKeys(exercise, rule.muscleKeys)) return true;
  return false;
}

export function exerciseHitsAvoidedMuscles(
  exercise: FocusableExercise,
  avoidMuscles: string[],
): boolean {
  if (avoidMuscles.length === 0) return false;
  return avoidMuscles.some((group) => {
    const key = normalize(group);
    const keys = MUSCLE_GROUPS[key] ?? [key];
    return exerciseHitsKeys(exercise, keys);
  });
}

export function filterExercisesByDayFocus<T extends FocusableExercise>(
  exercises: T[],
  dayFocus: string | null | undefined,
): T[] {
  if (!dayFocus) return exercises;
  return exercises.filter((exercise) => exerciseMatchesDayFocus(exercise, dayFocus));
}

export function normalizeExerciseName(name: string): string {
  return normalize(name);
}
