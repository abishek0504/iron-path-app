/**
 * SplitPicker — preferred-training-split selector shared by onboarding and
 * Edit Profile.
 *
 * Shows suggestion chips driven by the user's days-per-week, plus a
 * "Not sure — pick for me" chip. Only known split ids are stored in
 * `v2_profiles.preferred_training_style` so the AI generation engine can map
 * the split to predictable day-focus options. Legacy free-text values from
 * the old "Custom" input are still accepted downstream (they fall back to
 * generic focus options) but can no longer be created here.
 */

import { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import {
  getSuggestedSplits,
  isKnownSplitId,
  TRAINING_SPLITS,
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

  const suggestions = useMemo(
    () => getSuggestedSplits(Math.max(1, daysPerWeek)),
    [daysPerWeek],
  );

  // If the frequency changes and the selected suggestion no longer fits,
  // clear it so the user re-picks. "Not sure" survives frequency changes.
  useEffect(() => {
    if (
      isKnownSplitId(value) &&
      value !== NOT_SURE_ID &&
      !suggestions.some((s) => s.id === value)
    ) {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  const selectedSplit = isKnownSplitId(value) ? TRAINING_SPLITS[value!] : null;

  return (
    <View style={styles.container}>
      <View style={styles.chipGroup}>
        {suggestions.map((split) => {
          const selected = value === split.id;
          return (
            <TouchableOpacity
              key={split.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(split.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {split.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, value === NOT_SURE_ID && styles.chipSelected]}
          onPress={() => onChange(NOT_SURE_ID)}
        >
          <Text
            style={[styles.chipText, value === NOT_SURE_ID && styles.chipTextSelected]}
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
    chipGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    chipTextSelected: {
      color: colors.background,
      fontWeight: typography.weights.semibold,
    },
    descriptionText: {
      color: colors.textMuted,
      fontSize: typography.sizes.sm,
    },
  });
}
