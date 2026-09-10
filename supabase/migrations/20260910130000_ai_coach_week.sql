-- AI Coach: profile flags, week generation jobs, and atomic week commit.

ALTER TABLE public.v2_profiles
  ADD COLUMN IF NOT EXISTS ai_coach_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_coach_planned_week_start date;

COMMENT ON COLUMN public.v2_profiles.ai_coach_enabled IS
  'When true, Planner auto-plans remaining training days each local Sun–Sat week.';
COMMENT ON COLUMN public.v2_profiles.ai_coach_planned_week_start IS
  'Local Sunday (YYYY-MM-DD) of the last week AI Coach successfully planned.';

ALTER TABLE public.v2_ai_generations
  DROP CONSTRAINT IF EXISTS v2_ai_generations_source_check;

ALTER TABLE public.v2_ai_generations
  ADD CONSTRAINT v2_ai_generations_source_check
  CHECK (source IN ('openai', 'openai_week', 'gemini', 'fallback', 'error'));

COMMENT ON COLUMN public.v2_ai_generations.source IS
  'openai = day LLM commit, openai_week = week LLM commit, gemini = legacy, fallback = unused result, error = failed call';

CREATE TABLE IF NOT EXISTS public.v2_ai_week_jobs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.v2_workout_templates(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('auto', 'regenerate')),
  week_start_date date NOT NULL,
  days_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generated', 'committed', 'failed')),
  sessions_json jsonb,
  slots_created int NOT NULL DEFAULT 0,
  error_code text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

COMMENT ON TABLE public.v2_ai_week_jobs IS
  'Idempotency + commit state for AI Coach week generation. Service role writes; owner reads.';

CREATE INDEX IF NOT EXISTS idx_v2_ai_week_jobs_user_id
  ON public.v2_ai_week_jobs (user_id, id);

CREATE INDEX IF NOT EXISTS idx_v2_ai_week_jobs_expires_at
  ON public.v2_ai_week_jobs (expires_at);

