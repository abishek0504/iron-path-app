/**
 * Weight Tracker Card
 * Displays current weight, loss metrics, and a line chart of weight over time
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Scale } from 'lucide-react-native';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { useUserStore } from '../../stores/userStore';
import { useUIStore } from '../../stores/uiStore';
import {
  getWeightHistoryCached,
  invalidateWeightCache,
  invalidateProfileCache,
} from '../../lib/cache/dashboardStatsCache';
import { insertWeightLog } from '../../lib/supabase/queries/weight';
import { aggregateWeightLogsByDay, computeWeightMetrics } from '../../lib/utils/weightChart';
import { BottomSheet } from './BottomSheet';
import { LogoEdgeLoader } from './LogoEdgeLoader';
import { WeightTrendChart } from './WeightTrendChart';
import { devLog } from '../../lib/utils/logger';
import type { WeightLog } from '../../lib/supabase/queries/weight';

const CHART_HEIGHT = 160;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface WeightTrackerCardProps {
  userId: string;
  onRefresh?: () => void;
  /** Increment to re-fetch weight history (e.g. after Health sync). */
  refreshSignal?: number;
}

export function WeightTrackerCard({ userId, onRefresh, refreshSignal }: WeightTrackerCardProps) {
  const router = useRouter();
  const colors = useTheme();
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

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await getWeightHistoryCached(userId);
      setHistory(logs);

      if (__DEV__ && logs.length > 0) {
        const sorted = [...logs].sort(
          (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );
        devLog('weight-chart', {
          action: 'loadHistory',
          pointCount: logs.length,
          dateStart: sorted[0].recorded_at,
          dateEnd: sorted[sorted.length - 1].recorded_at,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  useEffect(() => {
    if (refreshSignal !== undefined && refreshSignal > 0) {
      loadHistory();
    }
  }, [refreshSignal, loadHistory]);

  useEffect(() => {
    if (currentWeight != null) {
      setSelectedWeight(Math.round(currentWeight));
    } else {
      setSelectedWeight(useImperial ? 154 : 70);
    }
  }, [currentWeight, useImperial]);

  const chartLogs = useMemo(() => aggregateWeightLogsByDay(history), [history]);
  const metrics = useMemo(
    () => computeWeightMetrics(currentWeight, chartLogs),
    [currentWeight, chartLogs],
  );

  const handleUpdateWeight = async () => {
    setShowWeightPicker(false);
    setSaving(true);
    try {
      const weightToSave = selectedWeight;
      const { success } = await insertWeightLog(userId, weightToSave, {
        current_weight: weightToSave,
      }, useImperial ? 'imperial' : 'metric');
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

  const styles = useMemo(() => StyleSheet.create({
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
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.xl,
      alignItems: 'flex-start',
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.bold,
      flexShrink: 1,
    },
    metricBlock: {
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '48%',
      gap: spacing.xs,
    },
    metricDelta: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    metricPositive: {
      color: colors.successText,
    },
    metricNegative: {
      color: colors.warningText,
    },
    percentText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textMuted,
    },
    chartContainer: {
      height: CHART_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
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
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
  }), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.titleRow}
          onPress={() => router.push('/weight-history')}
          accessibilityRole="button"
          accessibilityLabel="Open weight history"
        >
          <Scale size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Weight Tracker</Text>
        </Pressable>
        <TouchableOpacity
          style={[styles.updateButton, saving && styles.updateButtonDisabled]}
          onPress={() => setShowWeightPicker(true)}
          disabled={saving}
        >
          {saving ? (
            <LogoEdgeLoader size="small" variant="inverted" />
          ) : (
            <Text style={styles.updateButtonText}>Update weight</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.chartContainer}>
          <LogoEdgeLoader size="small" />
        </View>
      ) : currentWeight == null && history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No weight logged yet</Text>
          <Text style={styles.emptySubtext}>Tap Update weight to get started</Text>
        </View>
      ) : (
        <>
          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Current</Text>
              <Text style={styles.metricValue}>
                {(currentWeight ?? 0).toFixed(1)} {unitsLabel}
              </Text>
            </View>
            {metrics && chartLogs.length > 1 && (
              <View style={styles.metricBlock}>
                <Text style={styles.metricLabel}>
                  {metrics.lost >= 0 ? 'Lost' : 'Gained'}
                </Text>
                <Text
                  style={[
                    styles.metricDelta,
                    metrics.lost >= 0 ? styles.metricPositive : styles.metricNegative,
                  ]}
                >
                  {Math.abs(metrics.lost).toFixed(1)} {unitsLabel}
                </Text>
                {metrics.pct !== 0 ? (
                  <Text style={styles.percentText}>
                    {metrics.pct >= 0 ? '' : '+'}
                    {(-metrics.pct).toFixed(1)}% since first log
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          {chartLogs.length >= 1 && (
            <WeightTrendChart
              logs={history}
              useImperial={useImperial}
              height={CHART_HEIGHT}
              animated
            />
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
