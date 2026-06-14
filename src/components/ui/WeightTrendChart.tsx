/**
 * Reusable weight trend line chart (smooth curve, daily aggregation).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { WeightLog } from '../../lib/supabase/queries/weight';
import {
  buildWeightChartData,
  CHART_PAD,
  CHART_VIEWBOX_HEIGHT,
  DEFAULT_CHART_WIDTH,
  DOT_RADIUS,
} from '../../lib/utils/weightChart';

export interface WeightTrendChartProps {
  logs: WeightLog[];
  useImperial: boolean;
  height?: number;
  animated?: boolean;
  style?: ViewStyle;
}

const X_AXIS_HEIGHT = 24;

export function WeightTrendChart({
  logs,
  useImperial,
  height = 160,
  animated = false,
  style,
}: WeightTrendChartProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);

  const chartSlideY = useSharedValue(height);
  const chartOpacity = useSharedValue(animated ? 0 : 1);
  const hasAnimatedRef = useRef(false);

  const chartData = useMemo(
    () => buildWeightChartData(logs, chartWidth, useImperial),
    [logs, chartWidth, useImperial],
  );

  useEffect(() => {
    if (!animated || logs.length < 1 || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;
    chartSlideY.value = height;
    chartOpacity.value = 0;
    chartSlideY.value = withDelay(150, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    chartOpacity.value = withDelay(150, withTiming(1, { duration: 350 }));
  }, [animated, logs.length, height, chartSlideY, chartOpacity]);

  const chartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: chartSlideY.value }],
    opacity: chartOpacity.value,
  }));

  const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - chartWidth) > 1) {
      setChartWidth(width);
    }
  }, [chartWidth]);

  const gridStroke = colors.borderLight ?? colors.textMuted;
  const svgHeight = height - X_AXIS_HEIGHT;

  if (!chartData) {
    return null;
  }

  const chartBody = (
    <>
      <View style={styles.chartSvgContainer} onLayout={handleChartLayout}>
        <Svg
          width={chartWidth}
          height={svgHeight}
          viewBox={`0 0 ${chartWidth} ${CHART_VIEWBOX_HEIGHT}`}
        >
          <G>
            {chartData.gridLines.map((line, i) => (
              <Line
                key={`grid-${i}`}
                x1={CHART_PAD.left}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={gridStroke}
                strokeWidth={1}
                opacity={0.35}
              />
            ))}
            {chartData.pathD ? (
              <Path
                d={chartData.pathD}
                fill="none"
                stroke={colors.primary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {chartData.points.map((point, i) => (
              <Circle
                key={`dot-${i}`}
                cx={point.x}
                cy={point.y}
                r={DOT_RADIUS}
                fill={colors.primary}
              />
            ))}
          </G>
        </Svg>
      </View>
      <View style={styles.xAxisLabels}>
        <Text style={styles.axisLabel}>{chartData.xLabelStart}</Text>
        <Text style={styles.axisLabel}>{chartData.xLabelEnd}</Text>
      </View>
    </>
  );

  return (
    <View style={[styles.wrapper, { height }, style]}>
      {animated ? (
        <Animated.View style={[styles.inner, chartAnimatedStyle]}>{chartBody}</Animated.View>
      ) : (
        <View style={styles.inner}>{chartBody}</View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
    },
    inner: {
      gap: spacing.xs,
    },
    chartSvgContainer: {
      width: '100%',
    },
    xAxisLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: CHART_PAD.left,
    },
    axisLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
    },
  });
}
