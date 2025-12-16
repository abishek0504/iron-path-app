-- Patch H: Remove goal from v2_profiles, v2_exercise_prescriptions, v2_template_slots
-- Consolidates duplicate prescriptions before removing goal column

-- Step 1: Remove goal from v2_profiles
ALTER TABLE v2_profiles DROP COLUMN IF EXISTS goal;

-- Step 2: Consolidate v2_exercise_prescriptions before removing goal
-- Dropping goal from prescriptions means you can end up with duplicates for (exercise_id, experience, mode)
-- Consolidate rows per (exercise_id, experience, mode) by selecting the final band you want
-- Rule: For each (exercise_id, experience, mode) group with multiple goals:
--   - If one prescription has goal='hypertrophy', use that one (8-12 rep range is middle ground)
--   - Else, use the first one found (or merge bands: take widest min/max ranges)
--   - Delete duplicate rows after consolidation
DO $$
BEGIN
  -- Consolidate duplicates: prefer 'hypertrophy' goal if exists, else keep first found
  WITH duplicates AS (
    SELECT 
      id, 
      exercise_id, 
      experience, 
      mode, 
      goal,
      ROW_NUMBER() OVER (
        PARTITION BY exercise_id, experience, mode 
        ORDER BY 
          CASE WHEN goal = 'hypertrophy' THEN 1 ELSE 2 END,
          created_at ASC
      ) as rn
    FROM v2_exercise_prescriptions
  )
  DELETE FROM v2_exercise_prescriptions 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
END $$;

-- Step 3: Remove goal column from v2_exercise_prescriptions
ALTER TABLE v2_exercise_prescriptions DROP COLUMN IF EXISTS goal;

-- Step 4: Drop old unique constraint (if it exists)
-- Safest V2 approach: Drop the known constraint name if it exists
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the unique constraint that includes goal (should have 4 columns: exercise_id, goal, experience, mode)
  SELECT conname INTO constraint_name
  FROM pg_constraint 
  WHERE conrelid = 'v2_exercise_prescriptions'::regclass 
    AND contype = 'u'
    AND array_length(conkey, 1) = 4; -- Old constraint had 4 columns
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE v2_exercise_prescriptions DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Step 5: Add new unique constraint: (exercise_id, experience, mode)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'v2_exercise_prescriptions'::regclass 
      AND conname = 'v2_exercise_prescriptions_exercise_id_experience_mode_key'
  ) THEN
    ALTER TABLE v2_exercise_prescriptions
    ADD CONSTRAINT v2_exercise_prescriptions_exercise_id_experience_mode_key 
    UNIQUE (exercise_id, experience, mode);
  END IF;
END $$;

-- Step 6: Remove goal override from v2_template_slots
ALTER TABLE v2_template_slots DROP COLUMN IF EXISTS goal;

