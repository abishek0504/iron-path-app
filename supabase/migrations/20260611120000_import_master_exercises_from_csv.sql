-- Auto-generated from supabase/seed/master_exercises_and_stretches_expanded_advanced.csv
-- 388 exercises: 45 updates, 343 inserts

UPDATE v2_exercises SET
  description = 'Start with dumbbells at shoulder level, palms facing you. Rotate wrists outward while pressing overhead. Reverse motion on descent.',
  density_score = 7,
  primary_muscles = ARRAY['anterior_deltoids'],
  secondary_muscles = ARRAY['lateral_deltoids', 'triceps', 'upper_chest'],
  implicit_hits = '{"triceps":0.6,"upper_chest":0.3,"lateral_deltoids":0.7}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 25,
  avg_time_per_set_sec = 55,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Arnold Press';

UPDATE v2_exercises SET
  description = 'Lie on bench with feet flat. Lower bar to chest with control, press up explosively. Keep core tight and shoulder blades retracted.',
  density_score = 9,
  primary_muscles = ARRAY['chest'],
  secondary_muscles = ARRAY['anterior_deltoids', 'serratus_anterior'],
  implicit_hits = '{"triceps":0.6,"anterior_deltoids":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 30,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['barbell', 'bench'],
  movement_pattern = 'push',
  tempo_category = 'explosive',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Bench Press (Barbell)';

UPDATE v2_exercises SET
  description = 'Hinge at hips, back straight. Pull bar to lower chest/upper abdomen, squeeze shoulder blades. Lower with control.',
  density_score = 9,
  primary_muscles = ARRAY['lats'],
  secondary_muscles = ARRAY['upper_back', 'lower_back', 'biceps', 'hamstrings'],
  implicit_hits = '{"biceps":0.5,"hamstrings":0.3,"lower_back":0.6,"upper_back":0.8}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 30,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Bent Over Row (Barbell)';

