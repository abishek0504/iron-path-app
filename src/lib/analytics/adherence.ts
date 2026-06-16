import { toLocalDateKey } from './dateBuckets';

export type AdherenceSummary = {
  sessionsCompleted: number;
  weeksInRange: number;
  targetPerWeek: number;
  avgSessionsPerWeek: number;
  adherencePct: number;
};

export function summarizeAdherence(
  completedDates: string[],
  rangeStart: Date,
  rangeEnd: Date,
  daysPerWeekTarget: number,
): AdherenceSummary {
  const uniqueDays = new Set(completedDates.map(toLocalDateKey));
  const sessionsCompleted = uniqueDays.size;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksInRange = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / msPerWeek));
  const avgSessionsPerWeek = sessionsCompleted / weeksInRange;
  const targetPerWeek = daysPerWeekTarget;
  const adherencePct =
    targetPerWeek > 0
      ? Math.min(100, Math.round((avgSessionsPerWeek / targetPerWeek) * 100))
      : 0;

  return {
    sessionsCompleted,
    weeksInRange,
    targetPerWeek,
    avgSessionsPerWeek: Math.round(avgSessionsPerWeek * 10) / 10,
    adherencePct,
  };
}

export function rollingFourWeekFrequency(completedDates: string[], asOf: Date): number {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - 28);
  const days = new Set<string>();
  for (const iso of completedDates) {
    const d = new Date(iso);
    if (d >= cutoff && d <= asOf) {
      days.add(toLocalDateKey(iso));
    }
  }
  return days.size;
}
