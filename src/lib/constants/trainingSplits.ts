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
  push_pull_legs: {
    id: 'push_pull_legs',
    label: 'Push / Pull / Legs',
    description: 'Rotate pushing, pulling, and leg days',
    dayFocusOptions: ['Push', 'Pull', 'Legs'],
  },
  ppl_upper_lower: {
    id: 'ppl_upper_lower',
    label: 'PPL + Upper / Lower',
    description: 'Push, pull, legs, then upper and lower days',
    dayFocusOptions: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  },
  bro_split: {
    id: 'bro_split',
    label: 'Bro Split',
    description: 'One muscle group per day (chest, back, legs, shoulders, arms)',
    dayFocusOptions: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'],
  },
  ppl_x2: {
    id: 'ppl_x2',
    label: 'Push / Pull / Legs x2',
    description: 'Run the PPL rotation twice per week',
    dayFocusOptions: ['Push', 'Pull', 'Legs'],
  },
  arnold: {
    id: 'arnold',
    label: 'Arnold Split',
    description: 'Chest+back, shoulders+arms, legs — run twice per week',
    dayFocusOptions: ['Chest + Back', 'Shoulders + Arms', 'Legs'],
  },
  not_sure: {
    id: 'not_sure',
    label: 'Not sure — pick for me',
    description: 'The AI chooses a sensible split based on your training frequency',
    dayFocusOptions: GENERIC_DAY_FOCUS_OPTIONS,
  },
};

/** Suggested split ids per training frequency (days per week). */
const SUGGESTIONS_BY_DAYS: Record<number, string[]> = {
  1: ['full_body'],
  2: ['full_body', 'upper_lower'],
  3: ['full_body', 'push_pull_legs', 'upper_lower'],
  4: ['upper_lower', 'full_body', 'push_pull_legs'],
  5: ['ppl_upper_lower', 'bro_split', 'upper_lower'],
  6: ['ppl_x2', 'arnold', 'bro_split'],
  7: ['ppl_x2', 'bro_split', 'full_body'],
};

export function getSuggestedSplits(daysPerWeek: number): TrainingSplit[] {
  const ids = SUGGESTIONS_BY_DAYS[daysPerWeek] ?? SUGGESTIONS_BY_DAYS[3];
  return ids.map((id) => TRAINING_SPLITS[id]);
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
