-- VibeSec security hardening (2026-06-14 audit)
-- 1. Block subscription self-grant on INSERT
-- 2. Protect soft-delete columns from client tampering
-- 3. Revoke EXECUTE on SECURITY DEFINER trigger helpers
-- 4. Harden trigger_update_muscle_freshness if present
-- 5. v2_support message length limit

-- ---------------------------------------------------------------------------
-- Subscription fields: protect on INSERT and UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_profiles_protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_tier := 'free';
      NEW.subscription_expires_at := NULL;
      NEW.revenuecat_app_user_id := NULL;
    ELSE
      NEW.subscription_tier := OLD.subscription_tier;
      NEW.subscription_expires_at := OLD.subscription_expires_at;
      NEW.revenuecat_app_user_id := OLD.revenuecat_app_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_profiles_protect_subscription ON v2_profiles;

CREATE TRIGGER trg_v2_profiles_protect_subscription
  BEFORE INSERT OR UPDATE ON v2_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.v2_profiles_protect_subscription_fields();

REVOKE ALL ON FUNCTION public.v2_profiles_protect_subscription_fields() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Soft-delete columns: only service role may set; owner may restore (clear both)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_profiles_protect_deletion_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.deleted_at := NULL;
      NEW.scheduled_purge_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.deleted_at IS NOT NULL
         AND NEW.deleted_at IS NULL
         AND NEW.scheduled_purge_at IS NULL THEN
        RETURN NEW;
      END IF;
      NEW.deleted_at := OLD.deleted_at;
      NEW.scheduled_purge_at := OLD.scheduled_purge_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v2_profiles_protect_deletion ON v2_profiles;

CREATE TRIGGER trg_v2_profiles_protect_deletion
  BEFORE INSERT OR UPDATE ON v2_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.v2_profiles_protect_deletion_fields();

REVOKE ALL ON FUNCTION public.v2_profiles_protect_deletion_fields() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Muscle freshness trigger function hardening (if deployed)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'trigger_update_muscle_freshness'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.trigger_update_muscle_freshness()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        function_url text;
        service_role_key text;
        payload jsonb;
        http_response record;
      BEGIN
        IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
          function_url := current_setting('app.supabase_url', true) || '/functions/v1/update-muscle-freshness';
          service_role_key := current_setting('app.supabase_service_role_key', true);
          payload := jsonb_build_object(
            'user_id', NEW.user_id::text,
            'session_id', NEW.id::text
          );
          BEGIN
            SELECT * INTO http_response FROM net.http_post(
              url := function_url,
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
              ),
              body := payload
            );
            IF http_response.status_code != 200 THEN
              RAISE WARNING 'Edge Function returned status %: %',
                http_response.status_code,
                http_response.content;
            END IF;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE WARNING 'Failed to call update-muscle-freshness Edge Function: %', SQLERRM;
          END;
        END IF;
        RETURN NEW;
      END;
      $body$;
    $fn$;
    REVOKE ALL ON FUNCTION public.trigger_update_muscle_freshness() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- v2_support message length limit
-- ---------------------------------------------------------------------------
ALTER TABLE v2_support
  DROP CONSTRAINT IF EXISTS v2_support_message_length_check;

ALTER TABLE v2_support
  ADD CONSTRAINT v2_support_message_length_check
  CHECK (char_length(message) BETWEEN 1 AND 5000);
