import type { DateRange, TrendGranularity, TrendPoint } from './types';

export const LBS_PER_KG = 2.20462;

/** Local calendar date key YYYY-MM-DD from ISO timestamp. */
export function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function getRangeForPreset(preset: '4w' | '12w' | '6mo' | 'ytd'): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);

  switch (preset) {
    case '4w':
      start.setDate(start.getDate() - 27);
      break;
    case '12w':
      start.setDate(start.getDate() - 83);
      break;
    case '6mo':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'ytd':
      start.setMonth(0, 1);
      break;
  }
  return { start, end };
}

/** ISO week key: YYYY-Www (Monday-based week). */
export function toWeekKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const weekNum = Math.ceil(
    ((monday.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
  );
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function toMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function bucketKeyForDate(iso: string, granularity: TrendGranularity): string {
  switch (granularity) {
    case 'day':
      return toLocalDateKey(iso);
    case 'week':
      return toWeekKey(iso);
    case 'month':
      return toMonthKey(iso);
  }
}

export function formatBucketLabel(bucketKey: string, granularity: TrendGranularity): string {
  if (granularity === 'week') {
    return bucketKey.replace('-W', ' W');
  }
  if (granularity === 'month') {
    const [y, m] = bucketKey.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(m) - 1]} ${y?.slice(2)}`;
  }
  const d = parseDateKey(bucketKey);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Sum numeric values into time buckets, returning sorted trend points. */
export function aggregateIntoBuckets(
  items: { dateIso: string; value: number }[],
  granularity: TrendGranularity,
): TrendPoint[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = bucketKeyForDate(item.dateIso, granularity);
    map.set(key, (map.get(key) ?? 0) + item.value);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketKey, value]) => ({
      bucketKey,
      label: formatBucketLabel(bucketKey, granularity),
      value,
    }));
}
