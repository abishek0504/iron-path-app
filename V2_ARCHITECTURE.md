# IronPath V2 Architecture: Holistic System Contract

## Goals

- Rebuild V2 cleanly with strict separation of concerns.
- Prevent old issues: modal-in-modal, buggy navigation, schema drift, meaningless defaults (3x10, 60 sec).
- Ensure new users get data-driven targets immediately using curated prescriptions; experienced users get personalization from performed truth.

## 1) Industry standard data layering

We use these layers. Every feature (recovery, progressive overload, planning, compounds, heatmap) pulls from the correct layer:

1. **Canonical reference (global, mostly immutable)**
2. **Curated prescriptions (global, per exercise targets by context)**
3. **User customization (user-scoped overrides and custom exercises)**
4. **Planning (templates, intent)**
5. **Performed truth (sessions and sets, the only truth for performance)**
6. Optional: **Derived caches** (rebuildable, never truth)

Hard rule: **Planning and prescriptions propose targets; performed truth records what actually happened.**

## 2) Global UI and navigation (no modal-in-modal)

- Reusable UI (exercise picker, settings, quick filters): **global bottom sheets driven by Zustand**, with a **single sheet host** mounted once at the root layout.
- Deep flows (exercise detail, active workout, edit profile): **Expo Router stack routes**, optionally presented modally.
- Rule: **never open a modal inside a modal**. Bottom sheets are not routes. Routes are not bottom sheets.

Zustand stores:

- `uiStore`: bottom sheets, dialogs, toasts
- `userStore`: profile + preferences cache
- `exerciseStore`: exercise search + merged exercise view
- `workoutStore`: active workout/session state

Logging:

- Single helper: `devLog(module, payload)`
- Wrap with `if (__DEV__)`
- Log aggregates, not per-row loops

## 3) Database naming, RLS, immutability

- All V2 tables are **lowercase snake_case** (`v2_exercises`, etc.).
- App uses **anon key + RLS**. Never ship `service_role`.
- Privileged writes happen via admin tooling / migrations / Edge Functions only.

RLS baseline:

- Allow SELECT for authenticated users (anon only if explicitly desired).
- Deny INSERT/UPDATE/DELETE for client roles on immutable tables.

Table-by-table RLS intent (explicit):

- `v2_exercises`: auth SELECT only, no writes from client
- `v2_muscles`: auth SELECT only, no writes from client
- `v2_ai_recommended_exercises`: auth SELECT only, no writes from client
- `v2_exercise_prescriptions`: auth SELECT only, no writes from client
- `v2_user_exercise_overrides`: auth CRUD for owner only
- `v2_user_custom_exercises`: auth CRUD for owner only
- `v2_workout_*` and `v2_session_*`: auth CRUD for owner only

Rule for user-owned tables: enforce `user_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE.

Immutability:

- `v2_exercises` is read-only from the client. Only admin/service contexts can write.

## 4) Canonical muscles

### `v2_muscles`

Single source of truth for muscle keys used everywhere.

- `key text PRIMARY KEY`
- `display_name text`
- optional `group text`, `sort_order int`, `is_active boolean`

Validation rule:

- Any write path that references muscle keys must validate against `v2_muscles.key`.

## 5) Exercise identity and biomechanics (global)

### `v2_exercises` (immutable)

Single source of truth for exercise metadata used by picker and all engine calculations.

Required fields:

- `density_score numeric`
- `primary_muscles text[]` (each must exist in `v2_muscles.key`)
- `implicit_hits jsonb` (keys in `v2_muscles.key`, values in 0..1)
- `is_unilateral boolean`
- `setup_buffer_sec int`
- `avg_time_per_set_sec int` (**includes rest time between sets**)
- `is_timed boolean`
- plus: `name`, `description`, `equipment_needed text[]`, `movement_pattern text`, etc.

Constraint policy:

- If DB-level validation for jsonb keys is not feasible, enforce in a shared validation layer (Edge/admin + overrides/custom exercises).

## 6) Curated per-exercise targets (new users, online-research backed)

### Why this exists

A single `is_timed` flag is not enough. Plank and skipping are both timed but have different target ranges. Prevent old behavior (every exercise becomes 3x10 or 60 sec).

### `v2_exercise_prescriptions` (curated programming targets)

Defines recommended targets per exercise under different contexts.

Minimal schema:

- `id uuid primary key default gen_random_uuid()`
- `exercise_id uuid not null references v2_exercises(id) on delete cascade`
- `goal text not null`  (strength, hypertrophy, conditioning, mobility, skill)
- `experience text not null` (beginner, intermediate, advanced)
- `mode text not null` (reps | timed)
- `sets_min int not null`
- `sets_max int not null`
- `reps_min int null`
- `reps_max int null`
- `duration_sec_min int null`
- `duration_sec_max int null`
- `is_active boolean not null default true`
- `source_notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- UNIQUE `(exercise_id, goal, experience, mode)`
- CHECK `sets_min >= 1 and sets_max >= sets_min and sets_max <= 10`
- CHECK mode gating:
- if mode = 'reps' then `reps_min` and `reps_max` are not null AND duration fields are null
- if mode = 'timed' then `duration_sec_min` and `duration_sec_max` are not null AND reps fields are null
- CHECK reps bounds: `reps_min >= 1 and reps_max >= reps_min and reps_max <= 50`
- CHECK duration bounds: `duration_sec_min >= 5 and duration_sec_max >= duration_sec_min and duration_sec_max <= 3600`

