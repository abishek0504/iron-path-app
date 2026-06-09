-- Apple Health linkage + sync ledger (Phase 2E). RPE/RIR validation tighten (Phase 3).

-- ---------------------------------------------------------------------------
-- HKWorkout / HealthKit sample UUIDs (nullable, idempotent writes on app side)
-- ---------------------------------------------------------------------------
ALTER TABLE public.v2_workout_sessions
  ADD COLUMN IF NOT EXISTS hk_workout_uuid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_workout_sessions_hk_workout_uuid_unique
  ON public.v2_workout_sessions (hk_workout_uuid)
  WHERE hk_workout_uuid IS NOT NULL;

ALTER TABLE public.v2_weight_logs
  ADD COLUMN IF NOT EXISTS hk_sample_uuid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_weight_logs_hk_sample_uuid_unique
  ON public.v2_weight_logs (hk_sample_uuid)
  WHERE hk_sample_uuid IS NOT NULL;

COMMENT ON COLUMN public.v2_workout_sessions.hk_workout_uuid IS
  'Apple Health HKWorkout UUID after successful write; prevents duplicate exports.';
COMMENT ON COLUMN public.v2_weight_logs.hk_sample_uuid IS
  'Apple Health HKQuantitySample UUID for bodyMass write deduplication.';

-- ---------------------------------------------------------------------------
-- v2_health_sync: last successful pull/push per logical type (JSONB blob)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.v2_health_sync (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  types jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.v2_health_sync IS
  'Ledger for HealthKit integration: last sync timestamps per category in `types`.';

ALTER TABLE public.v2_health_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v2_health_sync_owner_all" ON public.v2_health_sync;

CREATE POLICY "v2_health_sync_owner_all" ON public.v2_health_sync
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Session set validation: RPE 0–10 (inclusive), RIR 0–15 when present
-- ---------------------------------------------------------------------------
ALTER TABLE public.v2_session_sets DROP CONSTRAINT IF EXISTS rpe_check;

ALTER TABLE public.v2_session_sets ADD CONSTRAINT rpe_check
  CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10));

ALTER TABLE public.v2_session_sets DROP CONSTRAINT IF EXISTS v2_session_sets_rir_range;

ALTER TABLE public.v2_session_sets ADD CONSTRAINT v2_session_sets_rir_range
  CHECK (rir IS NULL OR (rir >= 0 AND rir <= 15));
