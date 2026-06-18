import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REST_SEC,
  resolveRestSec,
  getSupersetMembers,
  findNextStep,
  type FlowExercise,
} from './workoutFlow';

function exercise(opts: {
  group?: number | null;
  restSec?: number | null;
  sets: boolean[]; // completed flags
  setRestSec?: number | null;
}): FlowExercise {
  return {
    superset_group: opts.group ?? null,
    rest_sec: opts.restSec ?? null,
    sets: opts.sets.map((completed) => ({ completed, rest_sec: opts.setRestSec ?? null })),
  };
}

describe('resolveRestSec', () => {
  it('falls back to the app default when nothing is set', () => {
    const ex = exercise({ sets: [false] });
    expect(resolveRestSec(ex, ex.sets[0])).toBe(DEFAULT_REST_SEC);
  });

  it('uses the per-set value over the default', () => {
    const ex = exercise({ sets: [false], setRestSec: 120 });
    expect(resolveRestSec(ex, ex.sets[0])).toBe(120);
  });

  it('prefers the per-exercise override over the set value', () => {
    const ex = exercise({ sets: [false], setRestSec: 120, restSec: 45 });
    expect(resolveRestSec(ex, ex.sets[0])).toBe(45);
  });

  it('treats zero rest_sec as unset and falls back to default', () => {
    const ex = exercise({ sets: [false], restSec: 0 });
    expect(resolveRestSec(ex, ex.sets[0])).toBe(DEFAULT_REST_SEC);
  });

  it('handles undefined inputs', () => {
    expect(resolveRestSec(undefined, undefined)).toBe(DEFAULT_REST_SEC);
  });
});

describe('getSupersetMembers', () => {
  it('returns only the exercise itself when ungrouped', () => {
    const exercises = [exercise({ sets: [false] }), exercise({ sets: [false] })];
    expect(getSupersetMembers(exercises, 0)).toEqual([0]);
  });

  it('returns all members of the group in order', () => {
    const exercises = [
      exercise({ group: 1, sets: [false] }),
      exercise({ sets: [false] }),
      exercise({ group: 1, sets: [false] }),
    ];
    expect(getSupersetMembers(exercises, 0)).toEqual([0, 2]);
    expect(getSupersetMembers(exercises, 2)).toEqual([0, 2]);
  });

  it('keeps separate groups apart', () => {
    const exercises = [
      exercise({ group: 1, sets: [false] }),
      exercise({ group: 2, sets: [false] }),
      exercise({ group: 1, sets: [false] }),
      exercise({ group: 2, sets: [false] }),
    ];
    expect(getSupersetMembers(exercises, 1)).toEqual([1, 3]);
  });
});

describe('findNextStep — solo exercise', () => {
  it('rests before the next set of the same exercise', () => {
    const exercises = [exercise({ sets: [true, false, false] })];
    expect(findNextStep(exercises, 0)).toEqual({
      kind: 'execute',
      exerciseIndex: 0,
      setIndex: 1,
      withRest: true,
    });
  });

  it('enters logging when every set is complete', () => {
    const exercises = [exercise({ sets: [true, true] })];
    expect(findNextStep(exercises, 0)).toEqual({ kind: 'log' });
  });
});

describe('findNextStep — superset', () => {
  it('alternates to the partner with no rest mid-round', () => {
    const exercises = [
      exercise({ group: 1, sets: [true, false] }),
      exercise({ group: 1, sets: [false, false] }),
    ];
    expect(findNextStep(exercises, 0)).toEqual({
      kind: 'execute',
      exerciseIndex: 1,
      setIndex: 0,
      withRest: false,
    });
  });

  it('rests when wrapping back to the start of the group', () => {
    const exercises = [
      exercise({ group: 1, sets: [true, false] }),
      exercise({ group: 1, sets: [true, false] }),
    ];
    expect(findNextStep(exercises, 1)).toEqual({
      kind: 'execute',
      exerciseIndex: 0,
      setIndex: 1,
      withRest: true,
    });
  });

  it('skips a finished member and continues with the rest of the group', () => {
    const exercises = [
      exercise({ group: 1, sets: [true, true] }),
      exercise({ group: 1, sets: [true, false] }),
    ];
    // Member 0 is done; after member 1's first sets, the next incomplete set
    // belongs to member 1 again — reached by wrapping, so rest applies.
    expect(findNextStep(exercises, 0)).toEqual({
      kind: 'execute',
      exerciseIndex: 1,
      setIndex: 1,
      withRest: false,
    });
  });

  it('logs when the whole group is complete', () => {
    const exercises = [
      exercise({ group: 1, sets: [true, true] }),
      exercise({ group: 1, sets: [true, true] }),
    ];
    expect(findNextStep(exercises, 1)).toEqual({ kind: 'log' });
  });

  it('ignores exercises outside the group', () => {
    const exercises = [
      exercise({ group: 1, sets: [true] }),
      exercise({ sets: [false] }), // solo, not part of the round
      exercise({ group: 1, sets: [false] }),
    ];
    expect(findNextStep(exercises, 0)).toEqual({
      kind: 'execute',
      exerciseIndex: 2,
      setIndex: 0,
      withRest: false,
    });
  });
});
