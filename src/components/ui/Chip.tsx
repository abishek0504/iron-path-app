/**
 * Interactive option selector (squarer tile). Do not use for display-only tags.
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

/** Comfortable tap target for option chips (iOS HIG 44pt). */
const CHIP_MIN_HEIGHT = 44;
const CHIP_MIN_WIDTH = 44;

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
      minHeight: CHIP_MIN_HEIGHT,
      minWidth: CHIP_MIN_WIDTH,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primarySelectedBg,
      borderColor: colors.primary,
    },
    text: {
      color: colors.textSecondary,
      fontSize: typography.sizes.base,
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
