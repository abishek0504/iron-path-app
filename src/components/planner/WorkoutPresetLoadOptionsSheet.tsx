import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { PresetLoadMode } from '../../lib/supabase/queries/presets';

type Props = {
  visible: boolean;
  presetName: string;
  onClose: () => void;
  onSelect: (mode: PresetLoadMode) => void;
};

export const WorkoutPresetLoadOptionsSheet: React.FC<Props> = ({
  visible,
  presetName,
  onClose,
  onSelect,
}) => {
  const colors = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: spacing.lg,
          gap: spacing.md,
        },
        subtitle: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
          marginBottom: spacing.xs,
        },
        option: {
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          backgroundColor: colors.card,
        },
        optionTitle: {
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
        },
        optionDescription: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
          marginTop: spacing.xs,
        },
      }),
    [colors]
  );

  const options: Array<{ mode: PresetLoadMode; title: string; description: string }> = [
    {
      mode: 'replace',
      title: 'Replace workout',
      description: 'Replace exercises in an existing workout with this preset.',
    },
    {
      mode: 'append',
      title: 'Append to workout',
      description: 'Add preset exercises after the current exercises in a workout.',
    },
    {
      mode: 'newWorkout',
      title: 'Create new workout',
      description: 'Add a new workout for this day with the preset exercises.',
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="How to load preset" height={420}>
      <View style={styles.content}>
        <Text style={styles.subtitle}>Loading &quot;{presetName}&quot;</Text>
        {options.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={styles.option}
            onPress={() => onSelect(option.mode)}
          >
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionDescription}>{option.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
};
