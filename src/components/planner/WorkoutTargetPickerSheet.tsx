import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export type WorkoutTargetItem = {
  sessionId: string;
  label: string;
};

type Props = {
  visible: boolean;
  workouts: WorkoutTargetItem[];
  onClose: () => void;
  onClosed?: () => void;
  onSelect: (sessionId: string) => void;
};

export const WorkoutTargetPickerSheet: React.FC<Props> = ({
  visible,
  workouts,
  onClose,
  onClosed,
  onSelect,
}) => {
  const colors = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          gap: spacing.sm,
          paddingBottom: spacing.md,
        },
        subtitle: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
          marginBottom: spacing.xs,
        },
        chipRow: {
          gap: spacing.sm,
          paddingBottom: spacing.md,
        },
        chip: {
          minHeight: 44,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderRadius: borderRadius.sm,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          backgroundColor: colors.card,
          justifyContent: 'center',
        },
        chipText: {
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.medium,
        },
      }),
    [colors]
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} title="Choose workout" height={280}>
      <View style={styles.content}>
        <Text style={styles.subtitle}>Which workout should receive the preset?</Text>
        <ScrollView contentContainerStyle={styles.chipRow}>
          {workouts.map((workout) => (
            <TouchableOpacity
              key={workout.sessionId}
              style={styles.chip}
              onPress={() => onSelect(workout.sessionId)}
            >
              <Text style={styles.chipText}>{workout.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </BottomSheet>
  );
};
