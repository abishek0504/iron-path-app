/** Shared analytics row shapes — query layer maps DB rows into these. */

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export type AnalyticsSetRow = {
  weight: number | null;
  reps: number | null;
  duration_sec: number | null;
  rpe: number | null;
  rir: number | null;
  set_type: SetType | string | null;
  rest_sec: number | null;
  performed_at: string | null;
  session_exercise_id: string;
  exercise_id?: string | null;
  custom_exercise_id?: string | null;
  session_id?: string;
  completed_at?: string | null;
};

export type ExerciseMeta = {
  id: string;
  primary_muscles: string[] | null;
  implicit_hits: Record<string, number> | null;
  is_stretch?: boolean;
  name?: string;
};

export type SessionSummaryInput = {
  sessionId: string;
  completedAt: string;
  startedAt: string;
  sets: AnalyticsSetRow[];
  exerciseMetaByKey: Map<string, ExerciseMeta>;
};

export type TrendGranularity = 'day' | 'week' | 'month';

export type TrendPoint = {
  bucketKey: string;
  label: string;
  value: number;
};

export type DateRange = {
  start: Date;
  end: Date;
};
