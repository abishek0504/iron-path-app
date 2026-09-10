import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  getDayFocusOptions,
  orderTrainingDays,
  type DayFocusMap,
} from '../../lib/constants/trainingSplits';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { Chip } from '../ui/Chip';

interface DayFocusMapEditorProps {
  splitValue: string | null | undefined;
  workoutDays: string[];
  value: DayFocusMap;
  onChange: (next: DayFocusMap) => void;
}

export function DayFocusMapEditor({
  splitValue,
  workoutDays,
  value,
  onChange,
}: DayFocusMapEditorProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const options = useMemo(() => getDayFocusOptions(splitValue), [splitValue]);
  const orderedDays = useMemo(() => orderTrainingDays(workoutDays), [workoutDays]);

  if (orderedDays.length === 0 || options.length === 0) return null;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Day focus</Text>
      <Text style={styles.hint}>
        Assign a split day to each training weekday. Coach uses this map when it plans the week.
      </Text>
      {orderedDays.map((dayName) => (
        <View key={dayName} style={styles.dayBlock}>
          <Text style={styles.dayName}>{dayName}</Text>
          <View style={styles.chips}>
            {options.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={value[dayName] === option}
                onPress={() => onChange({ ...value, [dayName]: option })}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: spacing.sm,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    hint: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
    },
    dayBlock: {
      gap: spacing.xs,
    },
    dayName: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
  });
}
