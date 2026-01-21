-- Fix performed_at default value bug
-- The DEFAULT now() was causing sets to be marked as completed immediately upon creation
-- This should only be set when a user actually completes a set

ALTER TABLE v2_session_sets 
  ALTER COLUMN performed_at DROP DEFAULT;

-- Comment explaining the column's purpose
COMMENT ON COLUMN v2_session_sets.performed_at IS 'Timestamp when the set was actually performed. NULL until user completes the set.';
