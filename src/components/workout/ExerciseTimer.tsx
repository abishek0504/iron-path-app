/**
 * Exercise Timer
 *
 * Manual start → 5s prep countdown → hold countdown with early complete.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, SkipForward } from 'lucide-react-native';
import { formatCountdownTime, useCountdown } from '../../hooks/useCountdown';
import { computeHeldDurationSec } from '../../lib/utils/workoutDuration';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export const EXERCISE_PREP_COUNTDOWN_SEC = 5;

type ExerciseTimerPhase = 'idle' | 'prep' | 'hold';

interface ExerciseTimerProps {
  durationSec: number;
  onComplete: (elapsedSec: number) => void;
  onStarted?: () => void;
}

export const ExerciseTimer: React.FC<ExerciseTimerProps> = ({
  durationSec,
  onComplete,
  onStarted,
}) => {
  const colors = useTheme();
  const [phase, setPhase] = useState<ExerciseTimerPhase>('idle');
  const completedRef = useRef(false);
  const holdStartedAtRef = useRef<number | null>(null);

  const finish = useCallback(
    (elapsedSec: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(elapsedSec);
    },
    [onComplete],
  );

  const holdCountdown = useCountdown({
    durationSec,
    autoStart: false,
    onComplete: () => finish(computeHeldDurationSec(durationSec, 0)),
  });

  const getHeldSec = useCallback(() => {
    const fromCountdown = computeHeldDurationSec(durationSec, holdCountdown.secondsLeft);
    if (holdStartedAtRef.current == null) return fromCountdown;
    const fromClock = Math.min(
      durationSec,
      Math.max(0, Math.round((Date.now() - holdStartedAtRef.current) / 1000)),
    );
    return Math.max(fromCountdown, fromClock);
  }, [durationSec, holdCountdown.secondsLeft]);

  const beginHold = useCallback(() => {
    if (__DEV__) {
      const { devLog } = require('../../lib/utils/logger');
      devLog('exercise-timer', { action: 'hold_start', durationSec });
    }
    holdStartedAtRef.current = Date.now();
    onStarted?.();
    setPhase('hold');
    holdCountdown.start();
  }, [durationSec, holdCountdown.start, onStarted]);

  const prepCountdown = useCountdown({
    durationSec: EXERCISE_PREP_COUNTDOWN_SEC,
    autoStart: false,
    onComplete: beginHold,
  });

  const handleStart = () => {
    if (__DEV__) {
      const { devLog } = require('../../lib/utils/logger');
      devLog('exercise-timer', {
        action: 'prep_start',
        prepSec: EXERCISE_PREP_COUNTDOWN_SEC,
        durationSec,
      });
    }
    setPhase('prep');
    prepCountdown.start();
  };

  const handleCompleteEarly = () => {
    const elapsed = getHeldSec();
    if (__DEV__) {
      const { devLog } = require('../../lib/utils/logger');
      devLog('exercise-timer', { action: 'complete_early', durationSec, elapsedSec: elapsed });
    }
    finish(elapsed);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          borderWidth: 2,
          borderColor: colors.primary,
          marginBottom: spacing.md,
        },
        idleContent: {
          alignItems: 'center',
        },
        label: {
          fontSize: typography.sizes.sm,
          color: colors.textSecondary,
          marginBottom: spacing.xs,
        },
        targetDuration: {
          fontSize: typography.sizes['3xl'],
          fontWeight: typography.weights.bold,
          color: colors.primary,
          marginBottom: spacing.md,
        },
        prepTimer: {
          fontSize: 72,
          fontWeight: typography.weights.bold,
          color: colors.primary,
          marginBottom: spacing.sm,
        },
        startButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: colors.primary,
          borderRadius: borderRadius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          width: '100%',
        },
        startText: {
          fontSize: typography.sizes.lg,
          fontWeight: typography.weights.semibold,
          color: colors.background,
        },
        runningRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        runningContent: {
          flex: 1,
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
        completeEarlyButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          padding: spacing.sm,
          backgroundColor: colors.primary + '20',
          borderRadius: borderRadius.sm,
          marginLeft: spacing.sm,
        },
        completeEarlyText: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
          color: colors.primary,
        },
      }),
    [colors],
  );

  if (phase === 'idle') {
    return (
      <View style={styles.container}>
        <View style={styles.idleContent}>
          <Text style={styles.label}>Hold for</Text>
          <Text style={styles.targetDuration}>{durationSec} sec</Text>
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Play size={20} color={colors.background} />
            <Text style={styles.startText}>Start</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'prep') {
    return (
      <View style={styles.container}>
        <View style={styles.idleContent}>
          <Text style={styles.label}>Get ready</Text>
          <Text style={styles.prepTimer}>{prepCountdown.secondsLeft}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.runningRow}>
        <View style={styles.runningContent}>
          <Text style={styles.label}>Hold</Text>
          <Text style={styles.timer}>{formatCountdownTime(holdCountdown.secondsLeft)}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${holdCountdown.progress * 100}%` }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.completeEarlyButton} onPress={handleCompleteEarly}>
          <SkipForward size={20} color={colors.primary} />
          <Text style={styles.completeEarlyText}>Complete early</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
