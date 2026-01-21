-- Migration: Add trigger to update muscle freshness on session completion
-- This trigger calls the Edge Function when a workout session status changes to 'completed'

-- Create function that calls the Edge Function
CREATE OR REPLACE FUNCTION trigger_update_muscle_freshness()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
  service_role_key text;
  payload jsonb;
  http_response record;
BEGIN
  -- Only trigger if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get the Edge Function URL from environment or use default
    -- Note: Replace with your actual Supabase project URL
    function_url := current_setting('app.supabase_url', true) || '/functions/v1/update-muscle-freshness';
    
    -- Get service role key (this should be set as a database secret)
    service_role_key := current_setting('app.supabase_service_role_key', true);
    
    -- Build payload
    payload := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'session_id', NEW.id::text
    );
    
    -- Call Edge Function using pg_net extension
    -- Note: This requires pg_net extension to be enabled
    -- If pg_net is not available, this will be handled by application code instead
    BEGIN
      SELECT * INTO http_response FROM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := payload
      );
      
      -- Log any errors (optional)
      IF http_response.status_code != 200 THEN
        RAISE WARNING 'Edge Function returned status %: %', 
          http_response.status_code, 
          http_response.content;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- If pg_net is not available or call fails, log warning but don't fail the transaction
        RAISE WARNING 'Failed to call update-muscle-freshness Edge Function: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on v2_workout_sessions
DROP TRIGGER IF EXISTS trigger_session_completed ON v2_workout_sessions;

CREATE TRIGGER trigger_session_completed
  AFTER UPDATE ON v2_workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_muscle_freshness();

-- Add comment
COMMENT ON FUNCTION trigger_update_muscle_freshness() IS 
  'Calls Edge Function to update muscle freshness using Banister decay model when session is completed';

-- Note: This trigger assumes:
-- 1. pg_net extension is enabled (for http_post)
-- 2. Database settings for supabase_url and supabase_service_role_key are configured
-- 
-- If pg_net is not available, the application should call the Edge Function directly
-- after marking a session as completed.
