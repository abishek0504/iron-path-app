/**
 * Shared weight unit helpers.
 *
 * Stored lift/body weights use the user's display unit (`use_imperial`).
 * Convert when the preference flips; use unit-aware increments for overload.
 */

export const LBS_PER_KG = 2.20462;

/** Fallback bodyweight (lbs) when profile has no current_weight. */
export const DEFAULT_BW_LBS = 150;
/** Fallback bodyweight (kg) when profile has no current_weight. */
export const DEFAULT_BW_KG = 70;

/** Minimum progressive-overload step: 2.5 lb ≈ 1.25 kg. */
export function minWeightIncrement(useImperial: boolean): number {
  return useImperial ? 2.5 : 1.25;
}

/**
 * Plate-style increment for history-based suggestions.
 * Heavier loads step up more (5 lb / 2.5 kg).
 */
export function plateWeightIncrement(weight: number, useImperial: boolean): number {
  if (useImperial) {
    return weight >= 100 ? 5 : 2.5;
  }
  return weight >= 45 ? 2.5 : 1.25;
}

/** Rounding precision multiplier: imperial nearest 0.5, metric nearest 0.25. */
export function weightPrecision(useImperial: boolean): number {
  return useImperial ? 2 : 4;
}

export function roundLiftWeight(value: number, useImperial: boolean): number {
  const precision = weightPrecision(useImperial);
  return Math.round(value * precision) / precision;
}

export function roundBodyWeight(value: number): number {
  return Math.round(value);
}

export function convertWeight(
  value: number,
  options: { fromImperial: boolean; toImperial: boolean }
): number {
  if (options.fromImperial === options.toImperial) return value;
  if (options.toImperial) {
    return value * LBS_PER_KG;
  }
  return value / LBS_PER_KG;
}

export function convertBodyWeight(
  value: number,
  options: { fromImperial: boolean; toImperial: boolean }
): number {
  return roundBodyWeight(convertWeight(value, options));
}

export function convertLiftWeight(
  value: number,
  options: { fromImperial: boolean; toImperial: boolean }
): number {
  return roundLiftWeight(convertWeight(value, options), options.toImperial);
}

export function weightUnitLabel(useImperial: boolean): 'lbs' | 'kg' {
  return useImperial ? 'lbs' : 'kg';
}
