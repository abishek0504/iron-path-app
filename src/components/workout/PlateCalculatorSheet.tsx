import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { borderRadius, spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { calculatePlateBreakdown } from '../../lib/workout/plateCalculator';
import { BarbellLoadVisual } from './BarbellLoadVisual';

interface PlateCalculatorSheetProps {
  visible: boolean;
  target: number | null;
  useImperial: boolean;
  onClose: () => void;
}

export function PlateCalculatorSheet({
  visible,
  target,
  useImperial,
  onClose,
}: PlateCalculatorSheetProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const breakdown = useMemo(
    () => (target != null ? calculatePlateBreakdown(target, useImperial) : null),
    [target, useImperial],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Plate calculator</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          {breakdown == null ? (
            <Text style={styles.body}>Enter a weight to see how to load the bar.</Text>
          ) : (
            <>
              <Text style={styles.target}>
                {breakdown.target} {breakdown.unit}
              </Text>
              <BarbellLoadVisual breakdown={breakdown} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    target: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.primary,
      textAlign: 'center',
    },
    body: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
