-- Migration: Seed missing exercise metadata fields
-- Fills description, secondary_muscles, equipment_needed, movement_pattern, and tempo_category
-- Based on EMG research, biomechanics literature, and exercise classification systems
--
-- Movement Patterns: push, pull, squat, hinge, lunge, carry, rotation, anti-rotation
-- Tempo Categories: explosive, controlled, isometric

-- ============================================================================
-- UPPER BODY PUSH EXERCISES
-- ============================================================================

-- Bench Press (Barbell)
UPDATE v2_exercises SET
  description = 'Lie on bench with feet flat. Lower bar to chest with control, press up explosively. Keep core tight and shoulder blades retracted.',
  secondary_muscles = ARRAY['anterior_deltoids', 'serratus_anterior'],
  equipment_needed = ARRAY['barbell', 'bench'],
  movement_pattern = 'push',
  tempo_category = 'explosive'
WHERE name = 'Bench Press (Barbell)';

-- Incline Dumbbell Press
UPDATE v2_exercises SET
  description = 'Set bench to 30-45° incline. Press dumbbells from chest level to full extension above shoulders. Control the eccentric phase.',
  secondary_muscles = ARRAY['upper_chest', 'anterior_deltoids', 'serratus_anterior'],
  equipment_needed = ARRAY['dumbbells', 'incline_bench'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Incline Dumbbell Press';

-- Dumbbell Fly
UPDATE v2_exercises SET
  description = 'Lie on bench with dumbbells extended above chest. Lower weights in wide arc until chest stretch, then squeeze chest to bring weights together.',
  secondary_muscles = ARRAY['anterior_deltoids'],
  equipment_needed = ARRAY['dumbbells', 'bench'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Dumbbell Fly';

-- Push Up
UPDATE v2_exercises SET
  description = 'Start in plank position. Lower body until chest nearly touches ground, then push up explosively. Keep body straight from head to heels.',
  secondary_muscles = ARRAY['anterior_deltoids', 'abs', 'serratus_anterior'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Push Up';

-- Diamond Push Up
UPDATE v2_exercises SET
  description = 'Form diamond shape with hands under chest. Lower until chest touches hands, focus on tricep engagement. Push up explosively.',
  secondary_muscles = ARRAY['chest', 'anterior_deltoids', 'abs'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Diamond Push Up';

-- Pike Push Up
UPDATE v2_exercises SET
  description = 'Start in downward dog position. Lower head toward ground by bending elbows, then push back up. Targets shoulders and triceps.',
  secondary_muscles = ARRAY['upper_chest', 'traps', 'serratus_anterior'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Pike Push Up';

-- Dip
UPDATE v2_exercises SET
  description = 'Support body on parallel bars. Lower by bending elbows until shoulders below elbows, then press up. Lean forward to target chest more.',
  secondary_muscles = ARRAY['lower_chest', 'anterior_deltoids'],
  equipment_needed = ARRAY['parallel_bars'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Dip';

-- Overhead Press
UPDATE v2_exercises SET
  description = 'Stand with feet shoulder-width. Press bar from shoulder level to overhead. Keep core tight, slight lean back at top. Lower with control.',
  secondary_muscles = ARRAY['upper_chest', 'core', 'triceps'],
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'push',
  tempo_category = 'explosive'
WHERE name = 'Overhead Press';

-- Arnold Press
UPDATE v2_exercises SET
  description = 'Start with dumbbells at shoulder level, palms facing you. Rotate wrists outward while pressing overhead. Reverse motion on descent.',
  secondary_muscles = ARRAY['lateral_deltoids', 'triceps', 'upper_chest'],
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Arnold Press';

-- Lateral Raise
UPDATE v2_exercises SET
  description = 'Stand holding dumbbells at sides. Raise arms out to shoulder height with slight bend in elbows. Lower slowly to resist gravity.',
  secondary_muscles = ARRAY['traps'],
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Lateral Raise';

-- ============================================================================
-- UPPER BODY PULL EXERCISES
-- ============================================================================

-- Pull Up (Overhand)
UPDATE v2_exercises SET
  description = 'Hang from bar with overhand grip, hands wider than shoulders. Pull body up until chin clears bar. Lower with control.',
  secondary_muscles = ARRAY['traps', 'posterior_deltoids', 'forearms'],
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Pull Up (Overhand)';

-- Pull Up (Wide Grip)
UPDATE v2_exercises SET
  description = 'Wide overhand grip, hands 1.5x shoulder width. Pull up focusing on lats. Lower slowly to maximize time under tension.',
  secondary_muscles = ARRAY['traps', 'forearms'],
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Pull Up (Wide Grip)';

-- Chin Up (Supinated)
UPDATE v2_exercises SET
  description = 'Underhand grip, hands shoulder-width. Pull up emphasizing biceps and lats. Lower with control to full arm extension.',
  secondary_muscles = ARRAY['biceps', 'traps', 'forearms'],
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Chin Up (Supinated)';

-- Pull Up
UPDATE v2_exercises SET
  description = 'Standard pull-up with neutral or overhand grip. Pull body up until chin clears bar, focus on lat engagement. Lower with control.',
  secondary_muscles = ARRAY['biceps', 'traps', 'posterior_deltoids', 'forearms'],
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Pull Up';

-- Lat Pulldown
UPDATE v2_exercises SET
  description = 'Seated at lat pulldown machine. Pull bar to upper chest, squeeze lats at bottom. Control the eccentric phase fully.',
  secondary_muscles = ARRAY['biceps', 'posterior_deltoids', 'traps'],
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Lat Pulldown';

-- Seated Cable Row
UPDATE v2_exercises SET
  description = 'Seated with feet braced. Pull handle to lower chest/upper abdomen, squeeze shoulder blades together. Return with control.',
  secondary_muscles = ARRAY['lats', 'traps', 'biceps', 'posterior_deltoids'],
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Seated Cable Row';

-- Bent Over Row (Barbell)
UPDATE v2_exercises SET
  description = 'Hinge at hips, back straight. Pull bar to lower chest/upper abdomen, squeeze shoulder blades. Lower with control.',
  secondary_muscles = ARRAY['upper_back', 'lower_back', 'biceps', 'hamstrings'],
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Bent Over Row (Barbell)';

-- Face Pull
UPDATE v2_exercises SET
  description = 'Stand facing cable machine at face height. Pull rope to face level, external rotate shoulders. Targets rear delts and rotator cuff.',
  secondary_muscles = ARRAY['rotator_cuff', 'traps', 'upper_back'],
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Face Pull';

-- ============================================================================
-- LOWER BODY: SQUAT PATTERN
-- ============================================================================

-- Squat (Barbell)
UPDATE v2_exercises SET
  description = 'Bar on upper back, feet shoulder-width. Descend until thighs parallel to floor, knees track over toes. Drive through heels to stand.',
  secondary_muscles = ARRAY['glutes', 'lower_back', 'core'],
  equipment_needed = ARRAY['barbell', 'squat_rack'],
  movement_pattern = 'squat',
  tempo_category = 'controlled'
WHERE name = 'Squat (Barbell)';

-- Front Squat
UPDATE v2_exercises SET
  description = 'Bar across front deltoids, elbows high. Squat down keeping torso upright. More quad dominant than back squat.',
  secondary_muscles = ARRAY['glutes', 'upper_back', 'core', 'lower_back'],
  equipment_needed = ARRAY['barbell', 'squat_rack'],
  movement_pattern = 'squat',
  tempo_category = 'controlled'
WHERE name = 'Front Squat';

-- Leg Press
UPDATE v2_exercises SET
  description = 'Seated in leg press machine. Lower weight until knees at 90°, then press up explosively. Keep lower back against pad.',
  secondary_muscles = ARRAY['glutes', 'calves'],
  equipment_needed = ARRAY['leg_press_machine'],
  movement_pattern = 'squat',
  tempo_category = 'explosive'
WHERE name = 'Leg Press';

-- Bulgarian Split Squat
UPDATE v2_exercises SET
  description = 'Rear foot elevated on bench. Lower front leg until thigh parallel, drive through front heel to stand. Unilateral movement.',
  secondary_muscles = ARRAY['glutes', 'calves'],
  equipment_needed = ARRAY['bench', 'dumbbells'],
  movement_pattern = 'lunge',
  tempo_category = 'controlled'
WHERE name = 'Bulgarian Split Squat';

-- Walking Lunge
UPDATE v2_exercises SET
  description = 'Step forward into lunge position, lower until both knees at 90°. Push through front heel, step forward with back leg.',
  secondary_muscles = ARRAY['hamstrings', 'calves'],
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'lunge',
  tempo_category = 'controlled'
WHERE name = 'Walking Lunge';

-- Pistol Squat
UPDATE v2_exercises SET
  description = 'Single leg squat. Lower on one leg while extending other leg forward. Descend until thigh parallel, then stand explosively.',
  secondary_muscles = ARRAY['glutes', 'calves', 'abs', 'hamstrings'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'squat',
  tempo_category = 'controlled'
WHERE name = 'Pistol Squat';

-- Cossack Squat
UPDATE v2_exercises SET
  description = 'Wide stance, shift weight to one side while keeping other leg straight. Lower into deep squat, return to center, alternate sides.',
  secondary_muscles = ARRAY['quads', 'glutes', 'hamstrings'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'squat',
  tempo_category = 'controlled'
WHERE name = 'Cossack Squat';

-- Leg Extension
UPDATE v2_exercises SET
  description = 'Seated in leg extension machine. Extend legs against resistance until knees fully extended. Lower with control.',
  secondary_muscles = ARRAY['calves'],
  equipment_needed = ARRAY['leg_extension_machine'],
  movement_pattern = 'squat',
  tempo_category = 'controlled'
WHERE name = 'Leg Extension';

-- ============================================================================
-- LOWER BODY: HINGE PATTERN
-- ============================================================================

-- Deadlift (Conventional)
UPDATE v2_exercises SET
  description = 'Stand with feet hip-width, bar over mid-foot. Hinge at hips, grip bar, drive through heels to stand. Keep bar close to body.',
  secondary_muscles = ARRAY['hamstrings', 'glutes', 'traps', 'forearms'],
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'hinge',
  tempo_category = 'explosive'
WHERE name = 'Deadlift (Conventional)';

-- Romanian Deadlift (RDL)
UPDATE v2_exercises SET
  description = 'Stand holding bar. Hinge at hips, lower bar along legs until hamstring stretch. Drive hips forward to return to standing.',
  secondary_muscles = ARRAY['glutes', 'lower_back', 'forearms'],
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'hinge',
  tempo_category = 'controlled'
WHERE name = 'Romanian Deadlift (RDL)';

-- Hip Thrust
UPDATE v2_exercises SET
  description = 'Upper back against bench, bar across hips. Drive hips up until body forms straight line. Squeeze glutes at top, lower with control.',
  secondary_muscles = ARRAY['hamstrings', 'quads'],
  equipment_needed = ARRAY['barbell', 'bench'],
  movement_pattern = 'hinge',
  tempo_category = 'controlled'
WHERE name = 'Hip Thrust';

-- Leg Curl (Seated/Lying)
UPDATE v2_exercises SET
  description = 'Lying or seated in leg curl machine. Curl heels toward glutes against resistance. Lower with control to full extension.',
  secondary_muscles = ARRAY['calves'],
  equipment_needed = ARRAY['leg_curl_machine'],
  movement_pattern = 'hinge',
  tempo_category = 'controlled'
WHERE name = 'Leg Curl (Seated/Lying)';

-- Nordic Curl
UPDATE v2_exercises SET
  description = 'Kneel with feet secured. Lower body forward with control, resisting with hamstrings. Push back up to starting position.',
  secondary_muscles = ARRAY['glutes', 'calves'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'hinge',
  tempo_category = 'controlled'
WHERE name = 'Nordic Curl';

-- Reverse Nordic Curl
UPDATE v2_exercises SET
  description = 'Kneel upright. Lean back with control, resisting with quads and hip flexors. Return to upright position.',
  secondary_muscles = ARRAY['hip_flexors', 'abs'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'hinge',
  tempo_category = 'controlled'
WHERE name = 'Reverse Nordic Curl';

-- Calf Raise
UPDATE v2_exercises SET
  description = 'Stand on balls of feet, raise heels as high as possible. Lower slowly to full stretch. Can use bodyweight or added weight.',
  secondary_muscles = ARRAY['soleus'],
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'squat',
  tempo_category = 'controlled'
WHERE name = 'Calf Raise';

-- ============================================================================
-- ARMS & ISOLATION
-- ============================================================================

-- Bicep Curl (Barbell/Dumbbell)
UPDATE v2_exercises SET
  description = 'Stand holding weights at sides. Curl weights to shoulders, squeeze biceps at top. Lower with control, avoid swinging.',
  secondary_muscles = ARRAY['forearms'],
  equipment_needed = ARRAY['barbell', 'dumbbells'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Bicep Curl (Barbell/Dumbbell)';

-- Hammer Curl
UPDATE v2_exercises SET
  description = 'Hold dumbbells with neutral grip (palms facing each other). Curl to shoulders, targets brachialis and forearms more than standard curl.',
  secondary_muscles = ARRAY['forearms'],
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Hammer Curl';

-- Tricep Pushdown
UPDATE v2_exercises SET
  description = 'Stand at cable machine, rope attachment. Push down until arms fully extended, squeeze triceps. Return with control.',
  secondary_muscles = ARRAY[]::text[],
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Tricep Pushdown';

-- Skullcrusher
UPDATE v2_exercises SET
  description = 'Lie on bench, hold weight overhead. Lower weight toward forehead by bending elbows, then extend explosively.',
  secondary_muscles = ARRAY['lats'],
  equipment_needed = ARRAY['barbell', 'dumbbells', 'bench'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Skullcrusher';

-- Overhead Tricep Extension
UPDATE v2_exercises SET
  description = 'Stand or sit holding weight overhead. Lower weight behind head by bending elbows, then extend back up.',
  secondary_muscles = ARRAY[]::text[],
  equipment_needed = ARRAY['dumbbell', 'cable_machine'],
  movement_pattern = 'push',
  tempo_category = 'controlled'
WHERE name = 'Overhead Tricep Extension';

-- ============================================================================
-- CORE & STABILITY (ISOMETRIC/TIMED)
-- ============================================================================

-- Plank
UPDATE v2_exercises SET
  description = 'Hold body in straight line from head to heels, supported on forearms and toes. Keep core tight, avoid sagging hips.',
  secondary_muscles = ARRAY['shoulders', 'glutes'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric'
WHERE name = 'Plank';

-- Side Plank
UPDATE v2_exercises SET
  description = 'Lie on side, support body on one forearm and side of foot. Hold straight line, engage obliques and glute medius.',
  secondary_muscles = ARRAY['glute_medius', 'anterior_deltoids'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric'
WHERE name = 'Side Plank';

-- L-Sit
UPDATE v2_exercises SET
  description = 'Support body on parallel bars or floor. Lift legs to form L shape, hold position. Requires strong core and hip flexors.',
  secondary_muscles = ARRAY['hip_flexors', 'triceps', 'traps', 'quads'],
  equipment_needed = ARRAY['parallel_bars'],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric'
WHERE name = 'L-Sit';

-- Superman Hold
UPDATE v2_exercises SET
  description = 'Lie face down, lift arms and legs simultaneously. Hold position, squeeze glutes and lower back. Lower with control.',
  secondary_muscles = ARRAY['glutes', 'hamstrings', 'posterior_deltoids'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'hinge',
  tempo_category = 'isometric'
WHERE name = 'Superman Hold';

-- Farmer's Walk
UPDATE v2_exercises SET
  description = 'Carry heavy weights at sides, walk forward maintaining upright posture. Targets grip, core, and traps.',
  secondary_muscles = ARRAY['traps', 'core', 'glutes'],
  equipment_needed = ARRAY['dumbbells', 'kettlebells'],
  movement_pattern = 'carry',
  tempo_category = 'controlled'
WHERE name = 'Farmer''s Walk';

-- Hanging Leg Raise
UPDATE v2_exercises SET
  description = 'Hang from bar, raise straight legs to 90° or higher. Lower with control. Targets lower abs and hip flexors.',
  secondary_muscles = ARRAY['hip_flexors', 'forearms'],
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Hanging Leg Raise';

-- Hanging Knee Raise
UPDATE v2_exercises SET
  description = 'Hang from bar, bring knees to chest. Lower with control. Easier variation of hanging leg raise.',
  secondary_muscles = ARRAY['hip_flexors', 'forearms'],
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled'
WHERE name = 'Hanging Knee Raise';

-- V-Sit
UPDATE v2_exercises SET
  description = 'Sit on floor, lean back and lift legs to form V shape. Hold position, balance on glutes. Advanced core exercise.',
  secondary_muscles = ARRAY['hip_flexors', 'quads'],
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric'
WHERE name = 'V-Sit';

-- Add comments for documentation
COMMENT ON COLUMN v2_exercises.description IS 'Exercise description and form cues for users';
COMMENT ON COLUMN v2_exercises.secondary_muscles IS 'Array of secondary muscles involved in the movement';
COMMENT ON COLUMN v2_exercises.equipment_needed IS 'Array of required equipment (empty array = bodyweight)';
COMMENT ON COLUMN v2_exercises.movement_pattern IS 'Primary movement pattern: push, pull, squat, hinge, lunge, carry, rotation, anti-rotation';
COMMENT ON COLUMN v2_exercises.tempo_category IS 'Tempo classification: explosive (maximal velocity), controlled (moderate tempo), isometric (static hold)';
