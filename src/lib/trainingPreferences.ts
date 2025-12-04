export type TrainingStyleId =
  | 'calisthenics_compound_only'
  | 'strength_primary_plus_accessories'
  | 'cardio_only'
  | 'comprehensive';

export interface ComponentPreferences {
  include_tier1_compounds: boolean;
  include_tier2_accessories: boolean;
  include_tier3_prehab_mobility: boolean;
  include_cardio_conditioning: boolean;
}

const STYLE_LABELS: Record<TrainingStyleId, string> = {
  calisthenics_compound_only: 'Calisthenics compounds only',
  strength_primary_plus_accessories: 'Strength + accessories',
  cardio_only: 'Cardio only',
  comprehensive: 'Comprehensive (strength + accessories + mobility)',
};

export const getDefaultComponentsForStyle = (
  style: TrainingStyleId,
): ComponentPreferences => {
  switch (style) {
    case 'calisthenics_compound_only':
      return {
        include_tier1_compounds: true,
        include_tier2_accessories: false,
        include_tier3_prehab_mobility: false,
        include_cardio_conditioning: false,
      };
    case 'strength_primary_plus_accessories':
      return {
        include_tier1_compounds: true,
        include_tier2_accessories: true,
        include_tier3_prehab_mobility: false,
        include_cardio_conditioning: false,
      };
    case 'cardio_only':
      return {
        include_tier1_compounds: false,
        include_tier2_accessories: false,
        include_tier3_prehab_mobility: false,
        include_cardio_conditioning: true,
      };
    case 'comprehensive':
    default:
      return {
        include_tier1_compounds: true,
        include_tier2_accessories: true,
        include_tier3_prehab_mobility: true,
        include_cardio_conditioning: true,
      };
  }
};

const coerceComponents = (raw: any, fallback: ComponentPreferences): ComponentPreferences => {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }
  return {
    include_tier1_compounds:
      typeof raw.include_tier1_compounds === 'boolean'
        ? raw.include_tier1_compounds
        : fallback.include_tier1_compounds,
    include_tier2_accessories:
      typeof raw.include_tier2_accessories === 'boolean'
        ? raw.include_tier2_accessories
        : fallback.include_tier2_accessories,
    include_tier3_prehab_mobility:
      typeof raw.include_tier3_prehab_mobility === 'boolean'
        ? raw.include_tier3_prehab_mobility
        : fallback.include_tier3_prehab_mobility,
    include_cardio_conditioning:
      typeof raw.include_cardio_conditioning === 'boolean'
        ? raw.include_cardio_conditioning
        : fallback.include_cardio_conditioning,
  };
};

export const deriveStyleFromGoal = (goal: string | null | undefined): TrainingStyleId => {
  if (!goal) {
    return 'comprehensive';
  }
  const lower = goal.toLowerCase();
  if (lower.includes('weight loss') || lower.includes('lose weight')) {
    return 'cardio_only';
  }
  if (lower.includes('calisthenics') || lower.includes('bodyweight')) {
    return 'calisthenics_compound_only';
  }
  if (lower.includes('strength') || lower.includes('lift') || lower.includes('heavier')) {
    return 'strength_primary_plus_accessories';
  }
  return 'comprehensive';
};

export const deriveStyleAndComponentsFromProfile = (
  profile: any,
): { style: TrainingStyleId; components: ComponentPreferences } => {
  const style: TrainingStyleId =
    (profile?.preferred_training_style as TrainingStyleId) ||
    deriveStyleFromGoal(profile?.goal);

  const styleDefaults = getDefaultComponentsForStyle(style);
  const components = coerceComponents(profile?.include_components, styleDefaults);

  return { style, components };
};

export const deriveStyleAndComponentsFromGoal = (
  goal: string | null | undefined,
): { style: TrainingStyleId; components: ComponentPreferences } => {
  const style = deriveStyleFromGoal(goal);
  const components = getDefaultComponentsForStyle(style);
  return { style, components };
};

export const getTrainingStyleLabel = (style: TrainingStyleId): string => {
  return STYLE_LABELS[style];
};

export const serializeComponentsForStorage = (components: ComponentPreferences): ComponentPreferences => {
  return {
    include_tier1_compounds: !!components.include_tier1_compounds,
    include_tier2_accessories: !!components.include_tier2_accessories,
    include_tier3_prehab_mobility: !!components.include_tier3_prehab_mobility,
    include_cardio_conditioning: !!components.include_cardio_conditioning,
  };
};

export const describeComponentsForPrompt = (
  style: TrainingStyleId,
  components: ComponentPreferences,
): string => {
  const parts: string[] = [];

  parts.push(`TRAINING STYLE: ${STYLE_LABELS[style]}.`);

  const included: string[] = [];
  const excluded: string[] = [];

  if (components.include_tier1_compounds) {
    included.push('Tier 1 compounds (Big 6 movement patterns)');
  } else {
    excluded.push('Tier 1 compounds');
  }

  if (components.include_tier2_accessories) {
    included.push('Tier 2 accessories (supporting/isolation work)');
  } else {
    excluded.push('Tier 2 accessories');
  }

  if (components.include_tier3_prehab_mobility) {
    included.push('Tier 3 prehab/mobility/core');
  } else {
    excluded.push('Tier 3 prehab/mobility/core');
  }

  if (components.include_cardio_conditioning) {
    included.push('cardio / conditioning blocks');
  } else {
    excluded.push('cardio / conditioning blocks');
  }

  if (included.length) {
    parts.push(`INCLUDE these components in the program: ${included.join(', ')}.`);
  }
  if (excluded.length) {
    parts.push(`EXCLUDE these components: ${excluded.join(', ')}.`);
  }

  if (style === 'calisthenics_compound_only') {
    parts.push(
      'Focus on efficient calisthenics compounds that hit all major muscle groups across push, pull, squat, hinge, and lunge patterns. Avoid unnecessary isolation work.',
    );
  } else if (style === 'cardio_only') {
    parts.push(
      'Design workouts around cardio and conditioning modalities only. Do NOT include strength sets unless they clearly serve a conditioning purpose.',
    );
  }

  return parts.join('\n');
};


