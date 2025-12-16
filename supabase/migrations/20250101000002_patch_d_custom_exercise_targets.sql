-- Patch D: Add target band fields to v2_user_custom_exercises
-- Idempotent: can re-run safely

-- First, add columns as nullable
ALTER TABLE v2_user_custom_exercises
ADD COLUMN IF NOT EXISTS mode text,
ADD COLUMN IF NOT EXISTS sets_min int,
ADD COLUMN IF NOT EXISTS sets_max int,
ADD COLUMN IF NOT EXISTS reps_min int,
ADD COLUMN IF NOT EXISTS reps_max int,
ADD COLUMN IF NOT EXISTS duration_sec_min int,
ADD COLUMN IF NOT EXISTS duration_sec_max int;

-- Backfill existing rows (if table has existing rows, backfill first)
-- Set default values for existing rows to prevent constraint failure
UPDATE v2_user_custom_exercises 
SET mode = 'reps', sets_min = 3, sets_max = 4, reps_min = 8, reps_max = 12 
WHERE mode IS NULL;

-- Add explicit mode constraint
ALTER TABLE v2_user_custom_exercises
ADD CONSTRAINT IF NOT EXISTS custom_exercise_mode_check CHECK (mode IN ('reps', 'timed'));

-- Now add CHECK constraint for target bands
ALTER TABLE v2_user_custom_exercises
ADD CONSTRAINT IF NOT EXISTS custom_exercise_target_bands_check CHECK (
  mode IS NOT NULL AND
  sets_min IS NOT NULL AND sets_max IS NOT NULL AND
  sets_min >= 1 AND sets_max >= sets_min AND sets_max <= 10 AND
  (
    (mode = 'reps' AND reps_min IS NOT NULL AND reps_max IS NOT NULL AND 
     reps_min >= 1 AND reps_max >= reps_min AND reps_max <= 50 AND
     duration_sec_min IS NULL AND duration_sec_max IS NULL) OR
    (mode = 'timed' AND duration_sec_min IS NOT NULL AND duration_sec_max IS NOT NULL AND
     duration_sec_min >= 5 AND duration_sec_max >= duration_sec_min AND duration_sec_max <= 3600 AND
     reps_min IS NULL AND reps_max IS NULL)
  )
);

