/**
 * Shared stack/modal header with title and optional back/close actions.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

const HEADER_ACTION_SIZE = 44;

export const SCREEN_HEADER_HEIGHT = HEADER_ACTION_SIZE + spacing.sm * 2;

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
}

export function ScreenHeader({ title, onBack, onClose }: ScreenHeaderProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.side}>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={24} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    side: {
      minWidth: HEADER_ACTION_SIZE,
      minHeight: HEADER_ACTION_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    action: {
      minWidth: HEADER_ACTION_SIZE,
      minHeight: HEADER_ACTION_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      textAlign: 'center',
    },
  });
}
