-- IronPath V2: Create all v2_* tables
-- This migration creates the complete V2 schema as specified in V2_ARCHITECTURE.md

-- ============================================================================
-- 1. Canonical muscles (reference data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_muscles (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  "group" text,
  sort_order int,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_muscles IS 'Canonical muscle keys used for validation across all exercise metadata';

-- ============================================================================
-- 2. Exercise master list (immutable from client)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  density_score numeric NOT NULL,
  primary_muscles text[] NOT NULL,
  secondary_muscles text[],
  implicit_hits jsonb NOT NULL,
  is_unilateral boolean NOT NULL,
  setup_buffer_sec int NOT NULL,
  avg_time_per_set_sec int NOT NULL,
  is_timed boolean NOT NULL DEFAULT false,
  equipment_needed text[],
  movement_pattern text,
  tempo_category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT density_score_check CHECK (density_score >= 0 AND density_score <= 10)
);

COMMENT ON TABLE v2_exercises IS 'Master exercise list - immutable from client, only admin/service can write';
COMMENT ON COLUMN v2_exercises.avg_time_per_set_sec IS 'Includes rest time between sets';
COMMENT ON COLUMN v2_exercises.implicit_hits IS 'JSONB map: muscle_key -> activation (0..1)';

-- ============================================================================
-- 3. Exercise prescriptions (curated targets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_exercise_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES v2_exercises(id) ON DELETE CASCADE,
  goal text NOT NULL,
  experience text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('reps', 'timed')),
  sets_min int NOT NULL,
  sets_max int NOT NULL,
  reps_min int,
  reps_max int,
  duration_sec_min int,
  duration_sec_max int,
  is_active boolean NOT NULL DEFAULT true,
  source_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (exercise_id, goal, experience, mode),
  CONSTRAINT sets_check CHECK (sets_min >= 1 AND sets_max >= sets_min AND sets_max <= 10),
  CONSTRAINT reps_bounds_check CHECK (
    (mode = 'reps' AND reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_min >= 1 AND reps_max >= reps_min AND reps_max <= 50 AND duration_sec_min IS NULL AND duration_sec_max IS NULL) OR
    (mode = 'timed' AND duration_sec_min IS NOT NULL AND duration_sec_max IS NOT NULL AND duration_sec_min >= 5 AND duration_sec_max >= duration_sec_min AND duration_sec_max <= 3600 AND reps_min IS NULL AND reps_max IS NULL)
  )
);

COMMENT ON TABLE v2_exercise_prescriptions IS 'Curated programming targets per exercise by context (goal, experience, mode)';

-- ============================================================================
-- 4. AI recommended exercises (allow-list)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_ai_recommended_exercises (
  exercise_id uuid PRIMARY KEY REFERENCES v2_exercises(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  priority_order int,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_ai_recommended_exercises IS 'AI allow-list: only exercises in this table can be selected by AI generation';

-- ============================================================================
-- 5. User exercise overrides
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_user_exercise_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES v2_exercises(id) ON DELETE CASCADE,
  density_score_override numeric,
  primary_muscles_override text[],
  implicit_hits_override jsonb,
  is_unilateral_override boolean,
  setup_buffer_sec_override int,
  avg_time_per_set_sec_override int,
  is_timed_override boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id),
  CONSTRAINT density_score_override_check CHECK (density_score_override IS NULL OR (density_score_override >= 0 AND density_score_override <= 10))
);

COMMENT ON TABLE v2_user_exercise_overrides IS 'User-specific overrides for master exercises. Non-null overrides take precedence over global defaults.';

-- ============================================================================
-- 6. User custom exercises
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_user_custom_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  density_score numeric NOT NULL,
  primary_muscles text[] NOT NULL,
  secondary_muscles text[],
  implicit_hits jsonb NOT NULL,
  is_unilateral boolean NOT NULL,
  setup_buffer_sec int NOT NULL,
  avg_time_per_set_sec int NOT NULL,
  is_timed boolean NOT NULL DEFAULT false,
  equipment_needed text[],
  movement_pattern text,
  tempo_category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT density_score_check CHECK (density_score >= 0 AND density_score <= 10)
);

COMMENT ON TABLE v2_user_custom_exercises IS 'User-created exercises not in master list. Must include required metadata for engine eligibility.';

