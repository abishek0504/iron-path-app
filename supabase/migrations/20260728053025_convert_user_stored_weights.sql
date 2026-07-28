-- Convert all user-owned display-unit weights when switching imperial ↔ metric.
-- Does NOT flip v2_profiles.use_imperial; the client updates that after a successful call.

CREATE OR REPLACE FUNCTION public.convert_user_stored_weights(p_to_imperial boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from_imperial boolean;
  v_factor numeric;
  v_lbs_per_kg constant numeric := 2.20462;
  v_lb_to_kg constant numeric := 0.45359237;
  v_profile_updated int := 0;
  v_logs_updated int := 0;
  v_sets_updated int := 0;
  v_prs_updated int := 0;
  v_overrides_updated int := 0;
  v_daily_updated int := 0;
  v_health_updated int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(use_imperial, true)
  INTO v_from_imperial
  FROM public.v2_profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_from_imperial = p_to_imperial THEN
    RETURN jsonb_build_object(
      'converted', false,
      'reason', 'already_in_target_unit'
    );
  END IF;

  v_factor := CASE
    WHEN p_to_imperial THEN v_lbs_per_kg
    ELSE 1.0 / v_lbs_per_kg
  END;

  -- Profile body weight fields (nearest integer)
  UPDATE public.v2_profiles
  SET
    current_weight = CASE
      WHEN current_weight IS NOT NULL THEN ROUND(current_weight * v_factor)
      ELSE NULL
    END,
    goal_weight = CASE
      WHEN goal_weight IS NOT NULL THEN ROUND(goal_weight * v_factor)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = v_uid;
  GET DIAGNOSTICS v_profile_updated = ROW_COUNT;

  -- Weight tracker history (nearest integer)
  UPDATE public.v2_weight_logs
  SET weight = ROUND(weight * v_factor)
  WHERE user_id = v_uid;
  GET DIAGNOSTICS v_logs_updated = ROW_COUNT;

  -- Session set weights: planned + performed (1 decimal)
  UPDATE public.v2_session_sets ss
  SET weight = ROUND((ss.weight * v_factor)::numeric, 1)
  FROM public.v2_session_exercises se
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE se.id = ss.session_exercise_id
    AND ws.user_id = v_uid
    AND ss.weight IS NOT NULL;
  GET DIAGNOSTICS v_sets_updated = ROW_COUNT;

  -- PR cache
  UPDATE public.v2_user_exercise_prs
  SET weight = ROUND((weight * v_factor)::numeric, 1)
  WHERE user_id = v_uid;
  GET DIAGNOSTICS v_prs_updated = ROW_COUNT;

  -- Per-exercise defaults
  UPDATE public.v2_user_exercise_overrides
  SET default_weight = ROUND((default_weight * v_factor)::numeric, 1)
  WHERE user_id = v_uid
    AND default_weight IS NOT NULL;
  GET DIAGNOSTICS v_overrides_updated = ROW_COUNT;

  -- Daily volume rollup scales with weight (column name stays; value is display-unit volume)
  UPDATE public.v2_daily_workout_stats
  SET
    total_volume_lbs = total_volume_lbs * v_factor,
    updated_at = now()
  WHERE user_id = v_uid;
  GET DIAGNOSTICS v_daily_updated = ROW_COUNT;

  -- Health metrics store true kg; recompute from converted set weights
  UPDATE public.v2_session_health_metrics shm
  SET total_volume_kg = sub.volume_kg
  FROM (
    SELECT
      ws.id AS session_id,
      CASE
        WHEN p_to_imperial THEN COALESCE(SUM(ss.weight * COALESCE(ss.reps, 0)), 0) * v_lb_to_kg
        ELSE COALESCE(SUM(ss.weight * COALESCE(ss.reps, 0)), 0)
      END AS volume_kg
    FROM public.v2_workout_sessions ws
    JOIN public.v2_session_exercises se ON se.session_id = ws.id
    JOIN public.v2_session_sets ss ON ss.session_exercise_id = se.id
    WHERE ws.user_id = v_uid
      AND ss.performed_at IS NOT NULL
      AND ss.set_type <> 'warmup'
      AND ss.weight IS NOT NULL
      AND ss.reps IS NOT NULL
    GROUP BY ws.id
  ) sub
  WHERE shm.session_id = sub.session_id
    AND shm.user_id = v_uid;
  GET DIAGNOSTICS v_health_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'converted', true,
    'from_imperial', v_from_imperial,
    'to_imperial', p_to_imperial,
    'factor', v_factor,
    'profile_rows', v_profile_updated,
    'weight_log_rows', v_logs_updated,
    'session_set_rows', v_sets_updated,
    'pr_rows', v_prs_updated,
    'override_rows', v_overrides_updated,
    'daily_stats_rows', v_daily_updated,
    'health_metrics_rows', v_health_updated
  );
END;
$$;

COMMENT ON FUNCTION public.convert_user_stored_weights(boolean) IS
  'Convert caller''s stored display-unit weights between lbs and kg. Does not change use_imperial.';

REVOKE ALL ON FUNCTION public.convert_user_stored_weights(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_user_stored_weights(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.convert_user_stored_weights(boolean) TO authenticated;
