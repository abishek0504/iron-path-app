-- Migration: Refine implicit_hits to use weighted activation coefficients
-- This migration updates v2_exercises to use biomechanically weighted coefficients
-- for secondary muscle activation instead of binary hit/no-hit classification.
--
-- Coefficient Scale:
-- 1.0 = Primary Mover (set in primary_muscles array)
-- 0.6-0.9 = Major Synergist (significant contribution to movement)
-- 0.3-0.5 = Stabilizer/Minor Synergist (assists or stabilizes)
-- 0.1-0.2 = Minimal involvement (isometric or negligible activation)

-- Verify implicit_hits column is JSONB (should already be from base migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'v2_exercises'
    AND column_name = 'implicit_hits'
    AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE v2_exercises ALTER COLUMN implicit_hits TYPE jsonb USING implicit_hits::jsonb;
  END IF;
END $$;

-- ============================================================================
-- SEED DATA: Weighted Implicit Hits for Major Compound Movements
-- ============================================================================

-- Major Compound Movements (Foundation)
UPDATE v2_exercises SET implicit_hits = '{"triceps": 0.6, "anterior_deltoids": 0.5}'::jsonb 
WHERE name = 'Bench Press (Barbell)';

UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.7, "lower_back": 0.4, "core": 0.3}'::jsonb 
WHERE name = 'Squat (Barbell)';

UPDATE v2_exercises SET implicit_hits = '{"hamstrings": 0.9, "glutes": 0.8, "traps": 0.5, "forearms": 0.5}'::jsonb 
WHERE name = 'Deadlift (Conventional)';

UPDATE v2_exercises SET implicit_hits = '{"biceps": 0.6, "traps": 0.4, "upper_back": 0.5}'::jsonb 
WHERE name = 'Pull Up';

UPDATE v2_exercises SET implicit_hits = '{"triceps": 0.7, "upper_chest": 0.3, "core": 0.3}'::jsonb 
WHERE name = 'Overhead Press';

UPDATE v2_exercises SET implicit_hits = '{"lower_chest": 0.8, "anterior_deltoids": 0.4}'::jsonb 
WHERE name = 'Dip';

-- Chest & Push Variations
UPDATE v2_exercises SET implicit_hits = '{"chest": 0.7, "anterior_deltoids": 0.7, "triceps": 0.5}'::jsonb 
WHERE name = 'Incline Dumbbell Press';

UPDATE v2_exercises SET implicit_hits = '{"anterior_deltoids": 0.3, "biceps": 0.1}'::jsonb 
WHERE name = 'Dumbbell Fly';

UPDATE v2_exercises SET implicit_hits = '{"anterior_deltoids": 0.7, "triceps": 0.6, "abs": 0.5, "serratus_anterior": 0.5}'::jsonb 
WHERE name = 'Push Up';

UPDATE v2_exercises SET implicit_hits = '{"chest": 0.6, "anterior_deltoids": 0.6, "abs": 0.4}'::jsonb 
WHERE name = 'Diamond Push Up';

UPDATE v2_exercises SET implicit_hits = '{"triceps": 0.7, "upper_chest": 0.4, "traps": 0.4, "serratus_anterior": 0.4}'::jsonb 
WHERE name = 'Pike Push Up';

-- Back & Pull Variations
UPDATE v2_exercises SET implicit_hits = '{"biceps": 0.5, "posterior_deltoids": 0.3, "traps": 0.4}'::jsonb 
WHERE name = 'Lat Pulldown';

UPDATE v2_exercises SET implicit_hits = '{"lats": 0.7, "traps": 0.7, "biceps": 0.5, "posterior_deltoids": 0.5}'::jsonb 
WHERE name = 'Seated Cable Row';

UPDATE v2_exercises SET implicit_hits = '{"upper_back": 0.8, "lower_back": 0.6, "biceps": 0.5, "hamstrings": 0.3}'::jsonb 
WHERE name = 'Bent Over Row (Barbell)';

UPDATE v2_exercises SET implicit_hits = '{"rotator_cuff": 0.9, "traps": 0.7, "upper_back": 0.5}'::jsonb 
WHERE name = 'Face Pull';

UPDATE v2_exercises SET implicit_hits = '{"traps": 0.6, "biceps": 0.5, "posterior_deltoids": 0.4, "forearms": 0.4}'::jsonb 
WHERE name = 'Pull Up (Overhand)';

UPDATE v2_exercises SET implicit_hits = '{"traps": 0.7, "biceps": 0.4, "forearms": 0.5}'::jsonb 
WHERE name = 'Pull Up (Wide Grip)';

UPDATE v2_exercises SET implicit_hits = '{"biceps": 0.8, "traps": 0.5, "forearms": 0.5}'::jsonb 
WHERE name = 'Chin Up (Supinated)';

