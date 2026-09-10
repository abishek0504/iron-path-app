-- Remove the 50-rep ceiling so high-rep work (e.g. push-ups) can be logged and prescribed.

ALTER TABLE public.v2_session_sets
  DROP CONSTRAINT IF EXISTS reps_check;

ALTER TABLE public.v2_session_sets
  ADD CONSTRAINT reps_check
    CHECK (reps IS NULL OR reps >= 1);

ALTER TABLE public.v2_exercise_prescriptions
  DROP CONSTRAINT IF EXISTS reps_bounds_check;

ALTER TABLE public.v2_exercise_prescriptions
  ADD CONSTRAINT reps_bounds_check CHECK (
    (
      mode = 'reps'
      AND reps_min IS NOT NULL
      AND reps_max IS NOT NULL
      AND reps_min >= 1
      AND reps_max >= reps_min
      AND duration_sec_min IS NULL
      AND duration_sec_max IS NULL
    ) OR (
      mode = 'timed'
      AND duration_sec_min IS NOT NULL
      AND duration_sec_max IS NOT NULL
      AND duration_sec_min >= 5
      AND duration_sec_max >= duration_sec_min
      AND duration_sec_max <= 3600
      AND reps_min IS NULL
      AND reps_max IS NULL
    )
  );

ALTER TABLE public.v2_user_custom_exercises
  DROP CONSTRAINT IF EXISTS custom_exercise_target_bands_check;

ALTER TABLE public.v2_user_custom_exercises
  ADD CONSTRAINT custom_exercise_target_bands_check CHECK (
    mode IS NOT NULL
    AND sets_min IS NOT NULL
    AND sets_max IS NOT NULL
    AND sets_min >= 1
    AND sets_max >= sets_min
    AND sets_max <= 10
    AND (
      (
        mode = 'reps'
        AND reps_min IS NOT NULL
        AND reps_max IS NOT NULL
        AND reps_min >= 1
        AND reps_max >= reps_min
        AND duration_sec_min IS NULL
        AND duration_sec_max IS NULL
      ) OR (
        mode = 'timed'
        AND duration_sec_min IS NOT NULL
        AND duration_sec_max IS NOT NULL
        AND duration_sec_min >= 5
        AND duration_sec_max >= duration_sec_min
        AND duration_sec_max <= 3600
        AND reps_min IS NULL
        AND reps_max IS NULL
      )
    )
  );
