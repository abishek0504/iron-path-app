import { describe, expect, it, vi } from 'vitest';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../supabase/client', () => ({ supabase: { from: () => ({}) } }));
vi.mock('../supabase/queries/customExerciseMutations', () => ({
  createUserCustomExercise: vi.fn(),
}));
vi.mock('../supabase/queries/exercises', () => ({
  listMergedExercises: vi.fn(),
}));
vi.mock('../supabase/queries/workouts', () => ({
  createWorkoutSession: vi.fn(),
}));

import { parseStrongHevyCsv } from './strongHevyCsv';

const STRONG_CSV = `Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps
2026-08-01 18:00:00,Push,Bench Press,1,185,lbs,5
2026-08-01 18:00:00,Push,Bench Press,2,185,lbs,5
2026-08-01 18:00:00,Push,Overhead Press,1,95,lbs,8
`;

const HEVY_CSV = `title,start_time,exercise_title,set_index,weight_kg,reps
Pull,2026-08-02T17:30:00.000Z,Lat Pulldown,1,50,10
Pull,2026-08-02T17:30:00.000Z,Lat Pulldown,2,50,8
`;

describe('parseStrongHevyCsv', () => {
  it('parses Strong columns into one workout with two exercises', () => {
    const parsed = parseStrongHevyCsv(STRONG_CSV);
    expect(parsed.format).toBe('strong');
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.workouts[0].workoutName).toBe('Push');
    expect(parsed.workouts[0].exercises.map((ex) => ex.name)).toEqual([
      'Bench Press',
      'Overhead Press',
    ]);
    expect(parsed.workouts[0].exercises[0].sets).toHaveLength(2);
    expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(185);
    expect(parsed.workouts[0].exercises[0].sets[0].weightIsImperial).toBe(true);
  });

  it('parses Hevy columns and treats weight as kg', () => {
    const parsed = parseStrongHevyCsv(HEVY_CSV);
    expect(parsed.format).toBe('hevy');
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.workouts[0].exercises[0].name).toBe('Lat Pulldown');
    expect(parsed.workouts[0].exercises[0].sets[0].weight).toBe(50);
    expect(parsed.workouts[0].exercises[0].sets[0].weightIsImperial).toBe(false);
    expect(parsed.workouts[0].exercises[0].sets[1].reps).toBe(8);
  });

  it('keeps high-rep sets instead of clamping them', () => {
    const parsed = parseStrongHevyCsv(`Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps
2026-08-01 18:00:00,Push,Push-Up,1,0,lbs,100
`);
    expect(parsed.workouts[0].exercises[0].sets[0].reps).toBe(100);
  });

  it('returns unknown for unrelated CSV', () => {
    const parsed = parseStrongHevyCsv('foo,bar\n1,2');
    expect(parsed.format).toBe('unknown');
    expect(parsed.workouts).toHaveLength(0);
  });
});
