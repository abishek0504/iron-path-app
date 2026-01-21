/**
 * Exercise Timer
 * 
 * For timed exercises (planks, holds, etc.)
 * Manual start with skip button
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, Pause, SkipForward } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';

interface ExerciseTimerProps {
  targetDurationSec: number;
  onComplete: (actualDurationSec: number) => void;
  onSkip: () => void;
}

export const ExerciseTimer: React.FC<ExerciseTimerProps> = ({ 
  targetDurationSec, 
  onComplete, 
  onSkip 
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    if (secondsElapsed >= targetDurationSec) {
      setIsRunning(false);
      onComplete(secondsElapsed);
      return;
    }

    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, secondsElapsed, targetDurationSec, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = Math.min(secondsElapsed / targetDurationSec, 1);
  const isOverTarget = secondsElapsed > targetDurationSec;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Exercise Duration</Text>
        <Text style={[styles.timer, isOverTarget && styles.timerOver]}>
          {formatTime(secondsElapsed)}
        </Text>
        <Text style={styles.targetText}>Target: {formatTime(targetDurationSec)}</Text>
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill, 
            { width: `${Math.min(progress * 100, 100)}%` },
            isOverTarget && styles.progressOver
          ]} />
        </View>
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={() => setIsRunning(!isRunning)}
        >
          {isRunning ? (
            <>
              <Pause size={20} color={colors.warning} />
              <Text style={[styles.controlText, { color: colors.warning }]}>Pause</Text>
            </>
          ) : (
            <>
              <Play size={20} color={colors.success} />
              <Text style={[styles.controlText, { color: colors.success }]}>Start</Text>
            </>
          )}
        </TouchableOpacity>
        
        {secondsElapsed > 0 && (
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <SkipForward size={20} color={colors.primary} />
            <Text style={styles.skipText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
    marginBottom: spacing.md,
  },
  content: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timer: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  timerOver: {
    color: colors.warning,
  },
  targetText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  progressOver: {
    backgroundColor: colors.warning,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  controlText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.sm,
  },
  skipText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
