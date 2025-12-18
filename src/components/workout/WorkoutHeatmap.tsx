/**
 * Workout Heatmap
 * Presentational component for displaying muscle stress
 * Expects pre-aggregated stress data from callers
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../lib/utils/theme';

export interface MuscleStressData {
  muscle_key: string;
  display_name: string;
  stress: number;
}

interface WorkoutHeatmapProps {
  stressData: MuscleStressData[];
  onMuscleSelect?: (muscleKey: string) => void;
}

export const WorkoutHeatmap: React.FC<WorkoutHeatmapProps> = ({
  stressData,
  onMuscleSelect,
}) => {
  if (!stressData.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Muscle Stress Heatmap</Text>
        <Text style={styles.emptyText}>No recent training data</Text>
      </View>
    );
  }

  const getStressColor = (stress: number, maxStress: number): string => {
    if (maxStress === 0) return colors.border;
    const intensity = stress / maxStress;
    if (intensity > 0.8) return colors.error;
    if (intensity > 0.6) return '#f97316'; // orange
    if (intensity > 0.4) return '#eab308'; // yellow
    if (intensity > 0.2) return colors.primary;
    return colors.border;
  };

  const maxStress = Math.max(...stressData.map((d) => d.stress), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muscle Stress Heatmap</Text>
      <View style={styles.grid}>
        {stressData.map((item) => (
          <View
            key={item.muscle_key}
            style={[
              styles.muscleCell,
              {
                backgroundColor: getStressColor(item.stress, maxStress),
              },
            ]}
            onTouchEnd={() => {
              if (onMuscleSelect) {
                onMuscleSelect(item.muscle_key);
              }
            }}
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
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});

