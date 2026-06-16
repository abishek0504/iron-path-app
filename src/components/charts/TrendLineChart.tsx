/**
 * Generic trend line chart for analytics (volume, RPE, sessions, etc.).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { TrendPoint } from '../../lib/analytics/types';
import {
  buildTrendChartData,
  CHART_PAD,
  CHART_VIEWBOX_HEIGHT,
  DEFAULT_CHART_WIDTH,
  DOT_RADIUS,
  formatTrendValue,
} from '../../lib/utils/trendChart';

export interface TrendLineChartProps {
  data: TrendPoint[];
  height?: number;
  valueUnit?: string;
  formatValue?: (value: number) => string;
  style?: ViewStyle;
}

const X_AXIS_HEIGHT = 24;

export function TrendLineChart({
  data,
  height = 140,
  valueUnit,
  formatValue,
  style,
}: TrendLineChartProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);

  const chartData = useMemo(
    () => buildTrendChartData(data, chartWidth),
    [data, chartWidth],
  );

  const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - chartWidth) > 1) {
      setChartWidth(width);
    }
  }, [chartWidth]);

  const gridStroke = colors.borderLight ?? colors.textMuted;
  const svgHeight = height - X_AXIS_HEIGHT;
  const fmt = formatValue ?? ((v: number) => formatTrendValue(v, valueUnit));

  if (!chartData) {
    return (
      <View style={[styles.empty, { height }, style]}>
        <Text style={styles.emptyText}>No data in this range</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { height }, style]}>
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
        {chartData.points.length > 0 ? (
          <Text style={styles.latestValue}>
            {fmt(chartData.points[chartData.points.length - 1].value)}
          </Text>
        ) : null}
        <Text style={styles.axisLabel}>{chartData.xLabelEnd}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
      gap: spacing.xs,
    },
    chartSvgContainer: {
      width: '100%',
    },
    xAxisLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: CHART_PAD.left,
    },
    axisLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
    },
    latestValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
  });
}
