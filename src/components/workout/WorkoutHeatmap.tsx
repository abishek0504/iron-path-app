/**
 * Workout Heatmap
 * High-performance muscle visualization.
 * Displays muscle freshness from v2_muscle_freshness; freshness is computed on read
 * using the decay formula (last_trained_at + λ) so recovery shows over time on rest days.
 * Uses cached raw data (5 min TTL) and periodically recomputes freshness so the user
 * sees muscles recovering over time without refetching from the DB.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Info } from 'lucide-react-native';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { BodyHeatmap } from '../visualizations/BodyHeatmap';
import { devError, devLog } from '../../lib/utils/logger';
import { buildFreshnessMapFromRaw } from '../../lib/utils/muscleFreshness';
import {
  getLastCompletedSessionId,
  invokeUpdateMuscleFreshness,
} from '../../lib/supabase/queries/workouts';
import {
  getMuscleFreshnessRawCached,
  invalidateMuscleFreshnessCache,
} from '../../lib/cache/muscleFreshnessCache';

const LEGEND_DROPDOWN_DURATION = 200;
const LEGEND_CONTENT_MAX_HEIGHT = 130;
const DECAY_TICK_MS = 90 * 1000; // Recompute freshness every 90 sec (no DB)

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
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [lastTrainedByMuscle, setLastTrainedByMuscle] = useState<{ muscle_key: string; last_trained_at: string | null }[]>([]);
  const [freshnessData, setFreshnessData] = useState<Record<string, number>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const infoDropdownAnim = useRef(new Animated.Value(0)).current;
  const backfillAttemptedRef = useRef(false);

  useEffect(() => {
    backfillAttemptedRef.current = false;
  }, [userId]);

  const loadMuscleFreshness = useCallback(async () => {
    setLoading(true);
    try {
      if (__DEV__) {
        devLog('workout-heatmap', { action: 'loadMuscleFreshness:start', userId });
      }

      const rows = await getMuscleFreshnessRawCached(userId);
      const computed = buildFreshnessMapFromRaw(rows);
      setLastTrainedByMuscle(rows);
      setFreshnessData(computed);

      if (__DEV__) {
        devLog('workout-heatmap', {
          action: 'loadMuscleFreshness:done',
          userId,
          rowCount: rows.length,
          muscleCount: Object.keys(computed).length,
        });
      }

      // If empty but user has a completed session, backfill once (Edge Function may not have run)
      if (rows.length === 0 && !backfillAttemptedRef.current) {
        backfillAttemptedRef.current = true;
        const lastSessionId = await getLastCompletedSessionId(userId);
        if (lastSessionId) {
          if (__DEV__) {
            devLog('workout-heatmap', { action: 'backfill:invoke', sessionId: lastSessionId });
          }
          const ok = await invokeUpdateMuscleFreshness(userId, lastSessionId);
          if (ok) {
            invalidateMuscleFreshnessCache(userId);
            await loadMuscleFreshness();
            return;
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        devError('workout-heatmap', error, { action: 'loadMuscleFreshness:error', userId });
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMuscleFreshness();
  }, [loadMuscleFreshness]);

  // Live decay: recompute freshness from cached last_trained_at every 90s (no DB)
  useEffect(() => {
    if (lastTrainedByMuscle.length === 0) return;
    const interval = setInterval(() => {
      setFreshnessData(buildFreshnessMapFromRaw(lastTrainedByMuscle));
    }, DECAY_TICK_MS);
    return () => clearInterval(interval);
  }, [lastTrainedByMuscle]);

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
    }, [loadMuscleFreshness])
  );

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
            <View style={[styles.legendDot, { backgroundColor: colors.heatmapFullyRecovered }]} />
            <Text style={styles.legendText}>81-100%: Fully Recovered</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.heatmapLightFatigue }]} />
            <Text style={styles.legendText}>61-80%: Light Fatigue</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.heatmapModerateFatigue }]} />
            <Text style={styles.legendText}>31-60%: Moderate Fatigue</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.heatmapFullyFatigued }]} />
            <Text style={styles.legendText}>0-30%: Fully Fatigued</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}
