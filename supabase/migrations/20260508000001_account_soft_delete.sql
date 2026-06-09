-- Account soft-delete with grace period (Apple App Store Guideline 5.1.1(v)).
--
-- Adds two nullable timestamp columns to v2_profiles:
--   * deleted_at         — when the user requested deletion
--   * scheduled_purge_at — when the row will be hard-deleted by the purge job
--
-- During the grace window, the user can sign in and choose Restore (sets both
-- columns back to NULL). After scheduled_purge_at passes, a scheduled job
-- (set up separately) hard-deletes the auth.users row and cascades v2_* data.

ALTER TABLE v2_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMPTZ;

-- Helpful index for the future purge job
CREATE INDEX IF NOT EXISTS idx_v2_profiles_scheduled_purge_at
  ON v2_profiles (scheduled_purge_at)
  WHERE scheduled_purge_at IS NOT NULL;

COMMENT ON COLUMN v2_profiles.deleted_at IS
  'When the user requested account deletion. Soft-delete marker; row remains until scheduled_purge_at.';
COMMENT ON COLUMN v2_profiles.scheduled_purge_at IS
  'When the row will be hard-deleted by the scheduled purge job (typically deleted_at + 30 days).';
