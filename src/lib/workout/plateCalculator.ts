import { weightUnitLabel } from '../utils/units';

export const IMPERIAL_BAR_LB = 45;
export const METRIC_BAR_KG = 20;

export const IMPERIAL_PLATES_LB = [45, 35, 25, 10, 5, 2.5] as const;
export const METRIC_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateCount = { plate: number; count: number };

export interface PlateBreakdown {
  bar: number;
  unit: 'lbs' | 'kg';
  perSide: PlateCount[];
  leftoverPerSide: number;
  target: number;
}

export function barWeight(useImperial: boolean): number {
  return useImperial ? IMPERIAL_BAR_LB : METRIC_BAR_KG;
}

export function availablePlates(useImperial: boolean): readonly number[] {
  return useImperial ? IMPERIAL_PLATES_LB : METRIC_PLATES_KG;
}

/** Greedy per-side load. leftoverPerSide > 0 when the target is not plateable. */
export function calculatePlateBreakdown(target: number, useImperial: boolean): PlateBreakdown | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  const bar = barWeight(useImperial);
  const unit = weightUnitLabel(useImperial);
  if (target < bar) {
    return { bar, unit, perSide: [], leftoverPerSide: (target - bar) / 2, target };
  }

  let remaining = (target - bar) / 2;
  const perSide: PlateCount[] = [];
  for (const plate of availablePlates(useImperial)) {
    const count = Math.floor((remaining + 1e-9) / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      remaining -= count * plate;
    }
  }
  const leftoverPerSide = Math.abs(remaining) < 0.001 ? 0 : Math.round(remaining * 1000) / 1000;
  return { bar, unit, perSide, leftoverPerSide, target };
}

/** Heaviest-first plates for one side, one entry per plate (load order). */
export function expandPlatesPerSide(perSide: PlateCount[]): number[] {
  return perSide.flatMap(({ plate, count }) => Array.from({ length: count }, () => plate));
}

export function formatPlateLine(breakdown: PlateBreakdown): string {
  if (breakdown.perSide.length === 0 && breakdown.leftoverPerSide <= 0) {
    return `Bar only (${breakdown.bar} ${breakdown.unit})`;
  }
  const plates = breakdown.perSide
    .map((p) => `${p.count}×${p.plate}`)
    .join(' + ');
  const leftover =
    breakdown.leftoverPerSide > 0
      ? ` · leftover ${breakdown.leftoverPerSide} ${breakdown.unit}/side`
      : '';
  return `${plates} per side on ${breakdown.bar} ${breakdown.unit} bar${leftover}`;
}
