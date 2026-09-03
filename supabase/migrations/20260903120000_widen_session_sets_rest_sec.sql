-- Align per-set rest with per-exercise/slot rest (0–3600).
-- v2_session_sets.rest_sec was capped at 600 while v2_session_exercises.rest_sec
-- and v2_template_slots.rest_sec already allow NULL or 0–3600.

ALTER TABLE public.v2_session_sets
  DROP CONSTRAINT IF EXISTS rest_sec_check;

ALTER TABLE public.v2_session_sets
  ADD CONSTRAINT rest_sec_check
  CHECK (rest_sec IS NULL OR (rest_sec >= 0 AND rest_sec <= 3600));
