import type { PreviousPerformance } from '../supabase/queries/workouts';

export function formatPreviousPerformanceLabel(
  prevPerformance: PreviousPerformance | null,
  options: {
    mode: 'reps' | 'timed';
    setNumber?: number;
    useImperial?: boolean;
  },
): string | null {
  if (!prevPerformance?.sets.length) return null;

  const prevSet =
    prevPerformance.sets.find((s) => s.set_number === (options.setNumber ?? -1)) ??
    prevPerformance.sets[prevPerformance.sets.length - 1];
  if (!prevSet) return null;

  const unitsLabel = options.useImperial ? 'lbs' : 'kg';

  if (options.mode === 'timed') {
    return prevSet.duration_sec != null ? `${prevSet.duration_sec} sec` : null;
  }

  if (prevSet.reps == null) return null;
  const weightPart =
    prevSet.weight != null && prevSet.weight > 0 ? `${prevSet.weight} ${unitsLabel} × ` : '';
  return `${weightPart}${prevSet.reps} reps`;
}
