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

const ACTION_BUTTON_MIN_HEIGHT = 44;
const REST_TIMER_FONT_SIZE = 72;

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
      width: '100%',
      alignSelf: 'stretch',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: colors.primary,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    label: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    timer: {
      fontSize: REST_TIMER_FONT_SIZE,
      fontWeight: typography.weights.bold,
      color: colors.primary,
      textAlign: 'center',
    },
    progressBar: {
      height: 4,
      width: '100%',
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    actions: {
      flexDirection: 'row',
      width: '100%',
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: ACTION_BUTTON_MIN_HEIGHT,
      paddingHorizontal: spacing.sm,
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
      <View>
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
            <Text style={styles.actionText}>+{REST_EXTEND_SEC}s</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.actionButton} onPress={onSkip}>
          <SkipForward size={20} color={colors.primary} />
          <Text style={styles.actionText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
