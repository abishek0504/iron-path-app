-- Duplicate-session guard for auto-materialized workout sessions.
-- The planner auto-materializes a session when a planned day is opened. A race
-- between concurrent loads could previously insert two sessions for the same
-- day. Manual sessions (dashboard start, "Add workout", presets, AI generation)
-- are intentionally allowed to be multiple per day, so uniqueness is enforced
-- ONLY on auto-materialized rows via the origin tag.

ALTER TABLE public.v2_workout_sessions
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';

ALTER TABLE public.v2_workout_sessions
  ADD CONSTRAINT v2_workout_sessions_origin_check
  CHECK (origin IN ('auto', 'manual'));

-- At most one auto-materialized session per user + day (by UTC date).
-- started_at::date is not IMMUTABLE (depends on session timezone), so pin the
-- cast to UTC to make it valid in an index expression. Existing rows default to
-- 'manual', so this partial index starts empty and cannot fail on legacy data.
CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_workout_sessions_auto_per_day
  ON public.v2_workout_sessions (user_id, day_name, ((started_at AT TIME ZONE 'UTC')::date))
  WHERE origin = 'auto';
