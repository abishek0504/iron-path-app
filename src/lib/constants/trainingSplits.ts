/**
 * Training split definitions and per-frequency suggestions.
 *
 * The chosen split is stored in `v2_profiles.preferred_training_style` as
 * either one of these ids or free text for a custom split. The AI workout
 * generator reads it to keep each generated day compliant with the split.
 */

export interface TrainingSplit {
  id: string;
  label: string;
  description: string;
  /** Day-focus choices offered in the AI generation constraints form. */
  dayFocusOptions: string[];
}

/**
 * Generic focus options used when the stored split is `not_sure` or a legacy
 * free-text value the engine can't map to a known split.
 */
export const GENERIC_DAY_FOCUS_OPTIONS = [
  'Push',
  'Pull',
  'Legs',
  'Upper',
  'Lower',
  'Full Body',
  'Torso',
  'Limbs',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
];

export const TRAINING_SPLITS: Record<string, TrainingSplit> = {
  full_body: {
    id: 'full_body',
    label: 'Full Body',
    description: 'Every session trains the whole body',
    dayFocusOptions: ['Full Body'],
  },
  upper_lower: {
    id: 'upper_lower',
    label: 'Upper / Lower',
    description: 'Alternate upper-body and lower-body days',
    dayFocusOptions: ['Upper', 'Lower'],
  },
  push_pull: {
    id: 'push_pull',
    label: 'Push / Pull',
    description: 'Alternate pushing and pulling days (legs mixed into both)',
    dayFocusOptions: ['Push + Legs', 'Pull + Legs'],
  },
  push_pull_legs: {
    id: 'push_pull_legs',
    label: 'Push / Pull / Legs',
    description: 'Rotate pushing, pulling, and leg days',
    dayFocusOptions: ['Push', 'Pull', 'Legs'],
  },
  ppl_x2: {
    id: 'ppl_x2',
    label: 'Push / Pull / Legs x2',
    description: 'Run the PPL rotation twice per week',
    dayFocusOptions: ['Push', 'Pull', 'Legs'],
  },
  ppl_upper_lower: {
    id: 'ppl_upper_lower',
    label: 'PPL + Upper / Lower',
    description: 'Push, pull, legs, then upper and lower days',
    dayFocusOptions: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  },
  ppl_shoulders_arms: {
    id: 'ppl_shoulders_arms',
    label: 'PPL + Shoulders & Arms',
    description: 'Push, pull, legs, plus a dedicated shoulders and arms day',
    dayFocusOptions: ['Push', 'Pull', 'Legs', 'Shoulders + Arms'],
  },
  upper_lower_x3: {
    id: 'upper_lower_x3',
    label: 'Upper / Lower x3',
    description: 'Upper and lower each three times per week',
    dayFocusOptions: ['Upper', 'Lower'],
  },
  torso_limbs: {
    id: 'torso_limbs',
    label: 'Torso / Limbs',
    description: 'Alternate torso (chest/back) and limbs (arms/legs) days',
    dayFocusOptions: ['Torso', 'Limbs'],
  },
  bro_split: {
    id: 'bro_split',
    label: 'Bro Split',
    description: 'One muscle group per day (chest, back, legs, shoulders, arms)',
    dayFocusOptions: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
  },
  body_part_4day: {
    id: 'body_part_4day',
    label: '4-Day Body Part',
    description: 'Chest, back, legs, and shoulders + arms across four days',
    dayFocusOptions: ['Chest', 'Back', 'Legs', 'Shoulders + Arms'],
  },
  bro_split_6day: {
    id: 'bro_split_6day',
    label: '6-Day Body Part',
    description: 'Chest, back, shoulders, arms, quads, and posterior chain',
    dayFocusOptions: ['Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings + Glutes'],
  },
  arnold: {
    id: 'arnold',
    label: 'Arnold Split',
    description: 'Chest+back, shoulders+arms, legs — run twice per week',
    dayFocusOptions: ['Chest + Back', 'Shoulders + Arms', 'Legs'],
  },
  phul: {
    id: 'phul',
    label: 'PHUL',
    description: 'Power Hypertrophy Upper Lower — strength and size days',
    dayFocusOptions: [
      'Upper Power',
      'Lower Power',
      'Upper Hypertrophy',
      'Lower Hypertrophy',
    ],
  },
  phat: {
    id: 'phat',
    label: 'PHAT',
    description: 'Power Hypertrophy Adaptive Training across five focused days',
    dayFocusOptions: [
      'Upper Power',
      'Lower Power',
      'Back Hypertrophy',
      'Lower Hypertrophy',
      'Chest/Arms Hypertrophy',
    ],
  },
  powerlifting: {
    id: 'powerlifting',
    label: 'Powerlifting (SBD)',
    description: 'Squat, bench, and deadlift focused days with accessories',
    dayFocusOptions: ['Squat', 'Bench', 'Deadlift', 'Accessories'],
  },
  olympic: {
    id: 'olympic',
    label: 'Olympic / Strength',
    description: 'Snatch, clean & jerk, strength, and accessory emphasis days',
    dayFocusOptions: [
      'Snatch Focus',
      'Clean & Jerk Focus',
      'Strength',
      'Accessories',
    ],
  },
  not_sure: {
    id: 'not_sure',
    label: 'Not sure — pick for me',
    description: 'The AI chooses a sensible split based on your training frequency',
    dayFocusOptions: GENERIC_DAY_FOCUS_OPTIONS,
  },
};

