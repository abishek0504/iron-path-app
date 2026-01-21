-- Seed exercise prescriptions for all exercises
-- Uses current schema with: exercise_id, goal, experience, mode, sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max

WITH exercise_ids AS (
  SELECT id, name FROM v2_exercises
)

-- Insert prescriptions for rep-based exercises (hypertrophy goal)
INSERT INTO v2_exercise_prescriptions (exercise_id, goal, experience, mode, sets_min, sets_max, reps_min, reps_max, duration_sec_min, duration_sec_max)
SELECT 
  e.id,
  'hypertrophy'::text,
  exp.level,
  'reps'::text,
  exp.sets_min,
  exp.sets_max,
  exp.reps_min,
  exp.reps_max,
  NULL::integer,
  NULL::integer
FROM exercise_ids e
CROSS JOIN (
  VALUES 
    ('beginner', 3, 3, 8, 12),
    ('intermediate', 3, 4, 6, 10),
    ('advanced', 4, 5, 5, 8)
) AS exp(level, sets_min, sets_max, reps_min, reps_max)
WHERE e.name IN (
  -- Upper body push
  'Bench Press (Barbell)',
  'Incline Dumbbell Press',
  'Dumbbell Fly',
  'Push Up',
  'Diamond Push Up',
  'Pike Push Up',
  'Dip',
  'Overhead Press',
  'Arnold Press',
  'Lateral Raise',
  -- Upper body pull
  'Pull Up (Overhand)',
  'Pull Up (Wide Grip)',
  'Chin Up (Supinated)',
  'Pull Up',
  'Lat Pulldown',
  'Seated Cable Row',
  'Bent Over Row (Barbell)',
  'Face Pull',
  -- Lower body
  'Squat (Barbell)',
  'Front Squat',
  'Leg Press',
  'Bulgarian Split Squat',
  'Walking Lunge',
  'Pistol Squat',
  'Cossack Squat',
  'Leg Extension',
  'Deadlift (Conventional)',
  'Romanian Deadlift (RDL)',
  'Hip Thrust',
  'Leg Curl (Seated/Lying)',
  'Nordic Curl',
  'Reverse Nordic Curl',
  -- Arms
  'Bicep Curl (Barbell/Dumbbell)',
  'Hammer Curl',
  'Tricep Pushdown',
  'Skullcrusher',
  'Overhead Tricep Extension'
)

UNION ALL

-- Insert prescriptions for timed/isometric exercises
SELECT 
  e.id,
  'hypertrophy'::text,
  exp.level,
  'timed'::text,
  exp.sets_min,
  exp.sets_max,
  NULL::integer,
  NULL::integer,
  exp.duration_min,
  exp.duration_max
FROM exercise_ids e
CROSS JOIN (
  VALUES 
    ('beginner', 3, 3, 20, 30),
    ('intermediate', 3, 4, 30, 45),
    ('advanced', 4, 5, 45, 60)
) AS exp(level, sets_min, sets_max, duration_min, duration_max)
WHERE e.name IN (
  'Plank',
  'Side Plank',
  'L-Sit',
  'Superman Hold',
  'Farmer''s Walk'
)

UNION ALL

-- Insert prescriptions for calisthenics (bodyweight)
SELECT 
  e.id,
  'hypertrophy'::text,
  exp.level,
  'reps'::text,
  exp.sets_min,
  exp.sets_max,
  exp.reps_min,
  exp.reps_max,
  NULL::integer,
  NULL::integer
FROM exercise_ids e
CROSS JOIN (
  VALUES 
    ('beginner', 3, 3, 6, 10),
    ('intermediate', 3, 4, 8, 12),
    ('advanced', 4, 5, 10, 15)
) AS exp(level, sets_min, sets_max, reps_min, reps_max)
WHERE e.name IN (
  'Hanging Leg Raise',
  'Hanging Knee Raise',
  'V-Sit',
  'Calf Raise'
);
