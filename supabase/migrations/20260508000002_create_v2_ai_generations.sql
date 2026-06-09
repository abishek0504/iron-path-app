-- Audit log + rate-limit ledger for AI workout generation.
--
-- Every call to the `generate-workout` Edge Function records a row here so we
-- can enforce a per-user daily quota (e.g. 10 / day) and observe model usage,
-- latency, and fallback rates over time.
--
-- Source values:
--   * 'gemini'   — the LLM returned a response that passed allow-list validation
--   * 'fallback' — the LLM call failed or returned invalid IDs; client used the
--                  deterministic engine instead (still recorded so we count it
--                  against the quota — this prevents trivially DoSing the LLM)
--   * 'error'    — the entire call failed before a result was produced
--
-- Status is intentionally a free-form text rather than an enum so we can add
-- new values without a migration. RLS keeps it owner-readable; only the
-- service role (used inside the Edge Function) can INSERT.

CREATE TABLE IF NOT EXISTS v2_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  template_id uuid REFERENCES v2_workout_templates(id) ON DELETE SET NULL,
  day_name text,
  sessions_per_day int,
  exercise_count int,
  model text,
  source text NOT NULL CHECK (source IN ('gemini', 'fallback', 'error')),
  latency_ms int,
  error_code text
);

COMMENT ON TABLE v2_ai_generations IS
  'Audit log and rate-limit ledger for AI workout generation calls.';
COMMENT ON COLUMN v2_ai_generations.source IS
  'gemini = LLM response used, fallback = deterministic engine used, error = no result';

-- The rate-limit query is `WHERE user_id = $1 AND created_at > now() - interval ''1 day''`
-- so we want a (user_id, created_at desc) index.
CREATE INDEX IF NOT EXISTS idx_v2_ai_generations_user_created
  ON v2_ai_generations (user_id, created_at DESC);

-- RLS: owner can read their own audit rows; only service role writes.
ALTER TABLE v2_ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "v2_ai_generations_owner_select" ON v2_ai_generations;
CREATE POLICY "v2_ai_generations_owner_select" ON v2_ai_generations
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- No INSERT/UPDATE/DELETE policies → only service_role (which bypasses RLS)
-- can write. The Edge Function uses the service-role client for inserts.
