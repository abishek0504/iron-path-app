-- Subscription fields for RevenueCat / App Store IAP (server-authoritative).

ALTER TABLE v2_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id text;

ALTER TABLE v2_profiles
  DROP CONSTRAINT IF EXISTS v2_profiles_subscription_tier_check;

ALTER TABLE v2_profiles
  ADD CONSTRAINT v2_profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro'));

COMMENT ON COLUMN v2_profiles.subscription_tier IS 'free | pro — updated by revenuecat-webhook (service role) only';
COMMENT ON COLUMN v2_profiles.subscription_expires_at IS 'When pro access ends; NULL if active without fixed expiry from webhook';
COMMENT ON COLUMN v2_profiles.revenuecat_app_user_id IS 'RevenueCat app_user_id (defaults to auth user id)';

-- Prevent authenticated clients from self-granting pro.
CREATE OR REPLACE FUNCTION public.v2_profiles_protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.subscription_expires_at := OLD.subscription_expires_at;
    NEW.revenuecat_app_user_id := OLD.revenuecat_app_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_profiles_protect_subscription ON v2_profiles;

CREATE TRIGGER trg_v2_profiles_protect_subscription
  BEFORE UPDATE ON v2_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.v2_profiles_protect_subscription_fields();
