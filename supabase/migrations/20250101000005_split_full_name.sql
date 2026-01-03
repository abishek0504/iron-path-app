-- Patch: Split full_name into first_name and last_name in v2_profiles
-- Migration: 20250101000005_split_full_name.sql

-- Step 1: Add new columns
ALTER TABLE v2_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Step 2: Migrate existing data (split full_name into first_name and last_name)
-- For existing records, try to split on space (take first word as first_name, rest as last_name)
UPDATE v2_profiles
SET
  first_name = CASE
    WHEN full_name IS NULL OR full_name = '' THEN NULL
    WHEN position(' ' in full_name) > 0 THEN split_part(full_name, ' ', 1)
    ELSE full_name
  END,
  last_name = CASE
    WHEN full_name IS NULL OR full_name = '' THEN NULL
    WHEN position(' ' in full_name) > 0 THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE NULL
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Step 3: Drop the old full_name column
ALTER TABLE v2_profiles DROP COLUMN IF EXISTS full_name;

-- Step 4: Add constraint to make first_name required (NOT NULL)
-- Note: We allow NULL for now to handle existing data, but new inserts should require first_name
-- The application layer will enforce first_name as required

COMMENT ON COLUMN v2_profiles.first_name IS 'User first name (required)';
COMMENT ON COLUMN v2_profiles.last_name IS 'User last name (optional)';

