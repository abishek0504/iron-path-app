/**
 * Body Heatmap Component
 *
 * Uses react-native-body-highlighter to render body silhouettes
 * and maps our v2_muscles keys to the library's body part slugs.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import Body from 'react-native-body-highlighter';
import { useUserStore } from '../../stores/userStore';
import { spacing } from '../../lib/utils/theme';

// Map our v2_muscles keys to react-native-body-highlighter slugs.
// Library slug list: https://github.com/HichamELBSI/react-native-body-highlighter
const MUSCLE_KEY_TO_SLUG: Record<string, string> = {
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

interface BodyHeatmapProps {
  freshnessData: Record<string, number | null | undefined>;
  width?: number;
  height?: number;
}

type BodySide = 'front' | 'back';

export const BodyHeatmap: React.FC<BodyHeatmapProps> = ({
  freshnessData,
  width = Dimensions.get('window').width - 32,
  height = (Dimensions.get('window').width - 32) * 0.85,
}) => {
  const profile = useUserStore((state) => state.profile);
  const [side, setSide] = useState<BodySide>('front');

  const gender: 'male' | 'female' =
    (profile?.gender?.toLowerCase() === 'female' ? 'female' : 'male');

  const bodyData: Array<{ slug: string; intensity: number }> = useMemo(() => {
    const slugToIntensity = new Map<string, number>();

    const freshnessToIntensity = (freshness: number | null | undefined): number | null => {
      if (freshness === null || freshness === undefined) return null;
      if (freshness >= 81) return 1; // fully recovered
      if (freshness >= 61) return 2; // light fatigue
      if (freshness >= 31) return 3; // moderate fatigue
      return 4; // fully fatigued
    };

    for (const [muscleKey, freshness] of Object.entries(freshnessData)) {
      const slug = MUSCLE_KEY_TO_SLUG[muscleKey];
      const intensity = freshnessToIntensity(freshness);
      if (intensity === null || !slug) continue;

      const existing = slugToIntensity.get(slug);
      // Keep the "worst" intensity (highest number)
      if (!existing || intensity > existing) {
        slugToIntensity.set(slug, intensity);
      }
    }

    const parts: Array<{ slug: string; intensity: number }> = [];
    for (const [slug, intensity] of slugToIntensity.entries()) {
      parts.push({ slug, intensity });
    }

    if (__DEV__) {
      const { devLog } = require('../../lib/utils/logger');
      devLog('body-heatmap', {
        action: 'bodyData_computed',
        totalMuscleKeys: Object.keys(freshnessData).length,
        mappedSlugs: parts.length,
        sampleParts: parts.slice(0, 5),
        bicepsFreshness: freshnessData.biceps,
        bicepsIntensity: slugToIntensity.get('biceps'),
      });
    }

    return parts;
  }, [freshnessData]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Pressable
        style={styles.toggleButton}
        onPress={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
        accessibilityLabel={side === 'front' ? 'Show back view' : 'Show front view'}
        accessibilityRole="button"
      >
        <RotateCcw size={18} color="#e5e7eb" />
      </Pressable>
      <View style={styles.bodyWrapper}>
        <Body
          data={bodyData as any}
          side={side}
          gender={gender}
          scale={1.3}
          colors={['#22c55e', '#eab308', '#f97316', '#ef4444']}
          border="#4b5563"
        />
      </View>
    </View>
  );
};

const TOGGLE_BUTTON_SIZE = 44;
const BODY_VERTICAL_PADDING = 24;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: spacing.sm,
  },
  toggleButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    width: TOGGLE_BUTTON_SIZE,
    height: TOGGLE_BUTTON_SIZE,
    borderRadius: TOGGLE_BUTTON_SIZE / 2,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bodyWrapper: {
    paddingVertical: BODY_VERTICAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
