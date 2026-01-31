-- Resolve remaining linter issues: unindexed foreign keys and v2_user_exercise_prs without primary key.
-- A "covering" index for an FK means the FK column is the leftmost column of an index.

-- v2_daily_muscle_stress: FK muscle_key (PK is user_id, date, muscle_key; muscle_key not leftmost)
CREATE INDEX IF NOT EXISTS idx_v2_daily_muscle_stress_muscle_key
  ON public.v2_daily_muscle_stress (muscle_key);

-- v2_muscle_freshness: FK muscle_key (PK is user_id, muscle_key; muscle_key not leftmost)
CREATE INDEX IF NOT EXISTS idx_v2_muscle_freshness_muscle_key
  ON public.v2_muscle_freshness (muscle_key);

-- v2_template_slots: FK custom_exercise_id (day_id and exercise_id already indexed in prior migration)
CREATE INDEX IF NOT EXISTS idx_v2_template_slots_custom_exercise_id
  ON public.v2_template_slots (custom_exercise_id);

-- v2_user_exercise_overrides: FK exercise_id (PK is user_id, exercise_id; exercise_id not leftmost)
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_overrides_exercise_id
  ON public.v2_user_exercise_overrides (exercise_id);

-- v2_user_exercise_prs: FKs exercise_id and custom_exercise_id (unique indexes start with user_id)
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_exercise_id
  ON public.v2_user_exercise_prs (exercise_id);
CREATE INDEX IF NOT EXISTS idx_v2_user_exercise_prs_custom_exercise_id
  ON public.v2_user_exercise_prs (custom_exercise_id);

-- v2_user_exercise_prs: add primary key (linter: tables without PK can be inefficient at scale)
ALTER TABLE public.v2_user_exercise_prs
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.v2_user_exercise_prs'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.v2_user_exercise_prs ADD PRIMARY KEY (id);
  END IF;
END $$;
