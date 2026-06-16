import type { WeightLog } from '../supabase/queries/weight';

export const CHART_VIEWBOX_HEIGHT = 100;
export const CHART_PAD = { left: 12, right: 12, top: 12, bottom: 8 };
export const GRID_LINE_COUNT = 5;
export const DOT_RADIUS = 3.5;
export const MIN_Y_RANGE_IMPERIAL = 5;
export const MIN_Y_RANGE_METRIC = 2;
export const DEFAULT_CHART_WIDTH = 300;

export type WeightChartPoint = {
  x: number;
  y: number;
  weight: number;
  recordedAt: string;
};

export type WeightChartGridLine = {
  y1: number;
  y2: number;
  x2: number;
};

export type WeightChartData = {
  points: WeightChartPoint[];
  pathD: string;
  gridLines: WeightChartGridLine[];
  xLabelStart: string;
  xLabelEnd: string;
};

export type WeightMetrics = {
  current: number;
  first: number;
  lost: number;
  pct: number;
};

function toLocalDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** One point per calendar day (latest entry wins) so the chart never draws vertical segments. */
export function aggregateWeightLogsByDay(logs: WeightLog[]): WeightLog[] {
  const byDay = new Map<string, WeightLog>();

  for (const log of logs) {
    const dayKey = toLocalDayKey(log.recorded_at);
    const existing = byDay.get(dayKey);
    if (
      !existing ||
      new Date(log.recorded_at).getTime() >= new Date(existing.recorded_at).getTime()
    ) {
      byDay.set(dayKey, log);
    }
  }

  return Array.from(byDay.values()).sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
}

export function buildSmoothLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  const segments = [`M ${points[0].x},${points[0].y}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    segments.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }

  return segments.join(' ');
}

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = '2-digit';
  return d.toLocaleDateString('en-US', opts);
}

export function computeWeightMetrics(
  currentWeight: number | null,
  chartLogs: WeightLog[],
): WeightMetrics | null {
  const sorted = [...chartLogs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
  const current = currentWeight ?? (sorted.length ? sorted[sorted.length - 1].weight : null);
  const first = sorted.length ? sorted[0].weight : null;

  if (current == null || first == null) {
    return null;
  }

  const lost = first - current;
  const pct = first > 0 ? (lost / first) * 100 : 0;
  return { current, first, lost, pct };
}

export function buildWeightChartData(
  logs: WeightLog[],
  chartWidth: number,
  useImperial: boolean,
): WeightChartData | null {
  const sortedByDate = aggregateWeightLogsByDay(logs);
  if (sortedByDate.length === 0) return null;

  const weights = sortedByDate.map((l) => l.weight);
  let minW = Math.min(...weights);
  let maxW = Math.max(...weights);
  let range = maxW - minW;
  const minRange = useImperial ? MIN_Y_RANGE_IMPERIAL : MIN_Y_RANGE_METRIC;

  if (range < minRange) {
    const mid = (minW + maxW) / 2;
    minW = mid - minRange / 2;
    maxW = mid + minRange / 2;
    range = minRange;
  }

  const padding = range * 0.1;
  const chartMin = minW - padding;
  const chartMax = maxW + padding;
  const chartRange = chartMax - chartMin;

  const plotWidth = chartWidth - CHART_PAD.left - CHART_PAD.right;
  const h = CHART_VIEWBOX_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const tMin = new Date(sortedByDate[0].recorded_at).getTime();
  const tMax = new Date(sortedByDate[sortedByDate.length - 1].recorded_at).getTime();
  const tSpan = tMax - tMin;

  const points: WeightChartPoint[] = sortedByDate.map((log) => {
    const t = new Date(log.recorded_at).getTime();
    let x: number;
    if (sortedByDate.length === 1 || tSpan === 0) {
      x = CHART_PAD.left + plotWidth / 2;
    } else {
      x = CHART_PAD.left + ((t - tMin) / tSpan) * plotWidth;
    }
    const y = CHART_PAD.top + h - ((log.weight - chartMin) / chartRange) * h;
    return { x, y, weight: log.weight, recordedAt: log.recorded_at };
  });

  const pathD = buildSmoothLinePath(points);

  const gridLines: WeightChartGridLine[] = Array.from({ length: GRID_LINE_COUNT }, (_, i) => {
    const frac = i / (GRID_LINE_COUNT - 1);
    const value = chartMin + frac * chartRange;
    const y = CHART_PAD.top + h - ((value - chartMin) / chartRange) * h;
    return { y1: y, y2: y, x2: chartWidth - CHART_PAD.right };
  });

  return {
    points,
    pathD,
    gridLines,
    xLabelStart: formatChartDate(sortedByDate[0].recorded_at),
    xLabelEnd: formatChartDate(sortedByDate[sortedByDate.length - 1].recorded_at),
  };
}
