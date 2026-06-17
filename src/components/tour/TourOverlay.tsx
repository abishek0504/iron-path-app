import { useMemo } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { TourStep, TourTooltipPlacement } from '../../lib/onboarding/tourSteps';
import type { TourTargetMeasurement } from './TourTarget';

const SCRIM_OPACITY = 0.75;
const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 12;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_MARGIN = spacing.lg;
const ARROW_SIZE = 10;

interface TourOverlayProps {
  visible: boolean;
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  targetRect: TourTargetMeasurement | null;
  onNext: () => void;
  onSkip: () => void;
}

function buildScrimPath(
  width: number,
  height: number,
  hole: TourTargetMeasurement | null,
): string {
  const outer = `M0,0 H${width} V${height} H0 Z`;
  if (!hole) {
    return outer;
  }

  const x = hole.x - SPOTLIGHT_PADDING;
  const y = hole.y - SPOTLIGHT_PADDING;
  const w = hole.width + SPOTLIGHT_PADDING * 2;
  const h = hole.height + SPOTLIGHT_PADDING * 2;
  const r = Math.min(SPOTLIGHT_RADIUS, w / 2, h / 2);

  const holePath = [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h - r}`,
    `Q${x + w},${y + h} ${x + w - r},${y + h}`,
    `H${x + r}`,
    `Q${x},${y + h} ${x},${y + h - r}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    'Z',
  ].join(' ');

  return `${outer} ${holePath}`;
}

function resolvePlacement(
  placement: TourTooltipPlacement,
  targetRect: TourTargetMeasurement | null,
  tooltipHeight: number,
  screenHeight: number,
  topInset: number,
): 'top' | 'bottom' {
  if (placement === 'top' || placement === 'bottom') {
    return placement;
  }
  if (!targetRect) {
    return 'bottom';
  }

  const spaceAbove = targetRect.y - topInset;
  const spaceBelow = screenHeight - (targetRect.y + targetRect.height);
  if (spaceAbove >= tooltipHeight + ARROW_SIZE + TOOLTIP_MARGIN) {
    return 'top';
  }
  if (spaceBelow >= tooltipHeight + ARROW_SIZE + TOOLTIP_MARGIN) {
    return 'bottom';
  }
  return spaceAbove >= spaceBelow ? 'top' : 'bottom';
}

export function TourOverlay({
  visible,
  step,
  stepIndex,
  stepCount,
  targetRect,
  onNext,
  onSkip,
}: TourOverlayProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isLastStep = stepIndex >= stepCount - 1;

  const tooltipPlacement = resolvePlacement(
    step.placement,
    targetRect,
    160,
    screenHeight,
    insets.top,
  );

  const tooltipLeft = Math.max(
    TOOLTIP_MARGIN,
    Math.min(
      screenWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_MARGIN,
      targetRect
        ? targetRect.x + targetRect.width / 2 - TOOLTIP_MAX_WIDTH / 2
        : (screenWidth - TOOLTIP_MAX_WIDTH) / 2,
    ),
  );

  const tooltipTop =
    tooltipPlacement === 'top' && targetRect
      ? Math.max(insets.top + TOOLTIP_MARGIN, targetRect.y - 170)
      : targetRect
        ? Math.min(
            screenHeight - insets.bottom - 180,
            targetRect.y + targetRect.height + SPOTLIGHT_PADDING + ARROW_SIZE + spacing.sm,
          )
        : screenHeight / 2 - 80;

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
      ? targetRect.y - SPOTLIGHT_PADDING - ARROW_SIZE
      : targetRect
        ? targetRect.y + targetRect.height + SPOTLIGHT_PADDING
        : tooltipTop;

  const scrimPath = buildScrimPath(screenWidth, screenHeight, targetRect);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
          <Path
            d={scrimPath}
            fill={`rgba(0,0,0,${SCRIM_OPACITY})`}
            fillRule="evenodd"
          />
        </Svg>

        {targetRect ? (
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
          style={[
            styles.tooltip,
            {
              left: tooltipLeft,
              top: tooltipTop,
              maxWidth: TOOLTIP_MAX_WIDTH,
            },
          ]}
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
          <Pressable
            style={styles.nextButton}
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={isLastStep ? 'Finish tour' : 'Next step'}
          >
            <Text style={styles.nextButtonText}>{isLastStep ? 'Done' : 'Next'}</Text>
            {!isLastStep ? <ArrowRight size={18} color={colors.onPrimaryContrast} /> : null}
          </Pressable>
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
    nextButton: {
      marginTop: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    nextButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.onPrimaryContrast,
    },
  });
}