Hard rules:

- Engine must fetch targets from this table.
- No prescription row = **data error** (devLog, exclude from AI generation, do not invent numbers).
- When generating a workout, if a slot has an `exercise_id`, the engine must fetch a matching prescription row. If none exists, the exercise is ineligible for generation and must be swapped or the generation fails with a user-facing error.
- Templates must not contain generic defaults that override prescriptions.

## 7) AI gating (no filler exercise selection)

### `v2_ai_recommended_exercises`

Thin allow-list only.

- `exercise_id uuid REFERENCES v2_exercises(id)`
- `exercise_id` is PRIMARY KEY (or UNIQUE)
- `is_active boolean`
- `priority_order int`
- `notes text`
- timestamps

AI rule:

- AI selection restricted to allow-list.
- Programming targets come from `v2_exercise_prescriptions`.
- Computations use merged per-user exercise view.

## 8) User customization without corrupting global data

### `v2_user_exercise_overrides`

Overrides for master exercises only.

- key: `(user_id, exercise_id)`
- stores nullable override fields
- Merge rule: override wins only when non-null.

### `v2_user_custom_exercises`

User-created exercises not in master list.

- user-owned via RLS
- must include required metadata if eligible for engine (muscles + time model)

Validation:

- muscle keys in `v2_muscles`
- implicit hit values clamped 0..1

Hard rule:

- AI/UI must never write to `v2_exercises`.

## 9) Planning vs performed truth (industry standard)

### Planning (templates)

- `v2_workout_templates`
- `v2_template_days`
- `v2_template_slots`

Slots store intent (structure + intent only):

- `exercise_id` (or constraint spec later)
- optional: `goal` override (default from profile)
- optional: `experience` override (default from profile)
- optional: `notes`

Templates must not hardcode universal targets like "10 reps" or "60 seconds". Targets are populated from `v2_exercise_prescriptions` unless the user explicitly edits that slot.

Context precedence for prescription lookup:

- Slot goal/experience override (if set)
- else profile goal/experience
- else safe defaults (goal=`strength`, experience=`beginner`) + devLog

### Performed truth (sessions)

- `v2_workout_sessions`
- `v2_session_exercises`
- `v2_session_sets`

`v2_session_sets` minimum fields:

- reps (nullable)
- weight (nullable)
- rpe or rir (nullable but recommended)
- duration_sec (nullable)
- optional rest_sec
- constraints prevent impossible combinations

## 10) The merged per-user exercise view (used everywhere)

Definition:

- Start with `v2_exercises`
- Overlay non-null fields from `v2_user_exercise_overrides`
- If user custom exercise, use that row instead

Rule:

- All engine calculations and UI displays use this merged view.

Implementation pattern (avoid multi-query drift):

- Provide one query function `getMergedExercise(exercise_id, user_id)` and one bulk version `listMergedExercises(user_id)` that returns master joined with overrides.

## How targets are chosen (new users + personalization)

For a given exercise + user context (goal, experience):

1. Fetch prescription: `p = v2_exercise_prescriptions(exercise_id, goal, experience, mode)`.

Mode mapping:

- If `is_timed = true` -> prescription `mode = 'timed'`
- else `mode = 'reps'`

2. New user (low history): choose targets inside the band (lower-to-mid range). Never use generic defaults.
3. Experienced user: use last performed sets + effort signal (rpe/rir) to adjust within the same band. Always clamp to bounds.

Hard rule:

- Prescription defines safe/realistic band; history chooses exact point inside band.

## Formulas

### A) Time estimate per exercise

Assumptions:

- `avg_time_per_set_sec` includes rest time between sets
- `setup_buffer_sec` is one-time overhead
- unilateral doubling rule

Variables:

