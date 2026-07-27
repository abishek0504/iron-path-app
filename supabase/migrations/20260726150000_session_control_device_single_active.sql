-- Exclusive device ownership for active workouts + at most one active session per user.
-- control_device is set at session create and is the source of truth for phone vs watch control.

-- Abandon older duplicate actives so the unique index can be created (keep latest per user).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY started_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.v2_workout_sessions
  WHERE status = 'active'
)
UPDATE public.v2_workout_sessions s
SET status = 'abandoned'
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

ALTER TABLE public.v2_workout_sessions
  ADD COLUMN IF NOT EXISTS control_device text NOT NULL DEFAULT 'phone';

ALTER TABLE public.v2_workout_sessions
  DROP CONSTRAINT IF EXISTS v2_workout_sessions_control_device_check;

ALTER TABLE public.v2_workout_sessions
  ADD CONSTRAINT v2_workout_sessions_control_device_check
  CHECK (control_device IN ('phone', 'watch'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_workout_sessions_one_active_per_user
  ON public.v2_workout_sessions (user_id)
  WHERE status = 'active';
