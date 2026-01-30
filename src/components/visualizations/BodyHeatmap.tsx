/**
 * Body Heatmap Component
 *
 * Uses react-native-body-highlighter to render body silhouettes
 * and maps our v2_muscles keys to the library's body part slugs.
 * Region color = average fatigue of all muscles in that group.
 * Tap a region to see individual muscle fatigues.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Modal, Text, TouchableOpacity } from 'react-native';
import { RotateCcw, X } from 'lucide-react-native';
import Body from 'react-native-body-highlighter';
import { useUserStore } from '../../stores/userStore';
import { colors, spacing, typography, borderRadius } from '../../lib/utils/theme';
import {
  MUSCLE_KEY_TO_SLUG,
  SLUG_TO_MUSCLE_KEYS,
  MUSCLE_KEY_TO_DISPLAY_NAME,
  SLUG_TO_LABEL,
} from '../../lib/constants/muscleHeatmapSlugs';

type BodySide = 'front' | 'back';

interface BodyHeatmapProps {
  freshnessData: Record<string, number | null | undefined>;
  width?: number;
  height?: number;
  side?: BodySide;
  onSideChange?: (side: BodySide) => void;
}

function freshnessToIntensity(freshness: number | null | undefined): number | null {
  if (freshness === null || freshness === undefined) return null;
  if (freshness >= 81) return 1; // fully recovered
  if (freshness >= 61) return 2; // light fatigue
  if (freshness >= 31) return 3; // moderate fatigue
  return 4; // fully fatigued
}

export const BodyHeatmap: React.FC<BodyHeatmapProps> = ({
  freshnessData,
  width = Dimensions.get('window').width - 32,
  height = (Dimensions.get('window').width - 32) * 0.85,
  side: controlledSide,
  onSideChange,
}) => {
  const profile = useUserStore((state) => state.profile);
  const [internalSide, setInternalSide] = useState<BodySide>('front');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const isControlled = controlledSide !== undefined && onSideChange !== undefined;
  const side = isControlled ? controlledSide : internalSide;
  const setSide = isControlled ? onSideChange : setInternalSide;

  const gender: 'male' | 'female' =
    (profile?.gender?.toLowerCase() === 'female' ? 'female' : 'male');

  const bodyData: Array<{ slug: string; intensity: number }> = useMemo(() => {
    const slugToFreshnessSum = new Map<string, { sum: number; count: number }>();

    for (const [muscleKey, freshness] of Object.entries(freshnessData)) {
      const slug = MUSCLE_KEY_TO_SLUG[muscleKey];
      if (!slug || freshness === null || freshness === undefined) continue;

      const existing = slugToFreshnessSum.get(slug);
      if (!existing) {
        slugToFreshnessSum.set(slug, { sum: freshness, count: 1 });
      } else {
        existing.sum += freshness;
        existing.count += 1;
      }
    }

    const parts: Array<{ slug: string; intensity: number }> = [];
    for (const [slug, { sum, count }] of slugToFreshnessSum.entries()) {
      if (count === 0) continue;
      const avgFreshness = sum / count;
      const intensity = freshnessToIntensity(avgFreshness);
      if (intensity !== null) {
        parts.push({ slug, intensity });
      }
    }

    if (__DEV__) {
      const { devLog } = require('../../lib/utils/logger');
      devLog('body-heatmap', {
        action: 'bodyData_computed',
        totalMuscleKeys: Object.keys(freshnessData).length,
        mappedSlugs: parts.length,
        sampleParts: parts.slice(0, 5),
      });
    }

    return parts;
  }, [freshnessData]);

  const detailMuscles = useMemo(() => {
    if (!selectedSlug) return [];
    const keys = SLUG_TO_MUSCLE_KEYS[selectedSlug] ?? [];
    return keys.map((key) => ({
      key,
      name: MUSCLE_KEY_TO_DISPLAY_NAME[key] ?? key,
      freshness: freshnessData[key],
    }));
  }, [selectedSlug, freshnessData]);

  return (
    <View style={[styles.container, { width, height }]}>
      {!isControlled && (
        <Pressable
          style={styles.toggleButton}
          onPress={() => setSide(side === 'front' ? 'back' : 'front')}
          accessibilityLabel={side === 'front' ? 'Show back view' : 'Show front view'}
          accessibilityRole="button"
        >
          <RotateCcw size={20} color="#e5e7eb" />
        </Pressable>
      )}
      <View style={styles.bodyWrapper}>
        <Body
          data={bodyData as any}
          side={side}
          gender={gender}
          scale={1.2}
          colors={['#22c55e', '#eab308', '#f97316', '#ef4444']}
          border="#4b5563"
          onBodyPartPress={(bodyPart) => setSelectedSlug(bodyPart.slug ?? null)}
        />
      </View>

      <Modal
        visible={selectedSlug !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSlug(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedSlug(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedSlug ? SLUG_TO_LABEL[selectedSlug] ?? selectedSlug : ''}
              </Text>
              <Pressable
                onPress={() => setSelectedSlug(null)}
                style={styles.modalCloseButton}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <X size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              {detailMuscles.map(({ key, name, freshness }) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailName}>{name}</Text>
                  <Text style={styles.detailFreshness}>
                    {freshness !== null && freshness !== undefined
                      ? `${Math.round(freshness)}%`
                      : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const TOGGLE_BUTTON_SIZE = 45;
const BODY_VERTICAL_PADDING = 30;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'static',
    paddingTop: spacing.sm,
  },
  toggleButton: {
    position: 'absolute',
    top: 0,
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
  bodyWrapper: {
    paddingVertical: BODY_VERTICAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    width: '100%',
    maxWidth: 320,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailName: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  detailFreshness: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
});
