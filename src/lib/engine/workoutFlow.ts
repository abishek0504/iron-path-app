/**
 * Pure workout-flow logic for the active workout screen: rest resolution,
 * superset grouping, and next-step transitions. Extracted from
 * app/(stack)/workout/active.tsx so it can be unit tested.
 */

import type { SetType } from '../supabase/queries/workouts';

export const DEFAULT_REST_SEC = 90;

export interface FlowSet {
  rest_sec?: number | null;
  completed: boolean;
  set_type?: SetType | null;
}

export interface FlowExercise {
  superset_group?: number | null;
  rest_sec?: number | null;
  sets: FlowSet[];
}

/**
 * Rest duration resolution: per-exercise override, then per-set value, then app default.
 */
function positiveRestSec(value: number | null | undefined): number | null {
  return value != null && value > 0 ? value : null;
}

export function resolveRestSec(
  exercise: FlowExercise | undefined,
  set: FlowSet | undefined,
): number {
  return (
    positiveRestSec(exercise?.rest_sec)
    ?? positiveRestSec(set?.rest_sec)
    ?? DEFAULT_REST_SEC
  );
}

/**
 * Ordered indices of the exercises sharing a superset group with the given
 * exercise. Solo exercises return just themselves.
 */
export function getSupersetMembers(exercises: FlowExercise[], exerciseIndex: number): number[] {
  const group = exercises[exerciseIndex]?.superset_group;
  if (group == null) return [exerciseIndex];
  return exercises
    .map((ex, idx) => ({ ex, idx }))
    .filter(({ ex }) => ex.superset_group === group)
    .map(({ idx }) => idx);
}

export type NextStep =
  | { kind: 'execute'; exerciseIndex: number; setIndex: number; withRest: boolean }
  | { kind: 'log' };

/**
 * Decide what happens after completing a set. Within a superset round we move
 * to the next member with no rest; wrapping back to the start of the group (or
 * the next set of a solo exercise) triggers the rest timer — unless the upcoming
 * set is a drop set, which also skips rest. When every set in the group is
 * complete we enter the logging phase.
 */
export function findNextStep(exercises: FlowExercise[], exerciseIndex: number): NextStep {
  const members = getSupersetMembers(exercises, exerciseIndex);
  const pos = members.indexOf(exerciseIndex);

  for (let offset = 1; offset <= members.length; offset++) {
    const memberIdx = members[(pos + offset) % members.length];
    const setIndex = exercises[memberIdx].sets.findIndex((s) => !s.completed);
    if (setIndex >= 0) {
      const wrapped = pos + offset >= members.length;
      const nextSet = exercises[memberIdx].sets[setIndex];
      const withRest = wrapped && nextSet.set_type !== 'drop';
      return { kind: 'execute', exerciseIndex: memberIdx, setIndex, withRest };
    }
  }

  return { kind: 'log' };
}
