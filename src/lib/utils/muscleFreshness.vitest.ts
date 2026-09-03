import { describe, it, expect } from 'vitest';
import {
  MUSCLE_DECAY_LAMBDA,
  buildFreshnessMapFromRaw,
  computeFreshnessNow,
} from './muscleFreshness';

describe('muscle freshness', () => {
  it('never-trained muscle maps to fully recovered', () => {
    const fixed = new Date('2026-05-09T12:00:00.000Z');
    const map = buildFreshnessMapFromRaw(
      [{ muscle_key: 'chest', last_trained_at: null }],
      fixed,
    );
    expect(map.chest).toBe(100);
  });

  it('buildFreshnessMapFromRaw returns one entry per row', () => {
    const t = '2026-05-09T10:00:00.000Z';
    const map = buildFreshnessMapFromRaw(
      [
        { muscle_key: 'chest', last_trained_at: t },
        { muscle_key: 'biceps', last_trained_at: t },
      ],
      new Date('2026-05-09T12:00:00.000Z'),
    );
    expect(Object.keys(map).sort()).toEqual(['biceps', 'chest']);
  });

  it('adductors uses stabilizer λ 0.060 instead of DEFAULT_LAMBDA 0.041', () => {
    expect(MUSCLE_DECAY_LAMBDA.adductors).toBe(0.060);

    const now = new Date('2026-05-09T12:00:00.000Z');
    const lastTrainedAt = '2026-05-09T00:00:00.000Z';
    const adductorsFreshness = computeFreshnessNow('adductors', lastTrainedAt, now);
    const defaultLambdaFreshness = computeFreshnessNow('unknown_muscle', lastTrainedAt, now);

    expect(adductorsFreshness).not.toBe(defaultLambdaFreshness);
  });
});
