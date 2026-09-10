import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { borderRadius, spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { TourStep, TourTooltipPlacement } from '../../lib/onboarding/tourSteps';
import type { TourTargetMeasurement } from './TourTarget';

const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_MARGIN = spacing.lg;
const ARROW_SIZE = 10;
const HOLE_DURATION_MS = 300;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function buildScrimPath(
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  showHole: boolean,
): string {
  'worklet';
  const outer = `M0,0 H${width} V${height} H0 Z`;
  if (!showHole || w <= 0 || h <= 0) {
    return outer;
  }

  const hx = x - SPOTLIGHT_PADDING;
  const hy = y - SPOTLIGHT_PADDING;
  const hw = w + SPOTLIGHT_PADDING * 2;
  const hh = h + SPOTLIGHT_PADDING * 2;
  const r = Math.min(SPOTLIGHT_RADIUS, hw / 2, hh / 2);

  return [
    outer,
    `M${hx + r},${hy}`,
    `H${hx + hw - r}`,
    `Q${hx + hw},${hy} ${hx + hw},${hy + r}`,
    `V${hy + hh - r}`,
    `Q${hx + hw},${hy + hh} ${hx + hw - r},${hy + hh}`,
    `H${hx + r}`,
    `Q${hx},${hy + hh} ${hx},${hy + hh - r}`,
    `V${hy + r}`,
    `Q${hx},${hy} ${hx + r},${hy}`,
    'Z',
  ].join(' ');
}

function resolvePlacement(
  placement: TourTooltipPlacement,
  targetRect: TourTargetMeasurement | null,
  tooltipHeight: number,
  screenHeight: number,
  topInset: number,
  bottomInset: number,
): 'top' | 'bottom' {
  if (!targetRect) {
    return 'bottom';
  }

  const spaceAbove = targetRect.y - topInset - TOOLTIP_MARGIN;
  const spaceBelow =
    screenHeight - bottomInset - TOOLTIP_MARGIN - (targetRect.y + targetRect.height);
  const needed = tooltipHeight + ARROW_SIZE + spacing.sm;

  if (placement === 'top') {
    if (spaceAbove >= needed || spaceAbove >= spaceBelow) return 'top';
    return 'bottom';
  }
  if (placement === 'bottom') {
    if (spaceBelow >= needed || spaceBelow >= spaceAbove) return 'bottom';
    return 'top';
  }

  if (spaceBelow >= needed) return 'bottom';
  if (spaceAbove >= needed) return 'top';
  return spaceAbove >= spaceBelow ? 'top' : 'bottom';
}

interface TourOverlayProps {
  visible: boolean;
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  targetRect: TourTargetMeasurement | null;
  tooltipVisible: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function TourOverlay({
  visible,
  step,
  stepIndex,
  stepCount,
  targetRect,
  tooltipVisible,
  onNext,
  onBack,
  onSkip,
}: TourOverlayProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLastStep = stepIndex >= stepCount - 1;
  const canGoBack = stepIndex > 0;
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const holeX = useSharedValue(0);
  const holeY = useSharedValue(0);
  const holeW = useSharedValue(0);
  const holeH = useSharedValue(0);
  const holeOpacity = useSharedValue(0);
  const screenW = useSharedValue(screenWidth);
  const screenH = useSharedValue(screenHeight);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    screenW.value = screenWidth;
    screenH.value = screenHeight;
  }, [screenHeight, screenW, screenH, screenWidth]);

  useEffect(() => {
    const duration = reduceMotion ? 0 : HOLE_DURATION_MS;
    const timing = { duration, easing: Easing.out(Easing.cubic) };
    if (!targetRect) {
      holeOpacity.value = withTiming(0, timing);
      return;
    }
    holeX.value = withTiming(targetRect.x, timing);
    holeY.value = withTiming(targetRect.y, timing);
    holeW.value = withTiming(targetRect.width, timing);
    holeH.value = withTiming(targetRect.height, timing);
    holeOpacity.value = withTiming(1, timing);
  }, [holeH, holeOpacity, holeW, holeX, holeY, reduceMotion, targetRect]);

  const animatedProps = useAnimatedProps(() => ({
    d: buildScrimPath(
      screenW.value,
      screenH.value,
      holeX.value,
      holeY.value,
      holeW.value,
      holeH.value,
      holeOpacity.value > 0.05,
    ),
  }));

  const handleTooltipLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0 && Math.abs(nextHeight - tooltipHeight) > 1) {
      setTooltipHeight(nextHeight);
    }
  };

  const tooltipPlacement = resolvePlacement(
    step.placement,
    targetRect,
    tooltipHeight || 160,
    screenHeight,
    insets.top,
    insets.bottom,
  );

  const measuredHeight = tooltipHeight || 160;
  const minTop = insets.top + TOOLTIP_MARGIN;
  const maxTop = screenHeight - insets.bottom - TOOLTIP_MARGIN - measuredHeight;

  const tooltipLeft = Math.max(
    TOOLTIP_MARGIN,
    Math.min(
      screenWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_MARGIN,
      targetRect
        ? targetRect.x + targetRect.width / 2 - TOOLTIP_MAX_WIDTH / 2
        : (screenWidth - TOOLTIP_MAX_WIDTH) / 2,
    ),
  );

  let tooltipTop: number;
  if (!targetRect) {
    tooltipTop = Math.max(minTop, Math.min(maxTop, screenHeight / 2 - measuredHeight / 2));
  } else if (tooltipPlacement === 'top') {
    const preferred =
      targetRect.y - SPOTLIGHT_PADDING - ARROW_SIZE - spacing.sm - measuredHeight;
    tooltipTop = Math.max(minTop, Math.min(maxTop, preferred));
  } else {
    const preferred =
      targetRect.y + targetRect.height + SPOTLIGHT_PADDING + ARROW_SIZE + spacing.sm;
    tooltipTop = Math.max(minTop, Math.min(maxTop, preferred));
  }

  const arrowLeft = targetRect
    ? Math.max(
        tooltipLeft + spacing.lg,
        Math.min(
          tooltipLeft + TOOLTIP_MAX_WIDTH - spacing.lg,
          targetRect.x + targetRect.width / 2,
        ),
      )
    : tooltipLeft + TOOLTIP_MAX_WIDTH / 2;

  const arrowTop =
    tooltipPlacement === 'top' && targetRect
      ? Math.max(
          insets.top,
          Math.min(
            targetRect.y - SPOTLIGHT_PADDING - ARROW_SIZE,
            tooltipTop + measuredHeight,
          ),
        )
      : targetRect
        ? Math.min(
            screenHeight - insets.bottom - ARROW_SIZE,
            Math.max(targetRect.y + targetRect.height + SPOTLIGHT_PADDING, tooltipTop - ARROW_SIZE),
          )
        : tooltipTop;

  const showTooltip = tooltipVisible;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={canGoBack ? onBack : onSkip}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <View style={StyleSheet.absoluteFill} pointerEvents="auto" />
        <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedPath
            animatedProps={animatedProps}
            fill={colors.overlayScrim}
            fillRule="evenodd"
          />
        </Svg>

        {targetRect && showTooltip ? (
          <View
            pointerEvents="none"
            style={[
              styles.arrow,
              tooltipPlacement === 'top'
                ? {
                    left: arrowLeft - ARROW_SIZE,
                    top: arrowTop,
                    borderTopWidth: ARROW_SIZE,
                    borderLeftWidth: ARROW_SIZE,
                    borderRightWidth: ARROW_SIZE,
                    borderBottomWidth: 0,
                    borderTopColor: colors.card,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                  }
                : {
                    left: arrowLeft - ARROW_SIZE,
                    top: arrowTop,
                    borderBottomWidth: ARROW_SIZE,
                    borderLeftWidth: ARROW_SIZE,
                    borderRightWidth: ARROW_SIZE,
                    borderTopWidth: 0,
                    borderBottomColor: colors.card,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                  },
            ]}
          />
        ) : null}

        <View
          key={step.id}
          style={[
            styles.tooltip,
            {
              left: tooltipLeft,
              top: tooltipTop,
              maxWidth: TOOLTIP_MAX_WIDTH,
              opacity: showTooltip ? 1 : 0,
            },
          ]}
          onLayout={handleTooltipLayout}
          pointerEvents={showTooltip ? 'auto' : 'none'}
          accessibilityRole="alert"
          accessibilityLabel={`${step.title}. ${step.body}`}
        >
          <View style={styles.tooltipHeader}>
            <Text style={styles.stepCounter}>
              {stepIndex + 1} of {stepCount}
            </Text>
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
              hitSlop={8}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.actions}>
            {canGoBack ? (
              <Button
                label="Back"
                variant="secondary"
                size="sm"
                onPress={onBack}
                style={styles.actionButton}
              />
            ) : null}
            <Button
              label={isLastStep ? 'Done' : 'Next'}
              size="sm"
              onPress={onNext}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    arrow: {
      position: 'absolute',
      width: 0,
      height: 0,
    },
    tooltip: {
      position: 'absolute',
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    tooltipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepCounter: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    skipText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
    },
    body: {
      fontSize: typography.sizes.sm,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    actions: {
      marginTop: spacing.xs,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    actionButton: {
      minWidth: 88,
      borderRadius: borderRadius.md,
    },
  });
}
