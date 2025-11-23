-- Create workout_sessions table to track active workout sessions
-- Stores minimal state (current position only) - actual progress is derived from workout_logs
-- Follows the same patterns as other tables in the schema

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  plan_id bigint NOT NULL,
  day text NOT NULL,
  current_exercise_index integer NOT NULL DEFAULT 0,
  current_set_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  started_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  CONSTRAINT workout_sessions_status_check CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Create index for faster queries on active sessions
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_plan_day_status 
  ON public.workout_sessions(user_id, plan_id, day, status);

-- Create index for faster queries on user's active sessions
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_status 
  ON public.workout_sessions(user_id, status) 
  WHERE status = 'active';

-- Add comment to table
COMMENT ON TABLE public.workout_sessions IS 'Tracks active workout sessions - stores only current position. Actual progress is derived from workout_logs';
COMMENT ON COLUMN public.workout_sessions.current_exercise_index IS 'Index of current exercise in the workout plan';
COMMENT ON COLUMN public.workout_sessions.current_set_index IS 'Index of current set within the current exercise';
COMMENT ON COLUMN public.workout_sessions.status IS 'Session status: active, completed, or abandoned';
COMMENT ON COLUMN public.workout_sessions.day IS 'Day of week (e.g., Monday, Tuesday) for the workout session';

-- Migration: Add plan_id and day to workout_logs for efficient querying
-- This allows us to query logs by plan/day to reconstruct progress
ALTER TABLE public.workout_logs 
  ADD COLUMN IF NOT EXISTS plan_id bigint,
  ADD COLUMN IF NOT EXISTS day text,
  ADD COLUMN IF NOT EXISTS session_id bigint;

-- Add foreign key for plan_id (only if constraint doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workout_logs_plan_id_fkey'
  ) THEN
    ALTER TABLE public.workout_logs
      ADD CONSTRAINT workout_logs_plan_id_fkey 
      FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for session_id (only if constraint doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workout_logs_session_id_fkey'
  ) THEN
    ALTER TABLE public.workout_logs
      ADD CONSTRAINT workout_logs_session_id_fkey 
      FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient queries by plan and day
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_plan_day 
  ON public.workout_logs(user_id, plan_id, day, performed_at);

-- Create index for session queries
CREATE INDEX IF NOT EXISTS idx_workout_logs_session_id 
  ON public.workout_logs(session_id);

