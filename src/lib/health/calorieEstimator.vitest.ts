import { describe, it, expect } from 'vitest';
import { estimateActiveEnergyKcal } from './calorieEstimator';

describe('estimateActiveEnergyKcal', () => {
  it('returns 0 for invalid inputs', () => {
    expect(estimateActiveEnergyKcal(0, 3600)).toBe(0);
    expect(estimateActiveEnergyKcal(80, 0)).toBe(0);
  });

  it('estimates calories from MET formula', () => {
    const kcal = estimateActiveEnergyKcal(80, 3600);
    expect(kcal).toBeGreaterThan(0);
    expect(kcal).toBe(Math.round(4 * 80 * 1));
  });
});
