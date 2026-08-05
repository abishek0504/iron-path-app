-- Multi-workout-per-day and Pro AI (multiple sessions in one generate) both create
-- several status='active' rows. The watch exclusivity index blocked those inserts
-- (phone returned null → "Failed to add workout"), while the watch client already
-- abandons leftovers before create. Drop the unique index; exclusivity stays in
-- app logic (watch abandon-before-create + phone stale cleanup).

DROP INDEX IF EXISTS public.uq_v2_workout_sessions_one_active_per_user;