/** Known split ids excluding the "not sure" helper option. */
export const NAMED_SPLIT_IDS = Object.keys(TRAINING_SPLITS).filter(
  (id) => id !== 'not_sure'
);

/** Suggested split ids per training frequency (days per week). */
const SUGGESTIONS_BY_DAYS: Record<number, string[]> = {
  1: ['full_body'],
  2: ['full_body', 'upper_lower', 'push_pull'],
  3: ['full_body', 'push_pull_legs', 'upper_lower'],
  4: ['upper_lower', 'phul', 'torso_limbs', 'body_part_4day', 'push_pull_legs'],
  5: ['ppl_upper_lower', 'phat', 'ppl_shoulders_arms', 'bro_split', 'upper_lower'],
  6: ['ppl_x2', 'arnold', 'upper_lower_x3', 'bro_split_6day', 'powerlifting'],
  7: ['ppl_x2', 'bro_split_6day', 'olympic', 'full_body'],
};

export function getSuggestedSplits(daysPerWeek: number): TrainingSplit[] {
  const ids = SUGGESTIONS_BY_DAYS[daysPerWeek] ?? SUGGESTIONS_BY_DAYS[3];
  return ids.map((id) => TRAINING_SPLITS[id]).filter(Boolean);
}

/**
 * All named splits for the picker: suggestions first, then the rest (stable label order).
 */
export function getAllSplitsOrdered(daysPerWeek: number): {
  suggested: TrainingSplit[];
  more: TrainingSplit[];
} {
  const suggested = getSuggestedSplits(Math.max(1, daysPerWeek));
  const suggestedIds = new Set(suggested.map((s) => s.id));
  const more = NAMED_SPLIT_IDS
    .filter((id) => !suggestedIds.has(id))
    .map((id) => TRAINING_SPLITS[id])
    .sort((a, b) => a.label.localeCompare(b.label));
  return { suggested, more };
}

/**
 * Day-focus options for the AI generation form. Known split ids use their
 * own options; `not_sure`, legacy custom text, and missing values fall back
 * to the generic set.
 */
export function getDayFocusOptions(splitValue: string | null | undefined): string[] {
  if (splitValue && splitValue in TRAINING_SPLITS) {
    return TRAINING_SPLITS[splitValue].dayFocusOptions;
  }
  return GENERIC_DAY_FOCUS_OPTIONS;
}

export function isKnownSplitId(value: string | null | undefined): boolean {
  return !!value && value in TRAINING_SPLITS;
}

/** Display label for a stored split value (known id → label, custom → as-is). */
export function getSplitLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return TRAINING_SPLITS[value]?.label ?? value;
}

/**
 * Deterministic focus for training-day N of the user's split.
 * `not_sure`, unknown, and empty values return null so the model picks a coherent week.
 */
export function focusForTrainingDay(
  splitId: string | null | undefined,
  trainingDayIndex0: number,
): string | null {
  if (!splitId || splitId === 'not_sure' || !(splitId in TRAINING_SPLITS)) {
    return null;
  }
  const options = TRAINING_SPLITS[splitId].dayFocusOptions;
  if (options.length === 0) return null;
  const wrapped =
    ((trainingDayIndex0 % options.length) + options.length) % options.length;
  return options[wrapped] ?? null;
}

export type DayFocusMap = Record<string, string>;

const WEEKDAY_ORDER = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function isValidDayFocus(
  splitValue: string | null | undefined,
  focus: string | null | undefined,
): boolean {
  if (!focus) return false;
  return getDayFocusOptions(splitValue).includes(focus);
}

export function orderTrainingDays(workoutDays: string[]): string[] {
  const allowed = new Set<string>(WEEKDAY_ORDER);
  const unique = new Set<string>();
  for (const day of workoutDays) {
    if (allowed.has(day)) unique.add(day);
  }
  return [...unique].sort(
    (a, b) =>
      WEEKDAY_ORDER.indexOf(a as (typeof WEEKDAY_ORDER)[number]) -
      WEEKDAY_ORDER.indexOf(b as (typeof WEEKDAY_ORDER)[number]),
  );
}

export function resolveDayFocus(args: {
  splitValue: string | null | undefined;
  dayName: string;
  trainingDayIndex: number;
  overrides?: DayFocusMap | null;
}): string | null {
  const pinned = args.overrides?.[args.dayName];
  if (pinned && isValidDayFocus(args.splitValue, pinned)) {
    return pinned;
  }
  return focusForTrainingDay(args.splitValue, args.trainingDayIndex);
}

/** Keep pins that are still valid for the current split and selected days. */
export function sanitizeDayFocusMap(
  raw: unknown,
  splitValue: string | null | undefined,
  workoutDays: string[],
): DayFocusMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const allowedDays = new Set(orderTrainingDays(workoutDays));
  const result: DayFocusMap = {};
  for (const [dayName, focus] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowedDays.has(dayName)) continue;
    if (typeof focus !== 'string') continue;
    if (!isValidDayFocus(splitValue, focus)) continue;
    result[dayName] = focus;
  }
  return result;
}

/** Fill each selected day from a valid pin, else the split rotation. */
export function seedDayFocusMap(
  splitValue: string | null | undefined,
  workoutDays: string[],
  existing?: DayFocusMap | null,
): DayFocusMap {
  const ordered = orderTrainingDays(workoutDays);
  const result: DayFocusMap = {};
  ordered.forEach((dayName, trainingDayIndex) => {
    const resolved = resolveDayFocus({
      splitValue,
      dayName,
      trainingDayIndex,
      overrides: existing,
    });
    if (resolved) result[dayName] = resolved;
  });
  return result;
}
