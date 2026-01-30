/**
 * Workout Heatmap
 * High-performance muscle visualization
 * Displays muscle freshness from v2_muscle_freshness table
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Info } from 'lucide-react-native';
import { colors, spacing, typography } from '../../lib/utils/theme';
import { BodyHeatmap } from '../visualizations/BodyHeatmap';
import { supabase } from '../../lib/supabase/client';
import { devError, devLog } from '../../lib/utils/logger';

const LEGEND_DROPDOWN_DURATION = 200;
const LEGEND_CONTENT_MAX_HEIGHT = 130;

type BodySide = 'front' | 'back';

interface WorkoutHeatmapProps {
  userId: string;
  bodySide?: BodySide;
  onBodySideChange?: (side: BodySide) => void;
}

export const WorkoutHeatmap: React.FC<WorkoutHeatmapProps> = ({
  userId,
  bodySide = 'front',
  onBodySideChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [freshnessData, setFreshnessData] = useState<Record<string, number>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const infoDropdownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMuscleFreshness();
  }, [userId]);

  useEffect(() => {
    Animated.timing(infoDropdownAnim, {
      toValue: infoOpen ? 1 : 0,
      duration: LEGEND_DROPDOWN_DURATION,
      useNativeDriver: false,
    }).start();
  }, [infoOpen, infoDropdownAnim]);

  // Refresh when screen comes into focus (e.g., after completing a workout)
  useFocusEffect(
    useCallback(() => {
      loadMuscleFreshness();
    }, [userId])
  );

  const loadMuscleFreshness = async () => {
    setLoading(true);
    try {
      if (__DEV__) {
        devLog('workout-heatmap', { action: 'loadMuscleFreshness:start', userId });
      }

      const { data, error } = await supabase
        .from('v2_muscle_freshness')
        .select('muscle_key, freshness')
        .eq('user_id', userId);

      if (error) throw error;

      const freshnessMap: Record<string, number> = {};
      for (const row of data || []) {
        // Important: preserve 0 values (fully fatigued) instead of falling back to 100.
        const value =
          row.freshness === null || row.freshness === undefined
            ? 100
            : Number(row.freshness);
        freshnessMap[row.muscle_key] = value;
      }

      setFreshnessData(freshnessMap);
      if (__DEV__) {
        devLog('workout-heatmap', {
          action: 'loadMuscleFreshness:done',
          userId,
          rowCount: (data || []).length,
          muscleCount: Object.keys(freshnessMap).length,
          sampleMuscles: Object.entries(freshnessMap).slice(0, 5).map(([k, v]) => ({ key: k, freshness: v })),
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('workout-heatmap', error, { action: 'loadMuscleFreshness:error', userId });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading muscle data...</Text>
        </View>
      </View>
    );
  }

  if (Object.keys(freshnessData).length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          No muscle data yet. Complete a workout to see your muscle freshness.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heatmapContainer}>
        <BodyHeatmap
          freshnessData={freshnessData}
          side={bodySide}
          onSideChange={onBodySideChange}
        />
      </View>

      <View style={styles.footerRow}>
        <View style={styles.footerSpacer} />
        <Pressable
          style={styles.infoButton}
          onPress={() => setInfoOpen((open) => !open)}
          accessibilityLabel="Toggle muscle status legend"
          accessibilityRole="button"
        >
          <Info size={25} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.legendDropdown,
          {
            maxHeight: infoDropdownAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, LEGEND_CONTENT_MAX_HEIGHT],
            }),
            opacity: infoDropdownAnim,
            marginTop: infoDropdownAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, spacing.sm],
            }),
          },
        ]}
        pointerEvents={infoOpen ? 'auto' : 'none'}
        collapsable={false}
      >
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>81-100%: Fully Recovered</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
            <Text style={styles.legendText}>61-80%: Light Fatigue</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
            <Text style={styles.legendText}>31-60%: Moderate Fatigue</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>0-30%: Fully Fatigued</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  heatmapContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 44,
    marginTop: spacing.sm,
    marginRight: -spacing.sm,
  },
  footerSpacer: {
    flex: 1,
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDropdown: {
    overflow: 'hidden',
  },
  legend: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});

