/**
 * Workout Picker
 * Choose which workout (session) within the day to view/start/continue
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';

export type WorkoutItem = {
  index: number;
  label: string;
  isCompleted: boolean;
};

type Props = {
  workouts: WorkoutItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export const WorkoutPicker: React.FC<Props> = ({
  workouts,
  selectedIndex,
  onSelect,
}) => {
  if (workouts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No workouts yet. Tap "Add Workout" to start.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {workouts.map((w) => {
          const isSelected = w.index === selectedIndex;
          return (
            <Pressable
              key={w.index}
              onPress={() => onSelect(w.index)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {w.label}
              </Text>
              {w.isCompleted && <Text style={styles.completedBadge}>✓</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  chipRow: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  completedBadge: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    textAlign: 'center',
    padding: spacing.md,
  },
});
