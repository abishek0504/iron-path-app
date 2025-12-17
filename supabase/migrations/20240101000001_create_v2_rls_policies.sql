-- IronPath V2: RLS Policies
-- Implements table-by-table RLS as specified in V2_ARCHITECTURE.md

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
ALTER TABLE v2_muscles ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_exercise_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_ai_recommended_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_user_exercise_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_user_custom_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_template_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_template_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_muscle_freshness ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_daily_muscle_stress ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Immutable tables: auth SELECT only, no writes from client
-- ============================================================================

-- v2_muscles: auth SELECT only
CREATE POLICY "v2_muscles_select_auth" ON v2_muscles
  FOR SELECT
  TO authenticated
  USING (true);

-- v2_exercises: auth SELECT only (immutable from client)
CREATE POLICY "v2_exercises_select_auth" ON v2_exercises
  FOR SELECT
  TO authenticated
  USING (true);

-- v2_exercise_prescriptions: auth SELECT only
CREATE POLICY "v2_exercise_prescriptions_select_auth" ON v2_exercise_prescriptions
  FOR SELECT
  TO authenticated
  USING (true);

-- v2_ai_recommended_exercises: auth SELECT only
CREATE POLICY "v2_ai_recommended_exercises_select_auth" ON v2_ai_recommended_exercises
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- User-owned tables: auth CRUD for owner only
-- ============================================================================

-- v2_user_exercise_overrides: owner CRUD
CREATE POLICY "v2_user_exercise_overrides_owner" ON v2_user_exercise_overrides
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- v2_user_custom_exercises: owner CRUD
CREATE POLICY "v2_user_custom_exercises_owner" ON v2_user_custom_exercises
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- v2_profiles: owner CRUD
CREATE POLICY "v2_profiles_owner" ON v2_profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- v2_workout_templates: owner CRUD
CREATE POLICY "v2_workout_templates_owner" ON v2_workout_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- v2_template_days: owner via template
CREATE POLICY "v2_template_days_owner" ON v2_template_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND (v2_workout_templates.user_id = auth.uid() OR v2_workout_templates.user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND (v2_workout_templates.user_id = auth.uid() OR v2_workout_templates.user_id IS NULL)
    )
  );

-- v2_template_slots: owner via template
CREATE POLICY "v2_template_slots_owner" ON v2_template_slots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND (v2_workout_templates.user_id = auth.uid() OR v2_workout_templates.user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND (v2_workout_templates.user_id = auth.uid() OR v2_workout_templates.user_id IS NULL)
    )
  );

-- v2_workout_sessions: owner CRUD
CREATE POLICY "v2_workout_sessions_owner" ON v2_workout_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- v2_session_exercises: owner via session
CREATE POLICY "v2_session_exercises_owner" ON v2_session_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_sessions
      WHERE v2_workout_sessions.id = v2_session_exercises.session_id
      AND v2_workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_workout_sessions
      WHERE v2_workout_sessions.id = v2_session_exercises.session_id
      AND v2_workout_sessions.user_id = auth.uid()
    )
  );

-- v2_session_sets: owner via session
CREATE POLICY "v2_session_sets_owner" ON v2_session_sets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_session_exercises
      JOIN v2_workout_sessions ON v2_workout_sessions.id = v2_session_exercises.session_id
      WHERE v2_session_exercises.id = v2_session_sets.session_exercise_id
      AND v2_workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_session_exercises
      JOIN v2_workout_sessions ON v2_workout_sessions.id = v2_session_exercises.session_id
      WHERE v2_session_exercises.id = v2_session_sets.session_exercise_id
      AND v2_workout_sessions.user_id = auth.uid()
    )
  );

-- v2_muscle_freshness: owner CRUD
CREATE POLICY "v2_muscle_freshness_owner" ON v2_muscle_freshness
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- v2_daily_muscle_stress: owner CRUD
CREATE POLICY "v2_daily_muscle_stress_owner" ON v2_daily_muscle_stress
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

