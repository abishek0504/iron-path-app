/**
 * Interactive pill selector. Do not use for display-only muscle/equipment tags.
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}) => {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
    >
      <Text style={[styles.text, selected && styles.textSelected, textStyle]}>{label}</Text>
    </Pressable>
  );
};

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    chip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipSelected: {
      backgroundColor: colors.primarySelectedBg,
      borderColor: colors.primary,
    },
    text: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    textSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
