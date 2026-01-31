/**
 * Weight Tracker Card
 * Displays current weight, loss metrics, and a line chart of weight over time
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Picker } from '@react-native-picker/picker';
import Svg, { Path, G } from 'react-native-svg';
import { Scale } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useUserStore } from '../../stores/userStore';
import { useUIStore } from '../../stores/uiStore';
import {
  getWeightHistoryCached,
  invalidateWeightCache,
  invalidateProfileCache,
} from '../../lib/cache/dashboardStatsCache';
import { insertWeightLog } from '../../lib/supabase/queries/weight';
import { BottomSheet } from './BottomSheet';
import type { WeightLog } from '../../lib/supabase/queries/weight';

const CHART_HEIGHT = 160;
const CHART_VIEWBOX = { width: 300, height: 100 };
const CHART_PAD = { left: 44, right: 12, top: 12, bottom: 8 };

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface WeightTrackerCardProps {
  userId: string;
  onRefresh?: () => void;
}


export function WeightTrackerCard({ userId, onRefresh }: WeightTrackerCardProps) {
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const showToast = useUIStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<WeightLog[]>([]);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [selectedWeight, setSelectedWeight] = useState(70);
  const [saving, setSaving] = useState(false);

  const insets = useSafeAreaInsets();
  const useImperial = profile?.use_imperial ?? true;
  const currentWeight = profile?.current_weight ?? null;
  const unitsLabel = useImperial ? 'lbs' : 'kg';

  const chartSlideY = useSharedValue(CHART_HEIGHT);
  const chartOpacity = useSharedValue(0);
  const hasAnimatedRef = useRef(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await getWeightHistoryCached(userId);
      setHistory(logs);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (currentWeight != null) {
      setSelectedWeight(Math.round(currentWeight));
    } else {
      setSelectedWeight(useImperial ? 154 : 70);
    }
  }, [currentWeight, useImperial]);

  const sortedByDate = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
  }, [history]);

  const metrics = useMemo(() => {
    const current = currentWeight ?? (sortedByDate.length ? sortedByDate[sortedByDate.length - 1].weight : null);
    const first = sortedByDate.length ? sortedByDate[0].weight : null;

    if (current == null || first == null) {
      return null;
    }

    const lost = first - current;
    const pct = first > 0 ? (lost / first) * 100 : 0;
    return { current, first, lost, pct };
  }, [currentWeight, sortedByDate]);

  const chartData = useMemo(() => {
    if (sortedByDate.length < 2) return null;

    const weights = sortedByDate.map((l) => l.weight);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;
    const padding = range * 0.1;
    const chartMin = minW - padding;
    const chartMax = maxW + padding;
    const chartRange = chartMax - chartMin;

    const w = CHART_VIEWBOX.width - CHART_PAD.left - CHART_PAD.right;
    const h = CHART_VIEWBOX.height - CHART_PAD.top - CHART_PAD.bottom;

    const points = sortedByDate.map((log, i) => {
      const x = CHART_PAD.left + (i / Math.max(1, sortedByDate.length - 1)) * w;
      const y = CHART_PAD.top + h - ((log.weight - chartMin) / chartRange) * h;
      return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const firstDate = sortedByDate[0].recorded_at;
    const lastDate = sortedByDate[sortedByDate.length - 1].recorded_at;

    const formatDate = (iso: string) => {
      const d = new Date(iso);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      if (d.getFullYear() !== new Date().getFullYear()) opts.year = '2-digit';
      return d.toLocaleDateString('en-US', opts);
    };

    return {
      pathD,
      yMin: chartMin,
      yMax: chartMax,
      xLabelStart: formatDate(firstDate),
      xLabelEnd: formatDate(lastDate),
    };
  }, [sortedByDate]);

  useEffect(() => {
    if (history.length >= 2 && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      chartSlideY.value = CHART_HEIGHT;
      chartOpacity.value = 0;
      chartSlideY.value = withDelay(150, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
      chartOpacity.value = withDelay(150, withTiming(1, { duration: 350 }));
    }
  }, [history.length]);

  const chartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chartSlideY.value }],
    opacity: chartOpacity.value,
  }));

  const handleUpdateWeight = async () => {
    setShowWeightPicker(false);
    setSaving(true);
    try {
      const weightToSave = selectedWeight;
      const { success } = await insertWeightLog(userId, weightToSave, {
        current_weight: weightToSave,
      });
      if (!success) {
        showToast('Failed to save weight', 'error');
        return;
      }
      invalidateWeightCache(userId);
      invalidateProfileCache(userId);
      setProfile(profile ? { ...profile, current_weight: weightToSave } : null);
      setHistory((prev) => [
        { id: '', user_id: userId, weight: weightToSave, recorded_at: new Date().toISOString() },
        ...prev,
      ]);
      showToast('Weight updated', 'success');
      onRefresh?.();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } finally {
      setSaving(false);
    }
  };

  const weightRange = useImperial
    ? Array.from({ length: 351 }, (_, i) => i + 50)
    : Array.from({ length: 156 }, (_, i) => i + 25);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Scale size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Weight Tracker</Text>
        </View>
        <TouchableOpacity
          style={[styles.updateButton, saving && styles.updateButtonDisabled]}
          onPress={() => setShowWeightPicker(true)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={styles.updateButtonText}>Update weight</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.chartContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : currentWeight == null && history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No weight logged yet</Text>
          <Text style={styles.emptySubtext}>Tap Update weight to get started</Text>
        </View>
      ) : (
        <>
          <View style={styles.metricsRow}>
            <View>
              <Text style={styles.metricLabel}>Current</Text>
              <Text style={styles.metricValue}>
                {(currentWeight ?? 0).toFixed(1)} {unitsLabel}
              </Text>
            </View>
            {metrics && history.length > 1 && (
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>
                  {metrics.lost >= 0 ? 'Lost' : 'Gained'}
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    metrics.lost >= 0 ? styles.metricPositive : styles.metricNegative,
                  ]}
                >
                  {Math.abs(metrics.lost).toFixed(1)} {unitsLabel}
                  {metrics.pct !== 0 && (
                    <Text style={styles.percentText}>
                      {' '}
                      ({metrics.pct >= 0 ? '' : '+'}
                      {(-metrics.pct).toFixed(1)}%)
                    </Text>
                  )}
                </Text>
              </View>
            )}
          </View>

          {history.length >= 2 && chartData && (
            <Animated.View style={[styles.chartWrapper, chartAnimatedStyle]}>
              <View style={styles.chartWithAxes}>
                <View style={styles.yAxisLabels}>
                  <Text style={styles.axisLabel}>{chartData.yMax.toFixed(0)} {unitsLabel}</Text>
                  <Text style={styles.axisLabel}>{chartData.yMin.toFixed(0)} {unitsLabel}</Text>
                </View>
                <Svg
                  width="100%"
                  height={CHART_HEIGHT - 24}
                  viewBox={`0 0 ${CHART_VIEWBOX.width} ${CHART_VIEWBOX.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={styles.chartSvg}
                >
                  <G>
                    <Path
                      d={chartData.pathD}
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </G>
                </Svg>
              </View>
              <View style={styles.xAxisLabels}>
                <Text style={styles.axisLabel}>{chartData.xLabelStart}</Text>
                <Text style={styles.axisLabel}>{chartData.xLabelEnd}</Text>
              </View>
            </Animated.View>
          )}
        </>
      )}

      <BottomSheet
        visible={showWeightPicker}
        onClose={() => setShowWeightPicker(false)}
        title={`Select weight (${unitsLabel})`}
        height={340}
      >
        <ScrollView
          style={styles.pickerScroll}
          contentContainerStyle={[
            styles.pickerContainer,
            { paddingBottom: Math.max(spacing.xl, insets.bottom) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Picker
            selectedValue={selectedWeight}
            onValueChange={(v) => setSelectedWeight(v)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {weightRange.map((v) => (
              <Picker.Item
                key={v}
                label={`${v} ${unitsLabel}`}
                value={v}
              />
            ))}
          </Picker>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleUpdateWeight}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmButtonText}>Save</Text>
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  updateButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
  },
  metricBlock: {
    alignItems: 'flex-end',
  },
  metricPositive: {
    color: colors.success,
  },
  metricNegative: {
    color: colors.warning,
  },
  percentText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartWrapper: {
    overflow: 'hidden',
    gap: spacing.xs,
  },
  chartWithAxes: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxisLabels: {
    width: 48,
    height: CHART_HEIGHT - 32,
    justifyContent: 'space-between',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: CHART_PAD.left + 4,
  },
  axisLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  chartSvg: {
    flex: 1,
    overflow: 'visible',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  pickerScroll: {
    flex: 1,
  },
  pickerContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  picker: {
    height: 160,
    width: '100%',
  },
  pickerItem: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});
