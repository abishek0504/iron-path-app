import { describe, expect, it } from 'vitest';
import {
  layoutsFromWidths,
  nearestCenteredIndex,
  offsetToCenterIndex,
  sidePaddingForViewport,
  snapOffsetsForLayouts,
} from './planDayScroller';

const LAYOUTS = layoutsFromWidths([80, 88, 100], 155, 8);

describe('planDayScroller', () => {
  it('pads first and last chips so they can sit on the viewport center', () => {
    expect(sidePaddingForViewport(390, 80, 100)).toEqual({ left: 155, right: 145 });
  });

  it('clamps negative padding to zero', () => {
    expect(sidePaddingForViewport(40, 80, 100)).toEqual({ left: 0, right: 0 });
  });

  it('scrolls so the selected chip center matches the viewport center', () => {
    expect(offsetToCenterIndex(LAYOUTS, 1, 390)).toBe(92);
    expect(offsetToCenterIndex(LAYOUTS, 0, 390)).toBe(0);
  });

  it('builds snap offsets for every chip', () => {
    expect(snapOffsetsForLayouts(LAYOUTS, 390)).toEqual([0, 92, 194]);
  });

  it('picks the chip whose center is nearest the viewport center', () => {
    expect(nearestCenteredIndex(0, LAYOUTS, 390)).toBe(0);
    expect(nearestCenteredIndex(92, LAYOUTS, 390)).toBe(1);
    expect(nearestCenteredIndex(194, LAYOUTS, 390)).toBe(2);
  });

  it('stacks chip layouts with left pad and gap', () => {
    expect(layoutsFromWidths([80, 88], 155, 8)).toEqual([
      { x: 155, width: 80 },
      { x: 243, width: 88 },
    ]);
  });

  it('returns 0 for empty layouts', () => {
    expect(nearestCenteredIndex(20, [], 390)).toBe(0);
    expect(offsetToCenterIndex([], 0, 390)).toBe(0);
  });
});
