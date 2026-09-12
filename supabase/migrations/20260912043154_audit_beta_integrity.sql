-- Audit remediations: PR recompute by type, bodyweight AI fill,
-- week-job execute revoke, private progress-photo storage, purge paths.

CREATE OR REPLACE FUNCTION public.recompute_user_exercise_pr(
  p_user_id uuid,
  p_exercise_id uuid,
  p_custom_exercise_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  best_weight record;
  best_reps record;
  best_timed record;
  v_is_stretch boolean;
BEGIN
  IF p_exercise_id IS NOT NULL THEN
    SELECT COALESCE(e.is_stretch, false) INTO v_is_stretch
    FROM public.v2_exercises e
    WHERE e.id = p_exercise_id;
  END IF;

  DELETE FROM public.v2_user_exercise_prs
  WHERE user_id = p_user_id
    AND (
      (p_exercise_id IS NOT NULL AND exercise_id = p_exercise_id)
      OR (p_custom_exercise_id IS NOT NULL AND custom_exercise_id = p_custom_exercise_id)
    );

  IF COALESCE(v_is_stretch, false) THEN
    RETURN;
  END IF;

  SELECT
    ss.id AS set_id,
    ss.weight,
    ss.reps,
    ss.performed_at,
    se.id AS session_exercise_id,
    se.session_id,
    se.exercise_id,
    se.custom_exercise_id
  INTO best_weight
  FROM public.v2_session_sets ss
  JOIN public.v2_session_exercises se ON se.id = ss.session_exercise_id
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE ws.user_id = p_user_id
    AND ss.performed_at IS NOT NULL
    AND COALESCE(ss.set_type, 'normal') <> 'warmup'
    AND ss.weight IS NOT NULL
    AND ss.weight > 0
    AND (
      (p_exercise_id IS NOT NULL AND se.exercise_id = p_exercise_id)
      OR (p_custom_exercise_id IS NOT NULL AND se.custom_exercise_id = p_custom_exercise_id)
    )
  ORDER BY ss.weight DESC, COALESCE(ss.reps, 0) DESC, ss.performed_at DESC
  LIMIT 1;

  IF best_weight.set_id IS NOT NULL THEN
    INSERT INTO public.v2_user_exercise_prs (
      user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec,
      set_id, session_exercise_id, session_id, performed_at
    ) VALUES (
      p_user_id, best_weight.exercise_id, best_weight.custom_exercise_id, 'weight',
      best_weight.weight, best_weight.reps, NULL,
      best_weight.set_id, best_weight.session_exercise_id, best_weight.session_id, best_weight.performed_at
    );
  END IF;

  SELECT
    ss.id AS set_id,
    ss.reps,
    ss.performed_at,
    se.id AS session_exercise_id,
    se.session_id,
    se.exercise_id,
    se.custom_exercise_id
  INTO best_reps
  FROM public.v2_session_sets ss
  JOIN public.v2_session_exercises se ON se.id = ss.session_exercise_id
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE ws.user_id = p_user_id
    AND ss.performed_at IS NOT NULL
    AND COALESCE(ss.set_type, 'normal') <> 'warmup'
    AND ss.duration_sec IS NULL
    AND (ss.weight IS NULL OR ss.weight = 0)
    AND ss.reps IS NOT NULL
    AND (
      (p_exercise_id IS NOT NULL AND se.exercise_id = p_exercise_id)
      OR (p_custom_exercise_id IS NOT NULL AND se.custom_exercise_id = p_custom_exercise_id)
    )
  ORDER BY ss.reps DESC, ss.performed_at DESC
  LIMIT 1;

  IF best_reps.set_id IS NOT NULL THEN
    INSERT INTO public.v2_user_exercise_prs (
      user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec,
      set_id, session_exercise_id, session_id, performed_at
    ) VALUES (
      p_user_id, best_reps.exercise_id, best_reps.custom_exercise_id, 'reps_only',
      NULL, best_reps.reps, NULL,
      best_reps.set_id, best_reps.session_exercise_id, best_reps.session_id, best_reps.performed_at
    );
  END IF;

  SELECT
    ss.id AS set_id,
    ss.duration_sec,
    ss.performed_at,
    se.id AS session_exercise_id,
    se.session_id,
    se.exercise_id,
    se.custom_exercise_id
  INTO best_timed
  FROM public.v2_session_sets ss
  JOIN public.v2_session_exercises se ON se.id = ss.session_exercise_id
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE ws.user_id = p_user_id
    AND ss.performed_at IS NOT NULL
    AND COALESCE(ss.set_type, 'normal') <> 'warmup'
    AND ss.duration_sec IS NOT NULL
    AND (
      (p_exercise_id IS NOT NULL AND se.exercise_id = p_exercise_id)
      OR (p_custom_exercise_id IS NOT NULL AND se.custom_exercise_id = p_custom_exercise_id)
    )
  ORDER BY ss.duration_sec DESC, ss.performed_at DESC
  LIMIT 1;

  IF best_timed.set_id IS NOT NULL THEN
    INSERT INTO public.v2_user_exercise_prs (
      user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec,
      set_id, session_exercise_id, session_id, performed_at
    ) VALUES (
      p_user_id, best_timed.exercise_id, best_timed.custom_exercise_id, 'timed',
      NULL, NULL, best_timed.duration_sec,
      best_timed.set_id, best_timed.session_exercise_id, best_timed.session_id, best_timed.performed_at
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_pr_after_set_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_exercise_id uuid;
  v_custom_exercise_id uuid;
BEGIN
  SELECT ws.user_id, se.exercise_id, se.custom_exercise_id
  INTO v_user_id, v_exercise_id, v_custom_exercise_id
  FROM public.v2_session_exercises se
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE se.id = OLD.session_exercise_id;

  IF v_user_id IS NOT NULL THEN
    PERFORM public.recompute_user_exercise_pr(v_user_id, v_exercise_id, v_custom_exercise_id);
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_user_exercise_pr(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recompute_pr_after_set_delete() FROM PUBLIC, anon, authenticated;

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
SET search_path = public, pg_temp
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

    IF v_mode = 'reps' AND weight IS NULL THEN
      SELECT p.suggested_weight_lbs, p.suggested_weight_kg, p.suggested_weight_multiplier_bw
      INTO rx
      FROM public.v2_exercise_prescriptions p
      WHERE p.exercise_id = p_exercise_id
        AND p.experience = p_experience
        AND p.mode = v_mode
        AND p.is_active = true
      LIMIT 1;

      IF FOUND THEN
        IF rx.suggested_weight_multiplier_bw IS NOT NULL AND rx.suggested_weight_multiplier_bw = 0 THEN
          weight := 0;
        ELSIF rx.suggested_weight_multiplier_bw IS NOT NULL AND rx.suggested_weight_multiplier_bw > 0
           AND p_bodyweight IS NOT NULL AND p_bodyweight > 0 THEN
          weight := ROUND((p_bodyweight * rx.suggested_weight_multiplier_bw) * 2) / 2;
        ELSIF p_use_imperial THEN
          weight := COALESCE(rx.suggested_weight_lbs, 0);
        ELSE
          weight := COALESCE(rx.suggested_weight_kg, 0);
        END IF;
      END IF;
    END IF;

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
    IF rx.suggested_weight_multiplier_bw IS NOT NULL AND rx.suggested_weight_multiplier_bw = 0 THEN
      weight := 0;
    ELSIF rx.suggested_weight_multiplier_bw IS NOT NULL AND rx.suggested_weight_multiplier_bw > 0
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

REVOKE ALL ON FUNCTION public.resolve_ai_exercise_targets(uuid, text, jsonb, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ai_exercise_targets(uuid, text, jsonb, numeric, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.purge_expired_ai_week_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_ai_week_jobs() TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS progress_photos_select_own ON storage.objects;
DROP POLICY IF EXISTS progress_photos_insert_own ON storage.objects;
DROP POLICY IF EXISTS progress_photos_update_own ON storage.objects;
DROP POLICY IF EXISTS progress_photos_delete_own ON storage.objects;

CREATE POLICY progress_photos_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-photos'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY progress_photos_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'progress-photos'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY progress_photos_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'progress-photos'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'progress-photos'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY progress_photos_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'progress-photos'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  purged integer := 0;
  account record;
BEGIN
  FOR account IN
    SELECT id
    FROM public.v2_profiles
    WHERE scheduled_purge_at IS NOT NULL
      AND scheduled_purge_at <= now()
    LIMIT 50
  LOOP
    DELETE FROM storage.objects
    WHERE (
      bucket_id = 'avatars'
      AND (
        name LIKE account.id::text || '-%'
        OR name LIKE account.id::text || '/progress/%'
        OR owner_id = account.id::text
      )
    ) OR (
      bucket_id = 'progress-photos'
      AND (
        name LIKE account.id::text || '/%'
        OR owner_id = account.id::text
      )
    );

    DELETE FROM auth.users WHERE id = account.id;
    purged := purged + 1;
  END LOOP;

  RETURN purged;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_soft_deleted_accounts() FROM PUBLIC, anon, authenticated;
