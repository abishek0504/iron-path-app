/**
 * Muscle freshness decay (Banister Impulse-Response).
 * Used to compute current freshness from last_trained_at so the heatmap
 * reflects recovery over time even on rest days (no need to complete another workout).
 * λ values match supabase/functions/update-muscle-freshness/index.ts.
 */

/** Default λ when muscle not in map (medium recovery, half-life ~17h). */
const DEFAULT_LAMBDA = 0.041;

/** Decay constants (λ) per muscle. λ = ln(2) / half-life (hours). */
export const MUSCLE_DECAY_LAMBDA: Record<string, number> = {
  lower_back: 0.02,
  hamstrings: 0.02,

  chest: 0.041,
  upper_chest: 0.041,
  lower_chest: 0.041,
  quads: 0.041,
  lats: 0.041,
  glutes: 0.041,
  upper_back: 0.041,
  traps: 0.041,
  abs: 0.041,
  obliques: 0.041,

  lateral_deltoids: 0.099,
  posterior_deltoids: 0.099,
  anterior_deltoids: 0.099,
  biceps: 0.099,
  triceps: 0.099,
  calves: 0.099,
  soleus: 0.099,
  forearms: 0.099,

  rotator_cuff: 0.06,
  serratus_anterior: 0.06,
  transverse_abdominis: 0.06,
  glute_medius: 0.06,
  glute_minimus: 0.06,
  piriformis: 0.06,
  tibialis_anterior: 0.06,
  hip_flexors: 0.06,
};

/**
 * Compute current freshness (0–100) from when the muscle was last trained.
 * Uses Banister decay: at last_trained_at fatigue = 100 (freshness 0);
 * Fatigue(t) = 100 × e^(-λ × t), Freshness(t) = 100 - Fatigue(t).
 *
 * @param muscleKey - Canonical muscle key (v2_muscles.key)
 * @param lastTrainedAt - ISO timestamp when muscle was last trained, or null (never trained / fully recovered)
 * @param now - Optional reference time (default: now); useful for tests
 * @returns Freshness 0–100 (0 = fully fatigued, 100 = fully recovered)
 */
export function computeFreshnessNow(
  muscleKey: string,
  lastTrainedAt: string | null,
  now: Date = new Date()
): number {
  if (lastTrainedAt == null) return 100;

  const last = new Date(lastTrainedAt).getTime();
  const hoursSince = (now.getTime() - last) / (1000 * 60 * 60);
  if (hoursSince <= 0) return 0;

  const lambda = MUSCLE_DECAY_LAMBDA[muscleKey] ?? DEFAULT_LAMBDA;
  const fatigue = 100 * Math.exp(-lambda * hoursSince);
  const freshness = 100 - fatigue;
  return Math.max(0, Math.min(100, Math.round(freshness * 10) / 10));
}

/** Build a `{ muscle_key -> freshnessNow }` map from raw freshness rows (no DB). */
export function buildFreshnessMapFromRaw(
  rows: { muscle_key: string; last_trained_at: string | null }[],
  now: Date = new Date(),
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.muscle_key] = computeFreshnessNow(row.muscle_key, row.last_trained_at, now);
  }
  return map;
}
