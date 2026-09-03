import { describe, expect, it } from 'vitest';
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

describe('exerciseHitsAvoidedMuscles', () => {
  it('flags a chest press when Chest is avoided', () => {
    expect(exerciseHitsAvoidedMuscles(bench, ['Chest'])).toBe(true);
    expect(exerciseHitsAvoidedMuscles(row, ['Chest'])).toBe(false);
  });
});
