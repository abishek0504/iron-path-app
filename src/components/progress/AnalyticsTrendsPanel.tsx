import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendLineChart } from '../charts/TrendLineChart';
import { spacing, typography, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { getRangeForPreset } from '../../lib/analytics/dateBuckets';
import type { TrendGranularity } from '../../lib/analytics/types';
import { getAnalyticsTrendsCached } from '../../lib/cache/analyticsCache';
import type { AnalyticsTrendsBundle } from '../../lib/supabase/queries/analytics';
import { useUserStore } from '../../stores/userStore';
import { devLog } from '../../lib/utils/logger';

type RangePreset = '4w' | '12w' | '6mo' | 'ytd';

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: '4w', label: '4W' },
  { key: '12w', label: '12W' },
  { key: '6mo', label: '6M' },
  { key: 'ytd', label: 'YTD' },
];

type Props = {
  granularity?: TrendGranularity;
};

export function AnalyticsTrendsPanel({ granularity = 'week' }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profile = useUserStore((s) => s.profile);
  const useImperial = profile?.use_imperial !== false;

  const [preset, setPreset] = useState<RangePreset>('12w');
  const [bundle, setBundle] = useState<AnalyticsTrendsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) return;
    setLoading(true);
    try {
      const { start, end } = getRangeForPreset(preset);
      const data = await getAnalyticsTrendsCached(
        userId,
        start.toISOString(),
        end.toISOString(),
        granularity,
      );
      setBundle(data);
      if (__DEV__) {
        devLog('analytics-ui', {
          action: 'trends_loaded',
          preset,
          sessionCount: data.summaries.length,
          volumePoints: data.volumeTrend.length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.id, preset, granularity]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatVolume = useCallback(
    (volume: number) => {
      // Stored volume is already in the user's display unit.
      const unit = useImperial ? 'lb' : 'kg';
      if (volume >= 1000) return `${Math.round(volume / 100) / 10}k ${unit}`;
      return `${Math.round(volume)} ${unit}`;
    },
    [useImperial],
  );

  const totalVolume = bundle?.summaries.reduce((s, x) => s + x.volumeLbs, 0) ?? 0;
  const totalSessions = bundle?.summaries.length ?? 0;
  const avgRpe =
    bundle && bundle.summaries.length > 0
      ? bundle.summaries
          .filter((s) => s.avgRpe != null)
          .reduce((sum, s) => sum + (s.avgRpe ?? 0), 0) /
        Math.max(1, bundle.summaries.filter((s) => s.avgRpe != null).length)
      : null;

  if (loading && !bundle) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading trends…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.presetRow}>
        {RANGE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.presetChip, preset === opt.key && styles.presetChipActive]}
            onPress={() => setPreset(opt.key)}
          >
            <Text
              style={[styles.presetText, preset === opt.key && styles.presetTextActive]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statRow}>
        <StatChip label="Sessions" value={String(totalSessions)} styles={styles} />
        <StatChip label="Volume" value={formatVolume(totalVolume)} styles={styles} />
        <StatChip
          label="Avg RPE"
          value={avgRpe != null ? avgRpe.toFixed(1) : '—'}
          styles={styles}
        />
      </View>

      <ChartCard title="Volume" styles={styles}>
        <TrendLineChart
          data={bundle?.volumeTrend ?? []}
          formatValue={(v) => formatVolume(v)}
        />
      </ChartCard>

      <ChartCard title="Sessions" styles={styles}>
        <TrendLineChart data={bundle?.sessionCountTrend ?? []} valueUnit="sessions" />
      </ChartCard>

      <ChartCard title="Avg RPE" styles={styles}>
        <TrendLineChart data={bundle?.avgRpeTrend ?? []} />
      </ChartCard>

      <ChartCard title="Training load" styles={styles}>
        <TrendLineChart data={bundle?.trainingLoadTrend ?? []} />
      </ChartCard>
    </View>
  );
}

function StatChip({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChartCard({
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
      gap: spacing.md,
    },
    loading: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    presetRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    presetChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    presetChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySelectedBg,
    },
    presetText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    presetTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    statRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    statChip: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      alignItems: 'center',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      marginTop: 2,
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
  });
}
