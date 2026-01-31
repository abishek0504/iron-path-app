-- RLS: Replace auth.uid() with (select auth.uid()) so PostgreSQL evaluates it once (InitPlan)
-- instead of per row. Fixes linter "Auth RLS Initialization Plan" performance warning.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- v2_user_exercise_overrides
DROP POLICY IF EXISTS "v2_user_exercise_overrides_owner" ON v2_user_exercise_overrides;
CREATE POLICY "v2_user_exercise_overrides_owner" ON v2_user_exercise_overrides
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- v2_user_custom_exercises
DROP POLICY IF EXISTS "v2_user_custom_exercises_owner" ON v2_user_custom_exercises;
CREATE POLICY "v2_user_custom_exercises_owner" ON v2_user_custom_exercises
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- v2_profiles
DROP POLICY IF EXISTS "v2_profiles_owner" ON v2_profiles;
CREATE POLICY "v2_profiles_owner" ON v2_profiles
  FOR ALL TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- v2_workout_templates
DROP POLICY IF EXISTS "v2_workout_templates_owner" ON v2_workout_templates;
CREATE POLICY "v2_workout_templates_owner" ON v2_workout_templates
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()) OR user_id IS NULL)
  WITH CHECK (user_id = (select auth.uid()) OR user_id IS NULL);

-- v2_template_days
DROP POLICY IF EXISTS "v2_template_days_owner" ON v2_template_days;
CREATE POLICY "v2_template_days_owner" ON v2_template_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND (v2_workout_templates.user_id = (select auth.uid()) OR v2_workout_templates.user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND (v2_workout_templates.user_id = (select auth.uid()) OR v2_workout_templates.user_id IS NULL)
    )
  );

-- v2_template_slots
DROP POLICY IF EXISTS "v2_template_slots_owner" ON v2_template_slots;
CREATE POLICY "v2_template_slots_owner" ON v2_template_slots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND (v2_workout_templates.user_id = (select auth.uid()) OR v2_workout_templates.user_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND (v2_workout_templates.user_id = (select auth.uid()) OR v2_workout_templates.user_id IS NULL)
    )
  );

-- v2_workout_sessions
DROP POLICY IF EXISTS "v2_workout_sessions_owner" ON v2_workout_sessions;
CREATE POLICY "v2_workout_sessions_owner" ON v2_workout_sessions
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- v2_session_exercises
DROP POLICY IF EXISTS "v2_session_exercises_owner" ON v2_session_exercises;
CREATE POLICY "v2_session_exercises_owner" ON v2_session_exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_sessions
      WHERE v2_workout_sessions.id = v2_session_exercises.session_id
      AND v2_workout_sessions.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_workout_sessions
      WHERE v2_workout_sessions.id = v2_session_exercises.session_id
      AND v2_workout_sessions.user_id = (select auth.uid())
    )
  );

-- v2_session_sets
DROP POLICY IF EXISTS "v2_session_sets_owner" ON v2_session_sets;
CREATE POLICY "v2_session_sets_owner" ON v2_session_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_session_exercises
      JOIN v2_workout_sessions ON v2_workout_sessions.id = v2_session_exercises.session_id
      WHERE v2_session_exercises.id = v2_session_sets.session_exercise_id
      AND v2_workout_sessions.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_session_exercises
      JOIN v2_workout_sessions ON v2_workout_sessions.id = v2_session_exercises.session_id
      WHERE v2_session_exercises.id = v2_session_sets.session_exercise_id
      AND v2_workout_sessions.user_id = (select auth.uid())
    )
  );

-- v2_muscle_freshness
DROP POLICY IF EXISTS "v2_muscle_freshness_owner" ON v2_muscle_freshness;
CREATE POLICY "v2_muscle_freshness_owner" ON v2_muscle_freshness
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- v2_daily_muscle_stress
DROP POLICY IF EXISTS "v2_daily_muscle_stress_owner" ON v2_daily_muscle_stress;
CREATE POLICY "v2_daily_muscle_stress_owner" ON v2_daily_muscle_stress
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- v2_user_exercise_prs
DROP POLICY IF EXISTS "v2_user_exercise_prs_owner" ON v2_user_exercise_prs;
CREATE POLICY "v2_user_exercise_prs_owner" ON v2_user_exercise_prs
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- v2_support
DROP POLICY IF EXISTS "v2_support_owner_insert" ON v2_support;
CREATE POLICY "v2_support_owner_insert" ON v2_support
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "v2_support_owner_select" ON v2_support;
CREATE POLICY "v2_support_owner_select" ON v2_support
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- v2_weight_logs
DROP POLICY IF EXISTS "v2_weight_logs_owner" ON v2_weight_logs;
CREATE POLICY "v2_weight_logs_owner" ON v2_weight_logs
  FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
