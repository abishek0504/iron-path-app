import { describe, it, expect } from 'vitest';
import {
  cycleSetType,
  suggestDropWeight,
  restAfterSet,
  DROP_WEIGHT_FRACTION,
  FAILURE_REST_MULTIPLIER,
  FAILURE_DEFAULT_RPE,
} from './setTypes';

describe('cycleSetType', () => {
  it('cycles normal → warmup → drop → failure → normal', () => {
    expect(cycleSetType('normal')).toBe('warmup');
    expect(cycleSetType('warmup')).toBe('drop');
    expect(cycleSetType('drop')).toBe('failure');
    expect(cycleSetType('failure')).toBe('normal');
  });

  it('treats null/undefined as normal', () => {
    expect(cycleSetType(null)).toBe('warmup');
    expect(cycleSetType(undefined)).toBe('warmup');
  });
});

describe('suggestDropWeight', () => {
  it('returns 80% of prior weight', () => {
    expect(suggestDropWeight(100)).toBe(100 * DROP_WEIGHT_FRACTION);
  });

  it('returns null for missing or non-positive weight', () => {
    expect(suggestDropWeight(null)).toBeNull();
    expect(suggestDropWeight(0)).toBeNull();
    expect(suggestDropWeight(undefined)).toBeNull();
  });
});

describe('restAfterSet', () => {
  it('skips rest before a drop set', () => {
    expect(
      restAfterSet({ completedType: 'normal', nextType: 'drop', baseRestSec: 90 })
    ).toBe(0);
  });

  it('extends rest after a failure set', () => {
    expect(
      restAfterSet({ completedType: 'failure', nextType: 'normal', baseRestSec: 90 })
    ).toBe(Math.max(90, Math.round(90 * FAILURE_REST_MULTIPLIER)));
  });

  it('passes through base rest otherwise', () => {
    expect(
      restAfterSet({ completedType: 'normal', nextType: 'normal', baseRestSec: 60 })
    ).toBe(60);
  });
});

describe('FAILURE_DEFAULT_RPE', () => {
  it('is max effort', () => {
    expect(FAILURE_DEFAULT_RPE).toBe(10);
  });
});
