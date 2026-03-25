-- Migration: Seed v2_ai_recommended_exercises with priority_order and notes
-- Priority order: Lower number = higher priority (1 = highest priority)
-- Based on exercise hierarchy: compound movements first, isolation exercises last
-- All exercises with prescriptions are eligible for AI generation

-- Priority tiers:
-- 1-10: Foundational compound movements (Big 3 + major compounds)
-- 11-20: Secondary compound movements
-- 21-30: Assistance/accessory compound movements
-- 31-40: Isolation exercises
-- 41+: Advanced/specialized exercises

-- Insert exercises that have mode-specific prescriptions (reps exercises need 'reps', timed need 'timed')
-- Prevents "Missing prescription for AI exercise" at runtime
INSERT INTO v2_ai_recommended_exercises (exercise_id, is_active, priority_order, notes)
SELECT 
  e.id,
  true,
  CASE e.name
    -- Tier 1: Foundational Compounds (Big 3 + Major Compounds) - Priority 1-10
    WHEN 'Squat (Barbell)' THEN 1
    WHEN 'Deadlift (Conventional)' THEN 2
    WHEN 'Bench Press (Barbell)' THEN 3
    WHEN 'Overhead Press' THEN 4
    WHEN 'Bent Over Row (Barbell)' THEN 5
    WHEN 'Pull Up' THEN 6
    WHEN 'Front Squat' THEN 7
    WHEN 'Romanian Deadlift (RDL)' THEN 8
    WHEN 'Lat Pulldown' THEN 9
    WHEN 'Seated Cable Row' THEN 10
    
    -- Tier 2: Secondary Compound Movements - Priority 11-20
    WHEN 'Incline Dumbbell Press' THEN 11
    WHEN 'Hip Thrust' THEN 12
    WHEN 'Leg Press' THEN 13
    WHEN 'Pull Up (Overhand)' THEN 14
    WHEN 'Pull Up (Wide Grip)' THEN 15
    WHEN 'Chin Up (Supinated)' THEN 16
    WHEN 'Dip' THEN 17
    WHEN 'Bulgarian Split Squat' THEN 18
    WHEN 'Walking Lunge' THEN 19
    WHEN 'Face Pull' THEN 20
    
    -- Tier 3: Assistance/Accessory Compounds - Priority 21-30
    WHEN 'Push Up' THEN 21
    WHEN 'Diamond Push Up' THEN 22
    WHEN 'Pike Push Up' THEN 23
    WHEN 'Arnold Press' THEN 24
    WHEN 'Leg Extension' THEN 25
    WHEN 'Leg Curl (Seated/Lying)' THEN 26
    WHEN 'Nordic Curl' THEN 27
    WHEN 'Reverse Nordic Curl' THEN 28
    WHEN 'Pistol Squat' THEN 29
    WHEN 'Cossack Squat' THEN 30
    
    -- Tier 4: Isolation Exercises - Priority 31-40
    WHEN 'Bicep Curl (Barbell/Dumbbell)' THEN 31
    WHEN 'Hammer Curl' THEN 32
    WHEN 'Tricep Pushdown' THEN 33
    WHEN 'Skullcrusher' THEN 34
    WHEN 'Overhead Tricep Extension' THEN 35
    WHEN 'Lateral Raise' THEN 36
    WHEN 'Dumbbell Fly' THEN 37
    WHEN 'Calf Raise' THEN 38
    
    -- Tier 5: Core & Stability (Isometric/Timed) - Priority 41-50
    WHEN 'Plank' THEN 41
    WHEN 'Side Plank' THEN 42
    WHEN 'Hanging Leg Raise' THEN 43
    WHEN 'Hanging Knee Raise' THEN 44
    WHEN 'V-Sit' THEN 45
    WHEN 'L-Sit' THEN 46
    WHEN 'Superman Hold' THEN 47
    WHEN 'Farmer''s Walk' THEN 48
    
    -- Default: If exercise not explicitly listed, assign based on density_score
    ELSE 
      CASE 
        WHEN e.density_score >= 8 THEN 15  -- High density = secondary compound
        WHEN e.density_score >= 6 THEN 25  -- Medium-high = assistance
        WHEN e.density_score >= 4 THEN 35  -- Medium = isolation
        ELSE 45  -- Low density = specialized/advanced
      END
  END as priority_order,
  CASE e.name
    WHEN 'Squat (Barbell)' THEN 'Foundational lower body compound. King of leg exercises.'
    WHEN 'Deadlift (Conventional)' THEN 'Foundational posterior chain compound. Full-body strength builder.'
    WHEN 'Bench Press (Barbell)' THEN 'Foundational upper body push compound. Chest development cornerstone.'
    WHEN 'Overhead Press' THEN 'Foundational vertical push compound. Shoulder strength and stability.'
    WHEN 'Bent Over Row (Barbell)' THEN 'Foundational horizontal pull compound. Back thickness builder.'
    WHEN 'Pull Up' THEN 'Foundational vertical pull compound. Bodyweight back builder.'
    WHEN 'Front Squat' THEN 'Quad-dominant squat variation. Excellent for core strength.'
    WHEN 'Romanian Deadlift (RDL)' THEN 'Hamstring-focused hinge. Posterior chain developer.'
    WHEN 'Lat Pulldown' THEN 'Vertical pull machine variation. Accessible alternative to pull-ups.'
    WHEN 'Seated Cable Row' THEN 'Horizontal pull machine variation. Back width builder.'
    WHEN 'Incline Dumbbell Press' THEN 'Upper chest focus. Shoulder-friendly pressing variation.'
    WHEN 'Hip Thrust' THEN 'Glute-focused hinge. Posterior chain specialist.'
    WHEN 'Leg Press' THEN 'Quad-focused machine compound. High volume leg builder.'
    WHEN 'Dip' THEN 'Upper body push compound. Tricep and chest developer.'
    WHEN 'Bulgarian Split Squat' THEN 'Unilateral leg compound. Balance and strength builder.'
    WHEN 'Walking Lunge' THEN 'Unilateral leg compound. Functional movement pattern.'
    WHEN 'Face Pull' THEN 'Posterior deltoid and rotator cuff specialist. Shoulder health exercise.'
    WHEN 'Push Up' THEN 'Bodyweight push compound. Accessible chest builder.'
    WHEN 'Diamond Push Up' THEN 'Tricep-focused push-up variation. Bodyweight arm builder.'
    WHEN 'Pike Push Up' THEN 'Shoulder-focused push-up variation. Bodyweight overhead press.'
    WHEN 'Arnold Press' THEN 'Shoulder compound with rotation. Deltoid developer.'
    WHEN 'Leg Extension' THEN 'Quad isolation. Knee extension specialist.'
    WHEN 'Leg Curl (Seated/Lying)' THEN 'Hamstring isolation. Knee flexion specialist.'
    WHEN 'Nordic Curl' THEN 'Eccentric hamstring builder. Advanced bodyweight exercise.'
    WHEN 'Reverse Nordic Curl' THEN 'Eccentric quad builder. Advanced bodyweight exercise.'
    WHEN 'Pistol Squat' THEN 'Single-leg squat. Advanced bodyweight leg exercise.'
    WHEN 'Cossack Squat' THEN 'Lateral mobility squat. Hip mobility and strength.'
    WHEN 'Bicep Curl (Barbell/Dumbbell)' THEN 'Bicep isolation. Arm size builder.'
    WHEN 'Hammer Curl' THEN 'Brachialis and forearm focus. Arm thickness builder.'
    WHEN 'Tricep Pushdown' THEN 'Tricep isolation. Arm extension specialist.'
    WHEN 'Skullcrusher' THEN 'Tricep isolation. Overhead tricep builder.'
    WHEN 'Overhead Tricep Extension' THEN 'Tricep isolation. Long head focus.'
    WHEN 'Lateral Raise' THEN 'Lateral deltoid isolation. Shoulder width builder.'
    WHEN 'Dumbbell Fly' THEN 'Chest isolation. Stretch-focused chest builder.'
    WHEN 'Calf Raise' THEN 'Calf isolation. Lower leg developer.'
    WHEN 'Plank' THEN 'Core stability isometric. Foundational core strength.'
    WHEN 'Side Plank' THEN 'Lateral core stability. Oblique and glute medius builder.'
    WHEN 'Hanging Leg Raise' THEN 'Lower ab and hip flexor builder. Advanced core exercise.'
    WHEN 'Hanging Knee Raise' THEN 'Lower ab builder. Accessible core exercise.'
    WHEN 'V-Sit' THEN 'Advanced core isometric. Full-body core strength.'
    WHEN 'L-Sit' THEN 'Advanced core and hip flexor isometric. Gymnastic strength.'
    WHEN 'Superman Hold' THEN 'Posterior chain isometric. Lower back and glute builder.'
    WHEN 'Farmer''s Walk' THEN 'Grip and core carry. Full-body strength and stability.'
    ELSE 'AI-recommended exercise for balanced programming.'
  END as notes
FROM v2_exercises e
WHERE (
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

COMMENT ON TABLE v2_ai_recommended_exercises IS 'AI allow-list: only exercises in this table can be selected by AI generation. Priority order: lower number = higher priority.';
