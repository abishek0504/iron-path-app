-- Health metrics captured per completed workout session (Apple Health + in-app analytics).

CREATE TABLE IF NOT EXISTS public.v2_session_health_metrics (
  session_id uuid PRIMARY KEY REFERENCES public.v2_workout_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_energy_kcal double precision,
  energy_source text CHECK (energy_source IN ('estimated', 'watch', 'healthkit')),
  avg_heart_rate_bpm integer,
  max_heart_rate_bpm integer,
  active_duration_sec integer,
  total_volume_kg double precision,
  hk_energy_sample_uuid text,
  heart_rate_sample_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_session_health_metrics_hk_energy_uuid
  ON public.v2_session_health_metrics (hk_energy_sample_uuid)
  WHERE hk_energy_sample_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v2_session_health_metrics_user_id
  ON public.v2_session_health_metrics (user_id);

COMMENT ON TABLE public.v2_session_health_metrics IS
  'Per-session health analytics synced with Apple Health (calories, HR, volume).';

ALTER TABLE public.v2_session_health_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v2_session_health_metrics_owner_all" ON public.v2_session_health_metrics;

CREATE POLICY "v2_session_health_metrics_owner_all" ON public.v2_session_health_metrics
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
