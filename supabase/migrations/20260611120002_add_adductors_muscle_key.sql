-- Add adductors as a canonical muscle key (CSV uses it for inner-thigh work;
-- distinct from hip_flexors which maps to the adductors heatmap slug).

INSERT INTO v2_muscles (key, display_name, "group", sort_order, is_active)
VALUES ('adductors', 'Adductors', 'lower_body_front', 3, true)
ON CONFLICT (key) DO NOTHING;
