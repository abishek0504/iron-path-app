-- 20260122000006_remove_template_slot_sets.sql
-- Removes v2_template_slot_sets table to simplify architecture.
-- Prefill now always uses prescriptions + history via selectExerciseTargets().

-- Drop RLS policies first
drop policy if exists template_slot_sets_owner_all on public.v2_template_slot_sets;

-- Drop index
drop index if exists public.idx_v2_template_slot_sets_slot;

-- Drop table (cascade will handle any foreign key dependencies, though there shouldn't be any)
drop table if exists public.v2_template_slot_sets cascade;
