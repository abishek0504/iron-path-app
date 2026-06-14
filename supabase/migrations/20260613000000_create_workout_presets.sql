-- Workout presets: user-saved workout structures loadable into planner days.

create table if not exists public.v2_workout_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 1 and char_length(name) <= 60),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.v2_workout_presets is
  'User-saved workout structures (exercise list + order) loadable into planner days.';

create index if not exists idx_v2_workout_presets_user_id
  on public.v2_workout_presets (user_id, created_at desc);

create table if not exists public.v2_workout_preset_slots (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.v2_workout_presets(id) on delete cascade,
  exercise_id uuid references public.v2_exercises(id) on delete set null,
  custom_exercise_id uuid references public.v2_user_custom_exercises(id) on delete set null,
  sort_order integer not null,
  superset_group integer,
  rest_sec integer check (rest_sec is null or (rest_sec >= 0 and rest_sec <= 3600)),
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint v2_workout_preset_slots_exercise_reference_check check (
    (exercise_id is not null and custom_exercise_id is null)
    or (exercise_id is null and custom_exercise_id is not null)
  )
);

comment on table public.v2_workout_preset_slots is
  'Exercise slots within a saved workout preset.';

create index if not exists idx_v2_workout_preset_slots_preset_id
  on public.v2_workout_preset_slots (preset_id, sort_order);

alter table public.v2_workout_presets enable row level security;
alter table public.v2_workout_preset_slots enable row level security;

drop policy if exists "v2_workout_presets_owner" on public.v2_workout_presets;
create policy "v2_workout_presets_owner" on public.v2_workout_presets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "v2_workout_preset_slots_owner" on public.v2_workout_preset_slots;
create policy "v2_workout_preset_slots_owner" on public.v2_workout_preset_slots
  for all to authenticated
  using (
    exists (
      select 1 from public.v2_workout_presets presets
      where presets.id = v2_workout_preset_slots.preset_id
        and presets.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.v2_workout_presets presets
      where presets.id = v2_workout_preset_slots.preset_id
        and presets.user_id = (select auth.uid())
    )
  );