-- ============================================================================
-- 7. Profiles (user settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  age int,
  gender text,
  height numeric,
  current_weight numeric,
  goal_weight numeric,
  experience_level text,
  goal text,
  equipment_access text[],
  days_per_week int,
  workout_days text[],
  preferred_training_style text,
  use_imperial boolean DEFAULT true,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_profiles IS 'User profile and preferences';

-- ============================================================================
-- 8. Workout templates (planning)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Weekly Plan',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2_template_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES v2_workout_templates(id) ON DELETE CASCADE,
  day_name text NOT NULL,
  sort_order int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (template_id, day_name)
);

CREATE TABLE IF NOT EXISTS v2_template_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES v2_template_days(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES v2_exercises(id) ON DELETE SET NULL,
  goal text,
  experience text,
  notes text,
  sort_order int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE v2_workout_templates IS 'Workout plan templates - structure and intent only';
COMMENT ON TABLE v2_template_days IS 'Days within a template';
COMMENT ON TABLE v2_template_slots IS 'Exercise slots within a day. Targets come from prescriptions, not hardcoded here.';

-- ============================================================================
-- 9. Performed truth (sessions and sets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES v2_workout_templates(id) ON DELETE SET NULL,
  day_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS v2_session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES v2_workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES v2_exercises(id) ON DELETE SET NULL,
  custom_exercise_id uuid REFERENCES v2_user_custom_exercises(id) ON DELETE SET NULL,
  sort_order int NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT exercise_reference_check CHECK (
    (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS v2_session_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id uuid NOT NULL REFERENCES v2_session_exercises(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  reps int,
  weight numeric,
  rpe int,
  rir int,
  duration_sec int,
  rest_sec int,
  notes text,
  performed_at timestamptz DEFAULT now(),
  CONSTRAINT reps_check CHECK (reps IS NULL OR reps BETWEEN 1 AND 50),
  CONSTRAINT weight_check CHECK (weight IS NULL OR weight >= 0),
  CONSTRAINT rpe_check CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  CONSTRAINT duration_sec_check CHECK (duration_sec IS NULL OR duration_sec BETWEEN 5 AND 3600),
  CONSTRAINT rest_sec_check CHECK (rest_sec IS NULL OR rest_sec BETWEEN 0 AND 600),
  CONSTRAINT mode_exclusivity_check CHECK (NOT (reps IS NOT NULL AND duration_sec IS NOT NULL)),
  CONSTRAINT mode_required_check CHECK (reps IS NOT NULL OR duration_sec IS NOT NULL),
  CONSTRAINT rpe_rir_exclusivity_check CHECK (NOT (rpe IS NOT NULL AND rir IS NOT NULL))
);

COMMENT ON TABLE v2_workout_sessions IS 'Performed workout sessions - the truth source for what actually happened';
COMMENT ON TABLE v2_session_exercises IS 'Exercises performed in a session';
COMMENT ON TABLE v2_session_sets IS 'Individual sets performed. Must have either reps or duration_sec, not both.';

-- ============================================================================
-- 10. Optional derived caches (rebuildable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS v2_muscle_freshness (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muscle_key text NOT NULL REFERENCES v2_muscles(key) ON DELETE CASCADE,
  freshness numeric NOT NULL DEFAULT 100 CHECK (freshness >= 0 AND freshness <= 100),
  last_trained_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, muscle_key)
);

CREATE TABLE IF NOT EXISTS v2_daily_muscle_stress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  muscle_key text NOT NULL REFERENCES v2_muscles(key) ON DELETE CASCADE,
  stress numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, date, muscle_key)
);

COMMENT ON TABLE v2_muscle_freshness IS 'Derived cache: muscle recovery state (0-100). Rebuildable from v2_session_sets.';
COMMENT ON TABLE v2_daily_muscle_stress IS 'Derived cache: daily muscle stress aggregation. Used for heatmap. Rebuildable from v2_session_sets.';

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_v2_exercises_density_score ON v2_exercises(density_score);
CREATE INDEX IF NOT EXISTS idx_v2_exercise_prescriptions_lookup ON v2_exercise_prescriptions(exercise_id, goal, experience, mode, is_active);
CREATE INDEX IF NOT EXISTS idx_v2_ai_recommended_exercises_active ON v2_ai_recommended_exercises(is_active, priority_order);
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_overrides_user ON v2_user_exercise_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_user_custom_exercises_user ON v2_user_custom_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_workout_sessions_user ON v2_workout_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_v2_session_exercises_session ON v2_session_exercises(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_v2_session_sets_exercise ON v2_session_sets(session_exercise_id, set_number);
CREATE INDEX IF NOT EXISTS idx_v2_muscle_freshness_user ON v2_muscle_freshness(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_daily_muscle_stress_user_date ON v2_daily_muscle_stress(user_id, date);

