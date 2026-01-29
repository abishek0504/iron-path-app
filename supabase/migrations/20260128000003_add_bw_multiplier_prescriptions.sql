-- Add bodyweight multiplier for suggested weight (always calculated, no NULLs)
-- Suggested weight = current_weight * suggested_weight_multiplier_bw (fallback BW when profile has no weight)
-- Based on average lifting benchmarks (single default value per exercise/experience; user enters actual when working out)

ALTER TABLE v2_exercise_prescriptions
  ADD COLUMN IF NOT EXISTS suggested_weight_multiplier_bw numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN v2_exercise_prescriptions.suggested_weight_multiplier_bw IS 'Multiplier of bodyweight for suggested starting weight. suggested_weight = current_weight * this. 0 = bodyweight-only (no external load). Single value per exercise/experience (no ranges).';

-- Seed multipliers: single values from typical BW benchmarks (beginner / intermediate / advanced)
-- Deadlift: ~1.0x / 1.5x / 2.0x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 1.0
    WHEN 'intermediate' THEN 1.5
    WHEN 'advanced' THEN 2.0
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Deadlift (Conventional)'
);

-- RDL: slightly lighter than deadlift ~0.8x / 1.2x / 1.6x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.8
    WHEN 'intermediate' THEN 1.2
    WHEN 'advanced' THEN 1.6
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Romanian Deadlift (RDL)'
);

-- Squat: ~0.85x / 1.5x / 1.75x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.85
    WHEN 'intermediate' THEN 1.5
    WHEN 'advanced' THEN 1.75
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Squat (Barbell)', 'Front Squat')
);

-- Bench Press: ~0.65x / 1.25x / 1.5x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.65
    WHEN 'intermediate' THEN 1.25
    WHEN 'advanced' THEN 1.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Bench Press (Barbell)'
);

-- Overhead Press: ~0.4x / 0.6x / 0.8x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.4
    WHEN 'intermediate' THEN 0.6
    WHEN 'advanced' THEN 0.8
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Overhead Press'
);

-- Bent Over Row: ~0.5x / 0.75x / 1.0x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.5
    WHEN 'intermediate' THEN 0.75
    WHEN 'advanced' THEN 1.0
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Bent Over Row (Barbell)'
);

-- Hip Thrust: ~0.65x / 1.0x / 1.5x BW
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.65
    WHEN 'intermediate' THEN 1.0
    WHEN 'advanced' THEN 1.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Hip Thrust'
);

-- Dumbbell / machine exercises: fraction of BW (one limb or machine load)
-- Incline DB Press, DB Fly: ~0.2 / 0.35 / 0.5
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.2
    WHEN 'intermediate' THEN 0.35
    WHEN 'advanced' THEN 0.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Incline Dumbbell Press', 'Dumbbell Fly')
);

-- Arnold Press, Lateral Raise: ~0.08 / 0.12 / 0.18
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.08
    WHEN 'intermediate' THEN 0.12
    WHEN 'advanced' THEN 0.18
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Arnold Press', 'Lateral Raise')
);

-- Bicep Curl, Hammer Curl: ~0.1 / 0.15 / 0.2
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.1
    WHEN 'intermediate' THEN 0.15
    WHEN 'advanced' THEN 0.2
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Bicep Curl (Barbell/Dumbbell)', 'Hammer Curl')
);

-- Tricep Pushdown, Skullcrusher, Overhead Tricep: ~0.15 / 0.25 / 0.35
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.15
    WHEN 'intermediate' THEN 0.25
    WHEN 'advanced' THEN 0.35
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Tricep Pushdown',
    'Skullcrusher',
    'Overhead Tricep Extension'
  )
);

-- Lat Pulldown, Seated Cable Row: ~0.5 / 0.75 / 1.0 (machine load vs BW)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.5
    WHEN 'intermediate' THEN 0.75
    WHEN 'advanced' THEN 1.0
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Lat Pulldown', 'Seated Cable Row')
);

-- Leg Press: ~1.5 / 2.0 / 2.5 (machine typically heavier than squat)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 1.5
    WHEN 'intermediate' THEN 2.0
    WHEN 'advanced' THEN 2.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Leg Press'
);

-- Leg Extension, Leg Curl: ~0.3 / 0.5 / 0.7
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.3
    WHEN 'intermediate' THEN 0.5
    WHEN 'advanced' THEN 0.7
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Leg Extension', 'Leg Curl (Seated/Lying)')
);

-- Face Pull: ~0.1 / 0.15 / 0.2
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0.1
    WHEN 'intermediate' THEN 0.15
    WHEN 'advanced' THEN 0.2
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Face Pull'
);

-- Unilateral / bodyweight leg: 0 (bodyweight) or small added load ~0.1 / 0.2 / 0.3
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0
    WHEN 'intermediate' THEN 0.15
    WHEN 'advanced' THEN 0.3
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Bulgarian Split Squat',
    'Walking Lunge',
    'Pistol Squat',
    'Cossack Squat'
  )
);

-- Calf Raise: 0 / 0.25 / 0.5
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = CASE experience
    WHEN 'beginner' THEN 0
    WHEN 'intermediate' THEN 0.25
    WHEN 'advanced' THEN 0.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Calf Raise'
);

-- Bodyweight-only (pull-up, chin-up, dip, push-up, etc.): 0 (no external load; user enters 0 or adds weight when using belt)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_multiplier_bw = 0
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Pull Up (Overhand)',
    'Pull Up (Wide Grip)',
    'Chin Up (Supinated)',
    'Pull Up',
    'Push Up',
    'Diamond Push Up',
    'Pike Push Up',
    'Dip',
    'Hanging Leg Raise',
    'Hanging Knee Raise',
    'V-Sit',
    'Nordic Curl',
    'Reverse Nordic Curl'
  )
);

-- Timed exercises (Plank, etc.): 0 (no weight suggestion)
-- Default 0 already applied; ensure timed rows stay 0
UPDATE v2_exercise_prescriptions SET suggested_weight_multiplier_bw = 0 WHERE mode = 'timed';
