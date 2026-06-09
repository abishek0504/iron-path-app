import { describe, it, expect } from 'vitest';
import { getUtcDayBoundsIso, getUtcDayKey, WEEK_DAYS } from './date';

describe('date utils', () => {
  it('exports seven weekday labels', () => {
    expect(WEEK_DAYS.length).toBe(7);
    expect(WEEK_DAYS[0]).toBe('Sunday');
  });

  it('getUtcDayKey uses UTC calendar date', () => {
    expect(getUtcDayKey(new Date('2026-05-10T15:00:00.000Z'))).toBe('2026-05-10');
  });

  it('getUtcDayBoundsIso ends the following UTC day', () => {
    const { startIso, endIsoExclusive } = getUtcDayBoundsIso('2026-05-10');
    expect(startIso).toContain('2026-05-10');
    expect(new Date(endIsoExclusive).getTime()).toBeGreaterThan(new Date(startIso).getTime());
    expect(endIsoExclusive.slice(0, 10)).toBe('2026-05-11');
  });
});
