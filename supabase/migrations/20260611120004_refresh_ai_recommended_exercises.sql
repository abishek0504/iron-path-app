-- Refresh AI allow-list: all non-stretch exercises with valid mode prescriptions.
-- Stretches excluded until stretch AI catalog is fully wired.

INSERT INTO v2_ai_recommended_exercises (exercise_id, is_active, priority_order, notes)
SELECT
  e.id,
  true,
  CASE
    WHEN e.density_score >= 9 THEN 10
    WHEN e.density_score >= 8 THEN 20
    WHEN e.density_score >= 6 THEN 30
    WHEN e.density_score >= 4 THEN 40
    ELSE 50
  END AS priority_order,
  'AI-recommended exercise for balanced programming.' AS notes
FROM v2_exercises e
WHERE e.is_stretch = false
  AND (
    (e.is_timed = false AND EXISTS (
      SELECT 1 FROM v2_exercise_prescriptions p
      WHERE p.exercise_id = e.id AND p.mode = 'reps' AND p.is_active = true
    ))
    OR
    (e.is_timed = true AND EXISTS (
      SELECT 1 FROM v2_exercise_prescriptions p
      WHERE p.exercise_id = e.id AND p.mode = 'timed' AND p.is_active = true
    ))
  )
ON CONFLICT (exercise_id) DO UPDATE SET
  priority_order = EXCLUDED.priority_order,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Deactivate stretch entries if any slipped in
UPDATE v2_ai_recommended_exercises ae
SET is_active = false, updated_at = NOW()
FROM v2_exercises e
WHERE ae.exercise_id = e.id AND e.is_stretch = true;
