export type WorkoutLogLike = {
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  scheduled_weight: number | null;
  scheduled_reps: number | null;
  performed_at: string;
};

export type Trend = 'progressing' | 'flat' | 'struggling';

export interface ExerciseHistoryMetrics {
  hasHistory: boolean;
  lastLog: WorkoutLogLike | null;
  lastSuccessful: WorkoutLogLike | null;
  recentFailures: number;
  trend: Trend;
  estimatedTrainingMax: number | null;
}

const MAX_RECENT_FOR_TREND = 6;

const isSuccessful = (log: WorkoutLogLike): boolean => {
  const weight = typeof log.weight === 'number' ? log.weight : null;
  const reps = typeof log.reps === 'number' ? log.reps : null;
  const sWeight = typeof log.scheduled_weight === 'number' ? log.scheduled_weight : null;
  const sReps = typeof log.scheduled_reps === 'number' ? log.scheduled_reps : null;

  if (sWeight !== null && sReps !== null && sReps > 0) {
    if (weight === null || reps === null) return false;
    return weight >= sWeight && reps >= sReps;
  }

  // Fallback: treat any non-zero reps as a success
  return !!reps && reps > 0;
};

const computeEstimated1RM = (log: WorkoutLogLike): number | null => {
  const weight = typeof log.weight === 'number' ? log.weight : null;
  const reps = typeof log.reps === 'number' ? log.reps : null;
  if (!weight || !reps || reps <= 0) return null;
  // Simple Epley formula
  return weight * (1 + reps / 30);
};

export const computeExerciseHistoryMetrics = (logs: WorkoutLogLike[]): ExerciseHistoryMetrics => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      hasHistory: false,
      lastLog: null,
      lastSuccessful: null,
      recentFailures: 0,
      trend: 'flat',
      estimatedTrainingMax: null,
    };
  }

  // Assume logs are already sorted newest → oldest; if not, sort defensively.
  const sorted = [...logs].sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
  );

  const lastLog = sorted[0];
  let lastSuccessful: WorkoutLogLike | null = null;
  let recentFailures = 0;

  for (let i = 0; i < Math.min(sorted.length, MAX_RECENT_FOR_TREND); i += 1) {
    const log = sorted[i];
    if (isSuccessful(log)) {
      if (!lastSuccessful) {
        lastSuccessful = log;
      }
    } else {
      recentFailures += 1;
    }
  }

  const estimatedTrainingMax = lastSuccessful
    ? computeEstimated1RM(lastSuccessful)
    : computeEstimated1RM(lastLog);

  let trend: Trend = 'flat';

  if (recentFailures >= 2) {
    trend = 'struggling';
  } else if (lastSuccessful && lastLog && isSuccessful(lastLog)) {
    const last1RM = computeEstimated1RM(lastSuccessful);
    const current1RM = computeEstimated1RM(lastLog);
    if (last1RM && current1RM && current1RM > last1RM * 1.02) {
      trend = 'progressing';
    }
  }

  if (__DEV__) {
    console.log('[progressionMetrics] metrics', {
      sampleCount: sorted.length,
      recentFailures,
      trend,
      estimatedTrainingMax,
      lastLog: {
        weight: lastLog.weight,
        reps: lastLog.reps,
        scheduled_weight: lastLog.scheduled_weight,
        scheduled_reps: lastLog.scheduled_reps,
      },
    });
  }

  return {
    hasHistory: true,
    lastLog,
    lastSuccessful,
    recentFailures,
    trend,
    estimatedTrainingMax: estimatedTrainingMax ?? null,
  };
};



