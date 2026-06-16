import type { TrendPoint } from '../analytics/types';
import { buildSmoothLinePath } from './weightChart';

export const CHART_VIEWBOX_HEIGHT = 100;
export const CHART_PAD = { left: 12, right: 12, top: 12, bottom: 8 };
export const GRID_LINE_COUNT = 5;
export const DOT_RADIUS = 3.5;
export const DEFAULT_CHART_WIDTH = 300;

export type TrendChartPoint = {
  x: number;
  y: number;
  value: number;
  label: string;
};

export type TrendChartData = {
  points: TrendChartPoint[];
  pathD: string;
  gridLines: { y1: number; y2: number; x2: number }[];
  xLabelStart: string;
  xLabelEnd: string;
  minValue: number;
  maxValue: number;
};

export function buildTrendChartData(
  trend: TrendPoint[],
  chartWidth: number,
  minYRange = 1,
): TrendChartData | null {
  if (trend.length < 1) return null;

  const values = trend.map((p) => p.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  if (maxVal - minVal < minYRange) {
    const mid = (minVal + maxVal) / 2;
    minVal = mid - minYRange / 2;
    maxVal = mid + minYRange / 2;
  }

  const plotWidth = chartWidth - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_VIEWBOX_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const points: TrendChartPoint[] = trend.map((p, i) => {
    const x =
      trend.length === 1
        ? CHART_PAD.left + plotWidth / 2
        : CHART_PAD.left + (i / (trend.length - 1)) * plotWidth;
    const y =
      CHART_PAD.top + plotHeight - ((p.value - minVal) / (maxVal - minVal)) * plotHeight;
    return { x, y, value: p.value, label: p.label };
  });

  const gridLines = Array.from({ length: GRID_LINE_COUNT }, (_, i) => {
    const y = CHART_PAD.top + (i / (GRID_LINE_COUNT - 1)) * plotHeight;
    return { y1: y, y2: y, x2: chartWidth - CHART_PAD.right };
  });

  return {
    points,
    pathD: buildSmoothLinePath(points),
    gridLines,
    xLabelStart: trend[0]?.label ?? '',
    xLabelEnd: trend[trend.length - 1]?.label ?? '',
    minValue: minVal,
    maxValue: maxVal,
  };
}

export function formatTrendValue(value: number, unit?: string): string {
  if (value >= 10000) return `${Math.round(value / 1000)}k${unit ? ` ${unit}` : ''}`;
  if (Number.isInteger(value)) return `${value}${unit ? ` ${unit}` : ''}`;
  return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
}
