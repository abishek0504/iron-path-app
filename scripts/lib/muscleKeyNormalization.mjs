/**
 * Muscle key normalization for CSV → v2_exercises import.
 * Maps unfamiliar CSV keys to canonical v2_muscles keys to preserve heatmap/fatigue integrity.
 */

/** Canonical v2_muscles keys (28 existing + adductors after migration). */
export const CANONICAL_MUSCLE_KEYS = new Set([
  'chest', 'upper_chest', 'lower_chest', 'anterior_deltoids', 'lateral_deltoids',
  'posterior_deltoids', 'triceps', 'lats', 'upper_back', 'lower_back', 'traps',
  'biceps', 'forearms', 'abs', 'obliques', 'quads', 'hip_flexors', 'hamstrings',
  'glutes', 'calves', 'soleus', 'rotator_cuff', 'serratus_anterior',
  'transverse_abdominis', 'glute_medius', 'glute_minimus', 'piriformis',
  'tibialis_anterior', 'adductors',
]);

/** Global alias map: CSV key → canonical key. */
export const GLOBAL_MUSCLE_ALIASES = {
  rear_deltoids: 'posterior_deltoids',
  core: 'abs',
  lower_traps: 'traps',
  ankles: 'tibialis_anterior',
  tensor_fasciae_latae: 'glute_medius',
  neck: 'traps',
};

/** Exercise-specific overrides: exercise name → { csvKey → canonicalKey }. */
export const EXERCISE_MUSCLE_OVERRIDES = {
  "Child's Pose": { shoulders: 'posterior_deltoids' },
  'Downward Dog': { shoulders: 'posterior_deltoids' },
  'Overhead Triceps Stretch': { shoulders: 'lateral_deltoids' },
};

/** Keys that require a new v2_muscles row (not mappable to existing). */
export const NEW_MUSCLE_KEYS = [
  { key: 'adductors', display_name: 'Adductors', group: 'lower_body_front', sort_order: 3 },
];

/**
 * Resolve a CSV muscle key to a canonical v2_muscles key.
 * @returns {string|null} canonical key or null if unmapped
 */
export function resolveMuscleKey(csvKey, exerciseName) {
  const key = csvKey.trim().toLowerCase().replace(/\s+/g, '_');
  if (CANONICAL_MUSCLE_KEYS.has(key)) return key;

  const exerciseOverride = EXERCISE_MUSCLE_OVERRIDES[exerciseName]?.[key];
  if (exerciseOverride) return exerciseOverride;

  const alias = GLOBAL_MUSCLE_ALIASES[key];
  if (alias) return alias;

  if (key === 'adductors') return 'adductors';

  return null;
}

/** Normalize a string array of muscle keys; dedupe preserving order. */
export function normalizeMuscleArray(csvKeys, exerciseName, audit) {
  const out = [];
  const seen = new Set();
  for (const raw of csvKeys) {
    const canonical = resolveMuscleKey(raw, exerciseName);
    if (!canonical) {
      audit.unresolved.push({ exercise: exerciseName, key: raw });
      continue;
    }
    if (raw !== canonical) {
      audit.mapped.push({ exercise: exerciseName, from: raw, to: canonical });
    }
    if (!seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

/** Normalize implicit_hits object; merge weights when keys map to same canonical. */
export function normalizeImplicitHits(obj, exerciseName, audit) {
  const merged = {};
  for (const [rawKey, weight] of Object.entries(obj)) {
    const canonical = resolveMuscleKey(rawKey, exerciseName);
    if (!canonical) {
      audit.unresolved.push({ exercise: exerciseName, key: rawKey });
      continue;
    }
    if (rawKey !== canonical) {
      audit.mapped.push({ exercise: exerciseName, from: rawKey, to: canonical });
    }
    const w = typeof weight === 'number' ? weight : Number(weight);
    merged[canonical] = (merged[canonical] ?? 0) + w;
  }
  return merged;
}
