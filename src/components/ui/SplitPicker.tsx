/**
 * SplitPicker — preferred-training-split selector shared by onboarding and
 * Edit Profile.
 *
 * Shows suggestion chips driven by the user's days-per-week, plus a "Custom"
 * chip that reveals a free-text input. `value` is either a known split id or
 * the custom text; both are stored verbatim in
 * `v2_profiles.preferred_training_style`.
 */

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import {
  getSuggestedSplits,
  isKnownSplitId,
} from '../../lib/constants/trainingSplits';

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

  const valueIsKnown = isKnownSplitId(value);
  const [customMode, setCustomMode] = useState(!!value && !valueIsKnown);

  // If the frequency changes and the selected suggestion no longer fits,
  // clear it so the user re-picks. Custom text is kept — it's theirs.
  useEffect(() => {
    if (valueIsKnown && !suggestions.some((s) => s.id === value)) {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  const selectSuggestion = (id: string) => {
    setCustomMode(false);
    onChange(id);
  };

  const toggleCustom = () => {
    if (customMode) {
      setCustomMode(false);
      onChange(null);
    } else {
      setCustomMode(true);
      onChange(valueIsKnown ? null : value);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chipGroup}>
        {suggestions.map((split) => {
          const selected = !customMode && value === split.id;
          return (
            <TouchableOpacity
              key={split.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => selectSuggestion(split.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {split.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, customMode && styles.chipSelected]}
          onPress={toggleCustom}
        >
          <Text style={[styles.chipText, customMode && styles.chipTextSelected]}>
            Custom
          </Text>
        </TouchableOpacity>
      </View>

      {!customMode && value && isKnownSplitId(value) ? (
        <Text style={styles.descriptionText}>
          {suggestions.find((s) => s.id === value)?.description ?? ''}
        </Text>
      ) : null}

      {customMode ? (
        <TextInput
          value={value ?? ''}
          onChangeText={(text) => onChange(text)}
          placeholder="Describe your split (e.g. Chest+Tris / Back+Bis / Legs)"
          placeholderTextColor={colors.textMuted}
          style={styles.customInput}
          autoCapitalize="sentences"
        />
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
    customInput: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
  });
}
