import { describe, it, expect } from 'vitest';
import { buildFreshnessMapFromRaw } from './muscleFreshness';

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
});
