-- Add user default target columns to v2_user_exercise_overrides.
-- Used to prefill add-exercise-edit and future workouts from the user's last-used values.
-- Prescriptions remain suggested starting values; user edits persist here.

ALTER TABLE v2_user_exercise_overrides
  ADD COLUMN IF NOT EXISTS default_set_count int,
  ADD COLUMN IF NOT EXISTS default_weight numeric,
  ADD COLUMN IF NOT EXISTS default_reps int,
  ADD COLUMN IF NOT EXISTS default_duration_sec int,
  ADD COLUMN IF NOT EXISTS default_rest_sec int;

COMMENT ON COLUMN v2_user_exercise_overrides.default_set_count IS 'User preferred number of sets; prefill and algorithm use when set.';
COMMENT ON COLUMN v2_user_exercise_overrides.default_weight IS 'User preferred weight (reps mode); prefill when set.';
COMMENT ON COLUMN v2_user_exercise_overrides.default_reps IS 'User preferred reps per set (reps mode); prefill when set.';
COMMENT ON COLUMN v2_user_exercise_overrides.default_duration_sec IS 'User preferred duration per set (timed mode); prefill when set.';
COMMENT ON COLUMN v2_user_exercise_overrides.default_rest_sec IS 'User preferred rest between sets (sec); prefill when set.';
