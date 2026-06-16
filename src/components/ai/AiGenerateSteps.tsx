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
const RING_PULSE_HALF_MS = 300;
const SCALE_PULSE_HALF_MS = 600;
const CONNECTOR_FILL_MS = 800;

const CONNECTOR_MIN_HEIGHT = AI_LOADING_STEP_ROW_HEIGHT - ICON_SIZE - 8;

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
  const ringOpacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!isActive || reduceMotion) {
      ringOpacity.value = 1;
      scale.value = 1;
      return;
    }

    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: RING_PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: RING_PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: SCALE_PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: SCALE_PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [isActive, ringOpacity, reduceMotion, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { ringStyle, containerStyle };
}

function StepConnector({
  index,
  activeIndex,
  reduceMotion,
  colors,
  styles,
}: {
  index: number;
  activeIndex: number;
  reduceMotion: boolean;
  colors: ThemeColors;
  styles: StepStyles;
}) {
  const fillProgress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      fillProgress.value = index < activeIndex ? 1 : 0;
      return;
    }

    if (index < activeIndex - 1) {
      fillProgress.value = 1;
      return;
    }

    if (index === activeIndex - 1) {
      fillProgress.value = 0;
      fillProgress.value = withTiming(1, {
        duration: CONNECTOR_FILL_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    fillProgress.value = 0;
  }, [activeIndex, fillProgress, index, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    height: fillProgress.value * CONNECTOR_MIN_HEIGHT,
  }));

  return (
    <View style={styles.connectorTrack}>
      <View style={[styles.connectorEmpty, { backgroundColor: colors.border }]} />
      <Animated.View style={[styles.connectorFill, fillStyle, { backgroundColor: colors.primary }]} />
    </View>
  );
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
  const { ringStyle, containerStyle } = useActivePulse(status === 'active', reduceMotion);

  if (status === 'done') {
    return (
      <View style={[styles.iconBase, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Check size={14} color={colors.onPrimaryContrast} strokeWidth={3} />
      </View>
    );
  }

  if (status === 'active') {
    return (
      <Animated.View style={containerStyle}>
        <View style={[styles.iconBase, { borderColor: colors.primary }]}>
          <Animated.View style={[styles.activeRing, ringStyle, { borderColor: colors.primary }]} />
          <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
        </View>
      </Animated.View>
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
        {!isLast ? (
          <StepConnector
            index={index}
            activeIndex={activeIndex}
            reduceMotion={reduceMotion}
            colors={colors}
            styles={styles}
          />
        ) : null}
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
      alignSelf: 'stretch',
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
    connectorTrack: {
      width: 2,
      flex: 1,
      minHeight: CONNECTOR_MIN_HEIGHT,
      marginTop: 4,
      marginBottom: 4,
      borderRadius: 1,
      overflow: 'hidden',
      position: 'relative',
    },
    connectorEmpty: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
    },
    connectorFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
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
