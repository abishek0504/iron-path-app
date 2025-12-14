/**
 * Workout Heatmap
 * Reusable component for displaying daily muscle stress
 * Shows daily muscle stress derived from performed sets (not freshness)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { colors, spacing, borderRadius } from '../../lib/utils/theme';
import { devLog, devError } from '../../lib/utils/logger';

export interface MuscleStressData {
  muscle_key: string;
  display_name: string;
  stress: number;
}

interface WorkoutHeatmapProps {
  userId: string;
  dateRange: { start: Date; end: Date };
  onMuscleSelect?: (muscleKey: string) => void;
}

export const WorkoutHeatmap: React.FC<WorkoutHeatmapProps> = ({
  userId,
  dateRange,
  onMuscleSelect,
}) => {
  const [data, setData] = useState<MuscleStressData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHeatmapData();
  }, [userId, dateRange]);

  const loadHeatmapData = async () => {
    if (__DEV__) {
      devLog('heatmap', {
        action: 'loadHeatmapData',
        userId,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
      });
    }

    setLoading(true);
    try {
      // Get daily muscle stress for date range
      const { data: stressData, error } = await supabase
        .from('v2_daily_muscle_stress')
        .select('muscle_key, stress, v2_muscles!inner(display_name)')
        .eq('user_id', userId)
        .gte('date', dateRange.start.toISOString().split('T')[0])
        .lte('date', dateRange.end.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        if (__DEV__) {
          devError('heatmap', error, { userId, dateRange });
        }
        return;
      }

      // Aggregate stress by muscle across date range
      const aggregated = new Map<string, { stress: number; display_name: string }>();

      for (const row of stressData || []) {
        const muscleKey = row.muscle_key;
        const displayName =
          (row.v2_muscles as any)?.display_name || muscleKey;
        const current = aggregated.get(muscleKey) || {
          stress: 0,
          display_name: displayName,
        };
        aggregated.set(muscleKey, {
          stress: current.stress + (row.stress || 0),
          display_name: displayName,
        });
      }

      const result: MuscleStressData[] = Array.from(aggregated.entries()).map(
        ([key, value]) => ({
          muscle_key: key,
          display_name: value.display_name,
          stress: value.stress,
        })
      );

      // Sort by stress descending
      result.sort((a, b) => b.stress - a.stress);

      setData(result);

      if (__DEV__) {
        devLog('heatmap', {
          action: 'loadHeatmapData_result',
          muscleCount: result.length,
          totalStress: result.reduce((sum, d) => sum + d.stress, 0),
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('heatmap', error, { userId, dateRange });
      }
    } finally {
      setLoading(false);
    }
  };

  const getStressColor = (stress: number, maxStress: number): string => {
    if (maxStress === 0) return colors.border;
    const intensity = stress / maxStress;
    if (intensity > 0.8) return colors.error;
    if (intensity > 0.6) return '#f97316'; // orange
    if (intensity > 0.4) return '#eab308'; // yellow
    if (intensity > 0.2) return colors.primary;
    return colors.border;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const maxStress = Math.max(...data.map((d) => d.stress), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muscle Stress Heatmap</Text>
      <View style={styles.grid}>
        {data.map((item) => (
          <View
            key={item.muscle_key}
            style={[
              styles.muscleCell,
              {
                backgroundColor: getStressColor(item.stress, maxStress),
              },
            ]}
          >
            <Text style={styles.muscleName} numberOfLines={2}>
              {item.display_name}
            </Text>
            <Text style={styles.stressValue}>
              {item.stress.toFixed(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  muscleCell: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  muscleName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stressValue: {
    fontSize: 10,
    color: colors.textPrimary,
    opacity: 0.8,
  },
});

