-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  muscle_groups ARRAY DEFAULT '{}'::text[],
  equipment_needed ARRAY DEFAULT '{}'::text[],
  is_timed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  difficulty_level text,
  CONSTRAINT exercises_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  age integer,
  gender text,
  height numeric,
  current_weight numeric,
  target_weight numeric,
  experience_level text,
  equipment_access ARRAY,
  days_per_week integer,
  goal text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  goal_weight numeric,
  avatar_url text,
  use_imperial boolean DEFAULT true,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  muscle_groups ARRAY DEFAULT '{}'::text[],
  equipment_needed ARRAY DEFAULT '{}'::text[],
  is_timed boolean DEFAULT false,
  default_duration_sec integer,
  default_sets integer DEFAULT 3,
  default_reps text DEFAULT '8-12'::text,
  default_rest_sec integer DEFAULT 60,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT user_exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.workout_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  exercise_name text NOT NULL,
  weight numeric NOT NULL,
  reps numeric NOT NULL,
  notes text,
  performed_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  scheduled_reps numeric,
  scheduled_weight numeric,
  plan_id bigint,
  day text,
  session_id bigint,
  rpe numeric CHECK (rpe IS NULL OR rpe >= 1::numeric AND rpe <= 10::numeric),
  CONSTRAINT workout_logs_pkey PRIMARY KEY (id),
  CONSTRAINT workout_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT workout_logs_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id),
  CONSTRAINT workout_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.workout_sessions(id)
);
CREATE TABLE public.workout_plans (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  name text DEFAULT 'Weekly Plan'::text,
  is_active boolean DEFAULT true,
  plan_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT workout_plans_pkey PRIMARY KEY (id),
  CONSTRAINT workout_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.workout_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  plan_id bigint NOT NULL,
  day text NOT NULL,
  current_exercise_index integer NOT NULL DEFAULT 0,
  current_set_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])),
  started_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  CONSTRAINT workout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT workout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT workout_sessions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.workout_plans(id)
);