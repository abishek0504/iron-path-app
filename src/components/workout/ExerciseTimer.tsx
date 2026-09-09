/**
 * Exercise Timer
 *
 * Manual start → 5s prep countdown → hold countdown with early complete.
 * Both countdowns are wall-clock so backgrounding does not drift.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, SkipForward } from 'lucide-react-native';
import { formatCountdownTime, useCountdownToEpoch } from '../../hooks/useCountdown';
import { computeHeldDurationSec } from '../../lib/utils/workoutDuration';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export const EXERCISE_PREP_COUNTDOWN_SEC = 5;

type ExerciseTimerPhase = 'idle' | 'prep' | 'hold';

interface ExerciseTimerProps {
  durationSec: number;
  prepEndsAtEpoch?: number | null;
  holdEndsAtEpoch?: number | null;
  onComplete: (elapsedSec: number) => void;
  onPrepStarted?: (endsAtEpoch: number) => void;
  onStarted?: (endsAtEpoch: number) => void;
}

export const ExerciseTimer: React.FC<ExerciseTimerProps> = ({
  durationSec,
  prepEndsAtEpoch = null,
  holdEndsAtEpoch = null,
  onComplete,
  onPrepStarted,
  onStarted,
}) => {
  const colors = useTheme();
  const [phase, setPhase] = useState<ExerciseTimerPhase>('idle');
  const [prepEndsAt, setPrepEndsAt] = useState<number | null>(null);
  const [holdEndsAt, setHoldEndsAt] = useState<number | null>(null);
  const completedRef = useRef(false);
  const holdStartedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<ExerciseTimerPhase>('idle');
  phaseRef.current = phase;

  const finish = useCallback(
    (elapsedSec: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(elapsedSec);
    },
    [onComplete],
  );

  const beginHold = useCallback(
    (endsAt: number) => {
      if (__DEV__) {
        const { devLog } = require('../../lib/utils/logger');
        devLog('exercise-timer', { action: 'hold_start', durationSec, endsAt });
      }
      holdStartedAtRef.current = Date.now();
      setHoldEndsAt(endsAt);
      setPhase('hold');
      onStarted?.(endsAt);
    },
    [durationSec, onStarted],
  );

  useEffect(() => {
    const now = Date.now() / 1000;
    if (holdEndsAtEpoch != null && holdEndsAtEpoch > now) {
      completedRef.current = false;
      holdStartedAtRef.current = (holdEndsAtEpoch - durationSec) * 1000;
      setHoldEndsAt(holdEndsAtEpoch);
      setPhase('hold');
      return;
    }
    if (prepEndsAtEpoch != null && prepEndsAtEpoch > now) {
      completedRef.current = false;
      setPrepEndsAt(prepEndsAtEpoch);
      setPhase('prep');
    }
  }, [prepEndsAtEpoch, holdEndsAtEpoch, durationSec]);

  const holdCountdown = useCountdownToEpoch({
    endsAtEpoch: holdEndsAt ?? Number.POSITIVE_INFINITY,
    startedAtEpoch: holdEndsAt != null ? holdEndsAt - durationSec : undefined,
    onComplete: () => {
      if (phaseRef.current !== 'hold') return;
      finish(computeHeldDurationSec(durationSec, 0));
    },
  });

  const getHeldSec = useCallback(() => {
    const remaining = holdEndsAt != null
      ? Math.max(0, Math.ceil(holdEndsAt - Date.now() / 1000))
      : holdCountdown.secondsLeft;
    const fromCountdown = computeHeldDurationSec(durationSec, remaining);
    if (holdStartedAtRef.current == null) return fromCountdown;
    const fromClock = Math.min(
      durationSec,
      Math.max(0, Math.round((Date.now() - holdStartedAtRef.current) / 1000)),
    );
    return Math.max(fromCountdown, fromClock);
  }, [durationSec, holdCountdown.secondsLeft, holdEndsAt]);

  const prepCountdown = useCountdownToEpoch({
    endsAtEpoch: prepEndsAt ?? Number.POSITIVE_INFINITY,
    startedAtEpoch: prepEndsAt != null ? prepEndsAt - EXERCISE_PREP_COUNTDOWN_SEC : undefined,
    onComplete: () => {
      if (phaseRef.current !== 'prep') return;
      const endsAt = Date.now() / 1000 + durationSec;
      beginHold(endsAt);
    },
  });

  const handleStart = () => {
    const endsAt = Date.now() / 1000 + EXERCISE_PREP_COUNTDOWN_SEC;
    if (__DEV__) {
      const { devLog } = require('../../lib/utils/logger');
      devLog('exercise-timer', {
        action: 'prep_start',
        prepSec: EXERCISE_PREP_COUNTDOWN_SEC,
        durationSec,
        endsAt,
      });
    }
    completedRef.current = false;
    setPrepEndsAt(endsAt);
    setPhase('prep');
    onPrepStarted?.(endsAt);
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
          minHeight: 44,
        },
        startText: {
          fontSize: typography.sizes.lg,
          fontWeight: typography.weights.semibold,
          color: colors.onPrimaryContrast,
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
          minHeight: 44,
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
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start hold timer"
          >
            <Play size={20} color={colors.onPrimaryContrast} />
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
        <TouchableOpacity
          style={styles.completeEarlyButton}
          onPress={handleCompleteEarly}
          accessibilityRole="button"
          accessibilityLabel="Complete hold early"
        >
          <SkipForward size={20} color={colors.primary} />
          <Text style={styles.completeEarlyText}>Complete early</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
