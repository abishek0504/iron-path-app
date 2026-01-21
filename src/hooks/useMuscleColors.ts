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

interface MuscleColors {
  [muscleKey: string]: string;
}

// Color constants
const COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  gray: '#9ca3af', // Default for never trained
};

/**
 * Convert freshness value (0-100) to color hex
 */
function getFreshnessColor(freshness: number | null | undefined): string {
  if (freshness === null || freshness === undefined) {
    return COLORS.gray; // Never trained
  }

  if (freshness <= 30) return COLORS.red;
  if (freshness <= 60) return COLORS.orange;
  if (freshness <= 80) return COLORS.yellow;
  return COLORS.green;
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
