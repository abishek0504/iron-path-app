/**
 * Shared CTA button — primary / secondary / destructive / ghost.
 * Use for interactive actions only (not display-only tags).
 */

import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type GestureResponderEvent,
} from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  /** When true, button stretches to fill parent width. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  children?: React.ReactNode;
}

const PRESS_OPACITY = 0.85;

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
  accessibilityLabel,
  testID,
  children,
}) => {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const containerStyle = [
    styles.base,
    size === 'sm' ? styles.sizeSm : styles.sizeMd,
    styles[variant],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.labelBase,
    size === 'sm' ? styles.labelSm : styles.labelMd,
    styles[`${variant}Label` as const],
    textStyle,
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={PRESS_OPACITY}
      style={containerStyle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {children ?? <Text style={labelStyle}>{label}</Text>}
    </TouchableOpacity>
  );
};

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.md,
      borderWidth: 1,
    },
    sizeMd: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    sizeSm: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    fullWidth: {
      alignSelf: 'stretch',
      width: '100%',
    },
    disabled: {
      opacity: 0.45,
    },
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
    },
    destructive: {
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    labelBase: {
      fontWeight: typography.weights.semibold,
      textAlign: 'center',
    },
    labelMd: {
      fontSize: typography.sizes.base,
    },
    labelSm: {
      fontSize: typography.sizes.sm,
    },
    primaryLabel: {
      color: colors.onPrimaryContrast,
    },
    secondaryLabel: {
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    destructiveLabel: {
      color: colors.textPrimary,
    },
    ghostLabel: {
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
  });
}
