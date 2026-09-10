/** Keep in sync with src/lib/ai/weekJobReuse.ts. */

export function weekSessionsMatchExerciseCount(
  days: { sessions?: unknown[][] }[] | null | undefined,
  exercisesPerSession: number,
): boolean {
  if (!Array.isArray(days) || days.length === 0) return false;
  return days.every((day) => {
    if (!Array.isArray(day.sessions) || day.sessions.length === 0) return false;
    return day.sessions.every(
      (group) => Array.isArray(group) && group.length === exercisesPerSession,
    );
  });
}

export function shouldReuseWeekJobSessions(args: {
  status?: string | null;
  sessions: { sessions?: unknown[][] }[] | null | undefined;
  exercisesPerSession: number;
}): boolean {
  if (args.status !== 'generated' && args.status !== 'failed') return false;
  return weekSessionsMatchExerciseCount(args.sessions, args.exercisesPerSession);
}
