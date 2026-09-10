/** Exact day_name match for coach week sessions. Keep in sync with generate-week/weekValidation.ts. */

export function matchRawDaySessions<T extends { day_name: string; sessions: unknown }>(
  rawDays: T[],
  requestedName: string,
): T['sessions'] | null {
  const lower = requestedName.trim().toLowerCase();
  const byName = rawDays.find((day) => day.day_name.trim().toLowerCase() === lower);
  return byName?.sessions ?? null;
}
