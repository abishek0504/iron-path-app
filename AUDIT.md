# Iron Path – Full Stack Audit (Supabase + App)

This document maps the entire database and codebase: schema, data health, modules, screens, config, data flows, and drift. It is written so the app could be rebuilt from it.

---

## Supabase Schema (public)

### Tables

- `profiles` (14 rows, RLS: user-owned)
  - Columns: `id uuid PK`, `full_name text`, `age int`, `gender text`, `height numeric`, `current_weight numeric`, `goal_weight numeric`, `experience_level text`, `equipment_access text[]`, `days_per_week int`, `goal text`, `updated_at timestamptz default utc now`, `avatar_url text`, `use_imperial bool default true`, `workout_days text[]`, `workout_feedback text`, `preferred_training_style text`, `include_components jsonb`.
  - Null hotspots: `experience_level` 10/14, `preferred_training_style` 13/14, `include_components` 13/14, `workout_feedback` 14/14, `goal_weight` 6/14, `current_weight` 6/14, `age` 6/14.
  - Notes: `include_components` deprecated in code; styles derived from `preferred_training_style` or goal. `use_imperial` always set (no nulls).

- `exercises` (1011 rows, RLS: public SELECT, service_role ALL)
  - Columns: `id uuid PK default gen_random_uuid()`, `name text`, `description text`, `muscle_groups text[] default {}`, `equipment_needed text[] default {}`, `is_timed bool default false`, `difficulty_level text`, `how_to text[]`, `movement_pattern text`, `tempo_category text`, `setup_buffer_sec int`, `is_unilateral bool`, `base_seconds_per_rep numeric`, `density_score numeric`, `implicit_hits jsonb`, `created_at timestamptz default now`, `updated_at timestamptz default now`.
  - Null hotspots: `movement_pattern` 661/1011 null; `tempo_category`, `setup_buffer_sec`, `is_unilateral`, `base_seconds_per_rep` all 1011 null; `implicit_hits` 739/1011 null. `density_score` present for all (backfilled).
  - Risk: heavy reliance on heuristics in engine because metadata is missing. Types file does not include `density_score` / `implicit_hits` and uses wrong `id` type.

- `user_exercises` (4 rows, RLS: user-owned)
  - Columns: `id uuid PK default gen_random_uuid()`, `user_id uuid`, `name text`, `description text`, `muscle_groups text[]`, `equipment_needed text[]`, `is_timed bool default false`, `default_duration_sec int`, `default_sets int default 3`, `default_reps text default '8-12'`, `default_rest_sec int default 60`, `user_seconds_per_rep_override numeric`, `pr_weight numeric`, `pr_reps int`, `pr_performed_at timestamptz`, `created_at timestamptz default now`, `updated_at timestamptz default now`.
  - Null hotspots: `default_duration_sec` 4/4; `user_seconds_per_rep_override` 4/4; PR fields 3/4.

- `workout_plans` (14 rows, RLS: user-owned)
  - Columns: `id bigserial PK`, `user_id uuid`, `name text default 'Weekly Plan'`, `is_active bool default true`, `plan_data jsonb`, `created_at timestamptz default utc now`.
  - `plan_data` always present; structure enforced by app/DB functions, not typed in TS.

- `workout_logs` (108 rows, RLS: user-owned)
  - Columns: `id bigserial PK`, `user_id uuid`, `exercise_name text`, `weight numeric`, `reps numeric`, `notes text`, `performed_at timestamptz default utc now`, `scheduled_reps numeric`, `scheduled_weight numeric`, `plan_id bigint FK`, `day text`, `session_id bigint FK`, `rpe numeric check 1–10`.
  - Null hotspots: `notes` 107/108; `rpe` 108/108; `plan_id`/`day` 30/108; `session_id` 48/108; `scheduled_reps` 9/108; `scheduled_weight` 6/108.
  - RPE unused in code; logs mostly minimalist.

