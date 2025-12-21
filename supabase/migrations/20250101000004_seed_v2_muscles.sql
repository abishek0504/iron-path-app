-- Patch: Seed v2_muscles with comprehensive muscle list
-- Idempotent: can re-run safely using ON CONFLICT DO NOTHING
-- Total: 28 muscles organized by functional groups

-- Upper Body Push (group: upper_body_push)
INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active) VALUES
  ('chest', 'Chest', 'upper_body_push', 1, true),
  ('upper_chest', 'Upper Chest', 'upper_body_push', 2, true),
  ('lower_chest', 'Lower Chest', 'upper_body_push', 3, true),
  ('anterior_deltoids', 'Front Delts', 'upper_body_push', 4, true),
  ('lateral_deltoids', 'Side Delts', 'upper_body_push', 5, true),
  ('posterior_deltoids', 'Rear Delts', 'upper_body_push', 6, true),
  ('triceps', 'Triceps', 'upper_body_push', 7, true)
ON CONFLICT (key) DO NOTHING;

-- Upper Body Pull (group: upper_body_pull)
INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active) VALUES
  ('lats', 'Lats', 'upper_body_pull', 1, true),
  ('upper_back', 'Upper Back', 'upper_body_pull', 2, true),
  ('lower_back', 'Lower Back', 'upper_body_pull', 3, true),
  ('traps', 'Traps', 'upper_body_pull', 4, true),
  ('biceps', 'Biceps', 'upper_body_pull', 5, true),
  ('forearms', 'Forearms', 'upper_body_pull', 6, true)
ON CONFLICT (key) DO NOTHING;

-- Core (group: core)
INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active) VALUES
  ('abs', 'Abs', 'core', 1, true),
  ('obliques', 'Obliques', 'core', 2, true)
ON CONFLICT (key) DO NOTHING;

-- Lower Body Front (group: lower_body_front)
INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active) VALUES
  ('quads', 'Quadriceps', 'lower_body_front', 1, true),
  ('hip_flexors', 'Hip Flexors', 'lower_body_front', 2, true)
ON CONFLICT (key) DO NOTHING;

-- Lower Body Back (group: lower_body_back)
INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active) VALUES
  ('hamstrings', 'Hamstrings', 'lower_body_back', 1, true),
  ('glutes', 'Glutes', 'lower_body_back', 2, true),
  ('calves', 'Calves', 'lower_body_back', 3, true),
  ('soleus', 'Soleus', 'lower_body_back', 4, true)
ON CONFLICT (key) DO NOTHING;

-- Stabilizers (group: stabilizers)
INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active) VALUES
  ('rotator_cuff', 'Rotator Cuff', 'stabilizers', 1, true),
  ('serratus_anterior', 'Serratus Anterior', 'stabilizers', 2, true),
  ('transverse_abdominis', 'Transverse Abdominis', 'stabilizers', 3, true),
  ('glute_medius', 'Glute Medius', 'stabilizers', 4, true),
  ('glute_minimus', 'Glute Minimus', 'stabilizers', 5, true),
  ('piriformis', 'Piriformis', 'stabilizers', 6, true),
  ('tibialis_anterior', 'Tibialis Anterior', 'stabilizers', 7, true)
ON CONFLICT (key) DO NOTHING;

