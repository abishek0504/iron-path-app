/**
 * Rest Timer
 *
 * Auto-starts after completing a set
 * Shows countdown with skip button
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SkipForward } from 'lucide-react-native';
import { formatCountdownTime, useCountdown } from '../../hooks/useCountdown';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

interface RestTimerProps {
  durationSec: number;
  onComplete: () => void;
  onSkip: () => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({ durationSec, onComplete, onSkip }) => {
  const colors = useTheme();
  const { secondsLeft, progress } = useCountdown({
    durationSec,
    autoStart: true,
    onComplete,
  });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: colors.primary,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
    },
    label: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    timer: {
      fontSize: typography.sizes['3xl'],
      fontWeight: typography.weights.bold,
      color: colors.primary,
      marginBottom: spacing.sm,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    skipButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      backgroundColor: colors.primary + '20',
      borderRadius: borderRadius.sm,
    },
    skipText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Rest</Text>
        <Text style={styles.timer}>{formatCountdownTime(secondsLeft)}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <SkipForward size={20} color={colors.primary} />
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
};
