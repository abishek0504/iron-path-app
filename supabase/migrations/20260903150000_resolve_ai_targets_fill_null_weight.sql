-- When the LLM returns sets+reps but leaves weight null (no history / cannot
-- estimate safely), fill a starting load from the exercise prescription and
-- the user's bodyweight. Matches selectExerciseTargets no-history behavior.

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
        IF rx.suggested_weight_multiplier_bw IS NOT NULL AND rx.suggested_weight_multiplier_bw > 0
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
