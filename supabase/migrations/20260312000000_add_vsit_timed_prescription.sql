-- Add missing timed prescription for V-Sit (AI recommended exercise)
-- Fixes: [week-generation] ERROR: Missing prescription for AI exercise {exerciseId: '37deb97e-e1b6-47e2-a010-3136ffb9ee2e', experience: 'beginner', mode: 'timed'}
-- V-Sit is a timed core exercise; uses same bands as other timed exercises (Plank, Side Plank, etc.)

INSERT INTO v2_exercise_prescriptions (
  exercise_id,
  goal,
  experience,
  mode,
  sets_min,
  sets_max,
  reps_min,
  reps_max,
  duration_sec_min,
  duration_sec_max,
  is_active
)
VALUES
  ('37deb97e-e1b6-47e2-a010-3136ffb9ee2e', 'hypertrophy', 'beginner', 'timed', 3, 3, NULL, NULL, 20, 30, true),
  ('37deb97e-e1b6-47e2-a010-3136ffb9ee2e', 'hypertrophy', 'intermediate', 'timed', 3, 4, NULL, NULL, 30, 45, true),
  ('37deb97e-e1b6-47e2-a010-3136ffb9ee2e', 'hypertrophy', 'advanced', 'timed', 4, 5, NULL, NULL, 45, 60, true)
ON CONFLICT (exercise_id, goal, experience, mode) DO NOTHING;

-- Ensure V-Sit is in AI list (seed may have excluded it before timed prescription existed)
INSERT INTO v2_ai_recommended_exercises (exercise_id, is_active, priority_order, notes)
VALUES (
  '37deb97e-e1b6-47e2-a010-3136ffb9ee2e',
  true,
  45,
  'Advanced core isometric. Full-body core strength.'
)
ON CONFLICT (exercise_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  priority_order = EXCLUDED.priority_order,
  notes = EXCLUDED.notes,
  updated_at = NOW();
