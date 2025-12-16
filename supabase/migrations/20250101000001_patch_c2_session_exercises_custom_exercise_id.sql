-- Patch C2: Verify/add custom_exercise_id support to v2_session_exercises
-- Idempotent: can re-run safely
-- Note: This table may already have custom_exercise_id from initial migration

DO $$
BEGIN
  -- Add custom_exercise_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'v2_session_exercises' AND column_name = 'custom_exercise_id'
  ) THEN
    ALTER TABLE v2_session_exercises 
    ADD COLUMN custom_exercise_id uuid REFERENCES v2_user_custom_exercises(id) ON DELETE SET NULL;
  END IF;
  
  -- Add CHECK constraint if it doesn't exist (may be named differently)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'v2_session_exercises'::regclass 
      AND contype = 'c'
      AND conname LIKE '%exercise_reference%'
  ) THEN
    -- Check if constraint exists with different name
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'v2_session_exercises'::regclass 
        AND contype = 'c'
        AND (
          pg_get_constraintdef(oid) LIKE '%exercise_id IS NOT NULL%' 
          AND pg_get_constraintdef(oid) LIKE '%custom_exercise_id%'
        )
    ) THEN
      ALTER TABLE v2_session_exercises
      ADD CONSTRAINT session_exercise_reference_check CHECK (
        (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
        (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
      );
    END IF;
  END IF;
END $$;

