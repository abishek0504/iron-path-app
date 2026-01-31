-- Add covering indexes for foreign key columns that lack them.
-- Improves JOIN and CASCADE/REFERENCE performance; addresses advisor warning
-- "foreign key without a covering index".

-- v2_user_exercise_prs: FKs session_exercise_id, session_id, set_id had no index
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_session_exercise_id
  ON public.v2_user_exercise_prs (session_exercise_id);
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_session_id
  ON public.v2_user_exercise_prs (session_id);
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_set_id
  ON public.v2_user_exercise_prs (set_id);

-- v2_workout_templates: FK user_id
CREATE INDEX IF NOT EXISTS idx_v2_workout_templates_user_id
  ON public.v2_workout_templates (user_id);

-- v2_template_slots: FKs day_id, exercise_id
CREATE INDEX IF NOT EXISTS idx_v2_template_slots_day_id
  ON public.v2_template_slots (day_id);
CREATE INDEX IF NOT EXISTS idx_v2_template_slots_exercise_id
  ON public.v2_template_slots (exercise_id);

-- v2_workout_sessions: FK template_id
CREATE INDEX IF NOT EXISTS idx_v2_workout_sessions_template_id
  ON public.v2_workout_sessions (template_id);

-- v2_session_exercises: FKs exercise_id, custom_exercise_id (session_id already covered by idx_v2_session_exercises_session)
CREATE INDEX IF NOT EXISTS idx_v2_session_exercises_exercise_id
  ON public.v2_session_exercises (exercise_id);
CREATE INDEX IF NOT EXISTS idx_v2_session_exercises_custom_exercise_id
  ON public.v2_session_exercises (custom_exercise_id);