- `S = target_sets`
- `Tset = avg_time_per_set_sec`
- `Tsetup = setup_buffer_sec`
- `U = is_unilateral ? 2 : 1`

Formula:

- `exercise_time_sec = Tsetup + (S * Tset * U)`
- `session_time_sec = Σ exercise_time_sec`

Timed exercises:

- Prescription provides duration range.
- Performed truth stores `duration_sec`.
- If needed later, override estimate using chosen duration rather than `avg_time_per_set_sec`.

## Fatigue model (V2 minimal, schema-compatible)

Fatigue is a derived calculation from performed truth (`v2_session_sets`) plus merged exercise metadata (`primary_muscles`, `implicit_hits`). This adds no new columns and does not change existing meanings.

### Per-set stimulus (effort)

If `rpe` exists:

- `stimulus = clamp((rpe - 5) / 5, 0, 1)`

Else if `rir` exists:

- `rpe_est = clamp(10 - rir, 1, 10)`
- `stimulus = clamp((rpe_est - 5) / 5, 0, 1)`

Else:

- `stimulus = 0.6` (devLog once per session that effort was missing)

### Muscle weighting

For each muscle `m`:

- if `m ∈ primary_muscles` then `w_m = 1.0`
- else if `m ∈ implicit_hits` then `w_m = implicit_hits[m]` (0..1)

Normalize:

- `W = Σ w_m`
- `p_m = w_m / W`

### Stress accumulation

Per set:

- `muscle_stress(m) += stimulus * p_m`

Per day (optional aggregation):

- `daily_muscle_stress[user, date, m] = Σ muscle_stress(m) across all sets that date`

Heatmap definition:

- Heatmap shows **daily muscle stress** derived from performed sets (not freshness).

### Freshness update (fatigue + recovery)

Freshness is tracked per muscle. Compute independently for each muscle `m`:

Fatigue drop (per muscle):

- `ΔF_m = k * daily_muscle_stress[user, date, m]`

Apply fatigue (per muscle):

- `F_m_after = clamp(F_m_before - ΔF_m, 0, 100)`

Recovery regen (per muscle):

- for elapsed hours `h`: `regen = 25 * (h/24)`
- `F_m_new = clamp(F_m_old + regen, 0, 100)`

`k` is a tuning constant used in fatigue drop. V2 baseline: `k = 1.0`.

Hard rules:

- Never require RPE/RIR to compute fatigue.
- Clamp all inputs and outputs.
- Keep this model simple in V2 (no complex fatigue curves yet).

Cache tables:

- `v2_muscle_freshness` optional cache, rebuildable from performed sets

## Anti-break safeguards

### 1) Validation must prevent nonsense writes

Two layers:

- UI validation (block save + toast + devLog)
- DB CHECK constraints (hard guarantee)

DB constraint examples for `v2_session_sets`:

- `CHECK (reps IS NULL OR reps BETWEEN 1 AND 50)`
- `CHECK (weight IS NULL OR weight >= 0)`
- `CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10)`
- `CHECK (duration_sec IS NULL OR duration_sec BETWEEN 5 AND 3600)`
- `CHECK (rest_sec IS NULL OR rest_sec BETWEEN 0 AND 600)`
- `CHECK (NOT (reps IS NOT NULL AND duration_sec IS NOT NULL))`
- `CHECK (reps IS NOT NULL OR duration_sec IS NOT NULL)`

Performed set mode rule (must be enforced by DB CHECK constraints):

- If `duration_sec` is set then `reps` must be null.
- If `reps` is set then `duration_sec` must be null.

UI rule:

- UI validation on set inputs (reps, weight, duration, rpe/rir) with toast + devLog on invalid.

### 2) Derived computations are resilient

- Clamp all inputs
- Skip nulls safely
- Missing prescription = exclude + devLog, never invent numbers
- Missing rpe = conservative default + devLog once

## Curation pipeline (admin-only)

Curated population of:

- `v2_exercises`
- `v2_exercise_prescriptions`
- `v2_ai_recommended_exercises`

Must be done via:

- admin tooling, migrations, or secure Edge Functions
- never from the client
- no service_role in the app

If an AI web-research pipeline is used:

- server-side/admin-only
- output validated against schema + constraints before writing

## Implementation checklist

- Create migrations for all `v2_*` tables including `v2_exercise_prescriptions`.
- Implement RLS and immutability for `v2_exercises`.
- Implement validation helpers for muscle keys and implicit hits.
- Implement merged exercise view selector used by UI and engine.
- Implement target selection: prescriptions first, history adjusts within band.
- Implement DB constraints for performed truth sets.
- Implement global sheet host + modal manager + toast provider.
- Add devLog across all data operations and decision points.

