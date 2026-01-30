-- Help & Support submissions from the app
CREATE TABLE IF NOT EXISTS v2_support (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_support IS 'Help & Support submissions; name, email, and message from the contact form';

CREATE INDEX IF NOT EXISTS idx_v2_support_user_id ON v2_support(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_support_created_at ON v2_support(created_at DESC);

ALTER TABLE v2_support ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_support_owner_insert" ON v2_support
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "v2_support_owner_select" ON v2_support
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
