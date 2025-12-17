-- Patch C1: Add custom_exercise_id support to v2_template_slots
-- Idempotent: can re-run safely

DO $$
BEGIN
  -- Add custom_exercise_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'v2_template_slots' AND column_name = 'custom_exercise_id'
  ) THEN
    ALTER TABLE v2_template_slots 
    ADD COLUMN custom_exercise_id uuid REFERENCES v2_user_custom_exercises(id) ON DELETE SET NULL;
  END IF;
  
  -- Add CHECK constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_slot_exercise_check'
  ) THEN
    ALTER TABLE v2_template_slots
    ADD CONSTRAINT template_slot_exercise_check CHECK (
      (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
      (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
    );
  END IF;
END $$;

