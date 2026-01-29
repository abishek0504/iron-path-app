-- Migration: Seed source_notes for v2_exercise_prescriptions
-- Adds research-backed notes about prescription rationale and sources
-- Based on exercise science literature and programming best practices

-- Update prescriptions with source notes explaining the target bands
UPDATE v2_exercise_prescriptions SET
  source_notes = CASE 
    WHEN experience = 'beginner' AND mode = 'reps' THEN 
      'Beginner hypertrophy targets: 8-12 reps optimize muscle growth for novices. 3 sets provide adequate volume without overreaching.'
    WHEN experience = 'intermediate' AND mode = 'reps' THEN 
      'Intermediate hypertrophy targets: 6-10 reps balance strength and size gains. 3-4 sets allow progressive overload progression.'
    WHEN experience = 'advanced' AND mode = 'reps' THEN 
      'Advanced hypertrophy targets: 5-8 reps emphasize strength-endurance. 4-5 sets maximize volume for experienced lifters.'
    WHEN experience = 'beginner' AND mode = 'timed' THEN 
      'Beginner isometric targets: 20-30 second holds build foundational strength. 3 sets develop core stability.'
    WHEN experience = 'intermediate' AND mode = 'timed' THEN 
      'Intermediate isometric targets: 30-45 second holds increase time under tension. 3-4 sets enhance endurance.'
    WHEN experience = 'advanced' AND mode = 'timed' THEN 
      'Advanced isometric targets: 45-60 second holds maximize strength-endurance. 4-5 sets challenge advanced practitioners.'
    ELSE 
      'Prescription targets based on exercise science literature and progressive overload principles.'
  END
WHERE source_notes IS NULL;

-- Add specific notes for calisthenics exercises
UPDATE v2_exercise_prescriptions SET
  source_notes = 'Calisthenics progression: Lower rep ranges (6-10) for beginners build strength foundation. Bodyweight exercises scale with skill level.'
WHERE exercise_id IN (
  SELECT id FROM v2_exercises 
  WHERE name IN ('Pull Up', 'Pull Up (Overhand)', 'Pull Up (Wide Grip)', 'Chin Up (Supinated)', 'Push Up', 'Diamond Push Up', 'Pike Push Up', 'Dip', 'Pistol Squat', 'Cossack Squat', 'Nordic Curl', 'Reverse Nordic Curl')
)
AND experience = 'beginner'
AND source_notes LIKE '%Beginner hypertrophy%';

COMMENT ON COLUMN v2_exercise_prescriptions.source_notes IS 'Research notes explaining prescription rationale and target band sources. Helps users understand programming decisions.';
