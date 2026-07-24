-- Pre-launch security + performance hardening (addresses Supabase advisor findings).

-- 1. SECURITY DEFINER functions: lock execution to service_role only.
-- These RPCs are called exclusively by the generate-workout edge function via
-- the service_role client (supabase/functions/generate-workout/jobs.ts); the
-- app never calls them directly. Supabase default privileges grant EXECUTE to
-- anon/authenticated, which the original migration's REVOKE ... FROM PUBLIC did
-- not clear. Revoke explicitly so they are not callable over the public API.
REVOKE EXECUTE ON FUNCTION public.commit_ai_generation(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_expired_ai_generation_jobs() FROM anon, authenticated;

-- 2. RLS init-plan: wrap auth.uid() in a scalar subquery so it is evaluated once
-- per query instead of once per row. Fixes advisor "Auth RLS Initialization Plan".
DROP POLICY IF EXISTS "v2_user_exercise_prs_select" ON public.v2_user_exercise_prs;
CREATE POLICY "v2_user_exercise_prs_select" ON public.v2_user_exercise_prs
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- 3. Covering indexes for unindexed foreign keys (advisor "Unindexed foreign keys").
CREATE INDEX IF NOT EXISTS idx_v2_ai_generation_jobs_day_id
  ON public.v2_ai_generation_jobs (day_id);
CREATE INDEX IF NOT EXISTS idx_v2_ai_generation_jobs_template_id
  ON public.v2_ai_generation_jobs (template_id);
CREATE INDEX IF NOT EXISTS idx_v2_ai_generations_template_id
  ON public.v2_ai_generations (template_id);
CREATE INDEX IF NOT EXISTS idx_v2_workout_preset_slots_custom_exercise_id
  ON public.v2_workout_preset_slots (custom_exercise_id);
CREATE INDEX IF NOT EXISTS idx_v2_workout_preset_slots_exercise_id
  ON public.v2_workout_preset_slots (exercise_id);
