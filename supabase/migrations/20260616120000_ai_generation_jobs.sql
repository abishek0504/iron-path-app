-- Idempotency ledger for AI day generation (OpenAI result cache + commit state).

CREATE TABLE IF NOT EXISTS public.v2_ai_generation_jobs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.v2_workout_templates(id) ON DELETE CASCADE,
  day_id uuid NOT NULL REFERENCES public.v2_template_days(id) ON DELETE CASCADE,
  day_name text NOT NULL,
  sessions_per_day int NOT NULL CHECK (sessions_per_day >= 0 AND sessions_per_day <= 6),
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_start_iso timestamptz NOT NULL,
  session_end_iso_exclusive timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generated', 'committed', 'failed')),
  sessions_json jsonb,
  slots_created int NOT NULL DEFAULT 0,
  error_code text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

COMMENT ON TABLE public.v2_ai_generation_jobs IS
  'Idempotency + commit state for AI workout generation. Service role writes; owner reads.';

CREATE INDEX IF NOT EXISTS idx_v2_ai_generation_jobs_user_id
  ON public.v2_ai_generation_jobs (user_id, id);

CREATE INDEX IF NOT EXISTS idx_v2_ai_generation_jobs_expires_at
  ON public.v2_ai_generation_jobs (expires_at);

ALTER TABLE public.v2_ai_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v2_ai_generation_jobs_owner_select ON public.v2_ai_generation_jobs;
CREATE POLICY v2_ai_generation_jobs_owner_select ON public.v2_ai_generation_jobs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.v2_ai_generations
  ADD COLUMN IF NOT EXISTS generation_job_id uuid
  REFERENCES public.v2_ai_generation_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_v2_ai_generations_generation_job_id
  ON public.v2_ai_generations (generation_job_id)
  WHERE generation_job_id IS NOT NULL;
