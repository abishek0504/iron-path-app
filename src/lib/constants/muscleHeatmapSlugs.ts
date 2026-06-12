/**
 * Heatmap muscle mapping: v2_muscles keys to react-native-body-highlighter slugs.
 * Display regions (slugs) group multiple muscles; the heatmap shows average fatigue per region.
 * Library slugs: https://github.com/HichamELBSI/react-native-body-highlighter
 */

export const MUSCLE_KEY_TO_SLUG: Record<string, string> = {
  chest: 'chest',
  upper_chest: 'chest',
  lower_chest: 'chest',
  anterior_deltoids: 'deltoids',
  lateral_deltoids: 'deltoids',
  posterior_deltoids: 'deltoids',
  triceps: 'triceps',

  lats: 'upper-back',
  upper_back: 'upper-back',
  lower_back: 'lower-back',
  traps: 'trapezius',
  biceps: 'biceps',
  forearms: 'forearm',

  abs: 'abs',
  transverse_abdominis: 'abs',
  obliques: 'obliques',
  serratus_anterior: 'obliques',

  quads: 'quadriceps',
  hip_flexors: 'adductors',
  adductors: 'adductors',

  hamstrings: 'hamstring',
  glutes: 'gluteal',
  glute_medius: 'gluteal',
  glute_minimus: 'gluteal',
  piriformis: 'gluteal',
  calves: 'calves',
  soleus: 'calves',

  rotator_cuff: 'deltoids',
  tibialis_anterior: 'tibialis',
};

/** Reverse map: slug -> muscle keys that map to it (for averaging and tap detail). */
export const SLUG_TO_MUSCLE_KEYS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [key, slug] of Object.entries(MUSCLE_KEY_TO_SLUG)) {
    if (!out[slug]) out[slug] = [];
    out[slug].push(key);
  }
  return out;
})();

/** v2_muscles display_name by key (matches seed). */
export const MUSCLE_KEY_TO_DISPLAY_NAME: Record<string, string> = {
  chest: 'Chest',
  upper_chest: 'Upper Chest',
  lower_chest: 'Lower Chest',
  anterior_deltoids: 'Front Delts',
  lateral_deltoids: 'Side Delts',
  posterior_deltoids: 'Rear Delts',
  triceps: 'Triceps',
  lats: 'Lats',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  traps: 'Traps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  transverse_abdominis: 'Transverse Abdominis',
  serratus_anterior: 'Serratus Anterior',
  quads: 'Quadriceps',
  hip_flexors: 'Hip Flexors',
  adductors: 'Adductors',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  soleus: 'Soleus',
  glute_medius: 'Glute Medius',
  glute_minimus: 'Glute Minimus',
  piriformis: 'Piriformis',
  rotator_cuff: 'Rotator Cuff',
  tibialis_anterior: 'Tibialis Anterior',
};

/** Slug -> short label for modal title. */
export const SLUG_TO_LABEL: Record<string, string> = {
  chest: 'Chest',
  deltoids: 'Deltoids',
  triceps: 'Triceps',
  'upper-back': 'Upper back',
  'lower-back': 'Lower back',
  trapezius: 'Traps',
  biceps: 'Biceps',
  forearm: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quadriceps: 'Quadriceps',
  adductors: 'Adductors',
  hamstring: 'Hamstrings',
  gluteal: 'Glutes',
  calves: 'Calves',
  tibialis: 'Tibialis',
};
