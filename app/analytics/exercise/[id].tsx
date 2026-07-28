import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { TrendLineChart } from '../../../src/components/charts/TrendLineChart';
import { spacing, typography, borderRadius, type ThemeColors } from '../../../src/lib/utils/theme';
import { useTheme } from '../../../src/lib/utils/ThemeContext';
import { getRangeForPreset } from '../../../src/lib/analytics/dateBuckets';
import {
  getExerciseTrendCached,
  getPRTimelineCached,
} from '../../../src/lib/cache/analyticsCache';
import type { ExerciseTrendPoint } from '../../../src/lib/supabase/queries/analytics';
import type { PRTimelineEntry } from '../../../src/lib/analytics/progression';
import { useUserStore } from '../../../src/stores/userStore';
import { supabase } from '../../../src/lib/supabase/client';
import type { TrendPoint } from '../../../src/lib/analytics/types';

export default function ExerciseAnalyticsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const useImperial = profile?.use_imperial !== false;
  const params = useLocalSearchParams<{ id: string; name?: string }>();

  const exerciseKey = params.id ?? '';
  const title = params.name ?? 'Exercise';

  const [trend, setTrend] = useState<ExerciseTrendPoint[]>([]);
  const [prs, setPrs] = useState<PRTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? profile?.id;
    if (!userId || !exerciseKey) return;

    setLoading(true);
    try {
      const { start, end } = getRangeForPreset('12w');
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const [trendData, prData] = await Promise.all([
        getExerciseTrendCached(userId, exerciseKey, startIso, endIso),
        getPRTimelineCached(userId, exerciseKey, 20),
      ]);
      setTrend(trendData);
      setPrs(prData);
    } finally {
      setLoading(false);
    }
  }, [exerciseKey, profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stored weights/volume are already in the user's display unit.
  const formatWeight = (weight: number | null) => {
    if (weight == null) return '—';
    const unit = useImperial ? 'lb' : 'kg';
    return `${Math.round(weight * 10) / 10} ${unit}`;
  };

  const volumeTrend: TrendPoint[] = trend.map((p) => ({
    bucketKey: p.sessionId,
    label: new Date(p.completedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    value: p.volumeLbs,
  }));

  const e1rmTrend: TrendPoint[] = trend
    .filter((p) => p.estimated1RmLbs != null)
    .map((p) => ({
      bucketKey: p.sessionId,
      label: new Date(p.completedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      value: p.estimated1RmLbs ?? 0,
    }));

  const weightTrend: TrendPoint[] = trend
    .filter((p) => p.bestWeightLbs != null)
    .map((p) => ({
      bucketKey: p.sessionId,
      label: new Date(p.completedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      value: p.bestWeightLbs ?? 0,
    }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : (
          <>
            <ChartSection title="Volume" styles={styles}>
              <TrendLineChart
                data={volumeTrend}
                formatValue={(v) => `${Math.round(v)} ${useImperial ? 'lb' : 'kg'}`}
              />
            </ChartSection>

            {e1rmTrend.length > 0 ? (
              <ChartSection title="Est. 1RM" styles={styles}>
                <TrendLineChart
                  data={e1rmTrend}
                  formatValue={(v) => formatWeight(v)}
                />
              </ChartSection>
            ) : null}

            {weightTrend.length > 0 ? (
              <ChartSection title="Best set weight" styles={styles}>
                <TrendLineChart
                  data={weightTrend}
                  formatValue={(v) => formatWeight(v)}
                />
              </ChartSection>
            ) : null}

            {prs.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>PR history</Text>
                {prs.map((pr, i) => (
                  <View key={`${pr.sessionId}-${i}`} style={styles.prRow}>
                    <Text style={styles.prDate}>
                      {pr.performedAt
                        ? new Date(pr.performedAt).toLocaleDateString()
                        : '—'}
                    </Text>
                    <Text style={styles.prValue}>
                      {pr.prType === 'timed'
                        ? `${pr.value}s`
                        : pr.prType === 'reps_only'
                          ? `${pr.value} reps`
                          : formatWeight(pr.value)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent sessions</Text>
              {trend.length === 0 ? (
                <Text style={styles.muted}>No sessions in range</Text>
              ) : (
                [...trend].reverse().slice(0, 10).map((p) => (
                  <View key={p.sessionId} style={styles.sessionRow}>
                    <Text style={styles.sessionDate}>
                      {new Date(p.completedAt).toLocaleDateString()}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {formatWeight(p.bestWeightLbs)}
                      {p.bestReps != null ? ` × ${p.bestReps}` : ''}
                      {p.avgRpe != null ? ` · RPE ${p.avgRpe.toFixed(1)}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChartSection({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
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
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      padding: spacing.xs,
    },
    title: {
      flex: 1,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    loading: {
      color: colors.textSecondary,
      textAlign: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    prRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    prDate: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    prValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    sessionRow: {
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    sessionDate: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    sessionMeta: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      marginTop: 2,
    },
    muted: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
  });
}
