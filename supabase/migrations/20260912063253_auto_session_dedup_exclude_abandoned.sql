-- Abandoned auto sessions must not block rematerialize / Start.
-- Dedup stays on live or completed auto rows only.

DROP INDEX IF EXISTS public.uq_v2_workout_sessions_auto_per_day;

CREATE UNIQUE INDEX uq_v2_workout_sessions_auto_per_day
  ON public.v2_workout_sessions (user_id, day_name, ((started_at AT TIME ZONE 'UTC')::date))
  WHERE origin = 'auto' AND status IS DISTINCT FROM 'abandoned';
