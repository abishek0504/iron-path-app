import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase/client', () => ({ supabase: { from: () => ({}) } }));
vi.mock('../cache/exerciseCache', () => ({ listMergedExercisesCached: vi.fn() }));
vi.mock('../supabase/queries/workouts', () => ({ getMuscleStressStats: vi.fn() }));
vi.mock('../supabase/queries/prescriptions', () => ({ getPrescriptionsForExercises: vi.fn() }));

import {
  applyDeloadToTargetSets,
  DELOAD_VOLUME_FACTOR,
  DELOAD_WEEK_INTERVAL,
  getIsoWeekNumber,
} from './weekGeneration';

describe('deload week', () => {
  it('exports a 4-week interval and 0.6 volume factor', () => {
    expect(DELOAD_WEEK_INTERVAL).toBe(4);
    expect(DELOAD_VOLUME_FACTOR).toBe(0.6);
  });

  it('leaves target sets unchanged on non-deload weeks', () => {
    expect(applyDeloadToTargetSets(5, 1)).toBe(5);
    expect(applyDeloadToTargetSets(5, 3)).toBe(5);
  });

  it('ceils reduced volume with a minimum of 1 on every 4th ISO week', () => {
    expect(applyDeloadToTargetSets(5, 4)).toBe(3);
    expect(applyDeloadToTargetSets(1, 8)).toBe(1);
    expect(applyDeloadToTargetSets(2, 12)).toBe(2);
  });

  it('computes ISO week numbers for known dates', () => {
    expect(getIsoWeekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(getIsoWeekNumber(new Date(2026, 0, 26))).toBe(5);
  });
});
