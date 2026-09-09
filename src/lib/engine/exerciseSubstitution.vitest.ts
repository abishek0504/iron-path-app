import { describe, expect, it } from 'vitest';
import { suggestExerciseSubstitutions } from './exerciseSubstitution';

describe('suggestExerciseSubstitutions', () => {
  const catalog = [
    { id: 'bench', primary_muscles: ['chest', 'triceps'] },
    { id: 'fly', primary_muscles: ['chest'] },
    { id: 'ohp', primary_muscles: ['shoulders', 'triceps'] },
    { id: 'row', primary_muscles: ['back'] },
    { id: 'dip', primary_muscles: ['chest', 'triceps', 'shoulders'] },
    { id: 'curl', primary_muscles: ['biceps'] },
  ];

  it('excludes the current exercise and ranks by overlap', () => {
    const result = suggestExerciseSubstitutions(
      { id: 'bench', primary_muscles: ['chest', 'triceps'] },
      catalog,
    );
    expect(result.map((item) => item.id)).toEqual(['dip', 'fly', 'ohp']);
  });

  it('returns at most five alternatives', () => {
    const padded = [
      ...catalog,
      { id: 'pushup', primary_muscles: ['chest'] },
      { id: 'pec-dec', primary_muscles: ['chest'] },
      { id: 'close-grip', primary_muscles: ['triceps'] },
      { id: 'lm-press', primary_muscles: ['chest'] },
    ];
    const result = suggestExerciseSubstitutions(
      { id: 'bench', primary_muscles: ['chest', 'triceps'] },
      padded,
    );
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns empty when there is no muscle overlap', () => {
    const result = suggestExerciseSubstitutions(
      { id: 'curl', primary_muscles: ['biceps'] },
      catalog,
    );
    expect(result).toEqual([]);
  });
});
