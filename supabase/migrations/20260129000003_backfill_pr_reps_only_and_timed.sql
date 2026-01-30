-- Backfill reps_only (bodyweight) and timed PRs from existing completed sets.

WITH best_reps_only AS (
  SELECT
    ws.user_id,
    se.exercise_id,
    se.custom_exercise_id,
    se.id AS session_exercise_id,
    s.reps,
    s.id AS set_id,
    se.session_id,
    s.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id, COALESCE(se.exercise_id::text, se.custom_exercise_id::text)
      ORDER BY s.reps DESC NULLS LAST
    ) AS rn
  FROM v2_session_sets s
  JOIN v2_session_exercises se ON se.id = s.session_exercise_id
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE s.performed_at IS NOT NULL
    AND s.reps IS NOT NULL
    AND (s.weight IS NULL OR s.weight = 0)
    AND ws.status = 'completed'
    AND (se.exercise_id IS NOT NULL OR se.custom_exercise_id IS NOT NULL)
)
INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
SELECT user_id, exercise_id, NULL, 'reps_only', NULL, reps, NULL, set_id, session_exercise_id, session_id, performed_at
FROM best_reps_only
WHERE rn = 1 AND exercise_id IS NOT NULL
ON CONFLICT (user_id, exercise_id, pr_type) WHERE (exercise_id IS NOT NULL) DO NOTHING;

WITH best_reps_only AS (
  SELECT
    ws.user_id,
    se.exercise_id,
    se.custom_exercise_id,
    se.id AS session_exercise_id,
    s.reps,
    s.id AS set_id,
    se.session_id,
    s.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id, COALESCE(se.exercise_id::text, se.custom_exercise_id::text)
      ORDER BY s.reps DESC NULLS LAST
    ) AS rn
  FROM v2_session_sets s
  JOIN v2_session_exercises se ON se.id = s.session_exercise_id
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE s.performed_at IS NOT NULL
    AND s.reps IS NOT NULL
    AND (s.weight IS NULL OR s.weight = 0)
    AND ws.status = 'completed'
    AND (se.exercise_id IS NOT NULL OR se.custom_exercise_id IS NOT NULL)
)
INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
SELECT user_id, NULL, custom_exercise_id, 'reps_only', NULL, reps, NULL, set_id, session_exercise_id, session_id, performed_at
FROM best_reps_only
WHERE rn = 1 AND custom_exercise_id IS NOT NULL
ON CONFLICT (user_id, custom_exercise_id, pr_type) WHERE (custom_exercise_id IS NOT NULL) DO NOTHING;

WITH best_timed AS (
  SELECT
    ws.user_id,
    se.exercise_id,
    se.custom_exercise_id,
    se.id AS session_exercise_id,
    s.duration_sec,
    s.id AS set_id,
    se.session_id,
    s.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id, COALESCE(se.exercise_id::text, se.custom_exercise_id::text)
      ORDER BY s.duration_sec DESC NULLS LAST
    ) AS rn
  FROM v2_session_sets s
  JOIN v2_session_exercises se ON se.id = s.session_exercise_id
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE s.performed_at IS NOT NULL
    AND s.duration_sec IS NOT NULL
    AND ws.status = 'completed'
    AND (se.exercise_id IS NOT NULL OR se.custom_exercise_id IS NOT NULL)
)
INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
SELECT user_id, exercise_id, NULL, 'timed', NULL, NULL, duration_sec, set_id, session_exercise_id, session_id, performed_at
FROM best_timed
WHERE rn = 1 AND exercise_id IS NOT NULL
ON CONFLICT (user_id, exercise_id, pr_type) WHERE (exercise_id IS NOT NULL) DO NOTHING;

WITH best_timed AS (
  SELECT
    ws.user_id,
    se.exercise_id,
    se.custom_exercise_id,
    se.id AS session_exercise_id,
    s.duration_sec,
    s.id AS set_id,
    se.session_id,
    s.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id, COALESCE(se.exercise_id::text, se.custom_exercise_id::text)
      ORDER BY s.duration_sec DESC NULLS LAST
    ) AS rn
  FROM v2_session_sets s
  JOIN v2_session_exercises se ON se.id = s.session_exercise_id
  JOIN v2_workout_sessions ws ON ws.id = se.session_id
  WHERE s.performed_at IS NOT NULL
    AND s.duration_sec IS NOT NULL
    AND ws.status = 'completed'
    AND (se.exercise_id IS NOT NULL OR se.custom_exercise_id IS NOT NULL)
)
INSERT INTO v2_user_exercise_prs (user_id, exercise_id, custom_exercise_id, pr_type, weight, reps, duration_sec, set_id, session_exercise_id, session_id, performed_at)
SELECT user_id, NULL, custom_exercise_id, 'timed', NULL, NULL, duration_sec, set_id, session_exercise_id, session_id, performed_at
FROM best_timed
WHERE rn = 1 AND custom_exercise_id IS NOT NULL
ON CONFLICT (user_id, custom_exercise_id, pr_type) WHERE (custom_exercise_id IS NOT NULL) DO NOTHING;
