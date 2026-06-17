/**
 * Rest Timer
 *
 * Auto-starts after completing a set
 * Shows countdown with skip and optional +15s extend
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SkipForward, Plus } from 'lucide-react-native';
import { formatCountdownTime, useCountdownToEpoch } from '../../hooks/useCountdown';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { REST_EXTEND_SEC } from '../../lib/workout/restConstants';

interface RestTimerProps {
  endsAtEpoch: number;
  startedAtEpoch?: number;
  onComplete: () => void;
  onSkip: () => void;
  onExtend?: () => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({
  endsAtEpoch,
  startedAtEpoch,
  onComplete,
  onSkip,
  onExtend,
}) => {
  const colors = useTheme();
  const { secondsLeft, progress } = useCountdownToEpoch({
    endsAtEpoch,
    startedAtEpoch,
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
    },
    row: {
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
    actions: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginLeft: spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      backgroundColor: colors.primary + '20',
      borderRadius: borderRadius.sm,
    },
    actionText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.label}>Rest</Text>
          <Text style={styles.timer}>{formatCountdownTime(secondsLeft)}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
        <View style={styles.actions}>
          {onExtend ? (
            <TouchableOpacity style={styles.actionButton} onPress={onExtend}>
              <Plus size={18} color={colors.primary} />
              <Text style={styles.actionText}>{REST_EXTEND_SEC}s</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.actionButton} onPress={onSkip}>
            <SkipForward size={20} color={colors.primary} />
            <Text style={styles.actionText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
