export interface WorkoutExportRow {
  date: string;
  workoutName: string;
  durationMin: string;
  exerciseName: string;
  setOrder: number;
  weight: string;
  reps: string;
  seconds: string;
  notes: string;
  rpe: string;
  rir: string;
  setType: string;
}

export const WORKOUT_EXPORT_HEADERS = [
  'Date',
  'Workout Name',
  'Duration',
  'Exercise Name',
  'Set Order',
  'Weight',
  'Reps',
  'Seconds',
  'Notes',
  'RPE',
  'RIR',
  'Set Type',
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: WorkoutExportRow[]): string {
  const header = WORKOUT_EXPORT_HEADERS.join(',');
  const body = rows.map((row) =>
    [
      row.date,
      row.workoutName,
      row.durationMin,
      row.exerciseName,
      String(row.setOrder),
      row.weight,
      row.reps,
      row.seconds,
      row.notes,
      row.rpe,
      row.rir,
      row.setType,
    ]
      .map((cell) => csvEscape(cell))
      .join(','),
  );
  return [header, ...body].join('\n');
}
