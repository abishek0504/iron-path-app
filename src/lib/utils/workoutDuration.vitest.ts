import { describe, it, expect } from 'vitest';
import { computeElapsedDurationSec, computeHeldDurationSec, clampSessionDurationSec } from './workoutDuration';

describe('computeElapsedDurationSec', () => {
  const start = 1_000_000;

  it('clamps early skip under 5 seconds to minimum', () => {
    expect(computeElapsedDurationSec(start, start + 2_000)).toBe(5);
  });

  it('returns rounded elapsed for normal holds', () => {
    expect(computeElapsedDurationSec(start, start + 10_500)).toBe(11);
    expect(computeElapsedDurationSec(start, start + 30_000)).toBe(30);
  });

  it('clamps over 3600 seconds to maximum', () => {
    expect(computeElapsedDurationSec(start, start + 4_000_000)).toBe(3600);
  });
});

describe('computeHeldDurationSec', () => {
  it('derives held time from countdown remaining without a minimum', () => {
    expect(computeHeldDurationSec(30, 20)).toBe(10);
    expect(computeHeldDurationSec(30, 0)).toBe(30);
    expect(computeHeldDurationSec(30, 28)).toBe(2);
    expect(computeHeldDurationSec(30, 30)).toBe(0);
  });
});

describe('clampSessionDurationSec', () => {
  it('enforces DB bounds on persist', () => {
    expect(clampSessionDurationSec(2)).toBe(5);
    expect(clampSessionDurationSec(10)).toBe(10);
    expect(clampSessionDurationSec(5000)).toBe(3600);
  });
});
