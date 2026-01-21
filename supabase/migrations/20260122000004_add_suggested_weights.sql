-- Add suggested starting weights to exercise prescriptions
-- These are conservative starting points for beginners/intermediates

ALTER TABLE v2_exercise_prescriptions
  ADD COLUMN IF NOT EXISTS suggested_weight_lbs numeric,
  ADD COLUMN IF NOT EXISTS suggested_weight_kg numeric;

COMMENT ON COLUMN v2_exercise_prescriptions.suggested_weight_lbs IS 'Conservative starting weight for this exercise (imperial)';
COMMENT ON COLUMN v2_exercise_prescriptions.suggested_weight_kg IS 'Conservative starting weight for this exercise (metric)';

-- Seed suggested weights based on exercise type and experience level
-- Format: exercise_name, experience, weight_lbs, weight_kg

-- BARBELL COMPOUNDS (Heaviest lifts)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 65
    WHEN 'intermediate' THEN 95
    WHEN 'advanced' THEN 135
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 30
    WHEN 'intermediate' THEN 45
    WHEN 'advanced' THEN 60
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Bench Press (Barbell)', 'Overhead Press')
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 95
    WHEN 'intermediate' THEN 135
    WHEN 'advanced' THEN 185
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 45
    WHEN 'intermediate' THEN 60
    WHEN 'advanced' THEN 85
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Squat (Barbell)', 'Front Squat')
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 95
    WHEN 'intermediate' THEN 155
    WHEN 'advanced' THEN 225
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 45
    WHEN 'intermediate' THEN 70
    WHEN 'advanced' THEN 100
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN ('Deadlift (Conventional)', 'Romanian Deadlift (RDL)')
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 65
    WHEN 'intermediate' THEN 95
    WHEN 'advanced' THEN 135
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 30
    WHEN 'intermediate' THEN 45
    WHEN 'advanced' THEN 60
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Bent Over Row (Barbell)'
);

-- DUMBBELL EXERCISES (Medium weight)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 20
    WHEN 'intermediate' THEN 35
    WHEN 'advanced' THEN 50
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 10
    WHEN 'intermediate' THEN 15
    WHEN 'advanced' THEN 22.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Incline Dumbbell Press',
    'Dumbbell Fly'
  )
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 15
    WHEN 'intermediate' THEN 25
    WHEN 'advanced' THEN 40
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 7.5
    WHEN 'intermediate' THEN 12.5
    WHEN 'advanced' THEN 17.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Arnold Press',
    'Lateral Raise'
  )
);

-- BICEP/TRICEP ISOLATION (Lighter)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 15
    WHEN 'intermediate' THEN 25
    WHEN 'advanced' THEN 35
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 7.5
    WHEN 'intermediate' THEN 12.5
    WHEN 'advanced' THEN 15
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Bicep Curl (Barbell/Dumbbell)',
    'Hammer Curl'
  )
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 20
    WHEN 'intermediate' THEN 35
    WHEN 'advanced' THEN 50
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 10
    WHEN 'intermediate' THEN 15
    WHEN 'advanced' THEN 22.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Tricep Pushdown',
    'Skullcrusher',
    'Overhead Tricep Extension'
  )
);

-- CABLE/MACHINE EXERCISES
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 60
    WHEN 'intermediate' THEN 100
    WHEN 'advanced' THEN 140
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 27.5
    WHEN 'intermediate' THEN 45
    WHEN 'advanced' THEN 65
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Lat Pulldown',
    'Seated Cable Row'
  )
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 200
    WHEN 'intermediate' THEN 300
    WHEN 'advanced' THEN 400
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 90
    WHEN 'intermediate' THEN 135
    WHEN 'advanced' THEN 180
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Leg Press'
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 40
    WHEN 'intermediate' THEN 70
    WHEN 'advanced' THEN 100
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 20
    WHEN 'intermediate' THEN 30
    WHEN 'advanced' THEN 45
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Leg Extension',
    'Leg Curl (Seated/Lying)'
  )
);

UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 20
    WHEN 'intermediate' THEN 35
    WHEN 'advanced' THEN 50
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 10
    WHEN 'intermediate' THEN 15
    WHEN 'advanced' THEN 22.5
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Face Pull'
);

-- LEG UNILATERAL (Use bodyweight or light DB)
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 0  -- Bodyweight
    WHEN 'intermediate' THEN 15
    WHEN 'advanced' THEN 30
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 0  -- Bodyweight
    WHEN 'intermediate' THEN 7.5
    WHEN 'advanced' THEN 15
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name IN (
    'Bulgarian Split Squat',
    'Walking Lunge',
    'Pistol Squat',
    'Cossack Squat'
  )
);

-- HIP THRUST & GLUTE
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 65
    WHEN 'intermediate' THEN 135
    WHEN 'advanced' THEN 225
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 30
    WHEN 'intermediate' THEN 60
    WHEN 'advanced' THEN 100
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Hip Thrust'
);

-- CALF RAISES
UPDATE v2_exercise_prescriptions SET
  suggested_weight_lbs = CASE experience
    WHEN 'beginner' THEN 0  -- Bodyweight
    WHEN 'intermediate' THEN 40
    WHEN 'advanced' THEN 80
  END,
  suggested_weight_kg = CASE experience
    WHEN 'beginner' THEN 0  -- Bodyweight
    WHEN 'intermediate' THEN 20
    WHEN 'advanced' THEN 35
  END
WHERE exercise_id IN (
  SELECT id FROM v2_exercises WHERE name = 'Calf Raise'
);

-- BODYWEIGHT EXERCISES (Pull-ups, Dips, Push-ups, etc.)
-- Leave weights NULL for these - they use bodyweight
-- Nordic curls, reverse nordics, etc. also bodyweight

COMMENT ON TABLE v2_exercise_prescriptions IS 'Exercise prescriptions with conservative starting weights for each experience level';
