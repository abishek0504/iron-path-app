/**
 * SplitPicker — preferred-training-split selector shared by onboarding and
 * Edit Profile.
 *
 * Shows frequency-suggested splits first, then the full catalog, plus a
 * "Not sure — pick for me" option. Only known split ids are stored in
 * `v2_profiles.preferred_training_style` so the AI generation engine can map
 * the split to predictable day-focus options. Legacy free-text values from
 * the old "Custom" input are still accepted downstream (they fall back to
 * generic focus options) but can no longer be created here.
 */

import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import {
  getAllSplitsOrdered,
  isKnownSplitId,
  TRAINING_SPLITS,
  type TrainingSplit,
} from '../../lib/constants/trainingSplits';

const NOT_SURE_ID = TRAINING_SPLITS.not_sure.id;

interface SplitPickerProps {
  daysPerWeek: number;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function SplitPicker({ daysPerWeek, value, onChange }: SplitPickerProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { suggested, more } = useMemo(
    () => getAllSplitsOrdered(Math.max(1, daysPerWeek)),
    [daysPerWeek],
  );

  const selectedSplit = isKnownSplitId(value) ? TRAINING_SPLITS[value!] : null;

  const renderOption = (split: TrainingSplit) => {
    const selected = value === split.id;
    return (
      <TouchableOpacity
        key={split.id}
        style={[styles.optionRow, selected && styles.optionRowSelected]}
        onPress={() => onChange(split.id)}
      >
        <Text style={[styles.optionRowText, selected && styles.optionRowTextSelected]}>
          {split.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.optionList}>
        {suggested.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Suggested for your schedule</Text>
            {suggested.map(renderOption)}
          </>
        ) : null}

        {more.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, suggested.length > 0 && styles.sectionLabelSpaced]}>
              More splits
            </Text>
            {more.map(renderOption)}
          </>
        ) : null}

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Not sure</Text>
        <TouchableOpacity
          style={[styles.optionRow, value === NOT_SURE_ID && styles.optionRowSelected]}
          onPress={() => onChange(NOT_SURE_ID)}
        >
          <Text
            style={[styles.optionRowText, value === NOT_SURE_ID && styles.optionRowTextSelected]}
          >
            {TRAINING_SPLITS.not_sure.label}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedSplit ? (
        <Text style={styles.descriptionText}>{selectedSplit.description}</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    optionList: {
      gap: spacing.sm,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: spacing.xs,
    },
    sectionLabelSpaced: {
      marginTop: spacing.md,
    },
    optionRow: {
      width: '100%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    optionRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySelectedBg,
    },
    optionRowText: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
    },
    optionRowTextSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    descriptionText: {
      color: colors.textMuted,
      fontSize: typography.sizes.sm,
    },
  });
}
