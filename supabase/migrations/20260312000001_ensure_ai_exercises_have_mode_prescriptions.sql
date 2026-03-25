-- Ensure v2_ai_recommended_exercises only contains exercises with mode-specific prescriptions
-- AI generation requires: reps exercises need 'reps' prescription, timed exercises need 'timed' prescription
-- Removes entries that would cause "Missing prescription for AI exercise" at runtime

DELETE FROM v2_ai_recommended_exercises
WHERE exercise_id IN (
  SELECT ae.exercise_id
  FROM v2_ai_recommended_exercises ae
  JOIN v2_exercises e ON e.id = ae.exercise_id
  WHERE ae.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM v2_exercise_prescriptions p
      WHERE p.exercise_id = ae.exercise_id
        AND p.is_active = true
        AND (
          (e.is_timed = false AND p.mode = 'reps')
          OR
          (e.is_timed = true AND p.mode = 'timed')
        )
    )
);

COMMENT ON TABLE v2_ai_recommended_exercises IS 'AI allow-list: only exercises in this table can be selected by AI generation. Each exercise must have a prescription matching its mode (reps or timed). Priority order: lower number = higher priority.';
