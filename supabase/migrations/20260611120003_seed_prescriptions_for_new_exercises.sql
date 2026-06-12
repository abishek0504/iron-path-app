-- Rule-based prescriptions for exercises missing active hypertrophy prescriptions.
-- Idempotent: only inserts where no matching row exists.

-- Stretches: timed holds, low volume
INSERT INTO v2_exercise_prescriptions (
  exercise_id, goal, experience, mode,
  sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, is_active
)
SELECT
  e.id,
  'hypertrophy',
  exp.level,
  'timed',
  exp.sets_min,
  exp.sets_max,
  NULL,
  NULL,
  exp.duration_min,
  exp.duration_max,
  true
FROM v2_exercises e
CROSS JOIN (
  VALUES
    ('beginner', 1, 2, 30, 45),
    ('intermediate', 1, 2, 45, 60),
    ('advanced', 2, 3, 45, 90)
) AS exp(level, sets_min, sets_max, duration_min, duration_max)
WHERE e.is_stretch = true
  AND e.is_timed = true
  AND NOT EXISTS (
    SELECT 1 FROM v2_exercise_prescriptions p
    WHERE p.exercise_id = e.id
      AND p.goal = 'hypertrophy'
      AND p.experience = exp.level
      AND p.mode = 'timed'
      AND p.is_active = true
  );

-- Timed strength (non-stretch): planks, dead hangs, etc.
INSERT INTO v2_exercise_prescriptions (
  exercise_id, goal, experience, mode,
  sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, is_active
)
SELECT
  e.id,
  'hypertrophy',
  exp.level,
  'timed',
  exp.sets_min,
  exp.sets_max,
  NULL,
  NULL,
  exp.duration_min,
  exp.duration_max,
  true
FROM v2_exercises e
CROSS JOIN (
  VALUES
    ('beginner', 3, 3, 20, 30),
    ('intermediate', 3, 4, 30, 45),
    ('advanced', 4, 5, 45, 60)
) AS exp(level, sets_min, sets_max, duration_min, duration_max)
WHERE e.is_stretch = false
  AND e.is_timed = true
  AND NOT EXISTS (
    SELECT 1 FROM v2_exercise_prescriptions p
    WHERE p.exercise_id = e.id
      AND p.goal = 'hypertrophy'
      AND p.experience = exp.level
      AND p.mode = 'timed'
      AND p.is_active = true
  );

-- Rep-based strength: tier sets/reps by density_score
INSERT INTO v2_exercise_prescriptions (
  exercise_id, goal, experience, mode,
  sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, is_active
)
SELECT
  e.id,
  'hypertrophy',
  exp.level,
  'reps',
  exp.sets_min,
  exp.sets_max,
  exp.reps_min,
  exp.reps_max,
  NULL,
  NULL,
  true
FROM v2_exercises e
CROSS JOIN (
  VALUES
    ('beginner', 3, 3, 8, 12),
    ('intermediate', 3, 4, 6, 10),
    ('advanced', 4, 5, 5, 8)
) AS exp(level, sets_min, sets_max, reps_min, reps_max)
WHERE e.is_stretch = false
  AND e.is_timed = false
  AND e.density_score >= 8
  AND NOT EXISTS (
    SELECT 1 FROM v2_exercise_prescriptions p
    WHERE p.exercise_id = e.id
      AND p.goal = 'hypertrophy'
      AND p.experience = exp.level
      AND p.mode = 'reps'
      AND p.is_active = true
  );

INSERT INTO v2_exercise_prescriptions (
  exercise_id, goal, experience, mode,
  sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, is_active
)
SELECT
  e.id,
  'hypertrophy',
  exp.level,
  'reps',
  exp.sets_min,
  exp.sets_max,
  exp.reps_min,
  exp.reps_max,
  NULL,
  NULL,
  true
FROM v2_exercises e
CROSS JOIN (
  VALUES
    ('beginner', 3, 3, 8, 12),
    ('intermediate', 3, 4, 8, 12),
    ('advanced', 3, 4, 6, 10)
) AS exp(level, sets_min, sets_max, reps_min, reps_max)
WHERE e.is_stretch = false
  AND e.is_timed = false
  AND e.density_score BETWEEN 6 AND 7
  AND NOT EXISTS (
    SELECT 1 FROM v2_exercise_prescriptions p
    WHERE p.exercise_id = e.id
      AND p.goal = 'hypertrophy'
      AND p.experience = exp.level
      AND p.mode = 'reps'
      AND p.is_active = true
  );

INSERT INTO v2_exercise_prescriptions (
  exercise_id, goal, experience, mode,
  sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max, is_active
)
SELECT
  e.id,
  'hypertrophy',
  exp.level,
  'reps',
  exp.sets_min,
  exp.sets_max,
  exp.reps_min,
  exp.reps_max,
  NULL,
  NULL,
  true
FROM v2_exercises e
CROSS JOIN (
  VALUES
    ('beginner', 3, 3, 10, 15),
    ('intermediate', 3, 4, 10, 15),
    ('advanced', 3, 4, 8, 12)
) AS exp(level, sets_min, sets_max, reps_min, reps_max)
WHERE e.is_stretch = false
  AND e.is_timed = false
  AND e.density_score <= 5
  AND NOT EXISTS (
    SELECT 1 FROM v2_exercise_prescriptions p
    WHERE p.exercise_id = e.id
      AND p.goal = 'hypertrophy'
      AND p.experience = exp.level
      AND p.mode = 'reps'
      AND p.is_active = true
  );