UPDATE v2_exercises SET
  description = 'Stand holding weights at sides. Curl weights to shoulders, squeeze biceps at top. Lower with control, avoid swinging.',
  density_score = 5,
  primary_muscles = ARRAY['biceps'],
  secondary_muscles = ARRAY['forearms'],
  implicit_hits = '{"forearms":0.3}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 35,
  is_timed = false,
  equipment_needed = ARRAY['barbell', 'dumbbells'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Bicep Curl (Barbell/Dumbbell)';

UPDATE v2_exercises SET
  description = 'Rear foot elevated on bench. Lower front leg until thigh parallel, drive through front heel to stand. Unilateral movement.',
  density_score = 8,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['glutes', 'calves'],
  implicit_hits = '{"calves":0.3,"glutes":0.9}'::jsonb,
  is_unilateral = true,
  setup_buffer_sec = 20,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['bench', 'dumbbells'],
  movement_pattern = 'lunge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Bulgarian Split Squat';

UPDATE v2_exercises SET
  description = 'Stand on balls of feet, raise heels as high as possible. Lower slowly to full stretch. Can use bodyweight or added weight.',
  density_score = 5,
  primary_muscles = ARRAY['calves'],
  secondary_muscles = ARRAY['soleus'],
  implicit_hits = '{"soleus":0.8}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'squat',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Calf Raise';

UPDATE v2_exercises SET
  description = 'Underhand grip, hands shoulder-width. Pull up emphasizing biceps and lats. Lower with control to full arm extension.',
  density_score = 8,
  primary_muscles = ARRAY['lats'],
  secondary_muscles = ARRAY['biceps', 'traps', 'forearms'],
  implicit_hits = '{"traps":0.5,"biceps":0.8,"forearms":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Chin Up (Supinated)';

UPDATE v2_exercises SET
  description = 'Wide stance, shift weight to one side while keeping other leg straight. Lower into deep squat, return to center, alternate sides.',
  density_score = 7,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['quads', 'glutes', 'hamstrings'],
  implicit_hits = '{"quads":0.8,"glutes":0.6,"hamstrings":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 50,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'squat',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Cossack Squat';

UPDATE v2_exercises SET
  description = 'Stand with feet hip-width, bar over mid-foot. Hinge at hips, grip bar, drive through heels to stand. Keep bar close to body.',
  density_score = 10,
  primary_muscles = ARRAY['lower_back'],
  secondary_muscles = ARRAY['hamstrings', 'glutes', 'traps', 'forearms'],
  implicit_hits = '{"traps":0.5,"glutes":0.8,"forearms":0.5,"hamstrings":0.9}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 60,
  avg_time_per_set_sec = 120,
  is_timed = false,
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'hinge',
  tempo_category = 'explosive',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Deadlift (Conventional)';

UPDATE v2_exercises SET
  description = 'Form diamond shape with hands under chest. Lower until chest touches hands, focus on tricep engagement. Push up explosively.',
  density_score = 7,
  primary_muscles = ARRAY['triceps'],
  secondary_muscles = ARRAY['chest', 'anterior_deltoids', 'abs'],
  implicit_hits = '{"abs":0.4,"chest":0.6,"anterior_deltoids":0.6}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 30,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Diamond Push Up';

UPDATE v2_exercises SET
  description = 'Support body on parallel bars. Lower by bending elbows until shoulders below elbows, then press up. Lean forward to target chest more.',
  density_score = 8,
  primary_muscles = ARRAY['triceps'],
  secondary_muscles = ARRAY['lower_chest', 'anterior_deltoids'],
  implicit_hits = '{"lower_chest":0.8,"anterior_deltoids":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['parallel_bars'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Dip';

UPDATE v2_exercises SET
  description = 'Lie on bench with dumbbells extended above chest. Lower weights in wide arc until chest stretch, then squeeze chest to bring weights together.',
  density_score = 6,
  primary_muscles = ARRAY['chest'],
  secondary_muscles = ARRAY['anterior_deltoids'],
  implicit_hits = '{"biceps":0.1,"anterior_deltoids":0.3}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 20,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells', 'bench'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Dumbbell Fly';

UPDATE v2_exercises SET
  description = 'Stand facing cable machine at face height. Pull rope to face level, external rotate shoulders. Targets rear delts and rotator cuff.',
  density_score = 7,
  primary_muscles = ARRAY['posterior_deltoids'],
  secondary_muscles = ARRAY['rotator_cuff', 'traps', 'upper_back'],
  implicit_hits = '{"traps":0.7,"upper_back":0.5,"rotator_cuff":0.9}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Face Pull';

UPDATE v2_exercises SET
  description = 'Carry heavy weights at sides, walk forward maintaining upright posture. Targets grip, core, and traps.',
  density_score = 8,
  primary_muscles = ARRAY['forearms'],
  secondary_muscles = ARRAY['traps', 'abs', 'glutes'],
  implicit_hits = '{"abs":0.8,"traps":0.9,"glutes":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 30,
  is_timed = true,
  equipment_needed = ARRAY['dumbbells', 'kettlebells'],
  movement_pattern = 'carry',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Farmer''s Walk';

UPDATE v2_exercises SET
  description = 'Bar across front deltoids, elbows high. Squat down keeping torso upright. More quad dominant than back squat.',
  density_score = 9,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['glutes', 'upper_back', 'abs', 'lower_back'],
  implicit_hits = '{"abs":0.7,"glutes":0.6,"lower_back":0.4,"upper_back":0.6}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 45,
  avg_time_per_set_sec = 90,
  is_timed = false,
  equipment_needed = ARRAY['barbell', 'squat_rack'],
  movement_pattern = 'squat',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Front Squat';

UPDATE v2_exercises SET
  description = 'Hold dumbbells with neutral grip (palms facing each other). Curl to shoulders, targets brachialis and forearms more than standard curl.',
  density_score = 5,
  primary_muscles = ARRAY['biceps'],
  secondary_muscles = ARRAY['forearms'],
  implicit_hits = '{"forearms":0.8}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 35,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Hammer Curl';

UPDATE v2_exercises SET
  description = 'Hang from bar, bring knees to chest. Lower with control. Easier variation of hanging leg raise.',
  density_score = 6,
  primary_muscles = ARRAY['abs'],
  secondary_muscles = ARRAY['hip_flexors', 'forearms'],
  implicit_hits = '{"forearms":0.5,"hip_flexors":0.7}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 35,
  is_timed = false,
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Hanging Knee Raise';

UPDATE v2_exercises SET
  description = 'Hang from bar, raise straight legs to 90 degrees or higher. Lower with control. Targets lower abs and hip flexors.',
  density_score = 7,
  primary_muscles = ARRAY['abs'],
  secondary_muscles = ARRAY['hip_flexors', 'forearms'],
  implicit_hits = '{"forearms":0.4,"hip_flexors":0.8}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Hanging Leg Raise';

UPDATE v2_exercises SET
  description = 'Upper back against bench, bar across hips. Drive hips up until body forms straight line. Squeeze glutes at top, lower with control.',
  density_score = 8,
  primary_muscles = ARRAY['glutes'],
  secondary_muscles = ARRAY['hamstrings', 'quads'],
  implicit_hits = '{"quads":0.3,"hamstrings":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 35,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['barbell', 'bench'],
  movement_pattern = 'hinge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Hip Thrust';

UPDATE v2_exercises SET
  description = 'Set bench to 30-45° incline. Press dumbbells from chest level to full extension above shoulders. Control the eccentric phase.',
  density_score = 8,
  primary_muscles = ARRAY['upper_chest'],
  secondary_muscles = ARRAY['upper_chest', 'anterior_deltoids', 'serratus_anterior'],
  implicit_hits = '{"chest":0.7,"triceps":0.5,"anterior_deltoids":0.7}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 30,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells', 'incline_bench'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Incline Dumbbell Press';

UPDATE v2_exercises SET
  description = 'Support body on parallel bars or floor. Lift legs to form L shape, hold position. Requires strong core and hip flexors.',
  density_score = 8,
  primary_muscles = ARRAY['abs'],
  secondary_muscles = ARRAY['hip_flexors', 'triceps', 'traps', 'quads'],
  implicit_hits = '{"quads":0.4,"traps":0.5,"triceps":0.6,"hip_flexors":0.9}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 30,
  is_timed = true,
  equipment_needed = ARRAY['parallel_bars'],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric',
  is_stretch = false,
  updated_at = now()
WHERE name = 'L-Sit';

UPDATE v2_exercises SET
  description = 'Seated at lat pulldown machine. Pull bar to upper chest, squeeze lats at bottom. Control the eccentric phase fully.',
  density_score = 7,
  primary_muscles = ARRAY['lats'],
  secondary_muscles = ARRAY['biceps', 'posterior_deltoids', 'traps'],
  implicit_hits = '{"traps":0.4,"biceps":0.5,"posterior_deltoids":0.3}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 20,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Lat Pulldown';

UPDATE v2_exercises SET
  description = 'Stand holding dumbbells at sides. Raise arms out to shoulder height with slight bend in elbows. Lower slowly to resist gravity.',
  density_score = 6,
  primary_muscles = ARRAY['lateral_deltoids'],
  secondary_muscles = ARRAY['traps'],
  implicit_hits = '{"traps":0.3,"anterior_deltoids":0.2}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Lateral Raise';

UPDATE v2_exercises SET
  description = 'Lying or seated in leg curl machine. Curl heels toward glutes against resistance. Lower with control to full extension.',
  density_score = 5,
  primary_muscles = ARRAY['hamstrings'],
  secondary_muscles = ARRAY['calves'],
  implicit_hits = '{"calves":0.2}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['leg_curl_machine'],
  movement_pattern = 'hinge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Leg Curl (Seated/Lying)';

UPDATE v2_exercises SET
  description = 'Seated in leg extension machine. Extend legs against resistance until knees fully extended. Lower with control.',
  density_score = 5,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['calves'],
  implicit_hits = '{"calves":0.3}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['leg_extension_machine'],
  movement_pattern = 'squat',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Leg Extension';

UPDATE v2_exercises SET
  description = 'Seated in leg press machine. Lower weight until knees at 90 degrees, then press up explosively. Keep lower back against pad.',
  density_score = 7,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['glutes', 'calves'],
  implicit_hits = '{"calves":0.2,"glutes":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 30,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['leg_press_machine'],
  movement_pattern = 'squat',
  tempo_category = 'explosive',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Leg Press';

UPDATE v2_exercises SET
  description = 'Kneel with feet secured. Lower body forward with control, resisting with hamstrings. Push back up to starting position.',
  density_score = 8,
  primary_muscles = ARRAY['hamstrings'],
  secondary_muscles = ARRAY['glutes', 'calves'],
  implicit_hits = '{"calves":0.4,"glutes":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 50,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'hinge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Nordic Curl';

UPDATE v2_exercises SET
  description = 'Stand with feet shoulder-width. Press bar from shoulder level to overhead. Keep core tight, slight lean back at top. Lower with control.',
  density_score = 8,
  primary_muscles = ARRAY['anterior_deltoids'],
  secondary_muscles = ARRAY['upper_chest', 'abs', 'triceps'],
  implicit_hits = '{"abs":0.3,"triceps":0.7,"upper_chest":0.3}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 30,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'push',
  tempo_category = 'explosive',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Overhead Press';

UPDATE v2_exercises SET
  description = 'Stand or sit holding weight overhead. Lower weight behind head by bending elbows, then extend back up.',
  density_score = 5,
  primary_muscles = ARRAY['triceps'],
  secondary_muscles = ARRAY[]::text[],
  implicit_hits = '{}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY['dumbbell', 'cable_machine'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Overhead Tricep Extension';

UPDATE v2_exercises SET
  description = 'Start in downward dog position. Lower head toward ground by bending elbows, then push back up. Targets shoulders and triceps.',
  density_score = 7,
  primary_muscles = ARRAY['anterior_deltoids'],
  secondary_muscles = ARRAY['upper_chest', 'traps', 'serratus_anterior'],
  implicit_hits = '{"traps":0.4,"triceps":0.7,"upper_chest":0.4,"serratus_anterior":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 40,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Pike Push Up';

UPDATE v2_exercises SET
  description = 'Single leg squat. Lower on one leg while extending other leg forward. Descend until thigh parallel, then stand explosively.',
  density_score = 8,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['glutes', 'calves', 'abs', 'hamstrings'],
  implicit_hits = '{"abs":0.5,"calves":0.5,"glutes":0.8,"hamstrings":0.3}'::jsonb,
  is_unilateral = true,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 50,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'squat',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Pistol Squat';

UPDATE v2_exercises SET
  description = 'Standard pull-up with neutral or overhand grip. Pull body up until chin clears bar, focus on lat engagement. Lower with control.',
  density_score = 9,
  primary_muscles = ARRAY['lats'],
  secondary_muscles = ARRAY['biceps', 'traps', 'posterior_deltoids', 'forearms'],
  implicit_hits = '{"traps":0.4,"biceps":0.6,"upper_back":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Pull Up';

UPDATE v2_exercises SET
  description = 'Hang from bar with overhand grip, hands wider than shoulders. Pull body up until chin clears bar. Lower with control.',
  density_score = 9,
  primary_muscles = ARRAY['lats'],
  secondary_muscles = ARRAY['traps', 'posterior_deltoids', 'forearms'],
  implicit_hits = '{"traps":0.6,"biceps":0.5,"forearms":0.4,"posterior_deltoids":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Pull Up (Overhand)';

UPDATE v2_exercises SET
  description = 'Wide overhand grip, hands 1.5x shoulder width. Pull up focusing on lats. Lower slowly to maximize time under tension.',
  density_score = 9,
  primary_muscles = ARRAY['lats'],
  secondary_muscles = ARRAY['traps', 'forearms'],
  implicit_hits = '{"traps":0.7,"biceps":0.4,"forearms":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 50,
  is_timed = false,
  equipment_needed = ARRAY['pull_up_bar'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Pull Up (Wide Grip)';

UPDATE v2_exercises SET
  description = 'Start in plank position. Lower body until chest nearly touches ground, then push up explosively. Keep body straight from head to heels.',
  density_score = 7,
  primary_muscles = ARRAY['chest'],
  secondary_muscles = ARRAY['anterior_deltoids', 'abs', 'serratus_anterior'],
  implicit_hits = '{"abs":0.5,"triceps":0.6,"anterior_deltoids":0.7,"serratus_anterior":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 30,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Push Up';

UPDATE v2_exercises SET
  description = 'Kneel upright. Lean back with control, resisting with quads and hip flexors. Return to upright position.',
  density_score = 7,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['hip_flexors', 'abs'],
  implicit_hits = '{"abs":0.3,"hip_flexors":0.6}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 10,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'hinge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Reverse Nordic Curl';

UPDATE v2_exercises SET
  description = 'Stand holding bar. Hinge at hips, lower bar along legs until hamstring stretch. Drive hips forward to return to standing.',
  density_score = 9,
  primary_muscles = ARRAY['hamstrings'],
  secondary_muscles = ARRAY['glutes', 'lower_back', 'forearms'],
  implicit_hits = '{"glutes":0.8,"forearms":0.5,"lower_back":0.6}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 40,
  avg_time_per_set_sec = 90,
  is_timed = false,
  equipment_needed = ARRAY['barbell'],
  movement_pattern = 'hinge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Romanian Deadlift (RDL)';

UPDATE v2_exercises SET
  description = 'Seated with feet braced. Pull handle to lower chest/upper abdomen, squeeze shoulder blades together. Return with control.',
  density_score = 8,
  primary_muscles = ARRAY['upper_back'],
  secondary_muscles = ARRAY['lats', 'traps', 'biceps', 'posterior_deltoids'],
  implicit_hits = '{"lats":0.7,"traps":0.7,"biceps":0.5,"posterior_deltoids":0.5}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 20,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'pull',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Seated Cable Row';

UPDATE v2_exercises SET
  description = 'Lie on side, support body on one forearm and side of foot. Hold straight line, engage obliques and glute medius.',
  density_score = 6,
  primary_muscles = ARRAY['obliques'],
  secondary_muscles = ARRAY['glute_medius', 'anterior_deltoids'],
  implicit_hits = '{"glute_medius":0.6,"anterior_deltoids":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 30,
  is_timed = true,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Side Plank';

UPDATE v2_exercises SET
  description = 'Lie on bench, hold weight overhead. Lower weight toward forehead by bending elbows, then extend explosively.',
  density_score = 6,
  primary_muscles = ARRAY['triceps'],
  secondary_muscles = ARRAY['lats'],
  implicit_hits = '{"lats":0.2}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 20,
  avg_time_per_set_sec = 45,
  is_timed = false,
  equipment_needed = ARRAY['barbell', 'dumbbells', 'bench'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Skullcrusher';

UPDATE v2_exercises SET
  description = 'Bar on upper back, feet shoulder-width. Descend until thighs parallel to floor, knees track over toes. Drive through heels to stand.',
  density_score = 10,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['glutes', 'lower_back', 'abs'],
  implicit_hits = '{"abs":0.3,"glutes":0.7,"lower_back":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 45,
  avg_time_per_set_sec = 90,
  is_timed = false,
  equipment_needed = ARRAY['barbell', 'squat_rack'],
  movement_pattern = 'squat',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Squat (Barbell)';

UPDATE v2_exercises SET
  description = 'Lie face down, lift arms and legs simultaneously. Hold position, squeeze glutes and lower back. Lower with control.',
  density_score = 6,
  primary_muscles = ARRAY['lower_back'],
  secondary_muscles = ARRAY['glutes', 'hamstrings', 'posterior_deltoids'],
  implicit_hits = '{"glutes":0.7,"hamstrings":0.5,"posterior_deltoids":0.4}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 30,
  is_timed = true,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'hinge',
  tempo_category = 'isometric',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Superman Hold';

UPDATE v2_exercises SET
  description = 'Stand at cable machine, rope attachment. Push down until arms fully extended, squeeze triceps. Return with control.',
  density_score = 5,
  primary_muscles = ARRAY['triceps'],
  secondary_muscles = ARRAY[]::text[],
  implicit_hits = '{}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 35,
  is_timed = false,
  equipment_needed = ARRAY['cable_machine'],
  movement_pattern = 'push',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Tricep Pushdown';

UPDATE v2_exercises SET
  description = 'Sit on floor, lean back and lift legs to form V shape. Hold position, balance on glutes. Advanced core exercise.',
  density_score = 7,
  primary_muscles = ARRAY['abs'],
  secondary_muscles = ARRAY['hip_flexors', 'quads'],
  implicit_hits = '{"quads":0.3,"hip_flexors":0.9}'::jsonb,
  is_unilateral = false,
  setup_buffer_sec = 5,
  avg_time_per_set_sec = 30,
  is_timed = true,
  equipment_needed = ARRAY[]::text[],
  movement_pattern = 'anti-rotation',
  tempo_category = 'isometric',
  is_stretch = false,
  updated_at = now()
WHERE name = 'V-Sit';

UPDATE v2_exercises SET
  description = 'Step forward into lunge position, lower until both knees at 90 degrees. Push through front heel, step forward with back leg.',
  density_score = 7,
  primary_muscles = ARRAY['quads'],
  secondary_muscles = ARRAY['hamstrings', 'calves'],
  implicit_hits = '{"calves":0.4,"hamstrings":0.5}'::jsonb,
  is_unilateral = true,
  setup_buffer_sec = 15,
  avg_time_per_set_sec = 60,
  is_timed = false,
  equipment_needed = ARRAY['dumbbells'],
  movement_pattern = 'lunge',
  tempo_category = 'controlled',
  is_stretch = false,
  updated_at = now()
WHERE name = 'Walking Lunge';

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7675f5d4-8558-4280-bb25-ca1c261e5761',
  '45-Degree Back Extension',
  'Set hips on 45-degree bench. Lower torso, then raise by extending hips and squeezing glutes.',
  6,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back'],
  '{"hamstrings":0.6,"lower_back":0.5}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['back_extension_bench'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ea16b25b-f730-437b-bf6b-913f35560713',
  '90/90 Hip Switch',
  'Sit in 90/90 hip position and rotate knees side to side with control.',
  3,
  ARRAY['glutes'],
  ARRAY['hip_flexors', 'adductors', 'glute_medius'],
  '{"hip_flexors":0.4,"adductors":0.3,"glute_medius":0.4}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3a891dac-e971-4d50-a58d-fabf286a08fb',
  'Ab Wheel Rollout',
  'Kneel with ab wheel under shoulders. Roll forward while bracing, then pull back to start.',
  7,
  ARRAY['abs'],
  ARRAY['lats', 'triceps', 'hip_flexors'],
  '{"lats":0.5,"triceps":0.3,"hip_flexors":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY['ab_wheel'],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '09763566-14a4-4180-93a4-2af78ef43a02',
  'Adductor Rock Back',
  'Start on hands and knees with one leg extended to side. Rock hips back and forward slowly.',
  3,
  ARRAY['adductors'],
  ARRAY['hamstrings', 'glutes'],
  '{"hamstrings":0.3,"glutes":0.2}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4ca0ec80-a83b-4996-8b38-9552ce792c5b',
  'Ankle Dorsiflexion Mobilization',
  'Kneel with one foot forward and drive knee over toes while heel stays down.',
  3,
  ARRAY['calves'],
  ARRAY['soleus', 'tibialis_anterior'],
  '{"soleus":0.5,"tibialis_anterior":0.2}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1fb98803-6406-44f7-85e1-ebb37be81dac',
  'Archer Push Up',
  'Use a wide hand position. Shift weight toward one arm as the opposite arm stays straighter, then alternate.',
  8,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.6,"anterior_deltoids":0.6,"abs":0.4}'::jsonb,
  false,
  5,
  45,
  false,
  ARRAY[]::text[],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7eee505e-2020-4139-8270-c3e8e16f1f00',
  'Arm Circles',
  'Extend arms and make controlled circles forward and backward to warm shoulders.',
  3,
  ARRAY['anterior_deltoids'],
  ARRAY['lateral_deltoids', 'posterior_deltoids', 'rotator_cuff'],
  '{"lateral_deltoids":0.5,"posterior_deltoids":0.4,"rotator_cuff":0.3}'::jsonb,
  false,
  5,
  40,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '09df4f0f-da8c-44bb-99c3-36e77144b93a',
  'Assisted Pull Up',
  'Use an assisted pull-up machine or band. Pull chest toward bar, then lower with control.',
  7,
  ARRAY['lats'],
  ARRAY['biceps', 'upper_back', 'forearms'],
  '{"biceps":0.6,"upper_back":0.5,"forearms":0.4}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['assisted_pull_up_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '44ef7974-7b80-4d7d-8107-15d9508e5ff6',
  'Back Extension',
  'Anchor hips in back extension bench. Lower torso, then extend hips to raise body in line.',
  6,
  ARRAY['lower_back'],
  ARRAY['glutes', 'hamstrings'],
  '{"glutes":0.6,"hamstrings":0.6}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['back_extension_bench'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '821e748b-54ee-4b47-94e4-73ba0a0d8165',
  'Back Squat (High Bar)',
  'Place bar high on traps. Squat down with upright torso, then drive through feet to stand.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'abs', 'lower_back'],
  '{"glutes":0.7,"hamstrings":0.4,"abs":0.5,"lower_back":0.4}'::jsonb,
  false,
  45,
  90,
  false,
  ARRAY['barbell', 'squat_rack'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'af19bf0c-cfc7-4324-a831-b8a4e43fc5cf',
  'Back Squat (Low Bar)',
  'Place bar lower across rear delts. Sit hips back and down, then drive up through midfoot.',
  9,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'lower_back', 'abs'],
  '{"quads":0.7,"hamstrings":0.5,"lower_back":0.5,"abs":0.4}'::jsonb,
  false,
  45,
  90,
  false,
  ARRAY['barbell', 'squat_rack'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4b93e0b1-8170-4307-8b4b-7893ba28a8c1',
  'Band External Rotation',
  'Anchor a band at elbow height. Rotate forearm outward while keeping elbow at the side.',
  3,
  ARRAY['rotator_cuff'],
  ARRAY['posterior_deltoids'],
  '{"posterior_deltoids":0.3}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY['resistance_band'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9e49979c-fdef-4d85-9cc9-45cc11227a4f',
  'Band Pull-Apart',
  'Hold band at shoulder height. Pull band apart until hands move out to sides, then return slowly.',
  4,
  ARRAY['posterior_deltoids'],
  ARRAY['upper_back', 'traps', 'rotator_cuff'],
  '{"upper_back":0.6,"traps":0.4,"rotator_cuff":0.4}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY['resistance_band'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b5869e68-a3ec-4ed8-a8cf-1a02deb95d4f',
  'Band Shoulder Dislocates',
  'Hold a band wide and move arms from front to overhead and behind, then return.',
  3,
  ARRAY['chest'],
  ARRAY['anterior_deltoids', 'lats', 'rotator_cuff'],
  '{"anterior_deltoids":0.5,"lats":0.3,"rotator_cuff":0.3}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY['resistance_band'],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '31f864c5-ff74-4d26-b0cb-65fb7fbb254e',
  'Banded Clamshell',
  'Lie on side with knees bent and band above knees. Open top knee, pause, then lower.',
  3,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'obliques'],
  '{"glutes":0.5,"obliques":0.2}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY['resistance_band'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'aad45756-7dc9-4ce3-8860-196a54a2c065',
  'Banded Lateral Walk',
  'Place resistance band around legs. Step sideways with controlled tension, keeping knees slightly bent.',
  4,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'quads'],
  '{"glutes":0.5,"quads":0.3}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['resistance_band'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e26ec132-c6d7-487f-9c82-0842a398d80b',
  'Barbell Glute Bridge',
  'Lie on floor with bar over hips. Drive hips upward, squeeze glutes, then lower to floor.',
  7,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'abs'],
  '{"hamstrings":0.5,"abs":0.3}'::jsonb,
  false,
  30,
  45,
  false,
  ARRAY['barbell'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7b196c41-29e9-403e-a08e-d2e4cff0d2ab',
  'Barbell Shrug',
  'Hold bar in front of thighs. Elevate shoulders straight up, pause, then lower.',
  5,
  ARRAY['traps'],
  ARRAY['forearms', 'upper_back'],
  '{"forearms":0.4,"upper_back":0.3}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['barbell'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '74582624-2f78-488d-ae01-903046514e96',
  'Battle Ropes',
  'Hold rope ends and create waves, slams, or alternating pulses while bracing core.',
  8,
  ARRAY['anterior_deltoids'],
  ARRAY['abs', 'lats', 'forearms', 'traps'],
  '{"abs":0.6,"lats":0.4,"forearms":0.5,"traps":0.4}'::jsonb,
  false,
  15,
  30,
  false,
  ARRAY['battle_rope'],
  'push',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '205347a7-c15e-45a0-ac71-57424edff92f',
  'Bear Crawl',
  'Move forward on hands and feet with knees close to floor. Keep hips low and core braced.',
  7,
  ARRAY['abs'],
  ARRAY['quads', 'anterior_deltoids', 'obliques'],
  '{"quads":0.5,"anterior_deltoids":0.5,"obliques":0.5}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e5b7469d-3e94-4dc6-95ad-bfd9bba05671',
  'Belt Squat',
  'Attach belt to loading point. Squat while torso stays upright, then stand through midfoot.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings'],
  '{"glutes":0.7,"hamstrings":0.3}'::jsonb,
  false,
  25,
  60,
  false,
  ARRAY['belt_squat_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8b98e172-124c-4e1b-aa2e-e59e89d2b2ab',
  'Bench Dip',
  'Place hands on a bench behind hips. Lower by bending elbows, then press back up.',
  6,
  ARRAY['triceps'],
  ARRAY['chest', 'anterior_deltoids'],
  '{"chest":0.4,"anterior_deltoids":0.5}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY['bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f4530507-73a2-4681-b7a9-3499d7963e3e',
  'Bench Press (Dumbbell)',
  'Lie on a flat bench holding dumbbells at chest level. Press up until arms are extended, then lower with control.',
  8,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids'],
  '{"triceps":0.6,"anterior_deltoids":0.6}'::jsonb,
  false,
  25,
  60,
  false,
  ARRAY['dumbbells', 'bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4426bbeb-80c6-4fd1-b0c2-0f8494c6b404',
  'Bench Press (Smith Machine)',
  'Lie under a Smith machine bar. Unrack, lower bar to mid-chest, then press upward while keeping shoulder blades set.',
  8,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids'],
  '{"triceps":0.6,"anterior_deltoids":0.5}'::jsonb,
  false,
  35,
  60,
  false,
  ARRAY['smith_machine', 'bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '5657b657-483d-4d30-a96a-69625a33c942',
  'Bicycle Crunch',
  'Lie on back and alternate bringing elbow toward opposite knee while extending other leg.',
  5,
  ARRAY['obliques'],
  ARRAY['abs', 'hip_flexors'],
  '{"abs":0.7,"hip_flexors":0.4}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY[]::text[],
  'rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8b88d652-ed75-4b90-a3e2-d34cd1cd84c5',
  'Bird Dog',
  'Start on all fours. Extend opposite arm and leg, pause, then return and alternate.',
  4,
  ARRAY['lower_back'],
  ARRAY['glutes', 'abs', 'posterior_deltoids'],
  '{"glutes":0.4,"abs":0.4,"posterior_deltoids":0.2}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'bbe19173-c69b-4585-ad8e-b34804edf938',
  'Box Jump',
  'Stand facing a box. Jump onto it with soft landing, step down, and repeat.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'calves', 'hamstrings'],
  '{"glutes":0.7,"calves":0.6,"hamstrings":0.4}'::jsonb,
  false,
  10,
  30,
  false,
  ARRAY['box'],
  'squat',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9db97bbc-dd29-42b4-9969-6ba11659a115',
  'Box Squat',
  'Squat back to a box or bench, lightly pause, then drive up to standing.',
  8,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'lower_back', 'abs'],
  '{"quads":0.6,"hamstrings":0.5,"lower_back":0.4,"abs":0.4}'::jsonb,
  false,
  45,
  75,
  false,
  ARRAY['barbell', 'squat_rack', 'box'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e2db871c-8a7f-4cab-b852-c0661cfedf9d',
  'Burpee',
  'Drop to floor, kick feet back, perform push-up if desired, jump feet in, and stand or jump.',
  9,
  ARRAY['quads'],
  ARRAY['chest', 'triceps', 'abs', 'glutes', 'calves'],
  '{"chest":0.5,"triceps":0.4,"abs":0.5,"glutes":0.5,"calves":0.4}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'squat',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '10d575b6-cb89-4e1e-8609-a1e7a0160c43',
  'Butterfly Stretch',
  'Sit with soles of feet together. Let knees fall outward and gently hinge forward.',
  2,
  ARRAY['adductors'],
  ARRAY['glutes', 'lower_back'],
  '{"glutes":0.2,"lower_back":0.2}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '378cf55c-b388-4e7d-8cb7-b6582eaead65',
  'Cable Crunch',
  'Kneel facing high cable with rope. Crunch ribs toward pelvis, then return with control.',
  5,
  ARRAY['abs'],
  ARRAY['obliques'],
  '{"obliques":0.3}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['cable_machine', 'rope_attachment'],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '752c015e-3eed-49df-89f6-8a7515383c39',
  'Cable Curl',
  'Stand facing low cable. Curl handle or bar toward shoulders while keeping elbows near sides.',
  5,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['cable_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '185124e5-4228-4717-8711-2554eaf5c224',
  'Cable External Rotation',
  'Stand beside a cable with elbow bent at 90 degrees. Rotate forearm outward while keeping elbow tucked.',
  3,
  ARRAY['rotator_cuff'],
  ARRAY['posterior_deltoids'],
  '{"posterior_deltoids":0.3}'::jsonb,
  true,
  15,
  35,
  false,
  ARRAY['cable_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3be498d6-0fcf-4945-8025-af15a1bae8a7',
  'Cable Fly',
  'Stand between cable handles. Sweep arms together in a wide arc while keeping a soft elbow bend.',
  6,
  ARRAY['chest'],
  ARRAY['anterior_deltoids'],
  '{"anterior_deltoids":0.4}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd6e21544-a456-4885-871b-d0d9a64e00b6',
  'Cable Glute Kickback',
  'Attach ankle strap to low cable. Kick leg backward while keeping torso stable, then return.',
  4,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'glute_medius'],
  '{"hamstrings":0.3,"glute_medius":0.3}'::jsonb,
  true,
  20,
  35,
  false,
  ARRAY['cable_machine', 'ankle_strap'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e82d38a2-bc10-4d21-95f2-b7f283bc2217',
  'Cable Hip Abduction',
  'Attach ankle strap to low cable. Move leg out to side, pause, then return with control.',
  4,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'glute_medius'],
  '{"glutes":0.4,"glute_medius":0.3}'::jsonb,
  true,
  20,
  35,
  false,
  ARRAY['cable_machine', 'ankle_strap'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cd2bb044-eac3-4eaa-9c5d-48cc608e81fb',
  'Cable Hip Adduction',
  'Attach ankle strap to low cable. Sweep leg inward across body, then return slowly.',
  4,
  ARRAY['adductors'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.2}'::jsonb,
  true,
  20,
  35,
  false,
  ARRAY['cable_machine', 'ankle_strap'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '68c61613-ff30-41d6-8bcd-9e7edfc5197a',
  'Cable Lateral Raise',
  'Stand beside a low cable. Raise handle out to side to shoulder height, then lower slowly.',
  5,
  ARRAY['lateral_deltoids'],
  ARRAY['traps', 'rotator_cuff'],
  '{"traps":0.3,"rotator_cuff":0.3}'::jsonb,
  true,
  20,
  40,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '601bd8c5-5826-46c4-9dd7-d532097f50ac',
  'Cable Overhead Tricep Extension',
  'Face away from high cable with rope overhead. Extend elbows forward/up, then bend with control.',
  5,
  ARRAY['triceps'],
  ARRAY['abs'],
  '{"abs":0.3}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['cable_machine', 'rope_attachment'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1167ac67-3285-4f9f-90e3-950d19b88fb9',
  'Cable Pull Through',
  'Face away from low cable holding rope between legs. Hinge back, then drive hips forward.',
  6,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back'],
  '{"hamstrings":0.7,"lower_back":0.3}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['cable_machine', 'rope_attachment'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '46590ac9-b392-47e5-8435-fa43704e3a49',
  'Cable Pullover',
  'Use a high cable or rope. Sweep arms down and back without bending elbows much.',
  5,
  ARRAY['lats'],
  ARRAY['chest', 'serratus_anterior', 'abs'],
  '{"chest":0.3,"serratus_anterior":0.4,"abs":0.3}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['cable_machine', 'rope_attachment'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f70ed8e0-8d70-4a8c-bc17-738cba9acade',
  'Cable Rear Delt Fly',
  'Set cables at shoulder height. Pull handles outward and back with soft elbows.',
  5,
  ARRAY['posterior_deltoids'],
  ARRAY['upper_back', 'traps', 'rotator_cuff'],
  '{"upper_back":0.6,"traps":0.4,"rotator_cuff":0.3}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['cable_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '79f21f22-e6f8-46b7-8608-476bf52bbb2a',
  'Cable Tricep Kickback',
  'Set cable low. Hinge forward and extend elbow backward against cable resistance.',
  4,
  ARRAY['triceps'],
  ARRAY['posterior_deltoids'],
  '{"posterior_deltoids":0.2}'::jsonb,
  true,
  15,
  35,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'fa240813-21ac-43bf-bee8-35e41d2609d8',
  'Cable Woodchop',
  'Set cable high or low. Rotate torso and pull handle diagonally across body, then return slowly.',
  6,
  ARRAY['obliques'],
  ARRAY['abs', 'lats', 'glutes'],
  '{"abs":0.5,"lats":0.3,"glutes":0.3}'::jsonb,
  true,
  20,
  40,
  false,
  ARRAY['cable_machine'],
  'rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b64fff79-39be-4454-86b5-4fbc8f27f9a8',
  'Calf Wall Stretch',
  'Place hands on wall, step one foot back, keep heel down, and lean forward.',
  2,
  ARRAY['calves'],
  ARRAY['soleus'],
  '{"soleus":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY['wall'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd5750dc9-7da0-48bb-b9eb-e378575097d7',
  'Captain Chair Knee Raise',
  'Support body on captain chair pads. Raise knees toward chest, then lower with control.',
  5,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'forearms'],
  '{"hip_flexors":0.5,"forearms":0.2}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['captain_chair'],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0b6f71cc-4b39-484f-be6a-1048deeea4d5',
  'Cat-Cow Stretch',
  'On hands and knees, alternate arching and rounding the spine slowly.',
  3,
  ARRAY['lower_back'],
  ARRAY['abs', 'upper_back'],
  '{"abs":0.3,"upper_back":0.4}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '94595222-be86-43ca-b366-1db8ecf1904d',
  'Chest-Supported Row (Dumbbell)',
  'Lie chest-down on an incline bench. Row dumbbells toward ribs, squeeze shoulder blades, and lower.',
  7,
  ARRAY['upper_back'],
  ARRAY['lats', 'biceps', 'posterior_deltoids'],
  '{"lats":0.6,"biceps":0.5,"posterior_deltoids":0.5}'::jsonb,
  false,
  20,
  50,
  false,
  ARRAY['dumbbells', 'incline_bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1ffce15a-11f1-4e91-936c-4cfeccf6aa22',
  'Child''s Pose',
  'Kneel and sit hips back toward heels while reaching arms forward and relaxing torso.',
  2,
  ARRAY['lats'],
  ARRAY['lower_back', 'glutes', 'posterior_deltoids'],
  '{"lower_back":0.5,"glutes":0.3,"posterior_deltoids":0.2}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9e40b1bc-6a0b-44b4-8e97-b8a46397a197',
  'Clean and Press',
  'Clean weight to shoulders, then press overhead and return with control.',
  9,
  ARRAY['glutes'],
  ARRAY['anterior_deltoids', 'triceps', 'quads', 'traps', 'abs'],
  '{"anterior_deltoids":0.7,"triceps":0.6,"quads":0.5,"traps":0.5,"abs":0.4}'::jsonb,
  false,
  35,
  60,
  false,
  ARRAY['barbell', 'dumbbells'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '27926c39-39a0-4e81-9bc3-cca27834e418',
  'Close-Grip Bench Press',
  'Grip bar slightly narrower than shoulder width. Lower to lower chest and press up, emphasizing triceps.',
  8,
  ARRAY['triceps'],
  ARRAY['chest', 'anterior_deltoids'],
  '{"chest":0.7,"anterior_deltoids":0.5}'::jsonb,
  false,
  30,
  60,
  false,
  ARRAY['barbell', 'bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9613d9e2-7eae-49f9-af1f-ca182aee082a',
  'Close-Grip Lat Pulldown',
  'Use close or neutral grip handle. Pull toward upper chest, squeeze lats, then return with control.',
  7,
  ARRAY['lats'],
  ARRAY['biceps', 'upper_back', 'forearms'],
  '{"biceps":0.6,"upper_back":0.4,"forearms":0.3}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['lat_pulldown_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ef446c9a-3699-49db-9dc8-fe684c34ff73',
  'Cobra Stretch',
  'Lie face-down, place hands under shoulders, and gently lift chest to extend spine.',
  2,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'chest'],
  '{"hip_flexors":0.3,"chest":0.2}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '59242c78-4429-4d58-adac-26f5d9a31c22',
  'Commando Pull Up',
  'Grip bar with hands facing each other on opposite sides. Pull head to one side of bar, alternating sides.',
  8,
  ARRAY['lats'],
  ARRAY['biceps', 'forearms', 'obliques'],
  '{"biceps":0.7,"forearms":0.6,"obliques":0.4}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e0f0c1a3-3320-42bc-a20a-a815a9e82e7c',
  'Concentration Curl',
  'Sit with elbow braced against inner thigh. Curl dumbbell up, then lower slowly.',
  4,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.3}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY['dumbbell', 'bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a5cc9ede-8b17-458e-8145-a60b0ac5a9ee',
  'Couch Stretch',
  'Place back foot on wall or bench in kneeling lunge. Tuck pelvis and hold quad/hip flexor stretch.',
  2,
  ARRAY['hip_flexors'],
  ARRAY['quads', 'glutes'],
  '{"quads":0.7,"glutes":0.2}'::jsonb,
  true,
  5,
  60,
  true,
  ARRAY['bench', 'wall'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c12bb951-6a36-43ff-9ef8-7d67f607999a',
  'Cross-Body Shoulder Stretch',
  'Pull one arm across chest with opposite arm until rear shoulder stretches.',
  2,
  ARRAY['posterior_deltoids'],
  ARRAY['upper_back', 'traps'],
  '{"upper_back":0.3,"traps":0.2}'::jsonb,
  true,
  5,
  40,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a64f2c5a-79c6-40b8-b872-b7f971512d31',
  'Crunch',
  'Lie on back with knees bent. Curl shoulders off floor using abs, then lower slowly.',
  4,
  ARRAY['abs'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.2}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd47e918a-0db2-40da-b148-95fcae768f5d',
  'Cuban Press',
  'Raise elbows high, externally rotate shoulders, then press lightly overhead and reverse.',
  4,
  ARRAY['rotator_cuff'],
  ARRAY['posterior_deltoids', 'lateral_deltoids', 'traps'],
  '{"posterior_deltoids":0.5,"lateral_deltoids":0.4,"traps":0.3}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['dumbbells'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8d38d3eb-d154-4d01-807f-d46a360d938b',
  'Curtsy Lunge',
  'Step one leg diagonally behind the other. Lower into a lunge, then return to standing.',
  6,
  ARRAY['glutes'],
  ARRAY['quads', 'glute_medius', 'adductors'],
  '{"quads":0.5,"glute_medius":0.6,"adductors":0.3}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '019b60d4-eff9-44d8-a1ba-e77b19d6243b',
  'Dead Bug',
  'Lie on back with arms and knees up. Extend opposite arm and leg while keeping lower back down.',
  4,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'obliques'],
  '{"hip_flexors":0.3,"obliques":0.3}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '50d48324-22d5-4ce5-98c9-c3e8315a63cd',
  'Dead Hang',
  'Hang from pull-up bar with arms straight. Keep shoulders active and hold for time.',
  5,
  ARRAY['forearms'],
  ARRAY['lats', 'traps'],
  '{"lats":0.4,"traps":0.3}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['pull_up_bar'],
  'pull',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '660b3749-9d7f-4087-b760-a694960db5b7',
  'Decline Bench Press (Barbell)',
  'Lie on a decline bench. Lower bar to lower chest and press up, keeping shoulders retracted.',
  8,
  ARRAY['lower_chest'],
  ARRAY['chest', 'triceps', 'anterior_deltoids'],
  '{"chest":0.7,"triceps":0.6,"anterior_deltoids":0.4}'::jsonb,
  false,
  40,
  60,
  false,
  ARRAY['barbell', 'decline_bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '97368e6f-2ace-4705-a15c-f384d06e00c3',
  'Decline Dumbbell Press',
  'Lie on a decline bench with dumbbells. Press from lower chest line to above chest, then lower under control.',
  8,
  ARRAY['lower_chest'],
  ARRAY['chest', 'triceps', 'anterior_deltoids'],
  '{"chest":0.7,"triceps":0.5,"anterior_deltoids":0.4}'::jsonb,
  false,
  30,
  60,
  false,
  ARRAY['dumbbells', 'decline_bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '44ab97ab-91d8-4aad-b2d0-4848d2dc4a14',
  'Decline Push Up',
  'Place feet on a bench and hands on floor. Lower chest, then press up while keeping body straight.',
  8,
  ARRAY['upper_chest'],
  ARRAY['chest', 'triceps', 'anterior_deltoids', 'abs'],
  '{"chest":0.6,"triceps":0.6,"anterior_deltoids":0.7,"abs":0.4}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY['bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ed0990db-b8ca-47c2-a262-556aa056e233',
  'Deep Squat Hold',
  'Sit into a deep squat, keep heels down if possible, and gently open hips with elbows.',
  2,
  ARRAY['adductors'],
  ARRAY['glutes', 'calves', 'lower_back'],
  '{"glutes":0.4,"calves":0.3,"lower_back":0.2}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '33fdc532-cf20-4e3c-99ea-942a8bd42454',
  'Deficit Reverse Lunge',
  'Stand on a small platform. Step backward into a deeper lunge, then drive up through front leg.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.8,"hamstrings":0.4,"calves":0.3}'::jsonb,
  true,
  15,
  55,
  false,
  ARRAY['dumbbells', 'platform'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '881729cc-1cb8-4e09-a7e4-4d6ed4c7773c',
  'Donkey Calf Raise',
  'Hinge forward with load across hips. Raise heels high, pause, then lower into stretch.',
  5,
  ARRAY['calves'],
  ARRAY['soleus'],
  '{"soleus":0.4}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['donkey_calf_raise_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '066b5b38-0bb9-496a-b0eb-eb64732f0e54',
  'Donkey Kick',
  'Start on all fours. Drive one heel upward by extending hip, squeeze glute, then lower.',
  3,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'abs'],
  '{"hamstrings":0.3,"abs":0.2}'::jsonb,
  true,
  5,
  35,
  false,
  ARRAY[]::text[],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f4c4bbc2-5408-4b32-8c35-f6a3324ea2d7',
  'Doorway Pec Stretch',
  'Place forearm on doorway and step through gently until chest stretches.',
  2,
  ARRAY['chest'],
  ARRAY['anterior_deltoids', 'biceps'],
  '{"anterior_deltoids":0.5,"biceps":0.2}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY['doorway'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '757d8542-db86-4894-8d6d-17f1f927935e',
  'Downward Dog',
  'Press hips upward from plank-like position, pushing chest toward thighs and heels toward floor.',
  2,
  ARRAY['calves'],
  ARRAY['hamstrings', 'lats', 'posterior_deltoids'],
  '{"hamstrings":0.5,"lats":0.4,"posterior_deltoids":0.3}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3bfb8aea-e16b-478b-9c2d-eef5be300850',
  'Dragon Flag',
  'Lie on bench holding behind head. Raise body into a straight line and lower slowly.',
  9,
  ARRAY['abs'],
  ARRAY['lats', 'hip_flexors', 'lower_back'],
  '{"lats":0.5,"hip_flexors":0.5,"lower_back":0.3}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['bench'],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '25e819df-952d-4190-bae5-fc6a609b881a',
  'Dumbbell Pullover',
  'Lie on a bench holding one dumbbell over chest. Lower weight behind head, then pull back over chest.',
  6,
  ARRAY['lats'],
  ARRAY['chest', 'serratus_anterior', 'triceps'],
  '{"chest":0.5,"serratus_anterior":0.5,"triceps":0.3}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['dumbbell', 'bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'af2f5e28-78ff-4659-a5eb-3d683e6ad6e7',
  'Dumbbell Romanian Deadlift',
  'Hold dumbbells in front of thighs. Hinge back until hamstrings stretch, then drive hips forward.',
  8,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'lower_back', 'forearms'],
  '{"glutes":0.8,"lower_back":0.5,"forearms":0.4}'::jsonb,
  false,
  15,
  60,
  false,
  ARRAY['dumbbells'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cf09ffac-a1a7-4b32-a1db-489822c69052',
  'Dumbbell Shrug',
  'Hold dumbbells at sides. Shrug shoulders upward, pause briefly, then lower fully.',
  5,
  ARRAY['traps'],
  ARRAY['forearms', 'upper_back'],
  '{"forearms":0.4,"upper_back":0.3}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['dumbbells'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b850a5dd-e160-4aa1-a373-efb55304e81f',
  'Dumbbell Side Bend',
  'Hold dumbbell at one side. Bend sideways slightly, then pull torso back upright.',
  4,
  ARRAY['obliques'],
  ARRAY['forearms'],
  '{"forearms":0.3}'::jsonb,
  true,
  5,
  35,
  false,
  ARRAY['dumbbell'],
  'rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ab017f37-e545-44f1-a587-b96b875542ba',
  'Dumbbell Snatch',
  'Lift dumbbell from floor to overhead in one explosive motion, then lower and switch sides.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'quads', 'anterior_deltoids', 'traps', 'abs'],
  '{"hamstrings":0.5,"quads":0.5,"anterior_deltoids":0.5,"traps":0.4,"abs":0.4}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY['dumbbell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ab5651db-d350-4d47-93f4-c97c5891c4ea',
  'Dumbbell Squat',
  'Hold dumbbells at sides or shoulders. Squat down with control and stand back up.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'abs'],
  '{"glutes":0.7,"hamstrings":0.4,"abs":0.3}'::jsonb,
  false,
  10,
  50,
  false,
  ARRAY['dumbbells'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '284fc4f4-e74f-43f0-afc4-be1e7e2090d7',
  'Dumbbell Thruster',
  'Hold dumbbells at shoulders. Squat down, then stand and press overhead in one motion.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'anterior_deltoids', 'triceps', 'abs'],
  '{"glutes":0.6,"anterior_deltoids":0.7,"triceps":0.6,"abs":0.4}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['dumbbells'],
  'squat',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3319e0dc-e1d1-487e-b0d0-6ec2d1ec91e9',
  'Dumbbell Tricep Kickback',
  'Hinge forward with upper arm beside torso. Extend elbow backward, then lower slowly.',
  4,
  ARRAY['triceps'],
  ARRAY['posterior_deltoids'],
  '{"posterior_deltoids":0.2}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY['dumbbell'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0ef5f853-fbdd-4618-8647-4f302e2148b1',
  'Elliptical',
  'Use elliptical with smooth leg drive and optional handle push-pull rhythm.',
  6,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'chest', 'upper_back'],
  '{"glutes":0.4,"hamstrings":0.3,"calves":0.3,"chest":0.2,"upper_back":0.2}'::jsonb,
  false,
  15,
  300,
  true,
  ARRAY['elliptical'],
  'cardio',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8bc2c8da-2d89-4046-94cc-47463fbd79e8',
  'EZ-Bar Curl',
  'Hold EZ-bar with underhand grip. Curl toward shoulders, then lower under control.',
  5,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.4}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['ez_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2493ebd1-4320-43be-9c8f-9dfcf6688133',
  'Figure Four Stretch',
  'Lie on back, cross one ankle over opposite knee, and pull legs toward chest.',
  2,
  ARRAY['glutes'],
  ARRAY['piriformis', 'hamstrings'],
  '{"piriformis":0.7,"hamstrings":0.2}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e015530c-7eaa-4ec9-8dac-793fd69aa5bc',
  'Fire Hydrant',
  'Start on all fours. Lift bent knee out to side, pause, then lower while keeping hips stable.',
  3,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'abs'],
  '{"glutes":0.4,"abs":0.2}'::jsonb,
  true,
  5,
  35,
  false,
  ARRAY[]::text[],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c9f4b98a-58ce-4c04-907f-a050c3a19fed',
  'Floor Press (Barbell)',
  'Lie on floor under a barbell. Lower until upper arms touch the floor, then press up.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids'],
  '{"triceps":0.7,"anterior_deltoids":0.5}'::jsonb,
  false,
  30,
  60,
  false,
  ARRAY['barbell'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '235db50e-a561-4e1c-a4f8-cf802aadec87',
  'Floor Press (Dumbbell)',
  'Lie on floor with dumbbells. Lower elbows until upper arms touch floor, then press up.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids'],
  '{"triceps":0.6,"anterior_deltoids":0.5}'::jsonb,
  false,
  15,
  50,
  false,
  ARRAY['dumbbells'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '5c11c140-7216-465c-ad4c-4ab34ab6c48b',
  'Flutter Kicks',
  'Lie on back with legs straight. Alternate small up-and-down kicks while keeping lower back down.',
  5,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'quads'],
  '{"hip_flexors":0.6,"quads":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '07e477e7-e549-426d-bfe2-ed6aa26d7e64',
  'Foam Roller Calf Mobilization',
  'Sit with foam roller under calf and roll slowly from ankle toward knee.',
  3,
  ARRAY['calves'],
  ARRAY['soleus'],
  '{"soleus":0.4}'::jsonb,
  true,
  5,
  60,
  true,
  ARRAY['foam_roller'],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '290438a6-21f4-440a-bcd4-28606c329018',
  'Foam Roller Lat Mobilization',
  'Lie on side with foam roller under lat and slowly roll tender areas.',
  3,
  ARRAY['lats'],
  ARRAY['serratus_anterior', 'upper_back'],
  '{"serratus_anterior":0.2,"upper_back":0.2}'::jsonb,
  true,
  5,
  60,
  true,
  ARRAY['foam_roller'],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '84d55d67-efd1-4234-bd6e-c2b887885d60',
  'Foam Roller Quad Mobilization',
  'Lie face-down with foam roller under thigh and roll slowly from hip to knee.',
  3,
  ARRAY['quads'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.2}'::jsonb,
  true,
  5,
  60,
  true,
  ARRAY['foam_roller'],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '12deea11-40d1-4366-b9ad-121e8ff2da6a',
  'Foam Roller Thoracic Extension',
  'Place foam roller under upper back and gently extend over it in small segments.',
  3,
  ARRAY['upper_back'],
  ARRAY['chest', 'abs'],
  '{"chest":0.3,"abs":0.2}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY['foam_roller'],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9f637ec3-70ca-4622-9b53-ccfe63c9cc4c',
  'Forearm Plank',
  'Hold body in a straight line on forearms and toes. Brace abs and avoid sagging hips.',
  5,
  ARRAY['abs'],
  ARRAY['obliques', 'glutes', 'anterior_deltoids'],
  '{"obliques":0.5,"glutes":0.3,"anterior_deltoids":0.3}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'anti-rotation',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3dea3d27-eb86-464f-8a13-b4be8bfa7a76',
  'Forward Lunge',
  'Step forward into a lunge, lower until both knees bend, then push back to starting position.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.7,"hamstrings":0.3,"calves":0.2}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3e60176e-557e-4baa-b176-c69ccf26215e',
  'Frog Pump',
  'Lie on back with soles of feet together and knees out. Pump hips upward while squeezing glutes.',
  4,
  ARRAY['glutes'],
  ARRAY['adductors', 'hamstrings'],
  '{"adductors":0.3,"hamstrings":0.2}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY[]::text[],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '61c309aa-fd2f-4b04-af45-60dbaeed55e8',
  'Frog Stretch',
  'Kneel with knees wide and hips back. Hold a gentle inner-thigh stretch.',
  2,
  ARRAY['adductors'],
  ARRAY['glutes', 'hip_flexors'],
  '{"glutes":0.3,"hip_flexors":0.2}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ec2b6548-60ca-4a6c-b9d8-dc1f0f74d176',
  'Front Rack Carry',
  'Hold kettlebells or dumbbells in front rack at shoulders. Walk while bracing core.',
  7,
  ARRAY['abs'],
  ARRAY['upper_back', 'forearms', 'biceps', 'glutes'],
  '{"upper_back":0.6,"forearms":0.6,"biceps":0.3,"glutes":0.3}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['kettlebells', 'dumbbells'],
  'carry',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'fa482943-525d-45c1-b4f8-f27c529d9cc3',
  'Front Raise (Dumbbell)',
  'Stand with dumbbells in front of thighs. Raise arms to shoulder height, then lower slowly.',
  4,
  ARRAY['anterior_deltoids'],
  ARRAY['upper_chest'],
  '{"upper_chest":0.3}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['dumbbells'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7ef759af-cf1a-4c8b-af21-99b1efae6708',
  'Front Raise (Plate)',
  'Hold a weight plate with both hands. Raise to shoulder height, then lower with control.',
  4,
  ARRAY['anterior_deltoids'],
  ARRAY['upper_chest', 'forearms'],
  '{"upper_chest":0.3,"forearms":0.3}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['weight_plate'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2d38164e-882c-48ad-9066-f1b811eee913',
  'Glute-Ham Raise',
  'Secure feet in glute-ham developer. Lower torso and extend back up using hamstrings and glutes.',
  8,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'calves', 'lower_back'],
  '{"glutes":0.7,"calves":0.3,"lower_back":0.3}'::jsonb,
  false,
  20,
  50,
  false,
  ARRAY['glute_ham_developer'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '76c36cef-de33-47fc-bb4e-98bb4877e650',
  'Goblet Carry',
  'Hold kettlebell or dumbbell at chest. Walk with ribs down and torso upright.',
  5,
  ARRAY['abs'],
  ARRAY['upper_back', 'forearms', 'biceps'],
  '{"upper_back":0.5,"forearms":0.4,"biceps":0.3}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['kettlebell', 'dumbbell'],
  'carry',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4128a13f-0fdb-4c32-85a8-9518ebe18671',
  'Goblet Squat',
  'Hold a dumbbell or kettlebell at chest. Squat down between knees, then stand tall.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'abs', 'upper_back'],
  '{"glutes":0.7,"abs":0.4,"upper_back":0.3}'::jsonb,
  false,
  10,
  50,
  false,
  ARRAY['dumbbell', 'kettlebell'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c89288b4-76d4-4b64-9773-ae480ff65fdc',
  'Good Morning',
  'Place bar on upper back. Hinge at hips with soft knees, then return by squeezing glutes.',
  8,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'lower_back', 'abs'],
  '{"glutes":0.7,"lower_back":0.7,"abs":0.4}'::jsonb,
  false,
  40,
  60,
  false,
  ARRAY['barbell', 'squat_rack'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '84ea2bc2-d217-4b84-a0d2-d2fa839392f4',
  'Hack Squat',
  'Stand on hack squat platform with shoulders under pads. Lower until knees bend deeply, then press up.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.6,"hamstrings":0.3,"calves":0.2}'::jsonb,
  false,
  20,
  60,
  false,
  ARRAY['hack_squat_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '16119eec-c5ab-4220-b4f0-9154cea06874',
  'Hamstring Curl (Stability Ball)',
  'Lie on back with heels on ball. Lift hips and curl ball toward body, then extend legs.',
  6,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'calves', 'abs'],
  '{"glutes":0.5,"calves":0.3,"abs":0.4}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['stability_ball'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4fc5bd47-9c36-4753-a28f-59eb8688b377',
  'Hand-Release Push Up',
  'Lower chest to floor, briefly lift hands, then plant hands and push back up.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.5,"anterior_deltoids":0.5,"abs":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'push',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '53bd600b-dc87-4e41-97b1-c8490b3c9d9c',
  'Hang Clean',
  'Start with bar above knees. Extend hips explosively and catch bar on shoulders.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'quads', 'traps', 'forearms'],
  '{"hamstrings":0.6,"quads":0.5,"traps":0.7,"forearms":0.5}'::jsonb,
  false,
  35,
  55,
  false,
  ARRAY['barbell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8cc46d7d-d489-459c-aa8a-cbe31e7c0fad',
  'Happy Baby Pose',
  'Lie on back, hold feet or shins, and gently pull knees toward armpits.',
  2,
  ARRAY['adductors'],
  ARRAY['glutes', 'lower_back'],
  '{"glutes":0.4,"lower_back":0.3}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c54d9441-d7df-4ca4-8623-44ce17ea8457',
  'High Plank',
  'Hold top of push-up position with hands under shoulders. Brace core and keep body straight.',
  5,
  ARRAY['abs'],
  ARRAY['obliques', 'anterior_deltoids', 'serratus_anterior'],
  '{"obliques":0.5,"anterior_deltoids":0.4,"serratus_anterior":0.3}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'anti-rotation',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1e85ab0c-e74d-4cf1-a70e-6087745d949d',
  'High-to-Low Cable Fly',
  'Set pulleys high. Pull handles down and together toward lower chest to emphasize lower chest.',
  6,
  ARRAY['lower_chest'],
  ARRAY['chest', 'anterior_deltoids'],
  '{"chest":0.7,"anterior_deltoids":0.3}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '43e48323-757f-4abe-918e-6d104eae1e01',
  'Hip Abduction Machine',
  'Sit with pads outside thighs. Push knees outward, pause, then return slowly.',
  4,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'glute_medius'],
  '{"glutes":0.5,"glute_medius":0.3}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['hip_abduction_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0bc21202-d040-4101-b450-dc01b49924d6',
  'Hip Adduction Machine',
  'Sit with pads outside knees. Squeeze thighs together, then return slowly.',
  4,
  ARRAY['adductors'],
  ARRAY['glutes'],
  '{"glutes":0.2}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['hip_adduction_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'fbe9e100-4338-4c72-a641-2689b28084a7',
  'Hollow Body Hold',
  'Lie on back with arms and legs extended off floor. Press lower back down and hold.',
  6,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'quads'],
  '{"hip_flexors":0.4,"quads":0.2}'::jsonb,
  false,
  5,
  30,
  true,
  ARRAY[]::text[],
  'anti-rotation',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '011d7499-3f2b-46e3-9d44-0e8c7d8bb1e9',
  'Inchworm Walkout',
  'Hinge down, walk hands to plank, then walk feet toward hands or reverse.',
  3,
  ARRAY['hamstrings'],
  ARRAY['calves', 'abs', 'anterior_deltoids'],
  '{"calves":0.3,"abs":0.4,"anterior_deltoids":0.3}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2a7934e2-8059-4aef-aee0-cc71125febca',
  'Incline Bench Press (Barbell)',
  'Set bench to an incline. Lower bar to upper chest, then press up while keeping wrists stacked over elbows.',
  8,
  ARRAY['upper_chest'],
  ARRAY['chest', 'triceps', 'anterior_deltoids'],
  '{"chest":0.7,"triceps":0.6,"anterior_deltoids":0.7}'::jsonb,
  false,
  35,
  60,
  false,
  ARRAY['barbell', 'incline_bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'bee7e4fa-738d-447d-822b-5070f758c890',
  'Incline Dumbbell Curl',
  'Sit on an incline bench with arms hanging. Curl dumbbells without swinging, then lower fully.',
  5,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['dumbbells', 'incline_bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '411b28e7-fa67-4059-a265-68aa848851a2',
  'Incline Push Up',
  'Place hands on a bench or box. Lower chest toward the surface, then push back up.',
  5,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.5,"anterior_deltoids":0.5,"abs":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY['bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '983c7d6b-7f01-4908-a328-1ce45b610bbd',
  'Incline Treadmill Walk',
  'Walk on treadmill at an incline while keeping posture tall and steps controlled.',
  6,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'calves', 'quads'],
  '{"hamstrings":0.5,"calves":0.5,"quads":0.4}'::jsonb,
  false,
  15,
  300,
  true,
  ARRAY['treadmill'],
  'cardio',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8f7b746d-c9b8-4d24-a0ca-6f8142906731',
  'Inverted Row',
  'Lie under a fixed bar. Pull chest to bar while keeping body straight, then lower with control.',
  7,
  ARRAY['upper_back'],
  ARRAY['lats', 'biceps', 'posterior_deltoids', 'abs'],
  '{"lats":0.6,"biceps":0.5,"posterior_deltoids":0.5,"abs":0.3}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['barbell', 'squat_rack'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7b0e99c6-2636-4437-8f74-55b95a146efd',
  'JM Press',
  'Lower bar toward upper chest/neck with elbows forward, then extend elbows to press back up.',
  7,
  ARRAY['triceps'],
  ARRAY['chest', 'anterior_deltoids'],
  '{"chest":0.4,"anterior_deltoids":0.3}'::jsonb,
  false,
  30,
  50,
  false,
  ARRAY['barbell', 'bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cd26c728-1c67-4af1-886c-9e351cf2ee0f',
  'Jump Rope',
  'Jump repeatedly over rope with light foot contacts and steady rhythm.',
  8,
  ARRAY['calves'],
  ARRAY['quads', 'forearms', 'anterior_deltoids'],
  '{"quads":0.4,"forearms":0.3,"anterior_deltoids":0.2}'::jsonb,
  false,
  5,
  60,
  false,
  ARRAY['jump_rope'],
  'cardio',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '478550c5-bb46-4e33-9d74-c9e37a16eb4d',
  'Kettlebell Clean',
  'Swing kettlebell from hinge and guide it into front rack position, then lower and repeat.',
  8,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'upper_back', 'forearms', 'abs'],
  '{"hamstrings":0.6,"upper_back":0.5,"forearms":0.5,"abs":0.4}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY['kettlebell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a8cc4082-4bb1-46eb-9834-8a3d43c03109',
  'Kettlebell Snatch',
  'Swing kettlebell overhead in one motion, finishing with arm locked out and shoulder stable.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'anterior_deltoids', 'traps', 'forearms', 'abs'],
  '{"hamstrings":0.6,"anterior_deltoids":0.5,"traps":0.4,"forearms":0.5,"abs":0.4}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY['kettlebell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9680e032-d117-4947-a950-6fb77321d610',
  'Kettlebell Swing',
  'Hinge kettlebell between legs, then snap hips forward to swing it to chest height.',
  8,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'abs', 'forearms'],
  '{"hamstrings":0.7,"lower_back":0.5,"abs":0.4,"forearms":0.4}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['kettlebell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '348f485c-05cd-47e2-b151-00988d9cdfc4',
  'Kneeling Hip Flexor Stretch',
  'Kneel in lunge position, tuck pelvis slightly, and shift forward until front of hip stretches.',
  2,
  ARRAY['hip_flexors'],
  ARRAY['quads', 'glutes'],
  '{"quads":0.4,"glutes":0.2}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e097cdc1-3624-4a08-8eca-4554603b8c71',
  'Landmine Press',
  'Hold the end of a landmine bar at shoulder height. Press forward and upward, then lower with control.',
  7,
  ARRAY['anterior_deltoids'],
  ARRAY['upper_chest', 'triceps', 'abs', 'serratus_anterior'],
  '{"upper_chest":0.5,"triceps":0.6,"abs":0.4,"serratus_anterior":0.4}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['barbell', 'landmine_attachment'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '30f9b729-f9f1-4a27-a175-fc73aef1c2e5',
  'Landmine Row',
  'Straddle a landmine bar with row handle. Pull bar toward torso, then lower under control.',
  8,
  ARRAY['upper_back'],
  ARRAY['lats', 'biceps', 'lower_back'],
  '{"lats":0.7,"biceps":0.5,"lower_back":0.4}'::jsonb,
  false,
  25,
  60,
  false,
  ARRAY['barbell', 'landmine_attachment'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b8670dc7-f3df-4839-b226-08859ecb899e',
  'Landmine Squat',
  'Hold landmine bar at chest. Squat down with upright torso, then stand and keep bar close.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'abs', 'upper_back'],
  '{"glutes":0.6,"abs":0.4,"upper_back":0.3}'::jsonb,
  false,
  20,
  50,
  false,
  ARRAY['barbell', 'landmine_attachment'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3cc46806-5201-473b-9d02-3777aafa807e',
  'Lat Stretch on Bench',
  'Kneel facing bench with elbows on bench. Sit hips back until lats stretch.',
  2,
  ARRAY['lats'],
  ARRAY['triceps', 'upper_back'],
  '{"triceps":0.3,"upper_back":0.3}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY['bench'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '5a188aab-9d64-41b2-94bf-f59d4edbc6ec',
  'Lateral Lunge',
  'Step out to the side, bend the stepping knee, keep other leg straight, then push back to center.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'adductors', 'hamstrings'],
  '{"glutes":0.6,"adductors":0.7,"hamstrings":0.3}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e0b563a2-1af2-44b5-9b5f-321d30528119',
  'Lateral Step Up',
  'Stand beside a box. Step up sideways through the working leg, then lower with control.',
  7,
  ARRAY['glute_medius'],
  ARRAY['quads', 'glutes', 'adductors'],
  '{"quads":0.6,"glutes":0.6,"adductors":0.3}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['box', 'dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '6b9e9f41-545a-4ef7-af69-5ace01e308aa',
  'Lean-Away Lateral Raise',
  'Hold support with one hand and lean away. Raise dumbbell out to side, then lower slowly.',
  5,
  ARRAY['lateral_deltoids'],
  ARRAY['traps', 'rotator_cuff'],
  '{"traps":0.3,"rotator_cuff":0.3}'::jsonb,
  true,
  10,
  40,
  false,
  ARRAY['dumbbell'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f183447a-b0c0-4bec-ba87-87100a645675',
  'Leg Extension (Single-Leg)',
  'Sit in leg extension machine. Extend one leg fully, pause, then lower with control.',
  4,
  ARRAY['quads'],
  ARRAY[]::text[],
  '{}'::jsonb,
  true,
  15,
  35,
  false,
  ARRAY['leg_extension_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'aabfea0e-10bb-4a97-8f95-0f48b129f6bb',
  'Leg Swings Front-to-Back',
  'Hold support and swing one leg forward and backward with controlled range.',
  3,
  ARRAY['hamstrings'],
  ARRAY['hip_flexors', 'glutes'],
  '{"hip_flexors":0.5,"glutes":0.3}'::jsonb,
  true,
  5,
  40,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'fc41a345-6a1b-4222-aec4-c7edb1fa640c',
  'Leg Swings Side-to-Side',
  'Hold support and swing one leg across body and outward with control.',
  3,
  ARRAY['adductors'],
  ARRAY['glute_medius', 'hip_flexors'],
  '{"glute_medius":0.5,"hip_flexors":0.3}'::jsonb,
  true,
  5,
  40,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '05569a9e-4135-4ff9-946f-8211e0ec4de0',
  'Levator Scapulae Stretch',
  'Turn head slightly down toward armpit and gently assist until back of neck stretches.',
  2,
  ARRAY['traps'],
  ARRAY['traps', 'upper_back'],
  '{"traps":0.6,"upper_back":0.2}'::jsonb,
  true,
  5,
  30,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '36112313-934c-465e-ba82-d95f11a8f93a',
  'Low-to-High Cable Fly',
  'Set pulleys low. Sweep handles upward and inward toward upper chest while keeping ribs down.',
  6,
  ARRAY['upper_chest'],
  ARRAY['chest', 'anterior_deltoids'],
  '{"chest":0.6,"anterior_deltoids":0.5}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e6c2b12f-191e-491a-9229-7dbdb4a15ac3',
  'Lying Hamstring Stretch with Strap',
  'Lie on back with strap around foot. Raise leg until hamstring stretch is felt and hold.',
  2,
  ARRAY['hamstrings'],
  ARRAY['calves'],
  '{"calves":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY['yoga_strap'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '733d6d74-39bf-43fb-9f1e-53a66d000923',
  'Machine Chest Press',
  'Sit with handles at chest height. Press handles forward until arms extend, then return with control.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids'],
  '{"triceps":0.6,"anterior_deltoids":0.5}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['chest_press_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ec09758e-d361-4749-8064-3ebd17b6e51a',
  'Machine Hip Thrust',
  'Sit in hip thrust machine with pad over hips. Drive hips upward, squeeze glutes, then lower.',
  7,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'quads'],
  '{"hamstrings":0.4,"quads":0.2}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['hip_thrust_machine'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e184dda0-4b44-4940-aae8-4771ca0141c1',
  'Machine Row',
  'Sit at row machine with chest supported. Pull handles toward torso, squeeze shoulder blades, then return.',
  7,
  ARRAY['upper_back'],
  ARRAY['lats', 'biceps', 'posterior_deltoids'],
  '{"lats":0.6,"biceps":0.5,"posterior_deltoids":0.4}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['row_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e9af2932-aba5-471e-880a-b888f9811e82',
  'Machine Shoulder Press',
  'Sit with handles at shoulder height. Press overhead, pause briefly, then lower under control.',
  7,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'lateral_deltoids'],
  '{"triceps":0.6,"lateral_deltoids":0.5}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['shoulder_press_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cb4b3885-ad3c-4fed-9d27-5450395743c5',
  'Meadows Row',
  'Stand beside a landmine bar. Row the bar end toward hip with one arm, then lower.',
  8,
  ARRAY['lats'],
  ARRAY['upper_back', 'biceps', 'forearms', 'obliques'],
  '{"upper_back":0.6,"biceps":0.5,"forearms":0.5,"obliques":0.4}'::jsonb,
  true,
  25,
  50,
  false,
  ARRAY['barbell', 'landmine_attachment'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a5cd668b-595e-4fe2-9bd6-3ae60f6eebe2',
  'Medicine Ball Slam',
  'Raise medicine ball overhead and slam it forcefully to floor, then reset safely.',
  8,
  ARRAY['abs'],
  ARRAY['lats', 'anterior_deltoids', 'triceps', 'glutes'],
  '{"lats":0.5,"anterior_deltoids":0.5,"triceps":0.4,"glutes":0.4}'::jsonb,
  false,
  10,
  30,
  false,
  ARRAY['medicine_ball'],
  'push',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd02ab609-e9c8-42c7-90b5-44f28ad6de2a',
  'Mountain Climber',
  'Start in high plank. Drive knees toward chest alternately while keeping hips stable.',
  7,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'anterior_deltoids', 'quads'],
  '{"hip_flexors":0.6,"anterior_deltoids":0.4,"quads":0.3}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cd98d4ac-2576-4c49-96fa-8a38a109221f',
  'Neutral-Grip Pull Up',
  'Hang with palms facing each other. Pull body up until chin clears handles, then lower fully.',
  8,
  ARRAY['lats'],
  ARRAY['biceps', 'forearms', 'upper_back'],
  '{"biceps":0.7,"forearms":0.5,"upper_back":0.5}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9ae097b5-a364-4586-88fd-467c2a344a44',
  'Overhead Carry',
  'Hold weight overhead with arm locked out. Walk while keeping ribs down and shoulder stable.',
  7,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'traps', 'abs', 'rotator_cuff'],
  '{"triceps":0.5,"traps":0.4,"abs":0.6,"rotator_cuff":0.5}'::jsonb,
  true,
  15,
  40,
  false,
  ARRAY['dumbbell', 'kettlebell'],
  'carry',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3b982f07-244f-4797-be88-bdbf1df8b0fb',
  'Overhead Triceps Stretch',
  'Raise one arm overhead, bend elbow, and gently pull elbow back with opposite hand.',
  2,
  ARRAY['triceps'],
  ARRAY['lats', 'lateral_deltoids'],
  '{"lats":0.2,"lateral_deltoids":0.2}'::jsonb,
  true,
  5,
  40,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '16bff447-309d-482d-ba58-c1778c3fe16e',
  'Pallof Press',
  'Stand sideways to cable or band. Press handle straight out while resisting rotation, then return.',
  5,
  ARRAY['obliques'],
  ARRAY['abs', 'glutes', 'anterior_deltoids'],
  '{"abs":0.6,"glutes":0.3,"anterior_deltoids":0.2}'::jsonb,
  false,
  15,
  35,
  false,
  ARRAY['cable_machine', 'resistance_band'],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0ce25ccd-17d2-43fe-aa40-5ec5c9327b57',
  'Pec Deck Fly',
  'Sit with elbows or forearms on pads. Bring arms together in front of chest, then open slowly.',
  5,
  ARRAY['chest'],
  ARRAY['anterior_deltoids'],
  '{"anterior_deltoids":0.3}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['pec_deck_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '26d199ed-ebb9-4e00-bdce-e3f5b8d3f719',
  'Pendulum Squat',
  'Set shoulders under pads. Lower into deep squat on pendulum machine, then drive up through platform.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings'],
  '{"glutes":0.6,"hamstrings":0.3}'::jsonb,
  false,
  20,
  60,
  false,
  ARRAY['pendulum_squat_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9a095b9e-5b43-4fef-a1d4-26347920a177',
  'Pigeon Pose',
  'Bring one shin forward on floor and extend other leg back. Fold forward for glute stretch.',
  2,
  ARRAY['glutes'],
  ARRAY['piriformis', 'hip_flexors'],
  '{"piriformis":0.7,"hip_flexors":0.3}'::jsonb,
  true,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3251285c-fe0e-4a1b-8544-900df551a7f5',
  'Plank Shoulder Tap',
  'Hold high plank and tap opposite shoulder with one hand while resisting hip rotation.',
  6,
  ARRAY['obliques'],
  ARRAY['abs', 'anterior_deltoids', 'serratus_anterior'],
  '{"abs":0.6,"anterior_deltoids":0.4,"serratus_anterior":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '172c4b82-ad86-4506-96b3-51a3c2ff20ab',
  'Plate Pinch Hold',
  'Pinch weight plates between fingers and thumb. Hold for time while standing tall.',
  4,
  ARRAY['forearms'],
  ARRAY['traps'],
  '{"traps":0.2}'::jsonb,
  false,
  10,
  30,
  false,
  ARRAY['weight_plate'],
  'carry',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '15ee637f-95df-4e57-bca6-9b620c62e6c1',
  'Plyometric Push Up',
  'Lower into a push-up, then press explosively so hands leave the floor. Land softly and repeat.',
  9,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.7,"anterior_deltoids":0.6,"abs":0.4}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'push',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '6c719ec6-335c-4274-bce8-19bdee3adb9a',
  'Power Clean',
  'Pull bar explosively from floor and receive it on shoulders in a partial squat.',
  10,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'quads', 'traps', 'forearms', 'abs'],
  '{"hamstrings":0.6,"quads":0.6,"traps":0.7,"forearms":0.5,"abs":0.4}'::jsonb,
  false,
  45,
  60,
  false,
  ARRAY['barbell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0fe224d5-6ffa-4954-a27e-bdf3a8ac13f7',
  'Power Snatch',
  'Pull bar from floor to overhead in one motion, receiving in a partial squat.',
  10,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'quads', 'traps', 'anterior_deltoids', 'abs'],
  '{"hamstrings":0.6,"quads":0.5,"traps":0.7,"anterior_deltoids":0.5,"abs":0.5}'::jsonb,
  false,
  45,
  60,
  false,
  ARRAY['barbell'],
  'hinge',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '5c51396c-bac8-4a4a-bacb-1f6915770045',
  'Preacher Curl',
  'Rest upper arms on preacher pad. Curl weight up, squeeze biceps, then lower under control.',
  5,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['preacher_curl_bench', 'ez_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ed3f0a38-b6f8-4eb7-a599-0f31b92ff157',
  'Prone Leg Curl',
  'Lie face-down on leg curl machine. Curl heels toward glutes, pause, then lower with control.',
  5,
  ARRAY['hamstrings'],
  ARRAY['calves'],
  '{"calves":0.2}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['leg_curl_machine'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9a48d6fb-e0da-4437-b337-198130bcd917',
  'Push Jerk',
  'Dip with knees, drive bar overhead, and receive with arms locked and knees bent.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'quads', 'glutes', 'abs'],
  '{"triceps":0.7,"quads":0.5,"glutes":0.5,"abs":0.5}'::jsonb,
  false,
  35,
  50,
  false,
  ARRAY['barbell'],
  'push',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b1e08bfd-9ea7-4a97-b0d3-03e1164a23dc',
  'Push Press',
  'Hold bar at shoulders. Dip slightly with knees, drive upward, and press bar overhead.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'quads', 'glutes', 'abs'],
  '{"triceps":0.7,"quads":0.5,"glutes":0.4,"abs":0.4}'::jsonb,
  false,
  35,
  50,
  false,
  ARRAY['barbell'],
  'push',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1075b2d9-d993-4954-aff6-38a2916f0942',
  'Rear Delt Fly (Dumbbell)',
  'Hinge forward with dumbbells hanging. Raise arms out to sides, squeeze rear delts, then lower.',
  5,
  ARRAY['posterior_deltoids'],
  ARRAY['upper_back', 'traps'],
  '{"upper_back":0.6,"traps":0.4}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['dumbbells'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '84f97e6b-7080-46c4-870e-4c7e775896e4',
  'Reverse Crunch',
  'Lie on back with knees bent. Curl hips upward toward ribs, then lower with control.',
  5,
  ARRAY['abs'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '053bea06-340f-48e2-8e8c-69f839635cc0',
  'Reverse Curl',
  'Hold bar with overhand grip. Curl toward shoulders, emphasizing brachialis and forearms.',
  5,
  ARRAY['forearms'],
  ARRAY['biceps'],
  '{"biceps":0.5}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['barbell', 'ez_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '6cfa3ba2-4d41-4a3f-95bd-cdbb09c94c3a',
  'Reverse Hyperextension',
  'Lie face-down on reverse hyper machine. Swing legs upward by extending hips, then lower.',
  6,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back'],
  '{"hamstrings":0.6,"lower_back":0.5}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['reverse_hyper_machine'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '913aa172-ab75-4b9a-83c2-f03786af9f86',
  'Reverse Lunge',
  'Step backward into a lunge, lower under control, then drive through front foot to stand.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.7,"hamstrings":0.4,"calves":0.2}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3e6c191b-41fe-4cde-b36d-5978663cfc2c',
  'Reverse Pec Deck Fly',
  'Sit facing a pec deck machine. Pull handles apart until arms line with shoulders, then return slowly.',
  5,
  ARRAY['posterior_deltoids'],
  ARRAY['upper_back', 'traps'],
  '{"upper_back":0.6,"traps":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['pec_deck_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '6af029ba-1b51-43a0-9c6f-368f10094a1e',
  'Reverse Plank',
  'Sit with hands behind hips and legs straight. Lift hips until body forms a line and hold.',
  5,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'posterior_deltoids', 'lower_back'],
  '{"hamstrings":0.4,"posterior_deltoids":0.4,"lower_back":0.3}'::jsonb,
  false,
  5,
  30,
  true,
  ARRAY[]::text[],
  'hinge',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '23b329c8-7c74-45db-bd5a-06d5000ac8a7',
  'Reverse Wrist Curl',
  'Rest forearms on bench with palms down. Extend wrists upward, then lower under control.',
  3,
  ARRAY['forearms'],
  ARRAY[]::text[],
  '{}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['dumbbells', 'bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7cee6f5c-8c22-46e2-a401-55b8bfef127e',
  'Ring Push Up',
  'Hold gymnastics rings or straps in a push-up position. Lower chest between hands, then press up while stabilizing.',
  8,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs', 'serratus_anterior'],
  '{"triceps":0.6,"anterior_deltoids":0.6,"abs":0.6,"serratus_anterior":0.5}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['gymnastic_rings'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3d7302c1-e236-47df-9951-32ba7fc05af0',
  'Rowing Machine',
  'Drive with legs, swing torso, then pull handle to ribs. Reverse smoothly for each stroke.',
  8,
  ARRAY['quads'],
  ARRAY['lats', 'upper_back', 'glutes', 'hamstrings', 'biceps'],
  '{"lats":0.6,"upper_back":0.6,"glutes":0.5,"hamstrings":0.5,"biceps":0.4}'::jsonb,
  false,
  15,
  300,
  true,
  ARRAY['rowing_machine'],
  'cardio',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd7fc10a2-5f84-48eb-b0f8-65bbdb55e87b',
  'Russian Twist',
  'Sit with torso leaned back. Rotate weight or hands side to side while bracing core.',
  5,
  ARRAY['obliques'],
  ARRAY['abs', 'hip_flexors'],
  '{"abs":0.6,"hip_flexors":0.3}'::jsonb,
  false,
  5,
  40,
  false,
  ARRAY['medicine_ball'],
  'rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '39457111-8e4a-4d9b-84dd-12b8d0c402a8',
  'Scapular Pull Up',
  'Hang from pull-up bar. Keep arms straight and pull shoulder blades down, then relax under control.',
  4,
  ARRAY['traps'],
  ARRAY['lats', 'forearms', 'serratus_anterior'],
  '{"lats":0.5,"forearms":0.3,"serratus_anterior":0.3}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b34a6a32-51ee-427d-8d64-a9996b2459ab',
  'Scissor Kicks',
  'Lie on back with legs straight. Cross legs over each other in alternating scissor motion.',
  5,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'adductors'],
  '{"hip_flexors":0.6,"adductors":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '23c5a1d2-cbbe-4372-a509-ac649be6aa97',
  'Seated Calf Raise',
  'Sit with knees bent and pads on thighs. Raise heels, pause, then lower under control.',
  4,
  ARRAY['soleus'],
  ARRAY['calves'],
  '{"calves":0.5}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['seated_calf_raise_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '270b128b-0154-4ec6-872b-858ab4eea3c0',
  'Seated Chest Press (Cable)',
  'Sit between cable handles at chest level. Press forward and together, then return slowly.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids'],
  '{"triceps":0.5,"anterior_deltoids":0.5}'::jsonb,
  false,
  25,
  45,
  false,
  ARRAY['cable_machine', 'bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '103ff486-bf2b-4edb-a7f4-50066d48f091',
  'Seated Figure Four Stretch',
  'Sit upright, cross ankle over opposite knee, and hinge forward until glute stretches.',
  2,
  ARRAY['glutes'],
  ARRAY['piriformis'],
  '{"piriformis":0.7}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2a24669d-1f78-4702-be92-ce87ecfa27be',
  'Seated Hamstring Stretch',
  'Sit with one or both legs extended. Hinge forward from hips until hamstrings stretch.',
  2,
  ARRAY['hamstrings'],
  ARRAY['calves', 'lower_back'],
  '{"calves":0.3,"lower_back":0.2}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '926450b8-c060-40d2-878c-72f98c750c11',
  'Seated Shoulder Press (Barbell)',
  'Sit with bar at upper chest. Press overhead without excessive back arch, then lower with control.',
  8,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'lateral_deltoids', 'upper_chest'],
  '{"triceps":0.7,"lateral_deltoids":0.6,"upper_chest":0.3}'::jsonb,
  false,
  35,
  60,
  false,
  ARRAY['barbell', 'bench'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '11800578-57ee-46d2-bc34-322e2635fea8',
  'Seated Spinal Twist',
  'Sit tall, cross one leg, and rotate torso toward bent knee while breathing steadily.',
  2,
  ARRAY['obliques'],
  ARRAY['upper_back', 'glutes'],
  '{"upper_back":0.4,"glutes":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '881e284e-3b56-40a6-9a3a-939989814d3c',
  'Shoulder Press (Dumbbell)',
  'Sit or stand with dumbbells at shoulder height. Press overhead, then lower under control.',
  8,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'lateral_deltoids', 'upper_chest'],
  '{"triceps":0.7,"lateral_deltoids":0.6,"upper_chest":0.3}'::jsonb,
  false,
  15,
  55,
  false,
  ARRAY['dumbbells'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '974ee42a-9023-46f2-87fa-ed984c52f0e8',
  'Side-Lying Quad Stretch',
  'Lie on side, grasp top ankle, and draw heel toward glute for a quad stretch.',
  2,
  ARRAY['quads'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7e105e66-da83-425b-965e-1d9de304eb52',
  'Single-Arm Cable Row',
  'Sit or stand holding one cable handle. Pull elbow back toward ribs, then return with control.',
  6,
  ARRAY['lats'],
  ARRAY['upper_back', 'biceps', 'obliques'],
  '{"upper_back":0.6,"biceps":0.5,"obliques":0.4}'::jsonb,
  true,
  15,
  45,
  false,
  ARRAY['cable_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '39a4fdb7-37a0-4d12-bb15-3a7948baa9f5',
  'Single-Arm Cable Tricep Pushdown',
  'Use one cable handle. Extend elbow downward, pause, then return without moving upper arm.',
  4,
  ARRAY['triceps'],
  ARRAY[]::text[],
  '{}'::jsonb,
  true,
  15,
  35,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'fe5b7b13-51b9-424d-99df-9e8bc7b34f91',
  'Single-Arm Dumbbell Row',
  'Support one hand and knee on bench. Row dumbbell toward hip, then lower fully.',
  7,
  ARRAY['lats'],
  ARRAY['upper_back', 'biceps', 'forearms', 'obliques'],
  '{"upper_back":0.6,"biceps":0.5,"forearms":0.4,"obliques":0.3}'::jsonb,
  true,
  15,
  50,
  false,
  ARRAY['dumbbell', 'bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '26004375-2057-45c2-bb55-91f309765417',
  'Single-Arm Landmine Press',
  'Stand with landmine bar at one shoulder. Press up and forward with one arm while resisting rotation.',
  7,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'obliques', 'serratus_anterior'],
  '{"triceps":0.6,"upper_chest":0.5,"obliques":0.5,"serratus_anterior":0.4}'::jsonb,
  true,
  20,
  45,
  false,
  ARRAY['barbell', 'landmine_attachment'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cf2babda-ec9f-47ff-b7e8-6f31da398995',
  'Single-Leg Glute Bridge',
  'Lie on back with one foot planted. Lift hips using one leg, squeeze glute, then lower.',
  5,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'glute_medius', 'abs'],
  '{"hamstrings":0.5,"glute_medius":0.4,"abs":0.3}'::jsonb,
  true,
  5,
  40,
  false,
  ARRAY[]::text[],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '380a739d-58da-477b-841a-4e472968a4b8',
  'Single-Leg Romanian Deadlift',
  'Stand on one leg holding weight. Hinge forward while back leg reaches behind, then return upright.',
  8,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'glute_medius', 'lower_back', 'forearms'],
  '{"glutes":0.8,"glute_medius":0.5,"lower_back":0.4,"forearms":0.3}'::jsonb,
  true,
  10,
  55,
  false,
  ARRAY['dumbbells'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '583deca0-aa12-48cb-9dfa-e3fd9c419aa1',
  'Sissy Squat',
  'Keep hips extended while knees travel forward. Lower with control and return by extending knees.',
  7,
  ARRAY['quads'],
  ARRAY['abs', 'hip_flexors'],
  '{"abs":0.4,"hip_flexors":0.3}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['sissy_squat_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ba298c2c-28c0-4f2a-9995-3ba5280cf788',
  'Sled Pull',
  'Attach straps to sled and walk backward or forward pulling sled under control.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'upper_back', 'forearms'],
  '{"glutes":0.6,"hamstrings":0.5,"upper_back":0.4,"forearms":0.4}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['sled', 'straps'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0ac5bbe0-da64-470f-bacb-bced11b31ac6',
  'Sled Push',
  'Push sled handles forward with strong leg drive and braced torso.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'calves', 'hamstrings', 'abs'],
  '{"glutes":0.7,"calves":0.5,"hamstrings":0.4,"abs":0.4}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['sled'],
  'squat',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b66954d5-d47f-4c3b-98f1-0de10b1ad31e',
  'Smith Machine Squat',
  'Position bar on upper back in Smith machine. Squat down and press up through feet.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings'],
  '{"glutes":0.6,"hamstrings":0.3}'::jsonb,
  false,
  25,
  60,
  false,
  ARRAY['smith_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'daf6c925-7517-486e-9fb3-8d060eea0099',
  'Soleus Wall Stretch',
  'Stand facing wall with back knee bent and heel down. Lean forward to stretch lower calf.',
  2,
  ARRAY['soleus'],
  ARRAY['calves'],
  '{"calves":0.4}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY['wall'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '84cca32e-0040-4433-8dce-58b92dbaec5c',
  'Sphinx Stretch',
  'Lie face-down on forearms and gently lift chest while hips stay on floor.',
  2,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'lower_back'],
  '{"hip_flexors":0.3,"lower_back":0.2}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '36d861e0-201d-48f3-a96a-fcfdf3b2f94d',
  'Spider Curl',
  'Lie chest-down on an incline bench. Curl dumbbells or bar upward, then lower fully.',
  5,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['dumbbells', 'incline_bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4b11dacc-bdc0-42d4-b50f-ca2a0d05d148',
  'Split Squat',
  'Stand in split stance. Lower back knee toward floor, then drive through front foot to stand.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.7,"hamstrings":0.3,"calves":0.2}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ec80973c-915e-4db9-83d3-8e419ee23ac9',
  'Squat Jump',
  'Lower into a squat, jump upward explosively, land softly, and repeat.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'calves', 'hamstrings'],
  '{"glutes":0.7,"calves":0.6,"hamstrings":0.4}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'squat',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a3dfa149-7873-4725-804c-a303e1bfb9e6',
  'Squat Pry',
  'Hold deep squat and gently shift side to side or press knees outward with elbows.',
  3,
  ARRAY['adductors'],
  ARRAY['glutes', 'calves', 'tibialis_anterior'],
  '{"glutes":0.4,"calves":0.3,"tibialis_anterior":0.3}'::jsonb,
  false,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd0a086cd-231b-4151-bf6a-b1a123ea3ace',
  'Stair Climber',
  'Step continuously on stair climber while keeping torso tall and controlled foot placement.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.6,"hamstrings":0.3,"calves":0.4}'::jsonb,
  false,
  15,
  300,
  true,
  ARRAY['stair_climber'],
  'cardio',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1a61010a-a759-49cc-8f13-d0960e29d432',
  'Standing Cable Chest Press',
  'Stand staggered between cable handles. Press handles forward from chest height while bracing core.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.5,"anterior_deltoids":0.5,"abs":0.4}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['cable_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b91842fe-7049-4054-a732-3efede40289f',
  'Standing Calf Raise',
  'Stand with balls of feet on platform. Raise heels high, pause, then lower into stretch.',
  5,
  ARRAY['calves'],
  ARRAY['soleus'],
  '{"soleus":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['standing_calf_raise_machine'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9e5e4ffe-df28-4f39-9b5a-475513117c2a',
  'Standing Hamstring Stretch',
  'Stand tall, place one heel forward, hinge at hips, and hold a gentle hamstring stretch.',
  2,
  ARRAY['hamstrings'],
  ARRAY['calves'],
  '{"calves":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'be2bc218-fb50-4d9f-b020-bbee4ee9e32f',
  'Standing Lat Stretch',
  'Hold a rack or post, sit hips back, and lean away until side/back stretches.',
  2,
  ARRAY['lats'],
  ARRAY['obliques', 'upper_back'],
  '{"obliques":0.3,"upper_back":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY['squat_rack'],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '41c714b8-2f7f-484d-86bb-851c90fdea4a',
  'Standing Leg Curl',
  'Use standing leg curl machine. Curl heel toward glute, pause, then lower slowly.',
  4,
  ARRAY['hamstrings'],
  ARRAY['calves'],
  '{"calves":0.2}'::jsonb,
  true,
  15,
  35,
  false,
  ARRAY['leg_curl_machine'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '92c7e16a-49ec-4ddb-b5eb-397c836f1dc6',
  'Standing Quad Stretch',
  'Stand on one leg and pull opposite heel toward glute while keeping knees close.',
  2,
  ARRAY['quads'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.3}'::jsonb,
  true,
  5,
  40,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f35aafdd-dd08-47e9-bafc-e16704c60488',
  'Stationary Bike',
  'Pedal on stationary bike at chosen resistance while keeping a smooth cadence.',
  6,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.4,"hamstrings":0.4,"calves":0.3}'::jsonb,
  false,
  15,
  300,
  true,
  ARRAY['stationary_bike'],
  'cardio',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4bdce0a6-d640-4445-aca9-b9779a4b03b1',
  'Step Up',
  'Place one foot on a box or bench. Drive through front foot to stand tall, then step down.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves'],
  '{"glutes":0.7,"hamstrings":0.3,"calves":0.3}'::jsonb,
  true,
  10,
  50,
  false,
  ARRAY['box', 'dumbbells'],
  'lunge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ab2019ee-2304-41b1-97d0-25c9fd863ee2',
  'Stiff-Leg Deadlift',
  'Hold bar with minimal knee bend. Hinge at hips until hamstrings stretch, then stand tall.',
  8,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'lower_back', 'forearms'],
  '{"glutes":0.7,"lower_back":0.6,"forearms":0.4}'::jsonb,
  false,
  35,
  70,
  false,
  ARRAY['barbell'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '229fa8d4-1a4a-4737-a6ad-a4df4b308e72',
  'Stir the Pot',
  'Place forearms on stability ball in plank. Move elbows in small circles while bracing core.',
  6,
  ARRAY['abs'],
  ARRAY['obliques', 'anterior_deltoids', 'lats'],
  '{"obliques":0.6,"anterior_deltoids":0.3,"lats":0.3}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['stability_ball'],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'bab6dded-6bd1-4ae6-a428-666f999d738b',
  'Straight-Arm Pulldown',
  'Stand facing high cable. Pull straight arms down toward thighs, then return slowly.',
  5,
  ARRAY['lats'],
  ARRAY['triceps', 'abs', 'serratus_anterior'],
  '{"triceps":0.3,"abs":0.3,"serratus_anterior":0.3}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['cable_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '12c8a2e7-3dda-4d2c-af2d-35984430cb58',
  'Suitcase Carry',
  'Hold one heavy weight at side. Walk tall while resisting leaning toward the weight.',
  6,
  ARRAY['obliques'],
  ARRAY['forearms', 'traps', 'glutes'],
  '{"forearms":0.7,"traps":0.4,"glutes":0.3}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY['dumbbell', 'kettlebell'],
  'carry',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '08234240-6b8a-4b6e-ba15-0295b020e444',
  'Sumo Deadlift',
  'Use a wide stance with hands inside knees. Pull bar from floor by driving hips forward and standing tall.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'quads', 'lower_back', 'forearms', 'adductors'],
  '{"hamstrings":0.7,"quads":0.6,"lower_back":0.6,"forearms":0.5,"adductors":0.6}'::jsonb,
  false,
  45,
  90,
  false,
  ARRAY['barbell'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2d980773-4faf-4088-9c26-3c88607b0ef3',
  'Sumo Squat',
  'Stand with wide stance and toes turned out. Squat down between legs, then stand tall.',
  7,
  ARRAY['glutes'],
  ARRAY['quads', 'adductors', 'hamstrings'],
  '{"quads":0.6,"adductors":0.7,"hamstrings":0.3}'::jsonb,
  false,
  10,
  50,
  false,
  ARRAY['dumbbell', 'kettlebell'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f3d2fb8a-8efc-41b3-a3b6-2e865f6ca9ae',
  'Svend Press',
  'Hold a plate between palms at chest height. Press forward while squeezing the plate, then pull back.',
  4,
  ARRAY['chest'],
  ARRAY['anterior_deltoids', 'triceps'],
  '{"anterior_deltoids":0.4,"triceps":0.4}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['weight_plate'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '834a9f3a-09ef-40c0-9ae9-925aef55974b',
  'T-Bar Row',
  'Straddle a T-bar or landmine row handle. Pull weight toward lower chest, then lower with control.',
  8,
  ARRAY['upper_back'],
  ARRAY['lats', 'biceps', 'lower_back', 'forearms'],
  '{"lats":0.7,"biceps":0.5,"lower_back":0.5,"forearms":0.4}'::jsonb,
  false,
  25,
  60,
  false,
  ARRAY['barbell', 'landmine_attachment'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '79b0206d-bb0d-45dc-8596-115cca39caea',
  'Thoracic Open Book',
  'Lie on side with knees bent. Rotate top arm open across body and follow with eyes.',
  3,
  ARRAY['upper_back'],
  ARRAY['chest', 'obliques'],
  '{"chest":0.4,"obliques":0.4}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8eacb3be-46dc-4ce0-9371-0c8af3ca7b01',
  'Thread the Needle Stretch',
  'From hands and knees, slide one arm under body and rotate chest toward floor.',
  2,
  ARRAY['upper_back'],
  ARRAY['posterior_deltoids', 'traps'],
  '{"posterior_deltoids":0.3,"traps":0.3}'::jsonb,
  true,
  5,
  45,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8b96be65-b934-4ae6-b069-35bacf036ff2',
  'Tibialis Raise',
  'Lean against wall with heels down. Lift toes toward shins, pause, then lower.',
  3,
  ARRAY['tibialis_anterior'],
  ARRAY['calves'],
  '{"calves":0.2}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a26d099a-039d-4781-b676-3b92b9cebfb2',
  'Toe Touch Crunch',
  'Lie on back with legs raised. Reach hands toward toes by curling shoulders upward.',
  4,
  ARRAY['abs'],
  ARRAY['hip_flexors'],
  '{"hip_flexors":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'anti-rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '904e5da7-bc2f-482c-9d6c-4eac27302197',
  'Trap Bar Deadlift',
  'Stand inside trap bar. Push floor away and stand tall, then lower with hips and knees bending.',
  9,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'lower_back', 'forearms'],
  '{"quads":0.7,"hamstrings":0.6,"lower_back":0.5,"forearms":0.5}'::jsonb,
  false,
  40,
  90,
  false,
  ARRAY['trap_bar'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f0fe812a-9cb4-44e0-8281-a98e2e4c2537',
  'Trap Bar Shrug',
  'Stand inside trap bar and hold handles. Shrug shoulders up, pause, and lower with control.',
  5,
  ARRAY['traps'],
  ARRAY['forearms', 'upper_back'],
  '{"forearms":0.4,"upper_back":0.3}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['trap_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8609c07a-dac4-469c-9bc0-d064ab4646c9',
  'Treadmill Run',
  'Run on treadmill at chosen speed while maintaining upright posture and steady cadence.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'hip_flexors'],
  '{"glutes":0.5,"hamstrings":0.5,"calves":0.6,"hip_flexors":0.4}'::jsonb,
  false,
  15,
  300,
  true,
  ARRAY['treadmill'],
  'cardio',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '565f96ac-6574-47ac-8041-c1668bc8158e',
  'Tricep Extension Machine',
  'Sit at tricep machine with elbows on pad. Extend arms, then return with control.',
  5,
  ARRAY['triceps'],
  ARRAY[]::text[],
  '{}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['tricep_extension_machine'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1d82db75-ea25-43b0-a119-358976655217',
  'Tricep Rope Pushdown',
  'Attach rope to high cable. Extend elbows down and apart, then return with control.',
  5,
  ARRAY['triceps'],
  ARRAY[]::text[],
  '{}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['cable_machine', 'rope_attachment'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1dc191bd-c7bf-4723-a57f-3b6eca3a925c',
  'TRX Row',
  'Hold suspension handles and lean back. Pull chest toward handles, then lower with a straight body.',
  6,
  ARRAY['upper_back'],
  ARRAY['lats', 'biceps', 'posterior_deltoids', 'abs'],
  '{"lats":0.5,"biceps":0.5,"posterior_deltoids":0.5,"abs":0.3}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['suspension_trainer'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a40489b7-ccdf-4792-a1d5-44ade14d9a3c',
  'Turkish Get-Up',
  'Move from lying to standing while holding a weight overhead, then reverse the sequence.',
  8,
  ARRAY['abs'],
  ARRAY['obliques', 'anterior_deltoids', 'triceps', 'glutes', 'rotator_cuff'],
  '{"obliques":0.6,"anterior_deltoids":0.5,"triceps":0.4,"glutes":0.5,"rotator_cuff":0.5}'::jsonb,
  true,
  15,
  90,
  false,
  ARRAY['kettlebell', 'dumbbell'],
  'carry',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '117f1484-b0b9-43fe-b1cf-f73acd79db27',
  'Upper Trap Stretch',
  'Sit tall, gently tilt head to one side, and hold stretch along side of neck.',
  2,
  ARRAY['traps'],
  ARRAY['traps'],
  '{"traps":0.5}'::jsonb,
  true,
  5,
  30,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9cf81a91-93c1-4393-8a46-233248e10b32',
  'Upright Row',
  'Hold bar or dumbbells in front. Pull elbows upward to chest height, then lower carefully.',
  5,
  ARRAY['lateral_deltoids'],
  ARRAY['traps', 'biceps', 'forearms'],
  '{"traps":0.6,"biceps":0.3,"forearms":0.3}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['barbell', 'dumbbells'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c7271908-bbab-41e1-b0f2-50a0f824c417',
  'Wall Ball Shot',
  'Hold medicine ball at chest, squat, then explosively stand and throw ball to wall target.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'anterior_deltoids', 'triceps', 'abs'],
  '{"glutes":0.6,"anterior_deltoids":0.6,"triceps":0.4,"abs":0.4}'::jsonb,
  false,
  10,
  45,
  false,
  ARRAY['medicine_ball', 'wall'],
  'squat',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd26da3bc-c4f8-4920-a60b-6d59221ba257',
  'Wall Sit',
  'Lean back against wall and slide down until knees are bent. Hold the seated position for time.',
  5,
  ARRAY['quads'],
  ARRAY['glutes', 'calves'],
  '{"glutes":0.4,"calves":0.2}'::jsonb,
  false,
  5,
  45,
  true,
  ARRAY[]::text[],
  'squat',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '83aaf3bf-2829-4e54-b185-3b1581c08f43',
  'Wide Push Up',
  'Set hands wider than shoulders. Lower chest toward floor and press up, emphasizing chest.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.4,"anterior_deltoids":0.5,"abs":0.3}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '05052e71-f34d-4f4a-adc7-d9afdd15891e',
  'Wide-Grip Lat Pulldown',
  'Grip pulldown bar wide. Pull bar to upper chest while driving elbows down, then return slowly.',
  7,
  ARRAY['lats'],
  ARRAY['biceps', 'upper_back', 'forearms'],
  '{"biceps":0.5,"upper_back":0.5,"forearms":0.3}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['lat_pulldown_machine'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '893246be-1790-403c-ab09-5079856cf379',
  'Windshield Wiper',
  'Hang from bar or lie on floor. Rotate legs side to side while controlling the torso.',
  8,
  ARRAY['obliques'],
  ARRAY['abs', 'lats', 'hip_flexors'],
  '{"abs":0.7,"lats":0.4,"hip_flexors":0.5}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['pull_up_bar'],
  'rotation',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ba273e3e-0114-4137-9aba-96a9f38fee97',
  'World''s Greatest Stretch',
  'Step into deep lunge, place hands down, rotate chest toward front leg, and repeat.',
  3,
  ARRAY['hip_flexors'],
  ARRAY['hamstrings', 'glutes', 'upper_back', 'adductors'],
  '{"hamstrings":0.4,"glutes":0.4,"upper_back":0.4,"adductors":0.3}'::jsonb,
  true,
  5,
  60,
  true,
  ARRAY[]::text[],
  'stretch',
  'controlled',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '541e66ae-4d8f-44fe-ab97-bb27a5698675',
  'Wrist Curl',
  'Rest forearms on bench with palms up. Curl wrists upward, then lower slowly.',
  3,
  ARRAY['forearms'],
  ARRAY[]::text[],
  '{}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['dumbbells', 'bench'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '6403bed0-6695-4c72-8e9a-0d3ac9425192',
  'Wrist Extensor Stretch',
  'Extend arm with palm down and gently pull fingers toward body to stretch top forearm.',
  2,
  ARRAY['forearms'],
  ARRAY[]::text[],
  '{}'::jsonb,
  true,
  5,
  30,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '11f0aec2-e244-402f-bbc9-f25a38f5066e',
  'Wrist Flexor Stretch',
  'Extend arm with palm up and gently pull fingers downward/back with opposite hand.',
  2,
  ARRAY['forearms'],
  ARRAY[]::text[],
  '{}'::jsonb,
  true,
  5,
  30,
  true,
  ARRAY[]::text[],
  'stretch',
  'isometric',
  true
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1c0acebf-74d6-47ef-a83e-4620bfe8d7cb',
  'Z Press',
  'Sit on floor with legs straight and bar at shoulders. Press overhead while keeping torso upright.',
  8,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'abs', 'lower_back'],
  '{"triceps":0.7,"abs":0.6,"lower_back":0.4}'::jsonb,
  false,
  30,
  50,
  false,
  ARRAY['barbell'],
  'push',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a8b4da16-0ba1-4675-bb45-6cf2d0cf2216',
  'Zercher Squat',
  'Hold bar in crooks of elbows. Squat with upright torso, then drive up through feet.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'upper_back', 'abs', 'biceps'],
  '{"glutes":0.7,"upper_back":0.6,"abs":0.6,"biceps":0.2}'::jsonb,
  false,
  40,
  70,
  false,
  ARRAY['barbell', 'squat_rack'],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4a32d1cb-ad2d-437e-a587-80571aaf575d',
  'Zottman Curl',
  'Curl dumbbells up with palms up, rotate palms down, then lower under control.',
  5,
  ARRAY['biceps'],
  ARRAY['forearms'],
  '{"forearms":0.6}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['dumbbells'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9aed3a55-f8f0-4155-8ac2-c3e9802bc36b',
  'Bar Muscle-Up',
  'Pull explosively over a straight bar and press to support with controlled turnover.',
  9,
  ARRAY['lats'],
  ARRAY['biceps', 'triceps', 'chest', 'anterior_deltoids', 'abs'],
  '{"biceps":0.7,"triceps":0.7,"chest":0.6,"anterior_deltoids":0.6,"abs":0.5}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ba4345c3-1837-44c8-912e-6b9f447470a1',
  'Ring Muscle-Up',
  'Pull from rings into a deep transition, then press to a stable ring support.',
  10,
  ARRAY['lats'],
  ARRAY['biceps', 'triceps', 'chest', 'anterior_deltoids', 'abs'],
  '{"biceps":0.8,"triceps":0.8,"chest":0.7,"anterior_deltoids":0.7,"abs":0.6}'::jsonb,
  false,
  30,
  50,
  false,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '69d7f21c-24a7-4fa8-abf9-30ef23432c61',
  'Strict Muscle-Up',
  'Perform a muscle-up without leg drive, emphasizing pulling strength and a smooth transition.',
  10,
  ARRAY['lats'],
  ARRAY['biceps', 'triceps', 'chest', 'anterior_deltoids', 'abs'],
  '{"biceps":0.8,"triceps":0.7,"chest":0.6,"anterior_deltoids":0.6,"abs":0.6}'::jsonb,
  false,
  25,
  50,
  false,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd20ec4f5-0c88-4293-b1d9-3c4ce122fa6f',
  'Kipping Muscle-Up',
  'Use coordinated hip drive to assist the pull and transition over the bar or rings.',
  8,
  ARRAY['lats'],
  ARRAY['biceps', 'triceps', 'chest', 'abs', 'hip_flexors'],
  '{"biceps":0.6,"triceps":0.6,"chest":0.5,"abs":0.5,"hip_flexors":0.4}'::jsonb,
  false,
  25,
  45,
  false,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '810a91dd-2952-428f-a9a6-cc93d392ecc5',
  'Tuck Planche Hold',
  'Hold a tucked planche position with locked arms, protracted shoulders, and hips lifted.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['chest', 'triceps', 'abs', 'serratus_anterior'],
  '{"chest":0.6,"triceps":0.7,"abs":0.8,"serratus_anterior":0.7}'::jsonb,
  false,
  15,
  30,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '21a71032-b97e-47d7-a455-f1c996c164c1',
  'Advanced Tuck Planche Hold',
  'Hold a planche progression with knees tucked but hips extended farther behind the body.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['chest', 'triceps', 'abs', 'serratus_anterior'],
  '{"chest":0.7,"triceps":0.8,"abs":0.8,"serratus_anterior":0.7}'::jsonb,
  false,
  15,
  30,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b42788f5-ab26-492e-b42d-3b8bc37ef1c6',
  'Straddle Planche Hold',
  'Hold a straddle planche with straight arms and legs spread to reduce leverage demand.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['chest', 'triceps', 'abs', 'glutes', 'serratus_anterior'],
  '{"chest":0.7,"triceps":0.8,"abs":0.9,"glutes":0.4,"serratus_anterior":0.7}'::jsonb,
  false,
  20,
  25,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c6cb4d82-0ef7-4fd8-a25c-cd0e66dbe9ca',
  'Full Planche Hold',
  'Hold a full planche with straight arms and body parallel to the floor.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['chest', 'triceps', 'abs', 'glutes', 'serratus_anterior'],
  '{"chest":0.8,"triceps":0.8,"abs":0.9,"glutes":0.5,"serratus_anterior":0.8}'::jsonb,
  false,
  25,
  20,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c8779855-4f09-4b66-85ff-8aee01858a0f',
  'Planche Lean',
  'Lean shoulders forward past hands while keeping arms straight and body hollow.',
  6,
  ARRAY['anterior_deltoids'],
  ARRAY['chest', 'triceps', 'abs', 'serratus_anterior'],
  '{"chest":0.4,"triceps":0.5,"abs":0.6,"serratus_anterior":0.5}'::jsonb,
  false,
  10,
  35,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1c5faf83-d807-4835-b6cf-277f53844bf6',
  'Planche Push-Up',
  'Lower and press from a planche position while maintaining forward lean and body tension.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['chest', 'triceps', 'abs', 'serratus_anterior'],
  '{"chest":0.8,"triceps":0.8,"abs":0.9,"serratus_anterior":0.7}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b5a15da9-5036-408c-be21-73d0f51f5332',
  'Tuck Front Lever Hold',
  'Hang from a bar with knees tucked and torso held nearly horizontal.',
  8,
  ARRAY['lats'],
  ARRAY['abs', 'biceps', 'posterior_deltoids', 'lower_back'],
  '{"abs":0.8,"biceps":0.5,"posterior_deltoids":0.5,"lower_back":0.4}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'da32c117-6665-4d6e-b439-eb988d06b2c1',
  'Advanced Tuck Front Lever Hold',
  'Hold a front lever progression with knees tucked and hips opened farther from the body.',
  9,
  ARRAY['lats'],
  ARRAY['abs', 'biceps', 'posterior_deltoids', 'lower_back'],
  '{"abs":0.9,"biceps":0.5,"posterior_deltoids":0.5,"lower_back":0.5}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e61824f2-c7a6-424a-a1ae-1eb80f470049',
  'Straddle Front Lever Hold',
  'Hold a front lever with legs straight and straddled to reduce leverage demand.',
  10,
  ARRAY['lats'],
  ARRAY['abs', 'biceps', 'posterior_deltoids', 'glutes', 'lower_back'],
  '{"abs":0.9,"biceps":0.5,"posterior_deltoids":0.6,"glutes":0.3,"lower_back":0.5}'::jsonb,
  false,
  15,
  25,
  true,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '73b8a7da-1e72-4b61-a20f-e219a692a7b7',
  'Full Front Lever Hold',
  'Hold a straight-body front lever with body parallel to the floor.',
  10,
  ARRAY['lats'],
  ARRAY['abs', 'biceps', 'posterior_deltoids', 'glutes', 'lower_back'],
  '{"abs":0.9,"biceps":0.6,"posterior_deltoids":0.6,"glutes":0.4,"lower_back":0.5}'::jsonb,
  false,
  15,
  20,
  true,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '42410c52-63ea-4930-9b6c-aa58181e26d1',
  'Front Lever Raise',
  'Raise from a dead hang toward a front lever while keeping the body tight and controlled.',
  9,
  ARRAY['lats'],
  ARRAY['abs', 'biceps', 'posterior_deltoids', 'hip_flexors'],
  '{"abs":0.8,"biceps":0.5,"posterior_deltoids":0.6,"hip_flexors":0.4}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'ebd57b00-87a2-4c80-a290-562106344f12',
  'Front Lever Row',
  'Row the chest toward the bar while holding a front lever progression.',
  10,
  ARRAY['lats'],
  ARRAY['biceps', 'posterior_deltoids', 'abs', 'lower_back'],
  '{"biceps":0.7,"posterior_deltoids":0.7,"abs":0.8,"lower_back":0.4}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'bd2ba59d-2099-4079-9eca-18cd4743eac5',
  'Ice Cream Maker',
  'Move between a pull-up top position and a front lever position under control.',
  10,
  ARRAY['lats'],
  ARRAY['biceps', 'abs', 'posterior_deltoids', 'lower_back'],
  '{"biceps":0.7,"abs":0.8,"posterior_deltoids":0.6,"lower_back":0.4}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['pull_up_bar'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '29fbb75a-deed-4c07-b8e6-68094204a859',
  'Back Lever Hold',
  'Hold a straight-body back lever with arms extended and body parallel to the floor.',
  9,
  ARRAY['chest'],
  ARRAY['anterior_deltoids', 'biceps', 'abs', 'glutes', 'lower_back'],
  '{"anterior_deltoids":0.7,"biceps":0.5,"abs":0.7,"glutes":0.4,"lower_back":0.5}'::jsonb,
  false,
  15,
  25,
  true,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4f4ff313-005f-4466-8d77-f54e0bfd33e8',
  'Tuck Back Lever Hold',
  'Hold a tucked back lever progression with shoulders extended and hips lifted.',
  7,
  ARRAY['chest'],
  ARRAY['anterior_deltoids', 'biceps', 'abs', 'lower_back'],
  '{"anterior_deltoids":0.6,"biceps":0.4,"abs":0.6,"lower_back":0.4}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '84b2efad-8e04-4f06-8f63-f66b66d6cba3',
  'Skin the Cat',
  'Rotate through the rings or bar from hang to inverted hang and back with control.',
  6,
  ARRAY['lats'],
  ARRAY['chest', 'anterior_deltoids', 'abs', 'biceps'],
  '{"chest":0.5,"anterior_deltoids":0.5,"abs":0.6,"biceps":0.3}'::jsonb,
  false,
  15,
  45,
  false,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2be51032-3b16-4d7a-84a2-2a94d1c3d659',
  'German Hang Pull-Out',
  'Pull from a German hang back toward an inverted or support position with control.',
  8,
  ARRAY['lats'],
  ARRAY['chest', 'biceps', 'posterior_deltoids', 'abs'],
  '{"chest":0.5,"biceps":0.6,"posterior_deltoids":0.5,"abs":0.5}'::jsonb,
  false,
  15,
  40,
  false,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3630a54d-07a5-424b-ac07-2bb58557ba22',
  'Human Flag Hold',
  'Hold the body sideways from a vertical pole with stacked hands and full-body tension.',
  10,
  ARRAY['obliques'],
  ARRAY['lats', 'anterior_deltoids', 'triceps', 'glutes', 'abs'],
  '{"lats":0.8,"anterior_deltoids":0.6,"triceps":0.5,"glutes":0.5,"abs":0.8}'::jsonb,
  true,
  20,
  20,
  true,
  ARRAY['vertical_pole'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b857b70b-91fa-4934-97be-eb587b4ac3f7',
  'Tuck Human Flag Hold',
  'Hold a tucked human flag progression with knees pulled in to reduce leverage demand.',
  8,
  ARRAY['obliques'],
  ARRAY['lats', 'anterior_deltoids', 'triceps', 'abs'],
  '{"lats":0.7,"anterior_deltoids":0.5,"triceps":0.4,"abs":0.7}'::jsonb,
  true,
  15,
  25,
  true,
  ARRAY['vertical_pole'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '87fbf030-0e1f-4fc6-9591-0d73ef980b30',
  'Human Flag Raise',
  'Raise and lower the body into a human flag progression with controlled side-body tension.',
  10,
  ARRAY['obliques'],
  ARRAY['lats', 'anterior_deltoids', 'triceps', 'abs', 'glutes'],
  '{"lats":0.8,"anterior_deltoids":0.6,"triceps":0.5,"abs":0.8,"glutes":0.4}'::jsonb,
  true,
  20,
  35,
  false,
  ARRAY['vertical_pole'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e360d43b-e867-45ae-8e0f-b443c9f57af8',
  'Freestanding Handstand Hold',
  'Balance in a freestanding handstand while keeping elbows locked and ribs controlled.',
  8,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'traps', 'abs', 'forearms'],
  '{"triceps":0.6,"traps":0.5,"abs":0.7,"forearms":0.5}'::jsonb,
  false,
  10,
  35,
  true,
  ARRAY[]::text[],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2808dae9-25f9-47a5-9dc3-9d1301258a42',
  'Wall Handstand Hold',
  'Hold a handstand against a wall with active shoulders and a tight body line.',
  6,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'traps', 'abs', 'forearms'],
  '{"triceps":0.5,"traps":0.4,"abs":0.6,"forearms":0.3}'::jsonb,
  false,
  10,
  45,
  true,
  ARRAY['wall'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8f7e799d-55b9-4847-8944-da73abf6d48c',
  'Strict Handstand Push-Up',
  'Lower from a handstand and press back up with controlled shoulder and triceps strength.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'traps', 'abs'],
  '{"triceps":0.8,"upper_chest":0.4,"traps":0.5,"abs":0.6}'::jsonb,
  false,
  20,
  45,
  false,
  ARRAY['wall'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '50f6331b-a7d3-4ca1-a20c-c75b67a46007',
  'Deficit Handstand Push-Up',
  'Perform handstand push-ups from elevated handles for a deeper pressing range.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'traps', 'abs'],
  '{"triceps":0.8,"upper_chest":0.5,"traps":0.5,"abs":0.6}'::jsonb,
  false,
  25,
  50,
  false,
  ARRAY['parallettes', 'wall'],
  'calisthenics_skill',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c99bd637-c5b2-4193-9085-04cdf9b029e0',
  'Kipping Handstand Push-Up',
  'Use hip drive to assist the press from a handstand push-up position.',
  8,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'abs', 'hip_flexors'],
  '{"triceps":0.7,"upper_chest":0.4,"abs":0.5,"hip_flexors":0.4}'::jsonb,
  false,
  20,
  40,
  false,
  ARRAY['wall'],
  'calisthenics_skill',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cc02937a-6567-4cba-a69c-ebe3a257bbb1',
  'Ring Support Hold',
  'Hold a stable top support on rings with elbows locked and rings turned slightly out.',
  6,
  ARRAY['triceps'],
  ARRAY['chest', 'anterior_deltoids', 'abs', 'forearms'],
  '{"chest":0.5,"anterior_deltoids":0.5,"abs":0.6,"forearms":0.5}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8c63c107-4e48-421b-b077-6b30333537ac',
  'Ring Turned-Out Support Hold',
  'Hold ring support with rings turned outward to increase shoulder and stabilization demand.',
  8,
  ARRAY['triceps'],
  ARRAY['chest', 'anterior_deltoids', 'abs', 'forearms'],
  '{"chest":0.6,"anterior_deltoids":0.6,"abs":0.7,"forearms":0.6}'::jsonb,
  false,
  10,
  25,
  true,
  ARRAY['gymnastic_rings'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a01f6a82-1430-4601-9ecd-184d36711865',
  'Iron Cross Progression Hold',
  'Hold an assisted iron cross progression with arms wide and shoulders stabilized.',
  10,
  ARRAY['chest'],
  ARRAY['lats', 'biceps', 'anterior_deltoids', 'forearms', 'abs'],
  '{"lats":0.7,"biceps":0.7,"anterior_deltoids":0.6,"forearms":0.6,"abs":0.5}'::jsonb,
  false,
  25,
  20,
  true,
  ARRAY['gymnastic_rings', 'resistance_band'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '36323129-faa9-485c-a8db-735c799714a9',
  'Archer Pull-Up',
  'Pull toward one hand while the opposite arm assists in a straighter position.',
  9,
  ARRAY['lats'],
  ARRAY['biceps', 'posterior_deltoids', 'forearms', 'abs'],
  '{"biceps":0.8,"posterior_deltoids":0.5,"forearms":0.6,"abs":0.4}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c69a70b6-5a56-4d2e-93d6-a42b16dd0c36',
  'Typewriter Pull-Up',
  'Pull to the bar and shift side to side while maintaining height near the top.',
  9,
  ARRAY['lats'],
  ARRAY['biceps', 'posterior_deltoids', 'forearms', 'abs'],
  '{"biceps":0.8,"posterior_deltoids":0.6,"forearms":0.6,"abs":0.4}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '0c2c8d58-860e-4707-8281-5685a3fc2b1d',
  'One-Arm Pull-Up',
  'Pull from a one-arm hang to the bar using unilateral pulling strength.',
  10,
  ARRAY['lats'],
  ARRAY['biceps', 'forearms', 'posterior_deltoids', 'abs'],
  '{"biceps":0.9,"forearms":0.8,"posterior_deltoids":0.6,"abs":0.5}'::jsonb,
  true,
  15,
  40,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8c16863e-1b4d-4c36-b6a5-75509544e11d',
  'One-Arm Chin-Up Eccentric',
  'Lower slowly from a one-arm chin-up top position to build unilateral pulling control.',
  9,
  ARRAY['lats'],
  ARRAY['biceps', 'forearms', 'posterior_deltoids', 'abs'],
  '{"biceps":0.9,"forearms":0.8,"posterior_deltoids":0.5,"abs":0.5}'::jsonb,
  true,
  15,
  45,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'eccentric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '5b31a259-e876-40a3-88f2-46e545e332ec',
  'Explosive Pull-Up',
  'Pull rapidly so the chest rises high above the bar with control on the descent.',
  8,
  ARRAY['lats'],
  ARRAY['biceps', 'posterior_deltoids', 'forearms', 'abs'],
  '{"biceps":0.7,"posterior_deltoids":0.5,"forearms":0.5,"abs":0.4}'::jsonb,
  false,
  10,
  35,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd09a0ccd-d949-45a7-a45e-e77a9b329e40',
  'Chest-to-Bar Pull-Up',
  'Pull until the chest contacts or reaches the bar, then lower with control.',
  8,
  ARRAY['lats'],
  ARRAY['biceps', 'posterior_deltoids', 'forearms', 'abs'],
  '{"biceps":0.7,"posterior_deltoids":0.5,"forearms":0.5,"abs":0.4}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY['pull_up_bar'],
  'pull',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '196d7ac7-e5a3-4514-a829-f9c0a2b775f1',
  'L-Sit Hold',
  'Hold the body supported on hands with legs straight in front and hips lifted.',
  7,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'triceps', 'quads', 'anterior_deltoids'],
  '{"hip_flexors":0.8,"triceps":0.5,"quads":0.4,"anterior_deltoids":0.4}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e926fabd-aaac-4d40-94de-315a9f88515e',
  'V-Sit Hold',
  'Hold a compressed support position with legs lifted high and torso upright.',
  9,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'triceps', 'quads', 'anterior_deltoids'],
  '{"hip_flexors":0.9,"triceps":0.5,"quads":0.4,"anterior_deltoids":0.4}'::jsonb,
  false,
  10,
  25,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '5a9a2978-8f6f-487d-b575-2ebd0042677a',
  'Manna Progression Hold',
  'Hold an advanced compression support progression with hips lifted and legs elevated.',
  10,
  ARRAY['abs'],
  ARRAY['hip_flexors', 'triceps', 'quads', 'anterior_deltoids'],
  '{"hip_flexors":0.9,"triceps":0.6,"quads":0.4,"anterior_deltoids":0.5}'::jsonb,
  false,
  15,
  20,
  true,
  ARRAY['parallettes'],
  'calisthenics_skill',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '02702577-0c30-43e5-b01d-c1dbe6e62863',
  'Shrimp Squat',
  'Lower into a single-leg squat variation while holding the opposite foot behind the body.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'abs'],
  '{"glutes":0.7,"hamstrings":0.4,"calves":0.5,"abs":0.5}'::jsonb,
  true,
  10,
  45,
  false,
  ARRAY[]::text[],
  'squat',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '988637c4-e807-4a81-90d4-2315c33a8f4e',
  'Depth Jump',
  'Step from a box, land briefly, and jump upward explosively with minimal ground contact.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'abs'],
  '{"glutes":0.8,"hamstrings":0.5,"calves":0.8,"abs":0.4}'::jsonb,
  false,
  20,
  30,
  false,
  ARRAY['plyo_box'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '092b0136-e38f-420b-86e5-86275fa13a25',
  'Drop Jump',
  'Drop from a low box and rebound upward quickly while maintaining a stable landing position.',
  8,
  ARRAY['calves'],
  ARRAY['quads', 'glutes', 'hamstrings', 'abs'],
  '{"quads":0.7,"glutes":0.6,"hamstrings":0.4,"abs":0.4}'::jsonb,
  false,
  20,
  25,
  false,
  ARRAY['plyo_box'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e3f28858-9263-43ff-98eb-f2cc18a5bc88',
  'Broad Jump',
  'Jump forward for distance and land with knees tracking and hips controlled.',
  8,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'calves', 'abs'],
  '{"quads":0.7,"hamstrings":0.7,"calves":0.6,"abs":0.4}'::jsonb,
  false,
  10,
  30,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '615e9a8c-bb65-44f1-8845-e579309e996b',
  'Single-Leg Broad Jump',
  'Jump forward from one leg and land on the same leg with control.',
  9,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'calves', 'glute_medius', 'abs'],
  '{"quads":0.7,"hamstrings":0.6,"calves":0.7,"glute_medius":0.7,"abs":0.5}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cd6ecda4-60b9-4020-bf87-736f1f3a553f',
  'Triple Broad Jump',
  'Perform three connected forward jumps for distance while maintaining rhythm and control.',
  9,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'calves', 'abs'],
  '{"quads":0.7,"hamstrings":0.7,"calves":0.7,"abs":0.4}'::jsonb,
  false,
  10,
  40,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '180c514f-34eb-4357-8e3f-b278558f4138',
  'Lateral Bound',
  'Jump side to side from one leg to the other with strong lateral hip control.',
  8,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'quads', 'hamstrings', 'calves', 'adductors'],
  '{"glutes":0.7,"quads":0.5,"hamstrings":0.5,"calves":0.6,"adductors":0.5}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e942e00f-adf8-4389-b2b9-265b7071492d',
  'Skater Bound',
  'Bound diagonally from side to side like a speed skater, absorbing each landing.',
  7,
  ARRAY['glute_medius'],
  ARRAY['glutes', 'quads', 'hamstrings', 'calves', 'adductors'],
  '{"glutes":0.7,"quads":0.5,"hamstrings":0.5,"calves":0.5,"adductors":0.5}'::jsonb,
  true,
  5,
  35,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'b08c5c8d-fbb9-497c-8d3a-460095732b65',
  'Single-Leg Lateral Hop',
  'Hop side to side on one leg while keeping the pelvis and knee stable.',
  7,
  ARRAY['glute_medius'],
  ARRAY['quads', 'calves', 'glutes', 'abs'],
  '{"quads":0.5,"calves":0.7,"glutes":0.5,"abs":0.5}'::jsonb,
  true,
  5,
  30,
  true,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'da10d7fa-32ab-46c2-97ec-1dfae8207934',
  'Pogo Jump',
  'Bounce repeatedly from the ankles with stiff legs and quick ground contact.',
  6,
  ARRAY['calves'],
  ARRAY['quads', 'glutes', 'abs'],
  '{"quads":0.3,"glutes":0.3,"abs":0.3}'::jsonb,
  false,
  5,
  30,
  true,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '90b12c88-2a14-437c-9422-58f918d4d301',
  'Single-Leg Pogo Jump',
  'Perform quick ankle-driven hops on one leg with minimal knee bend.',
  7,
  ARRAY['calves'],
  ARRAY['quads', 'glutes', 'glute_medius', 'abs'],
  '{"quads":0.3,"glutes":0.3,"glute_medius":0.5,"abs":0.4}'::jsonb,
  true,
  5,
  30,
  true,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'da459472-c5c3-47e6-9ad2-8e6599b86333',
  'Tuck Jump',
  'Jump vertically and pull knees toward the chest before landing in a stable position.',
  8,
  ARRAY['quads'],
  ARRAY['hip_flexors', 'glutes', 'hamstrings', 'calves', 'abs'],
  '{"hip_flexors":0.6,"glutes":0.6,"hamstrings":0.4,"calves":0.6,"abs":0.5}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1d759165-6993-4e61-b924-41f25d815221',
  'Countermovement Jump',
  'Dip quickly and jump vertically using an explosive countermovement.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'abs'],
  '{"glutes":0.7,"hamstrings":0.5,"calves":0.6,"abs":0.3}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c90e3d1f-6870-466b-a002-f6b332b694e6',
  'Split Squat Jump',
  'Jump from a split stance and land back in the same split stance.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'hip_flexors'],
  '{"glutes":0.7,"hamstrings":0.4,"calves":0.6,"hip_flexors":0.4}'::jsonb,
  true,
  5,
  35,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '528d7c0a-1ec6-44ca-ac78-4eec4f355370',
  'Jump Lunge',
  'Switch legs in the air from a lunge position and land with control.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'hip_flexors'],
  '{"glutes":0.7,"hamstrings":0.4,"calves":0.6,"hip_flexors":0.4}'::jsonb,
  true,
  5,
  35,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9708a7b6-2d52-4eb2-bfb5-f727f39bf19c',
  'Box Jump Over',
  'Jump onto or over a box and land with control before resetting or cycling reps.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'abs'],
  '{"glutes":0.7,"hamstrings":0.5,"calves":0.6,"abs":0.4}'::jsonb,
  false,
  20,
  35,
  false,
  ARRAY['plyo_box'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '480c9bb4-47c4-421d-9c8b-afbdf8597860',
  'Lateral Box Jump',
  'Jump sideways onto a box and land with hips and knees stable.',
  8,
  ARRAY['glute_medius'],
  ARRAY['quads', 'glutes', 'hamstrings', 'calves', 'abs'],
  '{"quads":0.6,"glutes":0.7,"hamstrings":0.4,"calves":0.6,"abs":0.4}'::jsonb,
  true,
  20,
  35,
  false,
  ARRAY['plyo_box'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '105060d8-7c1f-4e12-8484-27e48e38b73e',
  'Hurdle Hop',
  'Hop over low hurdles in sequence with quick, elastic ground contact.',
  8,
  ARRAY['calves'],
  ARRAY['quads', 'glutes', 'hamstrings', 'abs'],
  '{"quads":0.5,"glutes":0.5,"hamstrings":0.4,"abs":0.4}'::jsonb,
  false,
  25,
  35,
  false,
  ARRAY['hurdles'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f4712895-83b3-42d5-aec8-003216e5305b',
  'Lateral Hurdle Hop',
  'Hop side to side over a hurdle while maintaining quick rebound mechanics.',
  8,
  ARRAY['calves'],
  ARRAY['glute_medius', 'quads', 'glutes', 'abs'],
  '{"glute_medius":0.6,"quads":0.5,"glutes":0.5,"abs":0.5}'::jsonb,
  true,
  25,
  35,
  false,
  ARRAY['hurdles'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2c1555f2-4f66-408f-b3f9-e859841a45b8',
  'Cone Hop',
  'Hop over a cone forward, backward, or laterally with quick foot contacts.',
  6,
  ARRAY['calves'],
  ARRAY['quads', 'glutes', 'glute_medius', 'abs'],
  '{"quads":0.4,"glutes":0.4,"glute_medius":0.4,"abs":0.4}'::jsonb,
  false,
  10,
  30,
  true,
  ARRAY['cones'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2e80512c-e151-4f33-adad-535a6012007b',
  '180-Degree Jump',
  'Jump and rotate 180 degrees in the air, then land balanced and controlled.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'calves', 'obliques', 'abs'],
  '{"glutes":0.6,"calves":0.5,"obliques":0.6,"abs":0.4}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '569700e8-898d-43df-ad8d-4152a66049f8',
  'Kneeling Jump',
  'Start from tall kneeling and explosively jump to a squat landing.',
  8,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'calves', 'abs'],
  '{"quads":0.7,"hamstrings":0.6,"calves":0.4,"abs":0.5}'::jsonb,
  false,
  5,
  35,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9b7c370f-919b-4f1d-8569-dfea45013bbc',
  'Plyometric Push-Up',
  'Push explosively so the hands leave the floor, then land with elbows controlled.',
  8,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.7,"anterior_deltoids":0.6,"abs":0.5}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '74a88402-fe9d-46a4-aadc-02b4125feef3',
  'Clapping Push-Up',
  'Perform an explosive push-up and clap before returning hands to the floor.',
  8,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.7,"anterior_deltoids":0.6,"abs":0.5}'::jsonb,
  false,
  5,
  30,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd54a30b8-4dd9-4fea-9b7b-84608cbdbe6b',
  'Depth Push-Up',
  'Drop hands from elevated blocks to the floor and rebound into an explosive push-up.',
  9,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.7,"anterior_deltoids":0.6,"abs":0.6}'::jsonb,
  false,
  15,
  35,
  false,
  ARRAY['blocks'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a9a4f77f-2569-43a8-a1c4-014477f31835',
  'Medicine Ball Chest Pass',
  'Explosively throw a medicine ball from the chest toward a wall or partner.',
  7,
  ARRAY['chest'],
  ARRAY['triceps', 'anterior_deltoids', 'abs'],
  '{"triceps":0.6,"anterior_deltoids":0.5,"abs":0.4}'::jsonb,
  false,
  10,
  30,
  false,
  ARRAY['medicine_ball'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '606dbc66-c5a6-4cac-be56-46c458d8c3ba',
  'Medicine Ball Rotational Throw',
  'Rotate through the hips and torso to throw a medicine ball explosively to the side.',
  7,
  ARRAY['obliques'],
  ARRAY['abs', 'glutes', 'chest', 'anterior_deltoids'],
  '{"abs":0.6,"glutes":0.5,"chest":0.4,"anterior_deltoids":0.4}'::jsonb,
  true,
  10,
  35,
  false,
  ARRAY['medicine_ball'],
  'rotation',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '08ebe89c-e164-4ee6-97b0-188f7aa37e7a',
  'Medicine Ball Overhead Throw',
  'Throw a medicine ball overhead explosively using legs, hips, trunk, and shoulders.',
  7,
  ARRAY['lats'],
  ARRAY['abs', 'glutes', 'triceps', 'anterior_deltoids'],
  '{"abs":0.5,"glutes":0.6,"triceps":0.5,"anterior_deltoids":0.5}'::jsonb,
  false,
  10,
  30,
  false,
  ARRAY['medicine_ball'],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd4a86816-f3b3-4924-81cd-83ccfb692505',
  'Burpee Broad Jump',
  'Perform a burpee, then jump forward for distance before resetting.',
  9,
  ARRAY['quads'],
  ARRAY['chest', 'triceps', 'glutes', 'hamstrings', 'calves', 'abs'],
  '{"chest":0.5,"triceps":0.4,"glutes":0.7,"hamstrings":0.5,"calves":0.6,"abs":0.5}'::jsonb,
  false,
  5,
  45,
  false,
  ARRAY[]::text[],
  'plyometric',
  'explosive',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9c7ce403-2c9d-4a42-a8f7-63e5dea70402',
  'Atlas Stone Load',
  'Lift a stone from the floor and load it to a platform using hips, back, and arms.',
  10,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'quads', 'biceps', 'forearms', 'abs'],
  '{"hamstrings":0.8,"lower_back":0.8,"quads":0.7,"biceps":0.5,"forearms":0.7,"abs":0.6}'::jsonb,
  false,
  45,
  70,
  false,
  ARRAY['atlas_stone', 'platform'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '789e2fd6-bc38-4599-a014-50cd0968d909',
  'Atlas Stone to Shoulder',
  'Lift a stone from the floor and bring it to one shoulder with full-body tension.',
  10,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'quads', 'biceps', 'forearms', 'abs', 'obliques'],
  '{"hamstrings":0.8,"lower_back":0.8,"quads":0.6,"biceps":0.5,"forearms":0.7,"abs":0.6,"obliques":0.5}'::jsonb,
  true,
  45,
  65,
  false,
  ARRAY['atlas_stone'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '01729e9a-6800-45b8-954c-f3954709accb',
  'Natural Stone Load',
  'Lift an irregular stone from the ground and load it to a platform under control.',
  10,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'quads', 'biceps', 'forearms', 'abs'],
  '{"hamstrings":0.8,"lower_back":0.8,"quads":0.7,"biceps":0.5,"forearms":0.8,"abs":0.6}'::jsonb,
  false,
  45,
  70,
  false,
  ARRAY['natural_stone', 'platform'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4ac14313-1a11-47c0-b000-0425931def07',
  'Yoke Walk',
  'Carry a loaded yoke across a set distance while keeping the trunk braced.',
  10,
  ARRAY['traps'],
  ARRAY['quads', 'glutes', 'hamstrings', 'calves', 'abs', 'lower_back'],
  '{"quads":0.7,"glutes":0.7,"hamstrings":0.5,"calves":0.5,"abs":0.8,"lower_back":0.7}'::jsonb,
  false,
  60,
  60,
  true,
  ARRAY['yoke'],
  'strongman',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd777e1df-c8b3-4426-8201-2f7c1539a492',
  'Super Yoke Carry',
  'Carry a heavy yoke for distance with short, controlled steps and full-body bracing.',
  10,
  ARRAY['traps'],
  ARRAY['quads', 'glutes', 'hamstrings', 'calves', 'abs', 'lower_back'],
  '{"quads":0.7,"glutes":0.7,"hamstrings":0.5,"calves":0.6,"abs":0.8,"lower_back":0.7}'::jsonb,
  false,
  60,
  60,
  true,
  ARRAY['yoke'],
  'strongman',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'a73b3c02-710f-48f0-9be9-952de34f2d30',
  'Log Clean and Press',
  'Clean a strongman log to the shoulders and press it overhead.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'glutes', 'quads', 'hamstrings', 'abs'],
  '{"triceps":0.8,"upper_chest":0.6,"glutes":0.7,"quads":0.6,"hamstrings":0.5,"abs":0.6}'::jsonb,
  false,
  45,
  70,
  false,
  ARRAY['strongman_log'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '29477948-4bec-46e4-ac00-9415b7e7861a',
  'Log Press',
  'Press a strongman log overhead from the front rack position.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'traps', 'abs'],
  '{"triceps":0.8,"upper_chest":0.6,"traps":0.4,"abs":0.5}'::jsonb,
  false,
  40,
  55,
  false,
  ARRAY['strongman_log'],
  'push',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '908880a4-6484-41e6-b553-1c9266de0471',
  'Axle Clean and Press',
  'Clean a thick axle bar to the shoulders and press it overhead.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'glutes', 'quads', 'hamstrings', 'forearms', 'abs'],
  '{"triceps":0.8,"upper_chest":0.6,"glutes":0.7,"quads":0.6,"hamstrings":0.5,"forearms":0.7,"abs":0.6}'::jsonb,
  false,
  45,
  70,
  false,
  ARRAY['axle_bar'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '354a5a25-5166-4f6d-b668-4eb7979b2b61',
  'Axle Deadlift',
  'Deadlift a thick axle bar from the floor while maintaining grip and trunk tension.',
  9,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'lower_back', 'quads', 'forearms', 'traps', 'abs'],
  '{"glutes":0.8,"lower_back":0.7,"quads":0.5,"forearms":0.8,"traps":0.5,"abs":0.5}'::jsonb,
  false,
  35,
  55,
  false,
  ARRAY['axle_bar', 'plates'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '1bb48568-a061-4c20-bd57-48b72938ac38',
  'Frame Carry',
  'Carry a loaded frame for distance while keeping shoulders packed and torso braced.',
  10,
  ARRAY['forearms'],
  ARRAY['traps', 'quads', 'glutes', 'hamstrings', 'calves', 'abs'],
  '{"traps":0.7,"quads":0.6,"glutes":0.6,"hamstrings":0.4,"calves":0.5,"abs":0.7}'::jsonb,
  false,
  45,
  60,
  true,
  ARRAY['carry_frame'],
  'carry',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '71776175-9784-45a1-8d50-5275e52ee228',
  'Farmer Handle Carry',
  'Carry heavy farmer handles for distance while maintaining tall posture and grip.',
  9,
  ARRAY['forearms'],
  ARRAY['traps', 'quads', 'glutes', 'hamstrings', 'calves', 'abs'],
  '{"traps":0.7,"quads":0.5,"glutes":0.5,"hamstrings":0.3,"calves":0.5,"abs":0.7}'::jsonb,
  false,
  35,
  60,
  true,
  ARRAY['farmer_handles'],
  'carry',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '09907be0-9cba-42cd-b92c-6bb306cb95c3',
  'Husafell Stone Carry',
  'Bear-hug carry a shield-shaped stone for distance with strong trunk bracing.',
  10,
  ARRAY['abs'],
  ARRAY['biceps', 'forearms', 'upper_back', 'glutes', 'quads', 'lower_back'],
  '{"biceps":0.6,"forearms":0.7,"upper_back":0.7,"glutes":0.6,"quads":0.6,"lower_back":0.7}'::jsonb,
  false,
  45,
  60,
  true,
  ARRAY['husafell_stone'],
  'strongman',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c1e7b40c-cc56-4fa5-8dd6-26d28f73a7b3',
  'Shield Carry',
  'Carry a shield-style implement against the torso for distance.',
  9,
  ARRAY['abs'],
  ARRAY['biceps', 'forearms', 'upper_back', 'glutes', 'quads', 'lower_back'],
  '{"biceps":0.5,"forearms":0.6,"upper_back":0.7,"glutes":0.5,"quads":0.5,"lower_back":0.6}'::jsonb,
  false,
  40,
  60,
  true,
  ARRAY['shield'],
  'strongman',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '29b4be8e-fc97-4f54-a580-b5e96deb338f',
  'Sandbag Load',
  'Lift a sandbag from the floor and load it onto a platform.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'quads', 'biceps', 'forearms', 'abs'],
  '{"hamstrings":0.7,"lower_back":0.7,"quads":0.6,"biceps":0.5,"forearms":0.6,"abs":0.6}'::jsonb,
  false,
  30,
  60,
  false,
  ARRAY['sandbag', 'platform'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'cd0e51d5-ba67-4a28-afa8-0759cc61fc58',
  'Sandbag to Shoulder',
  'Lift a sandbag from the floor to one shoulder with hip drive and trunk control.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'quads', 'biceps', 'forearms', 'obliques'],
  '{"hamstrings":0.7,"lower_back":0.7,"quads":0.6,"biceps":0.5,"forearms":0.6,"obliques":0.5}'::jsonb,
  true,
  30,
  55,
  false,
  ARRAY['sandbag'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '9a778c4e-6ab0-48d7-9586-e0319c5eda3a',
  'Sandbag Carry',
  'Bear-hug or shoulder-carry a sandbag for distance while staying braced.',
  8,
  ARRAY['abs'],
  ARRAY['biceps', 'forearms', 'upper_back', 'glutes', 'quads', 'lower_back'],
  '{"biceps":0.5,"forearms":0.5,"upper_back":0.6,"glutes":0.5,"quads":0.5,"lower_back":0.6}'::jsonb,
  false,
  25,
  60,
  true,
  ARRAY['sandbag'],
  'carry',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '026bc59f-0d7d-46b8-9736-6dadb9bfab33',
  'Sandbag Clean and Press',
  'Clean a sandbag to the front rack or shoulder and press it overhead.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'glutes', 'quads', 'hamstrings', 'abs', 'forearms'],
  '{"triceps":0.7,"glutes":0.7,"quads":0.6,"hamstrings":0.5,"abs":0.6,"forearms":0.5}'::jsonb,
  false,
  30,
  65,
  false,
  ARRAY['sandbag'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f5ce87fe-4c31-4c13-a9bf-36566840353a',
  'Keg Load',
  'Lift a keg from the floor and load it to a platform or over a bar.',
  9,
  ARRAY['glutes'],
  ARRAY['hamstrings', 'lower_back', 'quads', 'biceps', 'forearms', 'abs'],
  '{"hamstrings":0.7,"lower_back":0.7,"quads":0.6,"biceps":0.5,"forearms":0.6,"abs":0.6}'::jsonb,
  false,
  35,
  60,
  false,
  ARRAY['keg', 'platform'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4619729c-4c9c-4d3a-bb99-1f80e9be4bad',
  'Keg Carry',
  'Carry a keg against the torso or on the shoulder for distance.',
  8,
  ARRAY['abs'],
  ARRAY['biceps', 'forearms', 'upper_back', 'glutes', 'quads', 'lower_back'],
  '{"biceps":0.5,"forearms":0.6,"upper_back":0.6,"glutes":0.5,"quads":0.5,"lower_back":0.6}'::jsonb,
  false,
  30,
  60,
  true,
  ARRAY['keg'],
  'carry',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '4c92873e-a47e-487f-aa5c-e87c728ea7b5',
  'Tire Flip',
  'Drive through the legs and hips to flip a tire forward.',
  9,
  ARRAY['glutes'],
  ARRAY['quads', 'hamstrings', 'lower_back', 'chest', 'biceps', 'forearms'],
  '{"quads":0.7,"hamstrings":0.7,"lower_back":0.7,"chest":0.4,"biceps":0.4,"forearms":0.5}'::jsonb,
  false,
  45,
  60,
  false,
  ARRAY['tire'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7471b501-da2e-4176-b2da-b5bdc562075e',
  'Conan’s Wheel',
  'Carry a front-loaded implement in the crooks of the elbows while walking in a circle.',
  10,
  ARRAY['abs'],
  ARRAY['biceps', 'forearms', 'quads', 'glutes', 'upper_back', 'lower_back'],
  '{"biceps":0.6,"forearms":0.6,"quads":0.6,"glutes":0.6,"upper_back":0.6,"lower_back":0.7}'::jsonb,
  false,
  60,
  75,
  true,
  ARRAY['conans_wheel'],
  'strongman',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd4338166-8291-43b5-b2a9-23c7d542e4ea',
  'Fingal’s Fingers',
  'Lift and tip a long hinged implement from the ground to vertical.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'chest', 'quads', 'glutes', 'abs', 'lower_back'],
  '{"triceps":0.7,"chest":0.5,"quads":0.7,"glutes":0.7,"abs":0.6,"lower_back":0.6}'::jsonb,
  false,
  60,
  75,
  false,
  ARRAY['fingals_finger'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '7960d0d1-de4d-4889-8379-c33fde1e5bc0',
  'Harness Sled Pull',
  'Pull a loaded sled forward using a harness and powerful leg drive.',
  9,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'abs', 'lower_back'],
  '{"glutes":0.8,"hamstrings":0.6,"calves":0.6,"abs":0.5,"lower_back":0.4}'::jsonb,
  false,
  35,
  60,
  true,
  ARRAY['sled', 'harness'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '3147160f-450f-4354-a118-b1c98c0334c1',
  'Backward Sled Drag',
  'Walk backward while dragging a sled to emphasize knee extension and quad endurance.',
  7,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'abs'],
  '{"glutes":0.4,"hamstrings":0.3,"calves":0.5,"abs":0.3}'::jsonb,
  false,
  25,
  60,
  true,
  ARRAY['sled'],
  'strongman',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'aa7116a3-33af-41ea-b08a-7c3407fe092f',
  'Arm-Over-Arm Sled Pull',
  'Pull a sled toward you hand-over-hand using a rope.',
  8,
  ARRAY['lats'],
  ARRAY['biceps', 'forearms', 'posterior_deltoids', 'abs', 'lower_back'],
  '{"biceps":0.7,"forearms":0.8,"posterior_deltoids":0.5,"abs":0.5,"lower_back":0.4}'::jsonb,
  false,
  30,
  60,
  true,
  ARRAY['sled', 'rope'],
  'strongman',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'c0eb2fb2-b956-4342-a9a9-8502bc90c0f6',
  'Truck Pull Simulation',
  'Use a harness and rope to pull a heavy sled or vehicle-simulation implement.',
  10,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'calves', 'lats', 'biceps', 'abs'],
  '{"glutes":0.8,"hamstrings":0.6,"calves":0.6,"lats":0.5,"biceps":0.4,"abs":0.6}'::jsonb,
  false,
  60,
  90,
  true,
  ARRAY['sled', 'harness', 'rope'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '79045fdb-4ab2-45c3-9eea-0c6d51058213',
  'Circus Dumbbell Press',
  'Clean a large dumbbell to the shoulder and press it overhead with one arm.',
  10,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'obliques', 'glutes', 'quads', 'forearms'],
  '{"triceps":0.8,"upper_chest":0.5,"obliques":0.7,"glutes":0.5,"quads":0.5,"forearms":0.6}'::jsonb,
  true,
  35,
  60,
  false,
  ARRAY['circus_dumbbell'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '2a88f54a-16a4-4602-808e-87db678942c6',
  'Viking Press',
  'Press a lever-style strongman implement overhead using coordinated leg and arm drive.',
  9,
  ARRAY['anterior_deltoids'],
  ARRAY['triceps', 'upper_chest', 'traps', 'quads', 'glutes', 'abs'],
  '{"triceps":0.8,"upper_chest":0.5,"traps":0.4,"quads":0.5,"glutes":0.5,"abs":0.4}'::jsonb,
  false,
  40,
  55,
  false,
  ARRAY['viking_press'],
  'strongman',
  'power',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '8a48ee8f-9daf-43a0-8450-3efa2113bcbd',
  'Car Deadlift',
  'Deadlift a car-deadlift frame or lever implement from handles at the sides.',
  10,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'lower_back', 'quads', 'forearms', 'traps', 'abs'],
  '{"glutes":0.8,"lower_back":0.8,"quads":0.6,"forearms":0.7,"traps":0.6,"abs":0.6}'::jsonb,
  false,
  60,
  65,
  false,
  ARRAY['car_deadlift_frame'],
  'strongman',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'edc96dea-68b4-4d56-9860-af293932b179',
  'Silver Dollar Deadlift',
  'Deadlift a bar from elevated blocks or boxes in a partial range of motion.',
  9,
  ARRAY['hamstrings'],
  ARRAY['glutes', 'lower_back', 'quads', 'forearms', 'traps', 'abs'],
  '{"glutes":0.7,"lower_back":0.7,"quads":0.5,"forearms":0.6,"traps":0.6,"abs":0.5}'::jsonb,
  false,
  45,
  55,
  false,
  ARRAY['barbell', 'blocks', 'plates'],
  'hinge',
  'controlled',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'e976034c-5592-40ea-b514-212bc654807b',
  'Hercules Hold',
  'Hold two heavy handles out to the sides against pulling force for time.',
  9,
  ARRAY['forearms'],
  ARRAY['traps', 'lats', 'posterior_deltoids', 'abs'],
  '{"traps":0.5,"lats":0.5,"posterior_deltoids":0.4,"abs":0.5}'::jsonb,
  false,
  45,
  45,
  true,
  ARRAY['hercules_hold_handles'],
  'strongman',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'd77590af-f222-420d-85b1-a07c5a962462',
  'Crucifix Hold',
  'Hold weights out to the sides at shoulder height for time.',
  8,
  ARRAY['lateral_deltoids'],
  ARRAY['traps', 'forearms', 'abs'],
  '{"traps":0.4,"forearms":0.5,"abs":0.4}'::jsonb,
  false,
  20,
  40,
  true,
  ARRAY['dumbbells'],
  'strongman',
  'isometric',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  'f613ec9e-1744-47b9-85f6-e47b46a44115',
  'Duck Walk',
  'Carry a low front-loaded implement between the legs for distance.',
  8,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'forearms', 'abs', 'lower_back'],
  '{"glutes":0.6,"hamstrings":0.5,"forearms":0.6,"abs":0.5,"lower_back":0.5}'::jsonb,
  false,
  35,
  55,
  true,
  ARRAY['duck_walk_handle'],
  'strongman',
  'loaded_carry',
  false
);

INSERT INTO v2_exercises (
  id, name, description, density_score, primary_muscles, secondary_muscles,
  implicit_hits, is_unilateral, setup_buffer_sec, avg_time_per_set_sec,
  is_timed, equipment_needed, movement_pattern, tempo_category, is_stretch
) VALUES (
  '11c2bfa0-d808-424d-8017-018f212d0e79',
  'Power Stairs',
  'Lift and place a heavy implement step by step up a platform staircase.',
  10,
  ARRAY['quads'],
  ARRAY['glutes', 'hamstrings', 'lower_back', 'forearms', 'traps', 'abs'],
  '{"glutes":0.7,"hamstrings":0.6,"lower_back":0.6,"forearms":0.7,"traps":0.5,"abs":0.5}'::jsonb,
  false,
  60,
  75,
  false,
  ARRAY['power_stairs_implement'],
  'strongman',
  'power',
  false
);
