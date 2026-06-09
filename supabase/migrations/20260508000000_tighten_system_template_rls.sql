-- Tighten RLS for "system" templates (user_id IS NULL).
--
-- Previous policies allowed `user_id = auth.uid() OR user_id IS NULL` for ALL
-- operations on v2_workout_templates / v2_template_days / v2_template_slots.
-- That meant any authenticated user could INSERT/UPDATE/DELETE rows whose
-- user_id is NULL — i.e. mutate shared "system" templates.
--
-- This migration splits the single FOR ALL policy into:
--   * SELECT: owner OR system (user_id IS NULL) — preserves read access
--   * INSERT/UPDATE/DELETE: owner only — closes the write hole
--
-- All v2_template_days and v2_template_slots policies follow the same pattern
-- via EXISTS on the parent template.

-- ============================================================================
-- v2_workout_templates
-- ============================================================================
DROP POLICY IF EXISTS "v2_workout_templates_owner" ON v2_workout_templates;

CREATE POLICY "v2_workout_templates_select" ON v2_workout_templates
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR user_id IS NULL);

CREATE POLICY "v2_workout_templates_insert" ON v2_workout_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "v2_workout_templates_update" ON v2_workout_templates
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "v2_workout_templates_delete" ON v2_workout_templates
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- v2_template_days
-- ============================================================================
DROP POLICY IF EXISTS "v2_template_days_owner" ON v2_template_days;

CREATE POLICY "v2_template_days_select" ON v2_template_days
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND (v2_workout_templates.user_id = (select auth.uid()) OR v2_workout_templates.user_id IS NULL)
    )
  );

CREATE POLICY "v2_template_days_insert" ON v2_template_days
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  );

CREATE POLICY "v2_template_days_update" ON v2_template_days
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  );

CREATE POLICY "v2_template_days_delete" ON v2_template_days
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_workout_templates
      WHERE v2_workout_templates.id = v2_template_days.template_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- v2_template_slots
-- ============================================================================
DROP POLICY IF EXISTS "v2_template_slots_owner" ON v2_template_slots;

CREATE POLICY "v2_template_slots_select" ON v2_template_slots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND (v2_workout_templates.user_id = (select auth.uid()) OR v2_workout_templates.user_id IS NULL)
    )
  );

CREATE POLICY "v2_template_slots_insert" ON v2_template_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  );

CREATE POLICY "v2_template_slots_update" ON v2_template_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  );

CREATE POLICY "v2_template_slots_delete" ON v2_template_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_template_days
      JOIN v2_workout_templates ON v2_workout_templates.id = v2_template_days.template_id
      WHERE v2_template_days.id = v2_template_slots.day_id
      AND v2_workout_templates.user_id = (select auth.uid())
    )
  );
