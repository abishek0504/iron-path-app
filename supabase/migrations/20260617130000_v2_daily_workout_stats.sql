-- Materialized daily workout aggregates for analytics charts (avoids full YTD scans).

CREATE TABLE IF NOT EXISTS public.v2_daily_workout_stats (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  session_count integer NOT NULL DEFAULT 0,
  total_volume_lbs double precision NOT NULL DEFAULT 0,
  total_sets integer NOT NULL DEFAULT 0,
  avg_rpe double precision,
  active_duration_sec integer NOT NULL DEFAULT 0,
  training_load double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

COMMENT ON TABLE public.v2_daily_workout_stats IS
  'Per-user daily rollup of completed workout metrics for analytics queries.';

CREATE INDEX IF NOT EXISTS idx_v2_daily_workout_stats_user_date
  ON public.v2_daily_workout_stats (user_id, date DESC);

ALTER TABLE public.v2_daily_workout_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v2_daily_workout_stats_owner_all" ON public.v2_daily_workout_stats;

CREATE POLICY "v2_daily_workout_stats_owner_all" ON public.v2_daily_workout_stats
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
