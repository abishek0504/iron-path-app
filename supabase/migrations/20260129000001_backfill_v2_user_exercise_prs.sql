-- Backfill v2_user_exercise_prs from existing completed sets.
-- Per (user, exercise): best set by weight DESC, then reps DESC NULLS LAST.

WITH best_sets AS (
  SELECT
    ws.user_id,
    se.exercise_id,
    se.custom_exercise_id,
    se.id AS session_exercise_id,
    s.weight,
    s.reps,
    s.id AS set_id,
    se.session_id,
    s.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id, COALESCE(se.exercise_id::text, se.custom_exercise_id::text)
      ORDER BY s.weight DESC NULLS LAST, COALESCE(s.reps, 0) DESC
    ) AS rn
  FROM v2_session_sets s
  JOIN v2_session_exercises se ON se.id = s.session_exercise_id
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE s.performed_at IS NOT NULL
    AND s.weight IS NOT NULL
    AND ws.status = 'completed'
    AND (se.exercise_id IS NOT NULL OR se.custom_exercise_id IS NOT NULL)
)
INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, weight, reps, set_id, session_exercise_id, session_id, performed_at)
SELECT user_id, exercise_id, NULL, weight, reps, set_id, session_exercise_id, session_id, performed_at
FROM best_sets
WHERE rn = 1 AND exercise_id IS NOT NULL
ON CONFLICT (user_id, exercise_id) WHERE (exercise_id IS NOT NULL) DO NOTHING;

WITH best_sets AS (
  SELECT
    ws.user_id,
    se.exercise_id,
    se.custom_exercise_id,
    se.id AS session_exercise_id,
    s.weight,
    s.reps,
    s.id AS set_id,
    se.session_id,
    s.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id, COALESCE(se.exercise_id::text, se.custom_exercise_id::text)
      ORDER BY s.weight DESC NULLS LAST, COALESCE(s.reps, 0) DESC
    ) AS rn
  FROM v2_session_sets s
  JOIN v2_session_exercises se ON se.id = s.session_exercise_id
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE s.performed_at IS NOT NULL
    AND s.weight IS NOT NULL
    AND ws.status = 'completed'
    AND (se.exercise_id IS NOT NULL OR se.custom_exercise_id IS NOT NULL)
)
INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, weight, reps, set_id, session_exercise_id, session_id, performed_at)
SELECT user_id, NULL, custom_exercise_id, weight, reps, set_id, session_exercise_id, session_id, performed_at
FROM best_sets
WHERE rn = 1 AND custom_exercise_id IS NOT NULL
ON CONFLICT (user_id, custom_exercise_id) WHERE (custom_exercise_id IS NOT NULL) DO NOTHING;
