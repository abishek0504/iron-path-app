import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { WeightTrendChart } from '../src/components/ui/WeightTrendChart';
import { useUserStore } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { supabase } from '../src/lib/supabase/client';
import {
  getWeightHistoryCached,
  invalidateProfileCache,
  invalidateWeightCache,
} from '../src/lib/cache/dashboardStatsCache';
import {
  deleteWeightLog,
  WEIGHT_HISTORY_MAX,
  type WeightLog,
} from '../src/lib/supabase/queries/weight';
import {
  aggregateWeightLogsByDay,
  computeWeightMetrics,
} from '../src/lib/utils/weightChart';
import { devError, devLog } from '../src/lib/utils/logger';
import { hapticWarning } from '../src/lib/utils/haptics';

const CHART_HEIGHT = 260;

type DeleteFlow = {
  entry: WeightLog;
  step: 'review' | 'confirm';
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatLogTimestamp(iso: string): string {
  const date = new Date(iso);
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} · ${timeLabel}`;
}

export default function WeightHistoryScreen() {
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const showToast = useUIStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<WeightLog[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteFlow, setDeleteFlow] = useState<DeleteFlow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const useImperial = profile?.use_imperial ?? true;
  const unitsLabel = useImperial ? 'lbs' : 'kg';
  const currentWeight = profile?.current_weight ?? null;

  const chartLogs = useMemo(() => aggregateWeightLogsByDay(history), [history]);
  const metrics = useMemo(
    () => computeWeightMetrics(currentWeight, chartLogs),
    [currentWeight, chartLogs],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        showToast('Please log in', 'error');
        router.replace('/login');
        return;
      }
      setUserId(uid);
      const logs = await getWeightHistoryCached(uid, WEIGHT_HISTORY_MAX);
      setHistory(logs);
      if (__DEV__) {
        devLog('weight-history', { action: 'load:done', entryCount: logs.length });
      }
    } catch (error) {
      if (__DEV__) devError('weight-history', error);
      showToast('Failed to load weight history', 'error');
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingDelete = deleteFlow?.entry ?? null;

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !userId || deletingId || deleteFlow?.step !== 'confirm') return;

    hapticWarning();
    const logId = pendingDelete.id;
    setDeleteFlow(null);
    setDeletingId(logId);

    try {
      const { success, currentWeight: nextWeight } = await deleteWeightLog(userId, logId);
      if (!success) {
        showToast('Failed to remove entry', 'error');
        return;
      }

      invalidateWeightCache(userId);
      invalidateProfileCache(userId);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setHistory((prev) => prev.filter((entry) => entry.id !== logId));
      setProfile(profile ? { ...profile, current_weight: nextWeight ?? undefined } : null);
      showToast('Weight entry removed', 'success');

      if (__DEV__) {
        devLog('weight-history', {
          action: 'delete:done',
          logId,
          currentWeight: nextWeight,
        });
      }
    } catch (error) {
      if (__DEV__) devError('weight-history', error, { action: 'delete' });
      showToast('Failed to remove entry', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weight history</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <LoadingScreen message="Loading weight history..." style={styles.loadingContainer} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No weight entries yet</Text>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>Current</Text>
                  <Text style={styles.metricValue}>
                    {(currentWeight ?? history[0]?.weight ?? 0).toFixed(1)} {unitsLabel}
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

              <View style={styles.chartCard}>
                <WeightTrendChart
                  logs={history}
                  useImperial={useImperial}
                  height={CHART_HEIGHT}
                />
              </View>

              <Text style={styles.sectionLabel}>All entries</Text>
              {history.map((entry) => {
                const isDeleting = deletingId === entry.id;
                return (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={styles.entryTextBlock}>
                      <Text style={styles.entryDate}>{formatLogTimestamp(entry.recorded_at)}</Text>
                      <Text style={styles.entryWeight}>
                        {entry.weight.toFixed(1)} {unitsLabel}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => setDeleteFlow({ entry, step: 'review' })}
                      disabled={isDeleting || deletingId != null}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove weight entry from ${formatLogTimestamp(entry.recorded_at)}`}
                    >
                      {isDeleting ? (
                        <LogoEdgeLoader size="small" />
                      ) : (
                        <Trash2 size={18} color={colors.errorText} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      <ConfirmDialog
        visible={deleteFlow?.step === 'review'}
        title="Remove weight entry?"
        message={
          pendingDelete
            ? `${pendingDelete.weight.toFixed(1)} ${unitsLabel} logged on ${formatLogTimestamp(pendingDelete.recorded_at)} will be removed from your history.`
            : undefined
        }
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (deleteFlow) {
            setDeleteFlow({ entry: deleteFlow.entry, step: 'confirm' });
          }
        }}
        onCancel={() => setDeleteFlow(null)}
      />

      <ConfirmDialog
        visible={deleteFlow?.step === 'confirm'}
        title="Confirm removal"
        message={
          pendingDelete
            ? `This permanently deletes this weight log and may update your chart and current weight. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete entry"
        cancelLabel="Go back"
        confirmDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteFlow(null)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 26,
    },
    loadingContainer: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.xl,
    },
    metricBlock: {
      flex: 1,
      gap: spacing.xs,
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
      color: colors.textMuted,
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      overflow: 'hidden',
    },
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.sm,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    entryTextBlock: {
      flex: 1,
      gap: spacing.xs,
    },
    entryDate: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
    },
    entryWeight: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    deleteButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: typography.sizes.base,
      textAlign: 'center',
      marginTop: spacing.xxl,
    },
  });
}