-- Shoulder Variations
UPDATE v2_exercises SET implicit_hits = '{"traps": 0.3, "anterior_deltoids": 0.2}'::jsonb 
WHERE name = 'Lateral Raise';

UPDATE v2_exercises SET implicit_hits = '{"lateral_deltoids": 0.7, "triceps": 0.6, "upper_chest": 0.3}'::jsonb 
WHERE name = 'Arnold Press';

-- Legs: Quad Dominant
UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.6, "upper_back": 0.6, "core": 0.7, "lower_back": 0.4}'::jsonb 
WHERE name = 'Front Squat';

UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.5, "calves": 0.2}'::jsonb 
WHERE name = 'Leg Press';

UPDATE v2_exercises SET implicit_hits = '{"calves": 0.3}'::jsonb 
WHERE name = 'Leg Extension';

UPDATE v2_exercises SET implicit_hits = '{"hamstrings": 0.5, "calves": 0.4}'::jsonb 
WHERE name = 'Walking Lunge';

UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.8, "calves": 0.5, "abs": 0.5, "hamstrings": 0.3}'::jsonb 
WHERE name = 'Pistol Squat';

UPDATE v2_exercises SET implicit_hits = '{"quads": 0.8, "glutes": 0.6, "hamstrings": 0.4}'::jsonb 
WHERE name = 'Cossack Squat';

UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.9, "calves": 0.3}'::jsonb 
WHERE name = 'Bulgarian Split Squat';

-- Legs: Posterior Chain
UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.8, "lower_back": 0.6, "forearms": 0.5}'::jsonb 
WHERE name = 'Romanian Deadlift (RDL)';

UPDATE v2_exercises SET implicit_hits = '{"hamstrings": 0.4, "quads": 0.3}'::jsonb 
WHERE name = 'Hip Thrust';

UPDATE v2_exercises SET implicit_hits = '{"calves": 0.2}'::jsonb 
WHERE name = 'Leg Curl (Seated/Lying)';

UPDATE v2_exercises SET implicit_hits = '{"soleus": 0.8}'::jsonb 
WHERE name = 'Calf Raise';

UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.4, "calves": 0.4}'::jsonb 
WHERE name = 'Nordic Curl';

UPDATE v2_exercises SET implicit_hits = '{"hip_flexors": 0.6, "abs": 0.3}'::jsonb 
WHERE name = 'Reverse Nordic Curl';

-- Arms & Isolation
UPDATE v2_exercises SET implicit_hits = '{}'::jsonb 
WHERE name = 'Tricep Pushdown';

UPDATE v2_exercises SET implicit_hits = '{"lats": 0.2}'::jsonb 
WHERE name = 'Skullcrusher';

UPDATE v2_exercises SET implicit_hits = '{"forearms": 0.3}'::jsonb 
WHERE name = 'Bicep Curl (Barbell/Dumbbell)';

UPDATE v2_exercises SET implicit_hits = '{"forearms": 0.8}'::jsonb 
WHERE name = 'Hammer Curl';

UPDATE v2_exercises SET implicit_hits = '{}'::jsonb 
WHERE name = 'Overhead Tricep Extension';

-- Core & Stability
UPDATE v2_exercises SET implicit_hits = '{"hip_flexors": 0.8, "forearms": 0.4}'::jsonb 
WHERE name = 'Hanging Leg Raise';

UPDATE v2_exercises SET implicit_hits = '{"hip_flexors": 0.7, "forearms": 0.5}'::jsonb 
WHERE name = 'Hanging Knee Raise';

UPDATE v2_exercises SET implicit_hits = '{"hip_flexors": 0.9, "quads": 0.3}'::jsonb 
WHERE name = 'V-Sit';

UPDATE v2_exercises SET implicit_hits = '{"hip_flexors": 0.9, "triceps": 0.6, "traps": 0.5, "quads": 0.4}'::jsonb 
WHERE name = 'L-Sit';

UPDATE v2_exercises SET implicit_hits = '{"glute_medius": 0.6, "anterior_deltoids": 0.4}'::jsonb 
WHERE name = 'Side Plank';

UPDATE v2_exercises SET implicit_hits = '{"glutes": 0.7, "hamstrings": 0.5, "posterior_deltoids": 0.4}'::jsonb 
WHERE name = 'Superman Hold';

UPDATE v2_exercises SET implicit_hits = '{"traps": 0.9, "core": 0.8, "glutes": 0.4}'::jsonb 
WHERE name = 'Farmer''s Walk';

-- Add comment for documentation
COMMENT ON COLUMN v2_exercises.implicit_hits IS 'JSONB map of muscle_key → weighted activation coefficient (0-1). 1.0=Primary Mover, 0.6-0.9=Major Synergist, 0.3-0.5=Stabilizer';
