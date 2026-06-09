-- Workout flow parity: set types, supersets, per-exercise rest overrides
--
-- 1. v2_session_sets.set_type: marks warm-up / drop / failure sets so PR and
--    volume calculations can exclude or special-case them.
-- 2. superset_group on v2_session_exercises and v2_template_slots: exercises
--    sharing the same non-null integer within a session/day form a superset
--    and alternate during execution with a shared rest timer.
-- 3. v2_session_exercises.rest_sec: per-exercise rest override used by the
--    active workout rest timer (falls back to per-set rest_sec, then default).

alter table public.v2_session_sets
  add column if not exists set_type text not null default 'normal'
  check (set_type in ('normal', 'warmup', 'drop', 'failure'));

alter table public.v2_session_exercises
  add column if not exists superset_group integer,
  add column if not exists rest_sec integer
  check (rest_sec is null or (rest_sec >= 0 and rest_sec <= 3600));

alter table public.v2_template_slots
  add column if not exists superset_group integer,
  add column if not exists rest_sec integer
  check (rest_sec is null or (rest_sec >= 0 and rest_sec <= 3600));

comment on column public.v2_session_sets.set_type is
  'normal | warmup | drop | failure. Warm-up sets are excluded from PR and volume calculations.';
comment on column public.v2_session_exercises.superset_group is
  'Exercises in the same session sharing this integer alternate as a superset.';
comment on column public.v2_session_exercises.rest_sec is
  'Per-exercise rest override in seconds; null falls back to set-level rest_sec or app default.';
comment on column public.v2_template_slots.superset_group is
  'Slots in the same template day sharing this integer form a superset when copied to sessions.';
comment on column public.v2_template_slots.rest_sec is
  'Per-slot rest override in seconds, copied to session exercises when materialized.';
