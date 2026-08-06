/**
 * Workout Picker
 * Choose which workout (session) within the day to view/start/continue
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

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
  const colors = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    chipRow: {
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    chip: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySelectedBg,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.base,
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
  }), [colors]);

  if (workouts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No workouts yet. Tap &quot;Add Workout&quot; to start.</Text>
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
