/**
 * Domino entrance + timed progress checklist for the AI generate loading screen.
 */

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import {
  AI_LOADING_STEP_ENTRANCE_SLIDE_MS,
  AI_LOADING_STEP_ENTRANCE_STAGGER_MS,
  AI_LOADING_STEP_INTERVAL_MS,
  AI_LOADING_STEP_ROW_HEIGHT,
  AI_LOADING_STEPS,
  getAiLoadingEntranceDurationMs,
} from '../../lib/ai/generateAiLoadingSteps';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

const ICON_SIZE = 22;
const PULSE_HALF_MS = 900;

type StepStatus = 'done' | 'active' | 'pending';
type StepStyles = ReturnType<typeof createStyles>;

function getStepStatus(index: number, activeIndex: number): StepStatus {
  if (index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return 'pending';
}

function useEntranceMotion(index: number, reduceMotion: boolean) {
  const translateY = useSharedValue(index === 0 || reduceMotion ? 0 : -AI_LOADING_STEP_ROW_HEIGHT);
  const opacity = useSharedValue(index === 0 || reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion || index === 0) {
      translateY.value = 0;
      opacity.value = 1;
      return;
    }

    const delay = index * AI_LOADING_STEP_ENTRANCE_STAGGER_MS;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: AI_LOADING_STEP_ENTRANCE_SLIDE_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [index, opacity, reduceMotion, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

function useActivePulse(isActive: boolean, reduceMotion: boolean) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isActive || reduceMotion) {
      pulse.value = 1;
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [isActive, pulse, reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));
}

function StepIcon({
  status,
  colors,
  styles,
  reduceMotion,
}: {
  status: StepStatus;
  colors: ThemeColors;
  styles: StepStyles;
  reduceMotion: boolean;
}) {
  const pulseStyle = useActivePulse(status === 'active', reduceMotion);

  if (status === 'done') {
    return (
      <View style={[styles.iconBase, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Check size={14} color={colors.onPrimaryContrast} strokeWidth={3} />
      </View>
    );
  }

  if (status === 'active') {
    return (
      <View style={[styles.iconBase, { borderColor: colors.primary }]}>
        <Animated.View style={[styles.activeRing, pulseStyle, { borderColor: colors.primary }]} />
        <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
      </View>
    );
  }

  return (
    <View style={[styles.iconBase, { borderColor: colors.borderLight, backgroundColor: 'transparent' }]} />
  );
}

function StepRow({
  label,
  index,
  activeIndex,
  reduceMotion,
  isLast,
  colors,
  styles,
}: {
  label: string;
  index: number;
  activeIndex: number;
  reduceMotion: boolean;
  isLast: boolean;
  colors: ThemeColors;
  styles: StepStyles;
}) {
  const status = getStepStatus(index, activeIndex);
  const rowStyle = useEntranceMotion(index, reduceMotion);

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <View style={styles.iconColumn}>
        <StepIcon status={status} colors={colors} styles={styles} reduceMotion={reduceMotion} />
        {!isLast ? <View style={[styles.connector, { backgroundColor: colors.border }]} /> : null}
      </View>
      <Text
        style={[
          styles.label,
          status === 'done' && { color: colors.textSecondary },
          status === 'active' && { color: colors.textPrimary, fontWeight: typography.weights.medium },
          status === 'pending' && { color: colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export interface AiGenerateStepsProps {
  stepIntervalMs?: number;
}

export function AiGenerateSteps({ stepIntervalMs = AI_LOADING_STEP_INTERVAL_MS }: AiGenerateStepsProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(), []);
  const steps = AI_LOADING_STEPS;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReduceMotion(enabled);
      if (enabled) {
        setEntranceComplete(true);
        setActiveIndex(steps.length - 1);
      }
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
      if (enabled) {
        setEntranceComplete(true);
        setActiveIndex(steps.length - 1);
      }
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [steps.length]);

  useEffect(() => {
    if (reduceMotion) return;

    const duration = getAiLoadingEntranceDurationMs(steps.length);
    const id = setTimeout(() => setEntranceComplete(true), duration);
    return () => clearTimeout(id);
  }, [reduceMotion, steps.length]);

  useEffect(() => {
    if (!entranceComplete || reduceMotion) return;

    const id = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev >= steps.length - 1) return prev;
        return prev + 1;
      });
    }, stepIntervalMs);

    return () => clearInterval(id);
  }, [entranceComplete, reduceMotion, stepIntervalMs, steps.length]);

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Generating workout, step ${activeIndex + 1} of ${steps.length}`}
      accessibilityRole="progressbar"
    >
      {steps.map((label, index) => (
        <StepRow
          key={label}
          label={label}
          index={index}
          activeIndex={activeIndex}
          reduceMotion={reduceMotion}
          isLast={index === steps.length - 1}
          colors={colors}
          styles={styles}
        />
      ))}
    </View>
  );
}

function createStyles() {
  const iconBase: ViewStyle = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: 340,
      paddingHorizontal: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      minHeight: AI_LOADING_STEP_ROW_HEIGHT,
      gap: spacing.md,
    },
    iconColumn: {
      width: ICON_SIZE,
      alignItems: 'center',
    },
    iconBase,
    activeRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: ICON_SIZE / 2,
      borderWidth: 2,
    },
    activeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    connector: {
      width: 2,
      height: AI_LOADING_STEP_ROW_HEIGHT - ICON_SIZE - 8,
      marginTop: 4,
      marginBottom: 4,
      borderRadius: 1,
    },
    label: {
      flex: 1,
      fontSize: typography.sizes.md,
      lineHeight: 22,
      paddingTop: 1,
    },
  });
}
