export interface PlanDayChipLayout {
  x: number;
  width: number;
}

export function layoutsFromWidths(
  widths: number[],
  leftPad: number,
  gap: number,
): PlanDayChipLayout[] {
  let x = leftPad;
  return widths.map((width) => {
    const item = { x, width };
    x += width + gap;
    return item;
  });
}

export function sidePaddingForViewport(
  viewportWidth: number,
  firstWidth: number,
  lastWidth: number,
): { left: number; right: number } {
  return {
    left: Math.max(0, viewportWidth / 2 - firstWidth / 2),
    right: Math.max(0, viewportWidth / 2 - lastWidth / 2),
  };
}

export function offsetToCenterIndex(
  layouts: PlanDayChipLayout[],
  index: number,
  viewportWidth: number,
): number {
  const item = layouts[index];
  if (!item || viewportWidth <= 0) return 0;
  return Math.max(0, item.x + item.width / 2 - viewportWidth / 2);
}

export function snapOffsetsForLayouts(
  layouts: PlanDayChipLayout[],
  viewportWidth: number,
): number[] {
  return layouts.map((_, index) => offsetToCenterIndex(layouts, index, viewportWidth));
}

export function nearestCenteredIndex(
  scrollX: number,
  layouts: PlanDayChipLayout[],
  viewportWidth: number,
): number {
  if (layouts.length === 0 || viewportWidth <= 0) return 0;
  const center = scrollX + viewportWidth / 2;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < layouts.length; index += 1) {
    const item = layouts[index];
    const distance = Math.abs(item.x + item.width / 2 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}
