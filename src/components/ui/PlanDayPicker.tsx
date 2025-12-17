import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';

type DayItem = {
  dayName: string;
  hasWorkout: boolean;
};

type Props = {
  selectedDayName: string;
  todayDayName: string;
  days: DayItem[];
  onSelect: (dayName: string) => void;
  onResetToToday: () => void;
};

export const PlanDayPicker: React.FC<Props> = ({
  selectedDayName,
  todayDayName,
  days,
  onSelect,
  onResetToToday,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {days.map((day) => {
          const isSelected = day.dayName === selectedDayName;
          const isToday = day.dayName === todayDayName;
          return (
            <Pressable
              key={day.dayName}
              onPress={() => onSelect(day.dayName)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                !isSelected && isToday && styles.chipToday,
                !day.hasWorkout && styles.chipRest,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                  !isSelected && isToday && styles.chipTextToday,
                ]}
              >
                {day.dayName}
              </Text>
              {day.hasWorkout && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => onSelect(selectedDayName)}>
          <Text style={styles.primaryButtonText}>Use this day</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onResetToToday}>
          <Text style={styles.secondaryButtonText}>Reset to today</Text>
        </Pressable>
      </View>
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
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
  },
  chipToday: {
    borderColor: colors.borderLight,
  },
  chipRest: {
    opacity: 0.7,
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
  chipTextToday: {
    color: colors.textSecondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});

