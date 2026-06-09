-- Exclude warm-up sets from PR detection.
-- Redefines trigger_upsert_exercise_pr with an early return for set_type = 'warmup'
-- and pins search_path (security advisor: function_search_path_mutable).

CREATE OR REPLACE FUNCTION trigger_upsert_exercise_pr()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_session_id uuid;
  v_exercise_id uuid;
  v_custom_exercise_id uuid;
  v_weight numeric;
  v_reps int;
  v_duration_sec int;
  v_pr_type text;
BEGIN
  IF NEW.performed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Warm-up sets are preparatory work and must never register as PRs.
  IF NEW.set_type = 'warmup' THEN
    RETURN NEW;
  END IF;

  -- Timed: duration_sec set
  IF NEW.duration_sec IS NOT NULL THEN
    v_pr_type := 'timed';
    v_duration_sec := NEW.duration_sec;
  ELSIF (NEW.weight IS NULL OR NEW.weight = 0) AND NEW.reps IS NOT NULL THEN
    v_pr_type := 'reps_only';
    v_weight := NULL;
    v_reps := NEW.reps;
    v_duration_sec := NULL;
  ELSIF NEW.weight IS NOT NULL AND NEW.weight > 0 THEN
    v_pr_type := 'weight';
    v_weight := NEW.weight;
    v_reps := NEW.reps;
    v_duration_sec := NULL;
  ELSE
    RETURN NEW;
  END IF;

  SELECT ws.user_id, se.session_id, se.exercise_id, se.custom_exercise_id
  INTO v_user_id, v_session_id, v_exercise_id, v_custom_exercise_id
  FROM v2_session_exercises se
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE se.id = NEW.session_exercise_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_exercise_id IS NOT NULL THEN
    IF v_pr_type = 'weight' THEN
      INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
      VALUES (v_user_id, v_exercise_id, NULL, 'weight', v_weight, v_reps, NULL, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
      ON CONFLICT (user_id, exercise_id, pr_type) WHERE (exercise_id IS NOT NULL)
      DO UPDATE SET weight = EXCLUDED.weight, reps = EXCLUDED.reps, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
      WHERE v2_user_exercise_prs.weight < EXCLUDED.weight
         OR (v2_user_exercise_prs.weight = EXCLUDED.weight AND COALESCE(EXCLUDED.reps, 0) > COALESCE(v2_user_exercise_prs.reps, 0));
    ELSIF v_pr_type = 'reps_only' THEN
      INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
      VALUES (v_user_id, v_exercise_id, NULL, 'reps_only', NULL, v_reps, NULL, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
      ON CONFLICT (user_id, exercise_id, pr_type) WHERE (exercise_id IS NOT NULL)
      DO UPDATE SET reps = EXCLUDED.reps, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
      WHERE v2_user_exercise_prs.reps < EXCLUDED.reps;
    ELSIF v_pr_type = 'timed' THEN
      INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
      VALUES (v_user_id, v_exercise_id, NULL, 'timed', NULL, NULL, v_duration_sec, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
      ON CONFLICT (user_id, exercise_id, pr_type) WHERE (exercise_id IS NOT NULL)
      DO UPDATE SET duration_sec = EXCLUDED.duration_sec, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
      WHERE v2_user_exercise_prs.duration_sec < EXCLUDED.duration_sec;
    END IF;
  ELSIF v_custom_exercise_id IS NOT NULL THEN
    IF v_pr_type = 'weight' THEN
      INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
      VALUES (v_user_id, NULL, v_custom_exercise_id, 'weight', v_weight, v_reps, NULL, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
      ON CONFLICT (user_id, custom_exercise_id, pr_type) WHERE (custom_exercise_id IS NOT NULL)
      DO UPDATE SET weight = EXCLUDED.weight, reps = EXCLUDED.reps, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
      WHERE v2_user_exercise_prs.weight < EXCLUDED.weight
         OR (v2_user_exercise_prs.weight = EXCLUDED.weight AND COALESCE(EXCLUDED.reps, 0) > COALESCE(v2_user_exercise_prs.reps, 0));
    ELSIF v_pr_type = 'reps_only' THEN
      INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
      VALUES (v_user_id, NULL, v_custom_exercise_id, 'reps_only', NULL, v_reps, NULL, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
      ON CONFLICT (user_id, custom_exercise_id, pr_type) WHERE (custom_exercise_id IS NOT NULL)
      DO UPDATE SET reps = EXCLUDED.reps, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
      WHERE v2_user_exercise_prs.reps < EXCLUDED.reps;
    ELSIF v_pr_type = 'timed' THEN
      INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
      VALUES (v_user_id, NULL, v_custom_exercise_id, 'timed', NULL, NULL, v_duration_sec, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
      ON CONFLICT (user_id, custom_exercise_id, pr_type) WHERE (custom_exercise_id IS NOT NULL)
      DO UPDATE SET duration_sec = EXCLUDED.duration_sec, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
      WHERE v2_user_exercise_prs.duration_sec < EXCLUDED.duration_sec;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION trigger_upsert_exercise_pr() IS
  'Upserts v2_user_exercise_prs: weight, reps_only, timed. One row per (user, exercise, pr_type). Warm-up sets (set_type = warmup) are ignored.';
