/**
 * useMuscleColors Hook
 * 
 * Maps muscle freshness values (0-100) to color hex codes
 * for Skia rendering
 * 
 * Color Scale:
 * - 0-30: Red (fully fatigued)
 * - 31-60: Orange (moderate fatigue)
 * - 61-80: Yellow (light fatigue)
 * - 81-100: Green (fully recovered)
 */

import { useMemo } from 'react';
import { darkColors } from '../lib/utils/theme';

interface MuscleColors {
  [muscleKey: string]: string;
}

/**
 * Convert freshness value (0-100) to color hex
 */
function getFreshnessColor(freshness: number | null | undefined): string {
  if (freshness === null || freshness === undefined) {
    return darkColors.heatmapBodyDefault;
  }

  if (freshness <= 30) return darkColors.heatmapFullyFatigued;
  if (freshness <= 60) return darkColors.heatmapModerateFatigue;
  if (freshness <= 80) return darkColors.heatmapLightFatigue;
  return darkColors.heatmapFullyRecovered;
}

/**
 * Hook to generate muscle color map from freshness data
 * 
 * @param freshnessData - Map of muscle_key to freshness value (0-100)
 * @returns Map of muscle_key to color hex code
 */
export function useMuscleColors(
  freshnessData: Record<string, number | null | undefined>
): MuscleColors {
  return useMemo(() => {
    const colors: MuscleColors = {};

    for (const [muscleKey, freshness] of Object.entries(freshnessData)) {
      colors[muscleKey] = getFreshnessColor(freshness);
    }

    return colors;
  }, [freshnessData]);
}

/**
 * Get color for a specific freshness value (utility function)
 */
export function getColorForFreshness(freshness: number | null | undefined): string {
  return getFreshnessColor(freshness);
}
