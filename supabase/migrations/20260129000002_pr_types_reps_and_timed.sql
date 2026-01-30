-- Add support for bodyweight (reps-only) and timed PRs.
-- pr_type: 'weight' | 'reps_only' | 'timed'. One row per (user, exercise, pr_type).

ALTER TABLE v2_user_exercise_prs
  ADD COLUMN IF NOT EXISTS pr_type text NOT NULL DEFAULT 'weight'
    CHECK (pr_type IN ('weight', 'reps_only', 'timed')),
  ADD COLUMN IF NOT EXISTS duration_sec int;

ALTER TABLE v2_user_exercise_prs
  ALTER COLUMN weight DROP NOT NULL;

ALTER TABLE v2_user_exercise_prs
  ADD CONSTRAINT v2_user_exercise_prs_type_check CHECK (
    (pr_type = 'weight' AND weight IS NOT NULL) OR
    (pr_type = 'reps_only' AND weight IS NULL AND reps IS NOT NULL) OR
    (pr_type = 'timed' AND weight IS NULL AND reps IS NULL AND duration_sec IS NOT NULL)
  );

DROP INDEX IF EXISTS idx_v2_user_exercise_prs_master;
DROP INDEX IF EXISTS idx_v2_user_exercise_prs_custom;
DROP INDEX IF EXISTS idx_v2_user_exercise_prs_user_weight;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_master
  ON v2_user_exercise_prs (user_id, exercise_id, pr_type) WHERE exercise_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_custom
  ON v2_user_exercise_prs (user_id, custom_exercise_id, pr_type) WHERE custom_exercise_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_user_order
  ON v2_user_exercise_prs (user_id, weight DESC NULLS LAST, reps DESC NULLS LAST, duration_sec DESC NULLS LAST);

COMMENT ON COLUMN v2_user_exercise_prs.pr_type IS 'weight = weighted set; reps_only = bodyweight reps; timed = duration PR';
COMMENT ON COLUMN v2_user_exercise_prs.duration_sec IS 'PR duration in seconds (timed exercises only)';

-- Trigger: handle weight, reps_only (bodyweight), and timed sets.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_upsert_exercise_pr() IS
  'Upserts v2_user_exercise_prs: weight (weight over reps), reps_only (bodyweight reps), timed (duration_sec). One row per (user, exercise, pr_type).';
