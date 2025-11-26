-- Add UPDATE and DELETE policies for workout_logs to allow users to edit and delete their own logs
-- This enables users to correct mistakes in logged data (weight, reps, notes) and delete sets/workouts

-- Enable RLS if not already enabled
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Create UPDATE policy for users to update their own workout logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workout_logs' 
    AND policyname = 'Users can update their own workout logs'
  ) THEN
    CREATE POLICY "Users can update their own workout logs"
      ON public.workout_logs
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create DELETE policy for users to delete their own workout logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workout_logs' 
    AND policyname = 'Users can delete their own workout logs'
  ) THEN
    CREATE POLICY "Users can delete their own workout logs"
      ON public.workout_logs
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

