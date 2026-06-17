ALTER TABLE v2_profiles
  ADD COLUMN IF NOT EXISTS app_tour_completed_at timestamptz;
