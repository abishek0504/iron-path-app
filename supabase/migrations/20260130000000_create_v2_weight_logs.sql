-- Create v2_weight_logs for weight tracking history
-- Stores each weight log entry; profile.current_weight remains the latest value for app-wide use

CREATE TABLE IF NOT EXISTS v2_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight numeric NOT NULL CHECK (weight > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_weight_logs IS 'User weight log history for tracking over time';

CREATE INDEX IF NOT EXISTS idx_v2_weight_logs_user_recorded ON v2_weight_logs(user_id, recorded_at DESC);

ALTER TABLE v2_weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_weight_logs_owner" ON v2_weight_logs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill: insert one row per user who has current_weight in profile (use created_at as recorded_at)
INSERT INTO v2_weight_logs (user_id, weight, recorded_at)
SELECT id, current_weight, COALESCE(created_at, now())
FROM v2_profiles
WHERE current_weight IS NOT NULL
  AND current_weight > 0
  AND NOT EXISTS (
    SELECT 1 FROM v2_weight_logs wl WHERE wl.user_id = v2_profiles.id
  );
