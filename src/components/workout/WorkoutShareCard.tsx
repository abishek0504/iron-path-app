import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { ShareWorkoutStats } from '../../lib/workout/shareWorkout';

interface WorkoutShareCardProps {
  stats: ShareWorkoutStats;
}

export const WorkoutShareCard = forwardRef<View, WorkoutShareCardProps>(({ stats }, ref) => {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <Text style={styles.brand}>Iron Path</Text>
      <Text style={styles.title}>{stats.title}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.durationMin}m</Text>
          <Text style={styles.statLabel}>duration</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Math.round(stats.volume)} {stats.unitsLabel}
          </Text>
          <Text style={styles.statLabel}>volume</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.setCount}</Text>
          <Text style={styles.statLabel}>sets</Text>
        </View>
      </View>
      {stats.topLifts.length > 0 ? (
        <View style={styles.lifts}>
          {stats.topLifts.map((lift) => (
            <View key={`${lift.name}-${lift.detail}`} style={styles.liftRow}>
              <Text style={styles.liftName} numberOfLines={1}>
                {lift.name}
              </Text>
              <Text style={styles.liftDetail}>{lift.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

WorkoutShareCard.displayName = 'WorkoutShareCard';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.md,
      width: 320,
    },
    brand: {
      color: colors.primary,
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    stat: {
      alignItems: 'flex-start',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
    },
    lifts: {
      gap: spacing.xs,
    },
    liftRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    liftName: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    liftDetail: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
  });
}
