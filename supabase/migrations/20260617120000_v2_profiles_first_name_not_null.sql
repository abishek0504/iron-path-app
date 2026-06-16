-- Enforce first_name NOT NULL on v2_profiles (deferred in 20250101000005_split_full_name.sql)

UPDATE public.v2_profiles
SET first_name = 'User'
WHERE first_name IS NULL OR btrim(first_name) = '';

ALTER TABLE public.v2_profiles
  ALTER COLUMN first_name SET NOT NULL;
