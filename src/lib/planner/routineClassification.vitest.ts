import { describe, expect, it } from 'vitest';
import {
  computeRoutineSessionExerciseIds,
  dayOnlyBadgeLabel,
  exerciseKey,
} from './routineClassification';

describe('exerciseKey', () => {
  it('prefers exercise_id over custom_exercise_id', () => {
    expect(exerciseKey({ exercise_id: 'a', custom_exercise_id: 'b' })).toBe('a');
  });

  it('falls back to custom_exercise_id', () => {
    expect(exerciseKey({ exercise_id: null, custom_exercise_id: 'c' })).toBe('c');
  });

  it('returns null when both missing', () => {
    expect(exerciseKey({ exercise_id: null, custom_exercise_id: null })).toBeNull();
  });
});

describe('computeRoutineSessionExerciseIds', () => {
  it('marks session exercises covered by template slots as routine', () => {
    const slots = [
      { exercise_id: 'bench', custom_exercise_id: null },
      { exercise_id: 'row', custom_exercise_id: null },
    ];
    const sessions = [
      {
        exercises: [
          { id: 'se1', exercise_id: 'bench', custom_exercise_id: null },
          { id: 'se2', exercise_id: 'row', custom_exercise_id: null },
        ],
      },
    ];
    const routine = computeRoutineSessionExerciseIds(slots, sessions);
    expect(routine.has('se1')).toBe(true);
    expect(routine.has('se2')).toBe(true);
  });

  it('marks extras beyond template quota as day-only', () => {
    const slots = [{ exercise_id: 'bench', custom_exercise_id: null }];
    const sessions = [
      {
        exercises: [
          { id: 'se1', exercise_id: 'bench', custom_exercise_id: null },
          { id: 'se2', exercise_id: 'bench', custom_exercise_id: null },
        ],
      },
    ];
    const routine = computeRoutineSessionExerciseIds(slots, sessions);
    expect(routine.has('se1')).toBe(true);
    expect(routine.has('se2')).toBe(false);
  });

  it('consumes quota across multiple sessions in order', () => {
    const slots = [{ exercise_id: 'bench', custom_exercise_id: null }];
    const sessions = [
      { exercises: [{ id: 'se1', exercise_id: 'bench', custom_exercise_id: null }] },
      { exercises: [{ id: 'se2', exercise_id: 'bench', custom_exercise_id: null }] },
    ];
    const routine = computeRoutineSessionExerciseIds(slots, sessions);
    expect(routine.has('se1')).toBe(true);
    expect(routine.has('se2')).toBe(false);
  });

  it('treats all as day-only when template slots are empty', () => {
    const sessions = [
      { exercises: [{ id: 'se1', exercise_id: 'bench', custom_exercise_id: null }] },
    ];
    const routine = computeRoutineSessionExerciseIds([], sessions);
    expect(routine.size).toBe(0);
  });
});

describe('dayOnlyBadgeLabel', () => {
  it('returns Today Only for today', () => {
    expect(dayOnlyBadgeLabel(true)).toBe('Today Only');
  });

  it('returns This day only for other days', () => {
    expect(dayOnlyBadgeLabel(false)).toBe('This day only');
  });
});