- `workout_sessions` (16 rows, RLS: user-owned)
  - Columns: `id bigserial PK`, `user_id uuid`, `plan_id bigint FK`, `day text`, `current_exercise_index int default 0`, `current_set_index int default 0`, `status text default 'active' check in (active, completed, abandoned)`, `started_at timestamptz default utc now`, `completed_at timestamptz`.
  - Null: `completed_at` 7/16.
  - Comment: “progress derived from workout_logs”.

### Policies (public)
- Exercises: public SELECT; service_role ALL.
- Profiles, user_exercises, workout_plans, workout_logs, workout_sessions: permissive ALL with `auth.uid() = user_id` (or id for profiles).

### Extensions (installed)
- Core used: `plpgsql`, `pgcrypto`, `pg_graphql`.
- Mostly unused/likely unused: PostGIS suite, pgroonga, pgmq, pg_net, vector, pgaudit, pgjwt, pg_cron, etc. (present but not referenced in code).

### Schema-to-code drift
- `src/types/supabase.ts`:
  - `exercises.id` typed `number` but DB `uuid`.
  - Missing `density_score`, `implicit_hits`, `is_unilateral`, `base_seconds_per_rep`, `setup_buffer_sec`, `tempo_category`.
  - Missing `default_*` fields in `user_exercises`.
  - Missing `rpe`, `plan_id`, `session_id` in `workout_logs` Row; `progress` absent in `workout_sessions`.
  - `profiles` missing `full_name`, `avatar_url`, `use_imperial`, `workout_days`.

### Data quality notes
- Exercises lack metadata: movement_pattern absent on ~65%, implicit_hits absent on 73%, base_seconds_per_rep/tempo/setup/unilateral absent on all → engine defaults to heuristic density/time.
- User PRs sparse; RPE entirely unused; plan_data JSON unmanaged by TS typing.

---

## Codebase Map

### Root structure
- `app/`: Expo Router screens.
- `src/lib/`: business logic, AI, engine, data utilities.
- `src/components/`: UI building blocks and skeletons.
- `src/types/`: Supabase types.
- Config: `package.json`, `babel.config.js`, `app.json`, `tailwind.config.js`, `tsconfig.json`.
- Assets: icons, splash.

### Key modules (src/lib)
- `adaptiveWorkoutEngine.ts`: day generation. Steps: gap analysis → prompt → density/bloat filter → fallback fill → normalize → volume template → golden standards → movement inference → bodyweight guard → timed normalization → progression → skill ordering → unilateral guarantee → prune low-density → fill-to-ceiling (add exercises, then add sets) → compress if over ceiling.
- `aiPrompts.ts`: builds prompts for Gemini (week/day), includes coverage/recovery context; enforces density >= 8 in prompt text.
- `smartCompression.ts`: `estimateDayDuration`, tier inference, compression steps (rest reduction, trim sets, drop tier 3, etc.).
- `timeEstimation.ts`: per-exercise duration from user override > base_seconds_per_rep > tempo; adds setup buffer; unilateral factor; fatigue multiplier.
- `volumeTemplates.ts`: sets defaults/clamps by category (compounds max 4 sets; accessories max 3; rests tuned).
- `progressionEngine.ts` + `progressionMetrics.ts`: compute progression suggestions from logs/PRs; metrics logging present.
- `movementPatterns.ts`: pattern inference by name.
- `coverageAnalysis.ts`: movement pattern coverage recommendations.
- `trainingPreferences.ts`: derive component preferences from style/goal; ignore include_components.
- `equipmentFilter.ts`: filters exercises by equipment availability.
- `muscleRecovery.ts`, `recoveryHeuristics.ts`: recovery state utilities.
- `jsonParser.ts`: robust extractJSON.
- `personalRecord.ts`, `oneRepMax.ts`: PR handling.
- `supabase.ts`: client with AsyncStorage/localStorage split; detectSessionInUrl true on web.
- Unused: `progressiveOverload.ts` (no references).

