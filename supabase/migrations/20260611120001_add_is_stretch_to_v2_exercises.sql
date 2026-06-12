-- Add is_stretch flag to distinguish mobility/stretch entries from strength exercises.

ALTER TABLE v2_exercises
  ADD COLUMN IF NOT EXISTS is_stretch boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN v2_exercises.is_stretch IS
  'True for mobility/stretch entries; excluded from AI strength selection until explicitly included.';
