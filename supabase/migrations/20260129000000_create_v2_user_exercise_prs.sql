-- PR cache: one row per user per exercise (current PR only).
-- Updated only when a set is completed that beats current PR (weight has priority over reps).

CREATE TABLE IF NOT EXISTS v2_user_exercise_prs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES v2_exercises(id) ON DELETE CASCADE,
  custom_exercise_id uuid REFERENCES v2_user_custom_exercises(id) ON DELETE CASCADE,
  weight numeric NOT NULL CHECK (weight >= 0),
  reps int,
  set_id uuid NOT NULL REFERENCES v2_session_sets(id) ON DELETE CASCADE,
  session_exercise_id uuid NOT NULL REFERENCES v2_session_exercises(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES v2_workout_sessions(id) ON DELETE CASCADE,
  performed_at timestamptz NOT NULL,
  CONSTRAINT v2_user_exercise_prs_exercise_ref_check CHECK (
    (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
  )
);

COMMENT ON TABLE v2_user_exercise_prs IS 'Cache: current weight PR per user per exercise. Updated by trigger when a set is completed that beats current PR (weight over reps).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_master
  ON v2_user_exercise_prs (user_id, exercise_id) WHERE exercise_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_custom
  ON v2_user_exercise_prs (user_id, custom_exercise_id) WHERE custom_exercise_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_user_weight
  ON v2_user_exercise_prs (user_id, weight DESC);

-- RLS
ALTER TABLE v2_user_exercise_prs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_user_exercise_prs_owner" ON v2_user_exercise_prs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: after a set is marked complete (performed_at + weight), upsert PR if this set beats current.
CREATE OR REPLACE FUNCTION trigger_upsert_exercise_pr()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_session_id uuid;
  v_exercise_id uuid;
  v_custom_exercise_id uuid;
  v_weight numeric;
  v_reps int;
BEGIN
  IF NEW.performed_at IS NULL OR NEW.weight IS NULL THEN
    RETURN NEW;
  END IF;

  v_weight := NEW.weight;
  v_reps := NEW.reps;

  SELECT ws.user_id, se.session_id, se.exercise_id, se.custom_exercise_id
  INTO v_user_id, v_session_id, v_exercise_id, v_custom_exercise_id
  FROM v2_session_exercises se
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE se.id = NEW.session_exercise_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_exercise_id IS NOT NULL THEN
    INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, weight, reps, set_id, session_exercise_id, session_id, performed_at)
    VALUES (v_user_id, v_exercise_id, NULL, v_weight, v_reps, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
    ON CONFLICT (user_id, exercise_id) WHERE (exercise_id IS NOT NULL)
    DO UPDATE SET weight = EXCLUDED.weight, reps = EXCLUDED.reps, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
    WHERE v2_user_exercise_prs.weight < EXCLUDED.weight
       OR (v2_user_exercise_prs.weight = EXCLUDED.weight AND COALESCE(EXCLUDED.reps, 0) > COALESCE(v2_user_exercise_prs.reps, 0));
  ELSIF v_custom_exercise_id IS NOT NULL THEN
    INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, weight, reps, set_id, session_exercise_id, session_id, performed_at)
    VALUES (v_user_id, NULL, v_custom_exercise_id, v_weight, v_reps, NEW.id, NEW.session_exercise_id, v_session_id, NEW.performed_at)
    ON CONFLICT (user_id, custom_exercise_id) WHERE (custom_exercise_id IS NOT NULL)
    DO UPDATE SET weight = EXCLUDED.weight, reps = EXCLUDED.reps, set_id = EXCLUDED.set_id, session_exercise_id = EXCLUDED.session_exercise_id, session_id = EXCLUDED.session_id, performed_at = EXCLUDED.performed_at
    WHERE v2_user_exercise_prs.weight < EXCLUDED.weight
       OR (v2_user_exercise_prs.weight = EXCLUDED.weight AND COALESCE(EXCLUDED.reps, 0) > COALESCE(v2_user_exercise_prs.reps, 0));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_session_set_pr_upsert ON v2_session_sets;

CREATE TRIGGER trigger_session_set_pr_upsert
  AFTER INSERT OR UPDATE ON v2_session_sets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_upsert_exercise_pr();

COMMENT ON FUNCTION trigger_upsert_exercise_pr() IS
  'Upserts v2_user_exercise_prs when a set is completed: only updates if new weight > current PR weight, or same weight and new reps > current reps (weight has priority).';
