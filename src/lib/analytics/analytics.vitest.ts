import { describe, it, expect } from 'vitest';
import {
  setVolumeLbs,
  sumVolumeLbs,
  muscleGroupVolumeSplit,
  estimateOneRepMaxLbs,
  bestSetForProgression,
  summarizeAdherence,
  wallClockDurationSec,
  computeActiveDurationSec,
  setStimulus,
  toLocalDateKey,
  aggregateIntoBuckets,
  getRangeForPreset,
} from './index';
import type { AnalyticsSetRow, ExerciseMeta } from './types';

const workingSet = (overrides: Partial<AnalyticsSetRow> = {}): AnalyticsSetRow => ({
  weight: 100,
  reps: 10,
  duration_sec: null,
  rpe: 8,
  rir: null,
  set_type: 'normal',
  rest_sec: 90,
  performed_at: '2026-06-01T10:00:00.000Z',
  session_exercise_id: 'se1',
  exercise_id: 'ex1',
  ...overrides,
});

describe('volume', () => {
  it('computes weight × reps for working sets', () => {
    expect(setVolumeLbs(workingSet())).toBe(1000);
    expect(setVolumeLbs(workingSet({ set_type: 'warmup' }))).toBe(0);
    expect(setVolumeLbs(workingSet({ performed_at: null }))).toBe(0);
  });

  it('splits volume across muscles', () => {
    const meta = new Map<string, ExerciseMeta>([
      [
        'ex1',
        {
          id: 'ex1',
          primary_muscles: ['chest', 'triceps'],
          implicit_hits: null,
        },
      ],
    ]);
    const split = muscleGroupVolumeSplit([workingSet()], meta);
    expect(split).toHaveLength(2);
    expect(split[0].volumeLbs + split[1].volumeLbs).toBeCloseTo(1000, 0);
  });
});

describe('progression', () => {
  it('estimates 1RM via Epley', () => {
    expect(estimateOneRepMaxLbs(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimateOneRepMaxLbs(225, 1)).toBe(225);
  });

  it('picks best set by e1RM', () => {
    const best = bestSetForProgression([
      { weight: 100, reps: 10, performed_at: 't', set_type: 'normal' },
      { weight: 120, reps: 5, performed_at: 't', set_type: 'normal' },
    ]);
    expect(best?.weightLbs).toBe(120);
  });
});

describe('adherence', () => {
  it('computes adherence vs weekly target', () => {
    const start = new Date('2026-06-01');
    const end = new Date('2026-06-28');
    const summary = summarizeAdherence(
      ['2026-06-02T10:00:00Z', '2026-06-09T10:00:00Z', '2026-06-16T10:00:00Z'],
      start,
      end,
      3,
    );
    expect(summary.sessionsCompleted).toBe(3);
    expect(summary.adherencePct).toBeGreaterThan(0);
  });
});

describe('duration', () => {
  it('computes wall-clock duration', () => {
    expect(
      wallClockDurationSec('2026-06-01T10:00:00Z', '2026-06-01T11:00:00Z'),
    ).toBe(3600);
  });

  it('estimates active time from performed_at gaps', () => {
    const sets: AnalyticsSetRow[] = [
      workingSet({ performed_at: '2026-06-01T10:00:00Z', rest_sec: 60 }),
      workingSet({ performed_at: '2026-06-01T10:05:00Z' }),
    ];
    expect(computeActiveDurationSec(sets)).toBeGreaterThan(0);
  });
});

describe('intensity', () => {
  it('maps RPE to stimulus', () => {
    expect(setStimulus(workingSet({ rpe: 10 }))).toBe(1);
    expect(setStimulus(workingSet({ rpe: 5 }))).toBe(0);
  });
});

describe('dateBuckets', () => {
  it('formats local date keys', () => {
    expect(toLocalDateKey('2026-06-15T23:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('aggregates daily buckets', () => {
    const points = aggregateIntoBuckets(
      [
        { dateIso: '2026-06-01T10:00:00Z', value: 100 },
        { dateIso: '2026-06-01T18:00:00Z', value: 50 },
        { dateIso: '2026-06-02T10:00:00Z', value: 200 },
      ],
      'day',
    );
    expect(points).toHaveLength(2);
    expect(points[0].value + points[1].value).toBe(350);
  });

  it('builds preset ranges', () => {
    const range = getRangeForPreset('4w');
    expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());
  });
});

describe('sumVolumeLbs', () => {
  it('sums multiple sets', () => {
    expect(sumVolumeLbs([workingSet(), workingSet({ reps: 5 })])).toBe(1500);
  });
});
