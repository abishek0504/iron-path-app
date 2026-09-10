import { describe, expect, it } from 'vitest';
import {
  TRAINING_SPLITS,
  focusForTrainingDay,
  getDayFocusOptions,
  resolveDayFocus,
  sanitizeDayFocusMap,
  seedDayFocusMap,
} from './trainingSplits';

describe('focusForTrainingDay', () => {
  it('rotates Push / Pull / Legs and wraps', () => {
    expect(focusForTrainingDay('push_pull_legs', 0)).toBe('Push');
    expect(focusForTrainingDay('push_pull_legs', 1)).toBe('Pull');
    expect(focusForTrainingDay('push_pull_legs', 2)).toBe('Legs');
    expect(focusForTrainingDay('push_pull_legs', 3)).toBe('Push');
  });

  it('runs PPL twice across six training days', () => {
    expect(focusForTrainingDay('ppl_x2', 0)).toBe('Push');
    expect(focusForTrainingDay('ppl_x2', 3)).toBe('Push');
    expect(focusForTrainingDay('ppl_x2', 5)).toBe('Legs');
  });

  it('keeps every full-body day on Full Body', () => {
    expect(focusForTrainingDay('full_body', 0)).toBe('Full Body');
    expect(focusForTrainingDay('full_body', 4)).toBe('Full Body');
  });

  it('mixes legs into both Push / Pull days', () => {
    expect(focusForTrainingDay('push_pull', 0)).toBe('Push + Legs');
    expect(focusForTrainingDay('push_pull', 1)).toBe('Pull + Legs');
  });

  it('returns null for not_sure, unknown, and empty splits', () => {
    expect(focusForTrainingDay('not_sure', 0)).toBeNull();
    expect(focusForTrainingDay('custom split text', 0)).toBeNull();
    expect(focusForTrainingDay(null, 0)).toBeNull();
    expect(focusForTrainingDay(undefined, 1)).toBeNull();
  });
});

describe('resolveDayFocus', () => {
  it('uses a Friday Push pin when the split still allows it', () => {
    expect(
      resolveDayFocus({
        splitValue: 'push_pull_legs',
        dayName: 'Friday',
        trainingDayIndex: 2,
        overrides: { Friday: 'Push' },
      }),
    ).toBe('Push');
  });

  it('falls back to rotation when the pin is not valid for the split', () => {
    expect(
      resolveDayFocus({
        splitValue: 'push_pull_legs',
        dayName: 'Friday',
        trainingDayIndex: 2,
        overrides: { Friday: 'Upper Power' },
      }),
    ).toBe('Legs');
  });
});

describe('sanitizeDayFocusMap', () => {
  it('drops pins for removed days and focuses the new split does not allow', () => {
    expect(
      sanitizeDayFocusMap(
        { Friday: 'Push', Monday: 'Upper Power', Funday: 'Legs' },
        'push_pull_legs',
        ['Monday', 'Friday'],
      ),
    ).toEqual({ Friday: 'Push' });
  });
});

describe('seedDayFocusMap', () => {
  it('fills missing days from the split rotation', () => {
    expect(
      seedDayFocusMap('push_pull_legs', ['Monday', 'Wednesday', 'Friday'], { Friday: 'Push' }),
    ).toEqual({
      Monday: 'Push',
      Wednesday: 'Pull',
      Friday: 'Push',
    });
  });
});

describe('getDayFocusOptions', () => {
  it('exposes chips for every catalog split', () => {
    for (const split of Object.values(TRAINING_SPLITS)) {
      const options = getDayFocusOptions(split.id);
      expect(options.length).toBeGreaterThan(0);
      expect(options).toEqual(split.dayFocusOptions);
    }
    expect(getDayFocusOptions('legacy custom')).toEqual(getDayFocusOptions('not_sure'));
  });
});