### Frontend (app/)
- `_layout.tsx`, `(tabs)/_layout.tsx`: routing shells.
- Screens:
  - `index.tsx` (welcome; session check).
  - Auth: `login.tsx`, `signup.tsx`, `signup-success.tsx`.
  - Onboarding: `onboarding.tsx`, `onboarding-equipment.tsx`.
  - Planner: `(tabs)/planner.tsx` (overview), `planner-day.tsx` (generateForDay uses adaptive engine), `exercise-select.tsx`.
  - Workout flow: `workout-active.tsx`, `workout-sets.tsx`, `exercise-detail.tsx`.
  - Profile: `(tabs)/profile.tsx`, `edit-profile.tsx` (component toggles removed).
  - Progress: `(tabs)/progress.tsx`.
- Components: `SkeletonLoader`, skeleton variants, `ConfirmDialog`, `Toast`.

### Config / tooling
- Expo SDK 54; React Native 0.81; React 19; React Native Reanimated 4.1.5; NativeWind 2.0.11; tailwindcss 3.3.2; no lint/test scripts.
- Babel plugins: nativewind, reanimated.
- app.json sets bundle IDs; Android edge-to-edge enabled.

---

## Data Flow & Usage Mapping

- Profiles: fetched for goal/style/equipment; `include_components` ignored in `trainingPreferences`; `preferred_training_style` drives component mix.
- Exercises: passed as `availableExercises` into engine; engine expects `movement_pattern`, `equipment_needed`, `density_score`, `implicit_hits`, `is_unilateral`, `base_seconds_per_rep`. Missing fields trigger heuristics (name-based density/pattern, tempo-based time).
- User exercises: used to build personalRecords and timing override; defaults mostly null → engine falls back to templates/heuristics.
- Workout plans: `plan_data` JSON mutated by DB functions (`adjust_plan_data`) and by planner-day; not typed in TS.
- Workout logs: used for progression metrics; `rpe` unused; scheduled_* rarely present.
- Workout sessions: track position; not deeply used in generation.

---

## Known Drift / Redundancy / Risk

- Types vs DB: `src/types/supabase.ts` out of sync (missing columns, wrong types). Risk of silent undefined at runtime.
- Metadata sparsity: lack of `movement_pattern`, `implicit_hits`, `is_unilateral`, `base_seconds_per_rep` reduces quality of density/time/recovery logic.
- Unused module: `progressiveOverload.ts` appears dead.
- RPE captured in schema, unused in code/UI; plan_data schema untyped.
- Extensions surface large/unused set (postgis/pgmq/etc.) — maintenance/security considerations.
- Null-heavy profile fields: styles/goals often null; code must handle defaults.

---

## Recommendations

1) Align types with DB: update `src/types/supabase.ts` to include real columns and correct ids (uuid), especially `density_score`, `implicit_hits`, timing fields, RPE, session/plan links.
2) Backfill exercise metadata: movement_pattern, is_unilateral, tempo_category, setup_buffer_sec, base_seconds_per_rep, implicit_hits to reduce heuristic fallbacks.
3) Decide on RPE and PR usage: if unused, remove from flows; otherwise surface and record.
4) Remove or wire `progressiveOverload.ts`; prune unused extensions if permissible.
5) Add typing/validation for `plan_data` shape or migrate to typed tables for sessions/sets.
6) Consider lint/test scripts to catch drift; add schema checks in CI.

---

## Rebuild Guide (high level map)
- Entry: `app/index.tsx` session gate → tabs via `_layout`.
- Planner generation: `app/planner-day.tsx` fetches profile, logs (30d), personalRecords, availableExercises → calls `generateDaySessionWithAI` in `adaptiveWorkoutEngine.ts`.
- Engine pipeline: prompt (aiPrompts) → density/bloat filter → fallback fill → normalize/volume template/golden standards → movement inference → progression → skill ordering/unilateral guard → duration fill/compress (smartCompression/estimateDayDuration/timeEstimation) → return session.
- Rendering: planner-day shows exercises/sets with duration/reps; workout-active/sets track progress; profile/edit-profile manage user data; onboarding captures equipment/days.


