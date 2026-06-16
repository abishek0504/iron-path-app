/** Epley estimated 1RM from weight (lbs) and reps. */
export function estimateOneRepMaxLbs(weightLbs: number, reps: number): number {
  if (weightLbs <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightLbs;
  return weightLbs * (1 + reps / 30);
}

export type ExerciseSessionPoint = {
  sessionId: string;
  completedAt: string;
  bestWeightLbs: number | null;
  bestReps: number | null;
  volumeLbs: number;
  estimated1RmLbs: number | null;
};

export type PRTimelineEntry = {
  exerciseKey: string;
  exerciseName?: string;
  prType: 'weight' | 'reps_only' | 'timed';
  value: number;
  performedAt: string;
  sessionId: string;
};

export function bestSetForProgression(
  sets: { weight: number | null; reps: number | null; performed_at: string | null; set_type?: string | null }[],
): { weightLbs: number; reps: number; e1rm: number } | null {
  let best: { weightLbs: number; reps: number; e1rm: number } | null = null;
  for (const s of sets) {
    if (!s.performed_at || s.set_type === 'warmup') continue;
    const w = s.weight ?? 0;
    const r = s.reps ?? 0;
    if (w <= 0 || r <= 0) continue;
    const e1rm = estimateOneRepMaxLbs(w, r);
    if (!best || e1rm > best.e1rm) {
      best = { weightLbs: w, reps: r, e1rm };
    }
  }
  return best;
}
