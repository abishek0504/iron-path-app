import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { Button } from './Button';

/** Circular workout indicator: half of 8×8 dot. */
const WORKOUT_DOT_RADIUS = 4;

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
    chipToday: {
      borderColor: colors.borderLight,
    },
    chipRest: {
      opacity: 0.7,
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
    chipTextToday: {
      color: colors.textSecondary,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: WORKOUT_DOT_RADIUS,
      backgroundColor: colors.primary,
    },
    actions: {
      gap: spacing.sm,
    },
  }), [colors]);

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
        <Button
          label="Use this day"
          onPress={() => onSelect(selectedDayName)}
          fullWidth
          size="sm"
        />
        <Button
          label="Reset to today"
          variant="secondary"
          onPress={onResetToToday}
          fullWidth
          size="sm"
        />
      </View>
    </View>
  );
};
