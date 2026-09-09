-- Progress photos: owner-only metadata + avatars-bucket objects at
-- {user_id}/progress/{timestamp}.jpg
-- Local migration only — do not apply remotely from this change.

CREATE TABLE IF NOT EXISTS v2_progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_progress_photos IS 'User progress photos stored in the avatars bucket';

CREATE INDEX IF NOT EXISTS idx_v2_progress_photos_user_captured
  ON v2_progress_photos (user_id, captured_at DESC);

ALTER TABLE v2_progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2_progress_photos_owner" ON v2_progress_photos
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.v2_progress_photos TO authenticated;
REVOKE ALL ON TABLE public.v2_progress_photos FROM anon;

-- Existing avatar policies only match flat `{uid}-%` keys. Progress photos use
-- `{uid}/progress/{timestamp}.jpg`.
CREATE POLICY "Users can upload their own progress photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE (select auth.uid())::text || '/progress/%'
  );

CREATE POLICY "Users can update their own progress photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE (select auth.uid())::text || '/progress/%'
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE (select auth.uid())::text || '/progress/%'
  );

CREATE POLICY "Users can delete their own progress photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE (select auth.uid())::text || '/progress/%'
  );

CREATE POLICY "Users can read their own progress photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE (select auth.uid())::text || '/progress/%'
  );
