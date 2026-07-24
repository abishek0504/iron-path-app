-- Fix signup failure ("Database error saving new user", SQLSTATE 23502).
--
-- The auth trigger handle_new_user() runs on INSERT into auth.users and does:
--   INSERT INTO public.v2_profiles (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;
-- but v2_profiles.first_name was NOT NULL with no default, so the trigger threw a
-- not-null violation and every signup returned 500. first_name is collected later
-- during onboarding (app/onboarding.tsx), so it must be nullable at signup time.
alter table public.v2_profiles alter column first_name drop not null;
