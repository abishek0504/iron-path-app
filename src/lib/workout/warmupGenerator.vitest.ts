import { describe, expect, it } from 'vitest';
import { buildWarmupLadder } from './warmupGenerator';

describe('buildWarmupLadder', () => {
  it('returns empty when there is no working weight', () => {
    expect(buildWarmupLadder(0, true)).toEqual([]);
  });

  it('builds 40/60/80 percent steps for 225 lb', () => {
    const ladder = buildWarmupLadder(225, true);
    expect(ladder).toHaveLength(3);
    expect(ladder[0]).toMatchObject({ reps: 8, percent: 0.4 });
    expect(ladder[1]).toMatchObject({ reps: 5, percent: 0.6 });
    expect(ladder[2]).toMatchObject({ reps: 3, percent: 0.8 });
    expect(ladder[0].weight).toBe(90);
    expect(ladder[1].weight).toBe(135);
    expect(ladder[2].weight).toBe(180);
  });
});
