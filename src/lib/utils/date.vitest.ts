import { describe, it, expect } from 'vitest';
import {
  getUtcDayBoundsIso,
  getUtcDayKey,
  getLocalDayKey,
  getLocalDayBoundsIso,
  getDateBoundsForDayName,
  WEEK_DAYS,
} from './date';

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

  it('getLocalDayKey uses local calendar date', () => {
    const local = new Date(2026, 4, 10, 23, 30); // 11:30 PM local on May 10
    expect(getLocalDayKey(local)).toBe('2026-05-10');
  });

  it('getLocalDayBoundsIso spans exactly the local calendar day', () => {
    const evening = new Date(2026, 4, 10, 22, 0); // 10 PM local
    const { startIso, endIsoExclusive } = getLocalDayBoundsIso(evening);
    const start = new Date(startIso);
    const end = new Date(endIsoExclusive);
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(10);
    expect(end.getDate()).toBe(11);
    // The evening moment itself must be inside the window (the UTC-key bug excluded it)
    expect(evening.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(evening.getTime()).toBeLessThan(end.getTime());
  });

  it('getDateBoundsForDayName window for today contains now', () => {
    const now = new Date();
    const todayName = WEEK_DAYS[now.getDay()];
    const { startIso, endIsoExclusive } = getDateBoundsForDayName(todayName);
    expect(now.getTime()).toBeGreaterThanOrEqual(new Date(startIso).getTime());
    expect(now.getTime()).toBeLessThan(new Date(endIsoExclusive).getTime());
  });
});
