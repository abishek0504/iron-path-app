import { describe, expect, it } from 'vitest';
import { calculatePlateBreakdown, formatPlateLine } from './plateCalculator';

describe('calculatePlateBreakdown', () => {
  it('returns null for invalid targets', () => {
    expect(calculatePlateBreakdown(0, true)).toBeNull();
    expect(calculatePlateBreakdown(-10, true)).toBeNull();
  });

  it('loads a standard 135 lb barbell', () => {
    const result = calculatePlateBreakdown(135, true);
    expect(result?.bar).toBe(45);
    expect(result?.perSide).toEqual([{ plate: 45, count: 1 }]);
    expect(result?.leftoverPerSide).toBe(0);
  });

  it('reports leftover when the load is not plateable', () => {
    const result = calculatePlateBreakdown(46, true);
    expect(result?.leftoverPerSide).toBeGreaterThan(0);
  });

  it('formats a plate line', () => {
    const result = calculatePlateBreakdown(135, true);
    expect(result && formatPlateLine(result)).toContain('1×45');
  });
});
