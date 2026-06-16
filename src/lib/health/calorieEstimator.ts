/** MET-based active energy estimate for strength training (phone-only fallback). */

const STRENGTH_TRAINING_MET = 4;

/**
 * Estimate kilocalories burned during active work time.
 * @param weightKg User body mass in kg
 * @param activeDurationSec Time spent lifting (excluding rest)
 */
export function estimateActiveEnergyKcal(
  weightKg: number,
  activeDurationSec: number,
): number {
  if (weightKg <= 0 || activeDurationSec <= 0) return 0;
  const hours = activeDurationSec / 3600;
  return Math.round(STRENGTH_TRAINING_MET * weightKg * hours);
}
