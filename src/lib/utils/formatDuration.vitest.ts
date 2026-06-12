import { describe, it, expect } from 'vitest';
import {
  formatDurationDisplay,
  formatDurationCompact,
  formatTimedSetsTarget,
} from './formatDuration';

describe('formatDuration', () => {
  it('formatDurationDisplay uses seconds under one minute', () => {
    expect(formatDurationDisplay(30)).toBe('30 sec');
    expect(formatDurationDisplay(0)).toBe('0 sec');
  });

  it('formatDurationDisplay uses minutes at 60+ seconds', () => {
    expect(formatDurationDisplay(60)).toBe('1 min');
    expect(formatDurationDisplay(90)).toBe('1 min 30 sec');
    expect(formatDurationDisplay(120)).toBe('2 min');
  });

  it('formatDurationCompact stays short for PR-style UI', () => {
    expect(formatDurationCompact(30)).toBe('30s');
    expect(formatDurationCompact(90)).toBe('1:30');
  });

  it('formatTimedSetsTarget combines sets and duration', () => {
    expect(formatTimedSetsTarget(2, 30)).toBe('2 sets × 30 sec');
    expect(formatTimedSetsTarget(3, 60)).toBe('3 sets × 1 min');
  });
});
