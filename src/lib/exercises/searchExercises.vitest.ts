import { describe, it, expect } from 'vitest';
import { searchExercisesByName } from './searchExercises';

const catalog = [
  { id: '1', name: 'Incline Dumbbell Bench Press' },
  { id: '2', name: 'Barbell Back Squat' },
  { id: '3', name: 'Bench Press' },
  { id: '4', name: 'Squat' },
  { id: '5', name: 'Dumbbell Bench Press' },
  { id: '6', name: 'Romanian Deadlift' },
];

describe('searchExercisesByName', () => {
  it('returns original order for empty or whitespace query', () => {
    expect(searchExercisesByName(catalog, '')).toEqual(catalog);
    expect(searchExercisesByName(catalog, '   ')).toEqual(catalog);
  });

  it('matches single-token substrings case-insensitively', () => {
    const results = searchExercisesByName(catalog, 'BENCH');
    expect(results.map((e) => e.name)).toEqual([
      'Bench Press',
      'Dumbbell Bench Press',
      'Incline Dumbbell Bench Press',
    ]);
  });

  it('requires every token (AND) regardless of token order', () => {
    const forward = searchExercisesByName(catalog, 'barbell squat');
    const reverse = searchExercisesByName(catalog, 'squat barbell');
    expect(forward.map((e) => e.name)).toEqual(['Barbell Back Squat']);
    expect(reverse.map((e) => e.name)).toEqual(['Barbell Back Squat']);
  });

  it('ranks exact and prefix matches above mid-string contains', () => {
    const results = searchExercisesByName(catalog, 'squat');
    expect(results[0]?.name).toBe('Squat');
    expect(results.map((e) => e.name)).toContain('Barbell Back Squat');
  });

  it('ranks name starting with query above looser contains', () => {
    const results = searchExercisesByName(catalog, 'bench');
    expect(results[0]?.name).toBe('Bench Press');
    expect(results.at(-1)?.name).toBe('Incline Dumbbell Bench Press');
  });

  it('excludes names missing any token', () => {
    const results = searchExercisesByName(catalog, 'bench deadlift');
    expect(results).toEqual([]);
  });
});
