import { describe, expect, it } from 'vitest';
import { rowsToCsv, type WorkoutExportRow } from './workoutExport';

describe('rowsToCsv', () => {
  it('escapes commas and quotes', () => {
    const row: WorkoutExportRow = {
      date: '2026-08-30',
      workoutName: 'Push, Day 1',
      durationMin: '45',
      exerciseName: 'Bench "Press"',
      setOrder: 1,
      weight: '185',
      reps: '5',
      seconds: '',
      notes: '',
      rpe: '8',
      rir: '',
      setType: 'normal',
    };
    const csv = rowsToCsv([row]);
    expect(csv.startsWith('Date,Workout Name,')).toBe(true);
    expect(csv).toContain('"Push, Day 1"');
    expect(csv).toContain('"Bench ""Press"""');
  });
});
