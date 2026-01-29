-- 20260122000005_create_template_slot_sets.sql
-- Adds v2_template_slot_sets to store per-slot default sets for planned workouts.

create table if not exists public.v2_template_slot_sets (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.v2_template_slots(id) on delete cascade,
  set_number integer not null check (set_number >= 1),
  weight numeric,
  reps integer,
  duration_sec integer,
  rpe integer,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),

  constraint v2_template_slot_sets_unique_slot_set_number
    unique (slot_id, set_number),

  -- Reps/duration exclusivity: exactly one of reps or duration_sec may be non-null
  constraint v2_template_slot_sets_reps_xor_duration
    check (
      (reps is not null and duration_sec is null)
      or (reps is null and duration_sec is not null)
    ),

  -- RPE bounds: 1-10 when present
  constraint v2_template_slot_sets_rpe_bounds
    check (rpe is null or (rpe >= 1 and rpe <= 10))
);

create index if not exists idx_v2_template_slot_sets_slot
  on public.v2_template_slot_sets (slot_id, set_number);

-- Enable RLS
alter table public.v2_template_slot_sets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'v2_template_slot_sets'
      and policyname = 'template_slot_sets_owner_all'
  ) then
    create policy template_slot_sets_owner_all
      on public.v2_template_slot_sets
      using (
        exists (
          select 1
          from public.v2_template_slots slots
          join public.v2_template_days days
            on days.id = slots.day_id
          join public.v2_workout_templates templates
            on templates.id = days.template_id
          where slots.id = v2_template_slot_sets.slot_id
            and (templates.user_id = auth.uid() or templates.user_id is null)
        )
      )
      with check (
        exists (
          select 1
          from public.v2_template_slots slots
          join public.v2_template_days days
            on days.id = slots.day_id
          join public.v2_workout_templates templates
            on templates.id = days.template_id
          where slots.id = v2_template_slot_sets.slot_id
            and (templates.user_id = auth.uid() or templates.user_id is null)
        )
      );
  end if;
end $$;