ALTER TABLE public.v2_ai_week_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v2_ai_week_jobs_owner_select ON public.v2_ai_week_jobs;
CREATE POLICY v2_ai_week_jobs_owner_select ON public.v2_ai_week_jobs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.v2_ai_generations
  ADD COLUMN IF NOT EXISTS week_job_id uuid
  REFERENCES public.v2_ai_week_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_v2_ai_generations_week_job_id
  ON public.v2_ai_generations (week_job_id)
  WHERE week_job_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_ai_day_plan(
  p_user_id uuid,
  p_template_id uuid,
  p_day_id uuid,
  p_day_name text,
  p_session_start timestamptz,
  p_session_end timestamptz,
  p_sessions_json jsonb,
  p_experience text,
  p_bodyweight numeric,
  p_use_imperial boolean
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sort_order int;
  session_ids uuid[];
  existing_count int;
  s_idx int;
  group_len int;
  e_idx int;
  plan jsonb;
  exercise_id uuid;
  target_session_id uuid;
  new_session_id uuid;
  slot_id uuid;
  se_id uuid;
  tgt record;
  set_n int;
  v_slots_created int := 0;
  v_seen uuid[] := '{}';
BEGIN
  PERFORM public.clear_plan_day_for_ai_replace(
    p_user_id,
    p_day_id,
    p_session_start,
    p_session_end
  );

  SELECT COALESCE(MAX(ts.sort_order), 0)
  INTO sort_order
  FROM public.v2_template_slots ts
  WHERE ts.day_id = p_day_id;

  SELECT COALESCE(array_agg(s.id ORDER BY s.started_at ASC), ARRAY[]::uuid[])
  INTO session_ids
  FROM public.v2_workout_sessions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.started_at >= p_session_start
    AND s.started_at < p_session_end;

  existing_count := COALESCE(array_length(session_ids, 1), 0);
  group_len := jsonb_array_length(p_sessions_json);

  FOR s_idx IN 0..(group_len - 1) LOOP
    IF (p_sessions_json->s_idx) IS NULL
       OR jsonb_array_length(p_sessions_json->s_idx) = 0 THEN
      CONTINUE;
    END IF;

    IF s_idx + 1 <= existing_count THEN
      target_session_id := session_ids[s_idx + 1];
    ELSE
      INSERT INTO public.v2_workout_sessions (
        user_id, template_id, day_name, status, started_at
      ) VALUES (
        p_user_id,
        p_template_id,
        p_day_name,
        'active',
        p_session_start
      )
      RETURNING id INTO new_session_id;
      target_session_id := new_session_id;
      existing_count := existing_count + 1;
      session_ids := session_ids || new_session_id;
    END IF;

    FOR e_idx IN 0..(jsonb_array_length(p_sessions_json->s_idx) - 1) LOOP
      plan := p_sessions_json->s_idx->e_idx;
      exercise_id := (plan->>'exercise_id')::uuid;
      IF exercise_id IS NULL THEN
        CONTINUE;
      END IF;
      IF exercise_id = ANY(v_seen) THEN
        CONTINUE;
      END IF;
      v_seen := v_seen || exercise_id;

      sort_order := sort_order + 1;

      INSERT INTO public.v2_template_slots (
        day_id, exercise_id, experience, notes, sort_order
      ) VALUES (
        p_day_id, exercise_id, NULL, NULL, sort_order
      )
      RETURNING id INTO slot_id;

      v_slots_created := v_slots_created + 1;

      INSERT INTO public.v2_session_exercises (
        session_id, exercise_id, custom_exercise_id, sort_order
      ) VALUES (
        target_session_id, exercise_id, NULL, sort_order
      )
      RETURNING id INTO se_id;

      SELECT * INTO tgt
      FROM public.resolve_ai_exercise_targets(
        exercise_id, p_experience, plan, p_bodyweight, p_use_imperial
      );

      IF tgt.sets IS NULL THEN
        CONTINUE;
      END IF;

      FOR set_n IN 1..tgt.sets LOOP
        INSERT INTO public.v2_session_sets (
          session_exercise_id,
          set_number,
          reps,
          weight,
          duration_sec,
          rpe,
          rir,
          rest_sec,
          notes
        ) VALUES (
          se_id,
          set_n,
          tgt.reps,
          tgt.weight,
          tgt.duration_sec,
          NULL,
          NULL,
          NULL,
          NULL
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_slots_created;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ai_day_plan(uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, text, numeric, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_ai_day_plan(uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, text, numeric, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.apply_ai_day_plan(uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, text, numeric, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_day_plan(uuid, uuid, uuid, text, timestamptz, timestamptz, jsonb, text, numeric, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_ai_week(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job record;
  tmpl_user_id uuid;
  experience text;
  bodyweight numeric;
  use_imperial boolean;
  day_item jsonb;
  day_id uuid;
  day_name text;
  day_template_id uuid;
  session_start timestamptz;
  session_end timestamptz;
  day_sessions jsonb;
  matched jsonb;
  v_slots_created int := 0;
  day_slots int;
BEGIN
  SELECT *
  INTO job
  FROM public.v2_ai_week_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'week_job_not_found';
  END IF;

  IF job.expires_at < now() THEN
    UPDATE public.v2_ai_week_jobs
    SET status = 'failed', error_code = 'job_expired', updated_at = now()
    WHERE id = p_job_id;
    RAISE EXCEPTION 'week_job_expired';
  END IF;

  IF job.status = 'committed' THEN
    RETURN jsonb_build_object('slots_created', job.slots_created);
  END IF;

  IF job.status <> 'generated' OR job.sessions_json IS NULL THEN
    RAISE EXCEPTION 'week_job_not_ready';
  END IF;

  SELECT t.user_id
  INTO tmpl_user_id
  FROM public.v2_workout_templates t
  WHERE t.id = job.template_id;

  IF tmpl_user_id IS NULL OR tmpl_user_id <> job.user_id THEN
    UPDATE public.v2_ai_week_jobs
    SET status = 'failed', error_code = 'ownership_mismatch', updated_at = now()
    WHERE id = p_job_id;
    RAISE EXCEPTION 'week_job_ownership_mismatch';
  END IF;

  SELECT COALESCE(p.experience_level, 'beginner'), p.current_weight, COALESCE(p.use_imperial, true)
  INTO experience, bodyweight, use_imperial
  FROM public.v2_profiles p
  WHERE p.id = job.user_id;

  FOR day_item IN SELECT value FROM jsonb_array_elements(job.days_json)
  LOOP
    day_id := COALESCE(
      (day_item->>'dayId')::uuid,
      (day_item->>'day_id')::uuid
    );
    day_name := COALESCE(day_item->>'dayName', day_item->>'day_name');
    session_start := COALESCE(
      (day_item->>'sessionStartIso')::timestamptz,
      (day_item->>'session_start_iso')::timestamptz
    );
    session_end := COALESCE(
      (day_item->>'sessionEndIsoExclusive')::timestamptz,
      (day_item->>'session_end_iso_exclusive')::timestamptz
    );

    IF day_id IS NULL OR day_name IS NULL OR session_start IS NULL OR session_end IS NULL THEN
      CONTINUE;
    END IF;

    SELECT d.template_id
    INTO day_template_id
    FROM public.v2_template_days d
    WHERE d.id = day_id;

    IF day_template_id IS NULL OR day_template_id <> job.template_id THEN
      UPDATE public.v2_ai_week_jobs
      SET status = 'failed', error_code = 'ownership_mismatch', updated_at = now()
      WHERE id = p_job_id;
      RAISE EXCEPTION 'week_job_day_mismatch';
    END IF;

    matched := NULL;
    SELECT value
    INTO matched
    FROM jsonb_array_elements(job.sessions_json) AS value
    WHERE value->>'day_id' = day_id::text
    LIMIT 1;

    IF matched IS NULL THEN
      CONTINUE;
    END IF;

    day_sessions := matched->'sessions';
    IF day_sessions IS NULL OR jsonb_typeof(day_sessions) <> 'array' THEN
      CONTINUE;
    END IF;

    day_slots := public.apply_ai_day_plan(
      job.user_id,
      job.template_id,
      day_id,
      day_name,
      session_start,
      session_end,
      day_sessions,
      experience,
      bodyweight,
      use_imperial
    );
    v_slots_created := v_slots_created + day_slots;
  END LOOP;

  IF v_slots_created = 0 THEN
    UPDATE public.v2_ai_week_jobs
    SET status = 'failed', error_code = 'no_slots_created', updated_at = now()
    WHERE id = p_job_id;
    RAISE EXCEPTION 'week_no_slots_created';
  END IF;

  UPDATE public.v2_ai_week_jobs
  SET status = 'committed',
      slots_created = v_slots_created,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('slots_created', v_slots_created);
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.v2_ai_week_jobs
    SET status = 'failed',
        error_code = LEFT(SQLERRM, 200),
        updated_at = now()
    WHERE id = p_job_id
      AND status <> 'committed';
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_ai_week(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_ai_week(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.commit_ai_week(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.commit_ai_week(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_ai_week_jobs()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.v2_ai_week_jobs
    WHERE expires_at < now() - interval '1 day'
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_ai_week_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_ai_week_jobs() TO service_role;
