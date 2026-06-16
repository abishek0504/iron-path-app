-- Target resolution + atomic commit for AI generation jobs.

CREATE OR REPLACE FUNCTION public.resolve_ai_exercise_targets(
  p_exercise_id uuid,
  p_experience text,
  p_ai_plan jsonb,
  p_bodyweight numeric DEFAULT NULL,
  p_use_imperial boolean DEFAULT true
)
RETURNS TABLE (
  sets int,
  reps int,
  duration_sec int,
  weight numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_is_timed boolean;
  v_is_stretch boolean;
  v_mode text;
  v_sets int;
  v_reps int;
  v_duration int;
  v_weight numeric;
  rx record;
BEGIN
  SELECT e.is_timed, COALESCE(e.is_stretch, false)
  INTO v_is_timed, v_is_stretch
  FROM public.v2_exercises e
  WHERE e.id = p_exercise_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_mode := CASE WHEN v_is_timed OR v_is_stretch THEN 'timed' ELSE 'reps' END;

  v_sets := NULLIF((p_ai_plan->>'sets')::int, 0);
  v_reps := (p_ai_plan->>'reps')::int;
  v_duration := (p_ai_plan->>'duration_sec')::int;
  v_weight := (p_ai_plan->>'weight')::numeric;

  IF v_sets IS NOT NULL AND (
    (v_mode = 'reps' AND v_reps IS NOT NULL) OR
    (v_mode = 'timed' AND v_duration IS NOT NULL)
  ) THEN
    sets := v_sets;
    reps := CASE WHEN v_mode = 'reps' THEN v_reps ELSE NULL END;
    duration_sec := CASE WHEN v_mode = 'timed' THEN v_duration ELSE NULL END;
    weight := CASE WHEN v_mode = 'reps' THEN v_weight ELSE NULL END;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.sets_min, p.sets_max, p.reps_min, p.reps_max,
         p.duration_sec_min, p.duration_sec_max,
         p.suggested_weight_lbs, p.suggested_weight_kg,
         p.suggested_weight_multiplier_bw
  INTO rx
  FROM public.v2_exercise_prescriptions p
  WHERE p.exercise_id = p_exercise_id
    AND p.experience = p_experience
    AND p.mode = v_mode
    AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  sets := GREATEST(1, ROUND((rx.sets_min + rx.sets_max)::numeric / 2.0)::int);

  IF v_mode = 'reps' THEN
    reps := GREATEST(
      rx.reps_min,
      LEAST(rx.reps_max, ROUND((rx.reps_min + rx.reps_max)::numeric / 2.0)::int)
    );
    duration_sec := NULL;
    IF rx.suggested_weight_multiplier_bw IS NOT NULL AND rx.suggested_weight_multiplier_bw > 0
       AND p_bodyweight IS NOT NULL AND p_bodyweight > 0 THEN
      weight := ROUND((p_bodyweight * rx.suggested_weight_multiplier_bw) * 2) / 2;
    ELSIF p_use_imperial THEN
      weight := COALESCE(rx.suggested_weight_lbs, 0);
    ELSE
      weight := COALESCE(rx.suggested_weight_kg, 0);
    END IF;
  ELSE
    reps := NULL;
    duration_sec := GREATEST(
      rx.duration_sec_min,
      LEAST(
        rx.duration_sec_max,
        ROUND((rx.duration_sec_min + rx.duration_sec_max)::numeric / 2.0)::int
      )
    );
    weight := NULL;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ai_exercise_targets(uuid, text, jsonb, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_ai_exercise_targets(uuid, text, jsonb, numeric, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_ai_generation(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job record;
  tmpl_user_id uuid;
  day_template_id uuid;
  experience text;
  bodyweight numeric;
  use_imperial boolean;
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
BEGIN
  SELECT *
  INTO job
  FROM public.v2_ai_generation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'generation_job_not_found';
  END IF;

  IF job.expires_at < now() THEN
    UPDATE public.v2_ai_generation_jobs
    SET status = 'failed', error_code = 'job_expired', updated_at = now()
    WHERE id = p_job_id;
    RAISE EXCEPTION 'generation_job_expired';
  END IF;

  IF job.status = 'committed' THEN
    RETURN jsonb_build_object('slots_created', job.slots_created);
  END IF;

  IF job.status <> 'generated' OR job.sessions_json IS NULL THEN
    RAISE EXCEPTION 'generation_job_not_ready';
  END IF;

  SELECT t.user_id, d.template_id
  INTO tmpl_user_id, day_template_id
  FROM public.v2_template_days d
  JOIN public.v2_workout_templates t ON t.id = d.template_id
  WHERE d.id = job.day_id;

  IF tmpl_user_id IS NULL OR tmpl_user_id <> job.user_id OR day_template_id <> job.template_id THEN
    UPDATE public.v2_ai_generation_jobs
    SET status = 'failed', error_code = 'ownership_mismatch', updated_at = now()
    WHERE id = p_job_id;
    RAISE EXCEPTION 'generation_job_ownership_mismatch';
  END IF;

  SELECT COALESCE(p.experience_level, 'beginner'), p.current_weight, COALESCE(p.use_imperial, true)
  INTO experience, bodyweight, use_imperial
  FROM public.v2_profiles p
  WHERE p.id = job.user_id;

  SELECT COALESCE(MAX(ts.sort_order), 0)
  INTO sort_order
  FROM public.v2_template_slots ts
  WHERE ts.day_id = job.day_id;

  SELECT COALESCE(array_agg(s.id ORDER BY s.started_at ASC), ARRAY[]::uuid[])
  INTO session_ids
  FROM public.v2_workout_sessions s
  WHERE s.user_id = job.user_id
    AND s.started_at >= job.session_start_iso
    AND s.started_at < job.session_end_iso_exclusive;

  existing_count := COALESCE(array_length(session_ids, 1), 0);
  group_len := jsonb_array_length(job.sessions_json);

  FOR s_idx IN 0..(group_len - 1) LOOP
    IF (job.sessions_json->s_idx) IS NULL
       OR jsonb_array_length(job.sessions_json->s_idx) = 0 THEN
      CONTINUE;
    END IF;

    IF s_idx + 1 <= existing_count THEN
      target_session_id := session_ids[s_idx + 1];
    ELSE
      INSERT INTO public.v2_workout_sessions (
        user_id, template_id, day_name, status, started_at
      ) VALUES (
        job.user_id,
        job.template_id,
        job.day_name,
        'active',
        job.session_start_iso
      )
      RETURNING id INTO new_session_id;
      target_session_id := new_session_id;
      existing_count := existing_count + 1;
      session_ids := session_ids || new_session_id;
    END IF;

    FOR e_idx IN 0..(jsonb_array_length(job.sessions_json->s_idx) - 1) LOOP
      plan := job.sessions_json->s_idx->e_idx;
      exercise_id := (plan->>'exercise_id')::uuid;
      IF exercise_id IS NULL THEN
        CONTINUE;
      END IF;

      sort_order := sort_order + 1;

      INSERT INTO public.v2_template_slots (
        day_id, exercise_id, experience, notes, sort_order
      ) VALUES (
        job.day_id, exercise_id, NULL, NULL, sort_order
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
        exercise_id, experience, plan, bodyweight, use_imperial
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

  IF v_slots_created = 0 THEN
    UPDATE public.v2_ai_generation_jobs
    SET status = 'failed', error_code = 'no_slots_created', updated_at = now()
    WHERE id = p_job_id;
    RAISE EXCEPTION 'generation_no_slots_created';
  END IF;

  UPDATE public.v2_ai_generation_jobs
  SET status = 'committed',
      slots_created = v_slots_created,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('slots_created', v_slots_created);
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.v2_ai_generation_jobs
    SET status = 'failed',
        error_code = LEFT(SQLERRM, 200),
        updated_at = now()
    WHERE id = p_job_id
      AND status <> 'committed';
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_ai_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_ai_generation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_ai_generation_jobs()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.v2_ai_generation_jobs
    WHERE expires_at < now() - interval '1 day'
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_ai_generation_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_ai_generation_jobs() TO service_role;
