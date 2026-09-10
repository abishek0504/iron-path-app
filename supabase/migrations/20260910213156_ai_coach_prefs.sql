-- AI Coach session size, per-day split focus, and replaceable athlete notes.

ALTER TABLE public.v2_profiles
  ADD COLUMN IF NOT EXISTS ai_coach_session_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS ai_coach_exercises_per_session integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS ai_coach_day_focus jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_coach_notes text;

ALTER TABLE public.v2_profiles
  DROP CONSTRAINT IF EXISTS v2_profiles_ai_coach_session_minutes_check,
  DROP CONSTRAINT IF EXISTS v2_profiles_ai_coach_exercises_per_session_check,
  DROP CONSTRAINT IF EXISTS v2_profiles_ai_coach_notes_length_check;

ALTER TABLE public.v2_profiles
  ADD CONSTRAINT v2_profiles_ai_coach_session_minutes_check
    CHECK (ai_coach_session_minutes IN (30, 45, 60, 75, 90)),
  ADD CONSTRAINT v2_profiles_ai_coach_exercises_per_session_check
    CHECK (ai_coach_exercises_per_session BETWEEN 2 AND 8),
  ADD CONSTRAINT v2_profiles_ai_coach_notes_length_check
    CHECK (ai_coach_notes IS NULL OR char_length(ai_coach_notes) <= 1000);

COMMENT ON COLUMN public.v2_profiles.ai_coach_session_minutes IS
  'Target AI Coach session length in minutes.';
COMMENT ON COLUMN public.v2_profiles.ai_coach_exercises_per_session IS
  'Exact strength exercise count AI Coach should prescribe per session.';
COMMENT ON COLUMN public.v2_profiles.ai_coach_day_focus IS
  'Weekday name -> split focus label. Empty object uses the split rotation.';
COMMENT ON COLUMN public.v2_profiles.ai_coach_notes IS
  'Replaceable sanitized athlete notes included as untrusted coach context.';
