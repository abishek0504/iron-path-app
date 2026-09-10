import { describe, expect, it } from 'vitest';
import { TRAINING_SPLITS } from '../constants/trainingSplits';
import {
  exerciseHitsAvoidedMuscles,
  exerciseMatchesDayFocus,
  filterExercisesByDayFocus,
} from './dayFocus';

const hipThrust = {
  name: 'Hip Thrust',
  movement_pattern: 'hinge',
  primary_muscles: ['glutes'],
};

const bench = {
  name: 'Bench Press (Barbell)',
  movement_pattern: 'push',
  primary_muscles: ['chest'],
};

const row = {
  name: 'Bent Over Row (Barbell)',
  movement_pattern: 'pull',
  primary_muscles: ['lats'],
};

describe('exerciseMatchesDayFocus', () => {
  it('rejects hip thrust on a Push day', () => {
    expect(exerciseMatchesDayFocus(hipThrust, 'Push')).toBe(false);
    expect(exerciseMatchesDayFocus(bench, 'Push')).toBe(true);
  });

  it('accepts hip thrust on Legs / Lower days', () => {
    expect(exerciseMatchesDayFocus(hipThrust, 'Legs')).toBe(true);
    expect(exerciseMatchesDayFocus(hipThrust, 'Lower')).toBe(true);
    expect(exerciseMatchesDayFocus(hipThrust, 'Hamstrings + Glutes')).toBe(true);
  });

  it('keeps pull work off a Push day', () => {
    expect(exerciseMatchesDayFocus(row, 'Push')).toBe(false);
    expect(exerciseMatchesDayFocus(row, 'Pull')).toBe(true);
  });

  it('lets AI decide when focus is empty', () => {
    expect(exerciseMatchesDayFocus(hipThrust, null)).toBe(true);
  });
});

describe('filterExercisesByDayFocus', () => {
  it('drops off-focus lifts from the catalog', () => {
    const filtered = filterExercisesByDayFocus([hipThrust, bench, row], 'Push');
    expect(filtered.map((e) => e.name)).toEqual(['Bench Press (Barbell)']);
  });
});

describe('split focus catalogs', () => {
  const catalog = [
    hipThrust,
    bench,
    row,
    {
      name: 'Snatch',
      movement_pattern: null,
      primary_muscles: ['quads', 'glutes', 'upper back'],
    },
    {
      name: 'Clean & Jerk',
      movement_pattern: null,
      primary_muscles: ['quads', 'glutes', 'upper back'],
    },
    {
      name: 'Back Squat',
      movement_pattern: 'squat',
      primary_muscles: ['quads'],
    },
    {
      name: 'Barbell Curl',
      movement_pattern: 'pull',
      primary_muscles: ['biceps'],
    },
    {
      name: 'Overhead Press (Barbell)',
      movement_pattern: 'push',
      primary_muscles: ['anterior deltoids', 'lateral deltoids'],
    },
  ];

  it('keeps a non-empty catalog for every split focus label', () => {
    for (const split of Object.values(TRAINING_SPLITS)) {
      for (const focus of split.dayFocusOptions) {
        const filtered = filterExercisesByDayFocus(catalog, focus);
        expect(filtered.length, `${split.id} / ${focus}`).toBeGreaterThan(0);
      }
    }
  });

  it('treats PHAT chest/arms and accessories as usable focuses', () => {
    expect(exerciseMatchesDayFocus(bench, 'Chest/Arms Hypertrophy')).toBe(true);
    expect(exerciseMatchesDayFocus(hipThrust, 'Accessories')).toBe(true);
    expect(exerciseMatchesDayFocus({ name: 'Snatch', movement_pattern: null, primary_muscles: [] }, 'Snatch Focus')).toBe(true);
    expect(exerciseMatchesDayFocus({ name: 'Clean & Jerk', movement_pattern: null, primary_muscles: [] }, 'Clean & Jerk Focus')).toBe(true);
    expect(exerciseMatchesDayFocus({ name: 'Back Squat', movement_pattern: 'squat', primary_muscles: ['quads'] }, 'Strength')).toBe(true);
    expect(exerciseMatchesDayFocus(hipThrust, 'Push + Legs')).toBe(true);
    expect(exerciseMatchesDayFocus(bench, 'Push + Legs')).toBe(true);
  });
});

describe('exerciseHitsAvoidedMuscles', () => {
  it('flags a chest press when Chest is avoided', () => {
    expect(exerciseHitsAvoidedMuscles(bench, ['Chest'])).toBe(true);
    expect(exerciseHitsAvoidedMuscles(row, ['Chest'])).toBe(false);
  });
});
