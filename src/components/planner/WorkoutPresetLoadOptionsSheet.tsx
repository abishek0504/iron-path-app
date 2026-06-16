import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { PresetLoadMode } from '../../lib/supabase/queries/presets';

type Props = {
  visible: boolean;
  presetName: string;
  onClose: () => void;
  onClosed?: () => void;
  onSelect: (mode: PresetLoadMode) => void;
};

export const WorkoutPresetLoadOptionsSheet: React.FC<Props> = ({
  visible,
  presetName,
  onClose,
  onClosed,
  onSelect,
}) => {
  const colors = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          flex: 1,
          marginHorizontal: -spacing.md,
        },
        scrollContent: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        },
        subtitle: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
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

  const options: { mode: PresetLoadMode; title: string; description: string }[] = [
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="How to load preset"
      height="52%"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
      </ScrollView>
    </BottomSheet>
  );
};
