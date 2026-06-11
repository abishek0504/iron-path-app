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
}

export const TRAINING_SPLITS: Record<string, TrainingSplit> = {
  full_body: {
    id: 'full_body',
    label: 'Full Body',
    description: 'Every session trains the whole body',
  },
  upper_lower: {
    id: 'upper_lower',
    label: 'Upper / Lower',
    description: 'Alternate upper-body and lower-body days',
  },
  push_pull_legs: {
    id: 'push_pull_legs',
    label: 'Push / Pull / Legs',
    description: 'Rotate pushing, pulling, and leg days',
  },
  ppl_upper_lower: {
    id: 'ppl_upper_lower',
    label: 'PPL + Upper / Lower',
    description: 'Push, pull, legs, then upper and lower days',
  },
  bro_split: {
    id: 'bro_split',
    label: 'Bro Split',
    description: 'One muscle group per day (chest, back, legs, shoulders, arms)',
  },
  ppl_x2: {
    id: 'ppl_x2',
    label: 'Push / Pull / Legs x2',
    description: 'Run the PPL rotation twice per week',
  },
  arnold: {
    id: 'arnold',
    label: 'Arnold Split',
    description: 'Chest+back, shoulders+arms, legs — run twice per week',
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

export function isKnownSplitId(value: string | null | undefined): boolean {
  return !!value && value in TRAINING_SPLITS;
}

/** Display label for a stored split value (known id → label, custom → as-is). */
export function getSplitLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return TRAINING_SPLITS[value]?.label ?? value;
}
