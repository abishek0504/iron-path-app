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

---

## 11) Complete File Structure Map

### Root Directory Structure

```
iron-path-app/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx              # Root layout: Stack navigator + global UI providers
│   ├── index.tsx                # Entry route: auth check + redirect
│   ├── login.tsx                # Login screen
│   └── (tabs)/                  # Tab navigation group
│       ├── _layout.tsx          # Tabs layout configuration
│       └── index.tsx            # Home tab (placeholder)
│
├── src/                          # Application source code
│   ├── components/              # React components
│   │   ├── ui/                 # Global UI components
│   │   │   ├── Toast.tsx        # Toast notification component
│   │   │   ├── ToastProvider.tsx # Global toast provider (Zustand integration)
│   │   │   ├── BottomSheet.tsx  # Reusable bottom sheet component
│   │   │   └── ModalManager.tsx # Global modal/sheet manager
│   │   ├── exercise/           # Exercise-related components
│   │   │   └── ExercisePicker.tsx # Exercise selection bottom sheet
│   │   ├── settings/           # Settings components
│   │   │   └── SettingsMenu.tsx # Settings menu bottom sheet
│   │   └── workout/            # Workout-related components
│   │       └── WorkoutHeatmap.tsx # Muscle stress heatmap visualization
│   │
│   ├── hooks/                   # React hooks
│   │   ├── useToast.ts         # Toast convenience hook
│   │   ├── useExercisePicker.ts # Exercise picker hook
│   │   └── useModal.ts         # Modal/sheet management hook
│   │
│   ├── lib/                     # Business logic and utilities
│   │   ├── engine/             # Core engine logic
│   │   │   └── targetSelection.ts # Prescription-based target selection
│   │   ├── supabase/           # Supabase integration
│   │   │   ├── client.ts       # Supabase client configuration
│   │   │   └── queries/        # Query functions
│   │   │       ├── exercises.ts # Exercise queries (merged view)
│   │   │       ├── prescriptions.ts # Prescription queries
│   │   │       ├── workouts.ts  # Workout session queries
│   │   │       └── users.ts    # User profile queries
│   │   └── utils/              # Utility functions
│   │       ├── logger.ts       # Dev logging utility
│   │       ├── theme.ts        # Theme constants (colors, spacing)
│   │       └── validation.ts  # Validation helpers (muscle keys, etc.)
│   │
│   ├── stores/                  # Zustand state stores
│   │   ├── uiStore.ts          # UI state (bottom sheets, toasts)
│   │   ├── userStore.ts        # User profile cache
│   │   ├── exerciseStore.ts    # Exercise search/selection state
│   │   └── workoutStore.ts     # Active workout/session state
│   │
│   └── types/                   # TypeScript type definitions
│       ├── supabase.ts         # Generated Supabase types (placeholder)
│       └── README.md           # Type generation instructions
│
├── supabase/                    # Database migrations
│   └── migrations/             # SQL migration files
│       ├── 20240101000000_create_v2_tables.sql
│       └── 20240101000001_create_v2_rls_policies.sql
│
├── styles/                      # Global styles
│   └── scrollbar.css           # Web scrollbar styling
│
├── Archive/                     # Old prototype (excluded from build)
│
├── app.json                     # Expo configuration
├── babel.config.js              # Babel configuration
├── metro.config.js              # Metro bundler configuration
├── package.json                 # Dependencies and scripts
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── index.ts                     # Expo entry point
├── nativewind-env.d.ts          # NativeWind type definitions
├── V2_ARCHITECTURE.md          # This document
├── README_V2.md                 # Project overview
└── IMPLEMENTATION_SUMMARY.md    # Implementation status
```

### Directory Purpose Explanations

**`app/`** - Expo Router file-based routing
- Each file/folder becomes a route
- `_layout.tsx` files define navigation structure
- `(tabs)` is a route group (doesn't affect URL)
- Routes can be stack screens or modals

**`src/components/`** - React components organized by domain
- `ui/` - Global, reusable UI primitives (Toast, BottomSheet)
- `exercise/` - Exercise-specific components
- `settings/` - Settings/preferences components
- `workout/` - Workout execution and visualization components

**`src/hooks/`** - Custom React hooks
- Convenience hooks wrapping Zustand stores
- Provide clean API for common operations

**`src/lib/`** - Business logic and utilities
- `engine/` - Core workout generation and target selection logic
- `supabase/` - Database client and query functions
- `utils/` - Pure utility functions (logging, validation, theme)

**`src/stores/`** - Zustand state management
- One store per domain (UI, user, exercise, workout)
- Stores are the single source of truth for their domain

**`src/types/`** - TypeScript definitions
- Generated types from Supabase schema
- Prevents type drift between code and database

**`supabase/migrations/`** - Database schema changes
- Versioned SQL migrations
- Applied via Supabase MCP or CLI

### File Naming Conventions

- **Components**: PascalCase (e.g., `ExercisePicker.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useToast.ts`)
- **Stores**: camelCase with `Store` suffix (e.g., `uiStore.ts`)
- **Utils**: camelCase (e.g., `logger.ts`, `validation.ts`)
- **Queries**: camelCase (e.g., `exercises.ts`, `prescriptions.ts`)
- **Routes**: kebab-case or route groups (e.g., `login.tsx`, `(tabs)/`)
- **Migrations**: timestamped snake_case (e.g., `20240101000000_create_v2_tables.sql`)

---

## 12) Detailed Table Documentation

### v2_muscles

**Purpose**: Canonical source of truth for muscle keys. All muscle references throughout the system must validate against this table.

**Fields**:
- `key` (text, PRIMARY KEY): Unique muscle identifier (e.g., "chest", "biceps", "quadriceps"). Used as foreign key in other tables.
- `display_name` (text, NOT NULL): Human-readable name (e.g., "Chest", "Biceps", "Quadriceps").
- `group` (text, nullable): Muscle group categorization (e.g., "upper_body", "lower_body", "core").
- `sort_order` (int, nullable): Display ordering for UI lists.
- `is_active` (boolean, default true): Soft delete flag. Inactive muscles are hidden from selection but preserved for historical data.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**Relationships**:
- Referenced by: `v2_exercises.primary_muscles[]`, `v2_exercises.implicit_hits{}`, `v2_muscle_freshness.muscle_key`, `v2_daily_muscle_stress.muscle_key`

**RLS**: Auth SELECT only (immutable from client)

**Example Data**:
```
key: "chest"
display_name: "Chest"
group: "upper_body"
sort_order: 1
is_active: true
```

### v2_exercises

**Purpose**: Master exercise list. Immutable from client. Single source of truth for exercise metadata used by picker and all engine calculations.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique exercise identifier.
- `name` (text, NOT NULL): Exercise name (e.g., "Barbell Bench Press").
- `description` (text, nullable): Exercise description/instructions.
- `density_score` (numeric, NOT NULL, CHECK 0-10): Exercise density rating (0-10 scale). Higher = more comprehensive exercise. Used for exercise selection prioritization.
- `primary_muscles` (text[], NOT NULL): Array of muscle keys from `v2_muscles`. Primary muscles targeted by this exercise.
- `secondary_muscles` (text[], nullable): Secondary muscles involved.
- `implicit_hits` (jsonb, NOT NULL): JSON object mapping muscle_key → activation (0-1). Muscles not in primary_muscles but still activated. Keys must exist in `v2_muscles.key`, values clamped 0-1.
- `is_unilateral` (boolean, NOT NULL): If true, exercise is performed one side at a time (doubles time estimate).
- `setup_buffer_sec` (int, NOT NULL): One-time setup time in seconds (equipment setup, positioning).
- `avg_time_per_set_sec` (int, NOT NULL): Average time per set in seconds, **includes rest time between sets**. Used for workout duration estimation.
- `is_timed` (boolean, NOT NULL, default false): If true, exercise is time-based (e.g., plank) rather than rep-based.
- `equipment_needed` (text[], nullable): Array of required equipment (e.g., ["barbell", "bench"]).
- `movement_pattern` (text, nullable): Movement pattern category (e.g., "push", "pull", "squat", "hinge").
- `tempo_category` (text, nullable): Tempo classification (e.g., "explosive", "controlled").
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**Constraints**:
- `density_score` must be between 0 and 10
- All `primary_muscles[]` values must exist in `v2_muscles.key` (enforced by validation layer)
- All `implicit_hits{}` keys must exist in `v2_muscles.key`, values clamped 0-1 (enforced by validation layer)

**RLS**: Auth SELECT only (immutable from client)

**Indexes**:
- `idx_v2_exercises_density_score`: For sorting/filtering by density

**Example Data**:
```
id: "550e8400-e29b-41d4-a716-446655440000"
name: "Barbell Bench Press"
density_score: 9.5
primary_muscles: ["chest", "triceps", "shoulders"]
implicit_hits: {"core": 0.3, "lats": 0.2}
is_unilateral: false
setup_buffer_sec: 30
avg_time_per_set_sec: 120
is_timed: false
equipment_needed: ["barbell", "bench"]
movement_pattern: "push"
```

### v2_exercise_prescriptions

**Purpose**: Curated programming targets per exercise by context (goal, experience, mode). Prevents generic defaults (3x10, 60s).

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique prescription identifier.
- `exercise_id` (uuid, NOT NULL, FK → v2_exercises.id): Exercise this prescription applies to.
- `goal` (text, NOT NULL): Training goal context. Values: "strength", "hypertrophy", "conditioning", "mobility", "skill".
- `experience` (text, NOT NULL): Experience level context. Values: "beginner", "intermediate", "advanced".
- `mode` (text, NOT NULL, CHECK 'reps' | 'timed'): Exercise mode. Determines which fields are populated.
- `sets_min` (int, NOT NULL): Minimum recommended sets (1-10).
- `sets_max` (int, NOT NULL): Maximum recommended sets (1-10, >= sets_min).
- `reps_min` (int, nullable): Minimum reps (only when mode='reps', 1-50).
- `reps_max` (int, nullable): Maximum reps (only when mode='reps', 1-50, >= reps_min).
- `duration_sec_min` (int, nullable): Minimum duration in seconds (only when mode='timed', 5-3600).
- `duration_sec_max` (int, nullable): Maximum duration in seconds (only when mode='timed', 5-3600, >= duration_sec_min).
- `is_active` (boolean, NOT NULL, default true): Soft delete flag.
- `source_notes` (text, nullable): Notes about prescription source (research, expert opinion, etc.).
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**Constraints**:
- UNIQUE `(exercise_id, goal, experience, mode)`: One prescription per exercise/context/mode combination.
- `sets_min >= 1 AND sets_max >= sets_min AND sets_max <= 10`
- Mode gating: if mode='reps' then reps fields NOT NULL AND duration fields NULL; if mode='timed' then duration fields NOT NULL AND reps fields NULL.
- `reps_min >= 1 AND reps_max >= reps_min AND reps_max <= 50` (when mode='reps')
- `duration_sec_min >= 5 AND duration_sec_max >= duration_sec_min AND duration_sec_max <= 3600` (when mode='timed')

**RLS**: Auth SELECT only (immutable from client)

**Indexes**:
- `idx_v2_exercise_prescriptions_lookup`: On `(exercise_id, goal, experience, mode, is_active)` for fast lookups

**Example Data**:
```
exercise_id: "550e8400-e29b-41d4-a716-446655440000"
goal: "hypertrophy"
experience: "intermediate"
mode: "reps"
sets_min: 3
sets_max: 4
reps_min: 8
reps_max: 12
duration_sec_min: NULL
duration_sec_max: NULL
```

### v2_ai_recommended_exercises

**Purpose**: Thin allow-list for AI exercise selection. Only exercises in this table can be selected by AI generation.

**Fields**:
- `exercise_id` (uuid, PRIMARY KEY, FK → v2_exercises.id): Exercise allowed for AI selection.
- `is_active` (boolean, NOT NULL, default true): Soft delete flag.
- `priority_order` (int, nullable): Selection priority (lower = higher priority). Used for ordering when multiple exercises match criteria.
- `notes` (text, nullable): Admin notes about why this exercise is recommended.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**RLS**: Auth SELECT only (immutable from client)

**Indexes**:
- `idx_v2_ai_recommended_exercises_active`: On `(is_active, priority_order)` for efficient AI selection queries

**Example Data**:
```
exercise_id: "550e8400-e29b-41d4-a716-446655440000"
is_active: true
priority_order: 1
notes: "Excellent compound movement for upper body"
```

### v2_user_exercise_overrides

**Purpose**: User-specific overrides for master exercises. Allows customization without corrupting global data.

**Fields**:
- `user_id` (uuid, NOT NULL, FK → auth.users.id): User who owns this override.
- `exercise_id` (uuid, NOT NULL, FK → v2_exercises.id): Exercise being overridden.
- `density_score_override` (numeric, nullable, CHECK 0-10): Override for density_score.
- `primary_muscles_override` (text[], nullable): Override for primary_muscles array.
- `implicit_hits_override` (jsonb, nullable): Override for implicit_hits object.
- `is_unilateral_override` (boolean, nullable): Override for is_unilateral.
- `setup_buffer_sec_override` (int, nullable): Override for setup_buffer_sec.
- `avg_time_per_set_sec_override` (int, nullable): Override for avg_time_per_set_sec.
- `is_timed_override` (boolean, nullable): Override for is_timed.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**Constraints**:
- PRIMARY KEY `(user_id, exercise_id)`: One override per user/exercise combination.
- `density_score_override` must be 0-10 if not null.

**RLS**: Auth CRUD for owner only (`user_id = auth.uid()`)

**Indexes**:
- `idx_v2_user_exercise_overrides_user`: On `user_id` for efficient user queries

**Merge Rule**: Non-null override fields take precedence over global defaults. Null means use global default.

**Example Data**:
```
user_id: "user-uuid-123"
exercise_id: "550e8400-e29b-41d4-a716-446655440000"
avg_time_per_set_sec_override: 150
setup_buffer_sec_override: 45
```

### v2_user_custom_exercises

**Purpose**: User-created exercises not in master list. Must include required metadata for engine eligibility.

**Fields**: Same structure as `v2_exercises` plus:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique custom exercise identifier.
- `user_id` (uuid, NOT NULL, FK → auth.users.id): User who owns this exercise.

**RLS**: Auth CRUD for owner only (`user_id = auth.uid()`)

**Indexes**:
- `idx_v2_user_custom_exercises_user`: On `user_id` for efficient user queries

**Example Data**: Same structure as `v2_exercises` with `user_id` field.

### v2_profiles

**Purpose**: User profile and preferences. Stores user settings and preferences used throughout the app.

**Fields**:
- `id` (uuid, PRIMARY KEY, FK → auth.users.id): User ID (matches auth.users.id).
- `full_name` (text, nullable): User's full name.
- `age` (int, nullable): User's age.
- `gender` (text, nullable): User's gender.
- `height` (numeric, nullable): User's height (in cm or inches based on use_imperial).
- `current_weight` (numeric, nullable): Current weight (in kg or lbs).
- `goal_weight` (numeric, nullable): Target weight (in kg or lbs).
- `experience_level` (text, nullable): Experience level: "beginner", "intermediate", "advanced".
- `goal` (text, nullable): Training goal: "strength", "hypertrophy", "conditioning", "mobility", "skill".
- `equipment_access` (text[], nullable): Array of available equipment.
- `days_per_week` (int, nullable): Target training days per week.
- `workout_days` (text[], nullable): Specific days of week (e.g., ["Monday", "Wednesday", "Friday"]).
- `preferred_training_style` (text, nullable): Preferred training style.
- `use_imperial` (boolean, default true): If true, use imperial units (lbs, inches); if false, use metric (kg, cm).
- `avatar_url` (text, nullable): URL to user's profile picture in Supabase Storage.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**RLS**: Auth CRUD for owner only (`id = auth.uid()`)

**Example Data**:
```
id: "user-uuid-123"
full_name: "John Doe"
age: 30
experience_level: "intermediate"
goal: "hypertrophy"
days_per_week: 4
use_imperial: true
```

### v2_workout_templates

**Purpose**: Workout plan templates. Stores structure and intent only, not hardcoded targets.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique template identifier.
- `user_id` (uuid, nullable, FK → auth.users.id): User who owns this template. NULL for system templates.
- `name` (text, NOT NULL, default 'Weekly Plan'): Template name.
- `is_active` (boolean, default true): Soft delete flag.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**RLS**: Auth CRUD for owner only (`user_id = auth.uid() OR user_id IS NULL`)

**Relationships**:
- Has many: `v2_template_days`

### v2_template_days

**Purpose**: Days within a workout template.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique day identifier.
- `template_id` (uuid, NOT NULL, FK → v2_workout_templates.id): Parent template.
- `day_name` (text, NOT NULL): Day name (e.g., "Monday", "Day 1").
- `sort_order` (int, NOT NULL): Display ordering.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**Constraints**:
- UNIQUE `(template_id, day_name)`: One day name per template.

**RLS**: Auth CRUD via template ownership

**Relationships**:
- Belongs to: `v2_workout_templates`
- Has many: `v2_template_slots`

### v2_template_slots

**Purpose**: Exercise slots within a template day. Stores intent only; targets come from prescriptions.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique slot identifier.
- `day_id` (uuid, NOT NULL, FK → v2_template_days.id): Parent day.
- `exercise_id` (uuid, nullable, FK → v2_exercises.id): Exercise for this slot. NULL = constraint spec (future).
- `goal` (text, nullable): Goal override for prescription lookup (defaults from profile if null).
- `experience` (text, nullable): Experience override for prescription lookup (defaults from profile if null).
- `notes` (text, nullable): User notes for this slot.
- `sort_order` (int, NOT NULL): Display ordering within day.
- `created_at` (timestamptz, default now()): Record creation timestamp.
- `updated_at` (timestamptz, default now()): Last update timestamp.

**RLS**: Auth CRUD via template ownership

**Relationships**:
- Belongs to: `v2_template_days`
- References: `v2_exercises` (nullable)

**Note**: Targets are NOT stored here. They are fetched from `v2_exercise_prescriptions` at render/generation time using context (slot goal/experience or profile defaults).

### v2_workout_sessions

**Purpose**: Performed workout sessions. The truth source for what actually happened.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique session identifier.
- `user_id` (uuid, NOT NULL, FK → auth.users.id): User who performed this session.
- `template_id` (uuid, nullable, FK → v2_workout_templates.id): Template this session was based on (if any).
- `day_name` (text, nullable): Day name from template (if any).
- `status` (text, NOT NULL, default 'active', CHECK 'active'|'completed'|'abandoned'): Session status.
- `started_at` (timestamptz, default now()): When session started.
- `completed_at` (timestamptz, nullable): When session was completed (if status='completed').

**RLS**: Auth CRUD for owner only (`user_id = auth.uid()`)

**Indexes**:
- `idx_v2_workout_sessions_user`: On `(user_id, started_at)` for efficient user history queries

**Relationships**:
- Belongs to: `v2_workout_templates` (nullable)
- Has many: `v2_session_exercises`

**Example Data**:
```
id: "session-uuid-123"
user_id: "user-uuid-123"
template_id: "template-uuid-456"
day_name: "Monday"
status: "completed"
started_at: "2024-01-15T10:00:00Z"
completed_at: "2024-01-15T11:30:00Z"
```

### v2_session_exercises

**Purpose**: Exercises performed in a session.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique session exercise identifier.
- `session_id` (uuid, NOT NULL, FK → v2_workout_sessions.id): Parent session.
- `exercise_id` (uuid, nullable, FK → v2_exercises.id): Master exercise (if used).
- `custom_exercise_id` (uuid, nullable, FK → v2_user_custom_exercises.id): User custom exercise (if used).
- `sort_order` (int, NOT NULL): Order within session.
- `created_at` (timestamptz, default now()): Record creation timestamp.

**Constraints**:
- CHECK: Exactly one of `exercise_id` or `custom_exercise_id` must be NOT NULL (mutually exclusive).

**RLS**: Auth CRUD via session ownership

**Indexes**:
- `idx_v2_session_exercises_session`: On `(session_id, sort_order)` for efficient session queries

**Relationships**:
- Belongs to: `v2_workout_sessions`
- References: `v2_exercises` OR `v2_user_custom_exercises` (mutually exclusive)
- Has many: `v2_session_sets`

### v2_session_sets

**Purpose**: Individual sets performed. Must have either reps or duration_sec, not both.

**Fields**:
- `id` (uuid, PRIMARY KEY, default gen_random_uuid()): Unique set identifier.
- `session_exercise_id` (uuid, NOT NULL, FK → v2_session_exercises.id): Parent session exercise.
- `set_number` (int, NOT NULL): Set number within exercise (1, 2, 3, ...).
- `reps` (int, nullable, CHECK 1-50): Reps performed (for rep-based exercises).
- `weight` (numeric, nullable, CHECK >= 0): Weight used (in kg or lbs based on user preference).
- `rpe` (int, nullable, CHECK 1-10): Rate of Perceived Exertion (1-10 scale).
- `rir` (int, nullable): Reps in Reserve (alternative to RPE).
- `duration_sec` (int, nullable, CHECK 5-3600): Duration in seconds (for timed exercises).
- `rest_sec` (int, nullable, CHECK 0-600): Rest time after this set (in seconds).
- `notes` (text, nullable): User notes for this set.
- `performed_at` (timestamptz, default now()): When this set was performed.

**Constraints**:
- `reps` must be 1-50 if not null
- `weight` must be >= 0 if not null
- `rpe` must be 1-10 if not null
- `duration_sec` must be 5-3600 if not null
- `rest_sec` must be 0-600 if not null
- `reps` and `duration_sec` are mutually exclusive (CHECK: NOT (reps IS NOT NULL AND duration_sec IS NOT NULL))
- At least one of `reps` or `duration_sec` must be NOT NULL (CHECK: reps IS NOT NULL OR duration_sec IS NOT NULL)
- `rpe` and `rir` are mutually exclusive (CHECK: NOT (rpe IS NOT NULL AND rir IS NOT NULL))

**RLS**: Auth CRUD via session ownership

**Indexes**:
- `idx_v2_session_sets_exercise`: On `(session_exercise_id, set_number)` for efficient set queries

**Relationships**:
- Belongs to: `v2_session_exercises`

**Example Data (Rep-based)**:
```
session_exercise_id: "session-exercise-uuid-123"
set_number: 1
reps: 10
weight: 100.5
rpe: 8
duration_sec: NULL
```

**Example Data (Timed)**:
```
session_exercise_id: "session-exercise-uuid-456"
set_number: 1
reps: NULL
weight: NULL
duration_sec: 60
rpe: 7
```

### v2_muscle_freshness

**Purpose**: Derived cache for muscle recovery state (0-100). Rebuildable from `v2_session_sets`. Never primary truth.

**Fields**:
- `user_id` (uuid, NOT NULL, FK → auth.users.id): User.
- `muscle_key` (text, NOT NULL, FK → v2_muscles.key): Muscle.
- `freshness` (numeric, NOT NULL, default 100, CHECK 0-100): Recovery state (0 = fully fatigued, 100 = fully recovered).
- `last_trained_at` (timestamptz, nullable): When this muscle was last trained.
- `updated_at` (timestamptz, default now()): Last cache update timestamp.

**Constraints**:
- PRIMARY KEY `(user_id, muscle_key)`: One freshness value per user/muscle.
- `freshness` must be 0-100.

**RLS**: Auth CRUD for owner only (`user_id = auth.uid()`)

**Indexes**:
- `idx_v2_muscle_freshness_user`: On `user_id` for efficient user queries

**Note**: This is a cache. Can be rebuilt from `v2_session_sets` using fatigue model formulas. Never used as primary truth.

### v2_daily_muscle_stress

**Purpose**: Derived cache for daily muscle stress aggregation. Used for heatmap visualization. Rebuildable from `v2_session_sets`.

**Fields**:
- `user_id` (uuid, NOT NULL, FK → auth.users.id): User.
- `date` (date, NOT NULL): Date of stress accumulation.
- `muscle_key` (text, NOT NULL, FK → v2_muscles.key): Muscle.
- `stress` (numeric, NOT NULL, default 0): Accumulated stress for this muscle on this date.
- `updated_at` (timestamptz, default now()): Last cache update timestamp.

**Constraints**:
- PRIMARY KEY `(user_id, date, muscle_key)`: One stress value per user/date/muscle.

**RLS**: Auth CRUD for owner only (`user_id = auth.uid()`)

**Indexes**:
- `idx_v2_daily_muscle_stress_user_date`: On `(user_id, date)` for efficient heatmap queries

**Note**: This is a cache. Can be rebuilt from `v2_session_sets` using stress accumulation formulas. Used for heatmap display (shows daily muscle stress, not freshness).

---

## 13) Variable Naming Conventions

### Database Naming

- **Tables**: `v2_` prefix + `snake_case` (e.g., `v2_exercises`, `v2_workout_sessions`)
- **Columns**: `snake_case` (e.g., `density_score`, `avg_time_per_set_sec`)
- **Foreign Keys**: `{referenced_table}_id` (e.g., `exercise_id`, `user_id`)
- **Timestamps**: `created_at`, `updated_at`, `performed_at`, `started_at`, `completed_at`
- **Boolean flags**: `is_` prefix (e.g., `is_active`, `is_timed`, `is_unilateral`)
- **Override fields**: `{field_name}_override` (e.g., `density_score_override`)
- **Array fields**: Plural form (e.g., `primary_muscles`, `equipment_needed`)

### TypeScript/JavaScript Naming

- **Components**: `PascalCase` (e.g., `ExercisePicker`, `BottomSheet`)
- **Hooks**: `camelCase` with `use` prefix (e.g., `useToast`, `useExercisePicker`)
- **Stores**: `camelCase` with `Store` suffix (e.g., `uiStore`, `userStore`)
- **Functions**: `camelCase` (e.g., `getMergedExercise`, `selectExerciseTargets`)
- **Variables**: `camelCase` (e.g., `exerciseId`, `userId`, `targetSets`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_SETS`, `DEFAULT_STIMULUS`)
- **Types/Interfaces**: `PascalCase` (e.g., `MergedExercise`, `ExerciseTarget`)
- **Enums**: `PascalCase` with `Enum` suffix or descriptive name (e.g., `GoalEnum`, `ExperienceLevel`)

### Store State Naming

- **State properties**: `camelCase` (e.g., `activeBottomSheet`, `selectedExercises`)
- **Actions**: `camelCase` verb (e.g., `openBottomSheet`, `setProfile`, `addSelectedExercise`)
- **Selectors**: Descriptive `camelCase` (e.g., `getActiveSession`, `getUserProfile`)

### Query Function Naming

- **Get single**: `get{Entity}` (e.g., `getMergedExercise`, `getUserProfile`)
- **Get multiple**: `list{Entities}` or `get{Entities}` (e.g., `listMergedExercises`, `getExercisePrescriptions`)
- **Create**: `create{Entity}` (e.g., `createWorkoutSession`)
- **Update**: `update{Entity}` (e.g., `updateUserProfile`)
- **Save**: `save{Entity}` (e.g., `saveSessionSet`)
- **Bulk operations**: `{operation}{Entities}Bulk` (e.g., `selectExerciseTargetsBulk`)

### Component Props Naming

- **Props**: `camelCase` (e.g., `onSelect`, `multiSelect`, `userId`)
- **Event handlers**: `on{Action}` (e.g., `onSelect`, `onClose`, `onSubmit`)
- **Boolean props**: `is{State}` or `has{Property}` (e.g., `isLoading`, `hasError`)

### Algorithm Variable Naming

- **Mathematical variables**: Single letter or descriptive (e.g., `S` for sets, `Tset` for time per set, `stimulus` for effort)
- **Iterators**: `i`, `j`, `k` for loops; descriptive names for forEach/map (e.g., `exercise`, `muscle`)
- **Accumulators**: Descriptive names (e.g., `totalStress`, `aggregated`, `merged`)

### File Naming

- **Components**: `PascalCase.tsx` (e.g., `ExercisePicker.tsx`)
- **Hooks**: `camelCase.ts` with `use` prefix (e.g., `useToast.ts`)
- **Stores**: `camelCase.ts` with `Store` suffix (e.g., `uiStore.ts`)
- **Utils**: `camelCase.ts` (e.g., `logger.ts`, `validation.ts`)
- **Queries**: `camelCase.ts` (e.g., `exercises.ts`, `prescriptions.ts`)
- **Types**: `camelCase.ts` (e.g., `supabase.ts`)
- **Routes**: `kebab-case.tsx` or route groups (e.g., `login.tsx`, `(tabs)/`)

### Common Patterns

- **IDs**: Always suffix with `Id` (e.g., `exerciseId`, `userId`, `sessionId`)
- **Counts**: Suffix with `Count` (e.g., `historyCount`, `setCount`)
- **Arrays**: Plural form (e.g., `exercises`, `muscles`, `targets`)
- **Maps/Objects**: Descriptive name + `Map` or context (e.g., `overrideMap`, `prescriptionMap`)
- **Flags**: `is`/`has` prefix (e.g., `isActive`, `hasOverrides`)
- **Nullable**: Use TypeScript `| null` or `?` optional chaining; name doesn't change

---

## 14) Data Flow Maps

### Exercise Selection Flow

```
User Action: Opens Exercise Picker
    ↓
UI Component: ExercisePicker.tsx
    ↓
Zustand Store: exerciseStore.setSearchQuery()
    ↓
Query Function: supabase.from('v2_exercises').select()
    ↓
Database: v2_exercises (RLS: auth SELECT)
    ↓
Query Function: Returns Exercise[]
    ↓
UI Component: Displays filtered list
    ↓
User Action: Selects exercise
    ↓
Zustand Store: exerciseStore.addSelectedExercise()
    ↓
Callback: onSelect(exercise) → Parent component
    ↓
UI Component: ModalManager.closeBottomSheet()
```

### Merged Exercise View Flow

```
Request: getMergedExercise(exerciseId, userId)
    ↓
Query Function: exercises.ts
    ↓
Step 1: Check v2_user_custom_exercises
    ├─ Found? → Return custom exercise (source: 'custom')
    └─ Not found? → Continue
    ↓
Step 2: Fetch v2_exercises (master)
    ↓
Step 3: Fetch v2_user_exercise_overrides
    ↓
Step 4: Merge Logic
    ├─ For each field:
    │   ├─ Override exists and non-null? → Use override
    │   └─ Otherwise → Use master default
    └─ Return MergedExercise (source: 'override' or 'master')
```

### Target Selection Flow

```
Request: selectExerciseTargets(exerciseId, userId, context, historyCount)
    ↓
Step 1: Get Merged Exercise
    └─ getMergedExercise(exerciseId, userId)
    ↓
Step 2: Determine Mode
    ├─ exercise.is_timed = true? → mode = 'timed'
    └─ Otherwise → mode = 'reps'
    ↓
Step 3: Fetch Prescription
    └─ getExercisePrescription(exerciseId, goal, experience, mode)
    ├─ Found? → Continue
    └─ Not found? → Return null (data error, exclude from generation)
    ↓
Step 4: Select Targets Within Band
    ├─ Sets: historyCount < 3? → lower-to-mid : mid-to-upper
    ├─ Reps (if mode='reps'): historyCount < 3? → lower-to-mid : mid-to-upper
    └─ Duration (if mode='timed'): historyCount < 3? → lower-to-mid : mid-to-upper
    ↓
Step 5: Clamp to Prescription Bounds
    └─ Ensure targets are within [min, max] ranges
    ↓
Return: ExerciseTarget { exercise_id, sets, reps/duration, mode }
```

### Workout Session Flow

```
User Action: Start Workout
    ↓
Query Function: createWorkoutSession(userId, templateId, dayName)
    ↓
Database: INSERT into v2_workout_sessions
    ↓
Zustand Store: workoutStore.setActiveSession(session)
    ↓
UI Component: WorkoutActive screen
    ↓
User Action: Complete Set
    ↓
Query Function: saveSessionSet(sessionExerciseId, setNumber, setData)
    ↓
Database: INSERT/UPDATE v2_session_sets
    ├─ Validation: DB CHECK constraints enforce bounds
    └─ RLS: Ensures user owns session
    ↓
User Action: Complete Workout
    ↓
Query Function: completeWorkoutSession(sessionId)
    ↓
Database: UPDATE v2_workout_sessions SET status='completed', completed_at=now()
    ↓
Zustand Store: workoutStore.completeSession()
```

### Fatigue Calculation Flow

```
Trigger: After workout session completion
    ↓
Input: v2_session_sets for date range
    ↓
Step 1: Calculate Per-Set Stimulus
    ├─ Has rpe? → stimulus = clamp((rpe - 5) / 5, 0, 1)
    ├─ Has rir? → rpe_est = clamp(10 - rir, 1, 10), then stimulus
    └─ Neither? → stimulus = 0.6 (devLog warning)
    ↓
Step 2: Get Merged Exercise Metadata
    └─ getMergedExercise(exerciseId, userId)
    ↓
Step 3: Calculate Muscle Weighting
    ├─ For each muscle m:
    │   ├─ m ∈ primary_muscles? → w_m = 1.0
    │   └─ m ∈ implicit_hits? → w_m = implicit_hits[m]
    └─ Normalize: p_m = w_m / Σw_m
    ↓
Step 4: Accumulate Stress
    └─ For each set: muscle_stress(m) += stimulus * p_m
    ↓
Step 5: Aggregate by Day
    └─ daily_muscle_stress[user, date, m] = Σ muscle_stress(m)
    ↓
Step 6: Update Cache (Optional)
    └─ INSERT/UPDATE v2_daily_muscle_stress
    ↓
Step 7: Calculate Freshness (Optional)
    ├─ Fatigue drop: ΔF_m = k * daily_muscle_stress
    ├─ Apply: F_m_after = clamp(F_m_before - ΔF_m, 0, 100)
    └─ Recovery: F_m_new = clamp(F_m_old + regen, 0, 100)
    ↓
Step 8: Update Cache (Optional)
    └─ INSERT/UPDATE v2_muscle_freshness
```

### Prescription Lookup Flow

```
Context: Generating workout slot targets
    ↓
Input: exerciseId, user context
    ↓
Step 1: Get User Profile
    └─ getUserProfile(userId) → goal, experience
    ↓
Step 2: Check Slot Overrides
    ├─ slot.goal exists? → use slot.goal
    └─ slot.experience exists? → use slot.experience
    ↓
Step 3: Fallback to Profile
    ├─ No slot goal? → use profile.goal
    ├─ No slot experience? → use profile.experience
    └─ No profile values? → use defaults ('strength', 'beginner') + devLog
    ↓
Step 4: Determine Mode
    └─ getMergedExercise(exerciseId, userId) → is_timed
    ↓
Step 5: Fetch Prescription
    └─ getExercisePrescription(exerciseId, goal, experience, mode)
    ├─ Found? → Use prescription
    └─ Not found? → Data error (exclude exercise, devLog, user-facing error)
```

### Toast Notification Flow

```
Trigger: Any component needs to show toast
    ↓
Hook: useToast().success(message) / .error(message) / .info(message)
    ↓
Zustand Store: uiStore.showToast(message, type, duration)
    ↓
Store State: toasts array updated
    ↓
UI Component: ToastProvider (renders all toasts)
    ↓
Component: Toast.tsx (individual toast)
    ├─ Animates in
    ├─ Auto-removes after duration
    └─ User can dismiss
    ↓
Store Action: uiStore.removeToast(id)
    ↓
Store State: toasts array updated (toast removed)
```

### Bottom Sheet Flow

```
Trigger: Component needs to open bottom sheet
    ↓
Hook: useModal().openSheet('exercisePicker', { onSelect, multiSelect })
    ↓
Zustand Store: uiStore.openBottomSheet(id, props)
    ↓
Store State: activeBottomSheet = 'exercisePicker', bottomSheetProps = { onSelect, multiSelect }
    ↓
UI Component: ModalManager (watches activeBottomSheet)
    ↓
Component: BottomSheet (renders based on activeBottomSheet)
    ├─ Renders ExercisePicker with props
    └─ Handles close gesture
    ↓
User Action: Close sheet
    ↓
Zustand Store: uiStore.closeBottomSheet()
    ↓
Store State: activeBottomSheet = null, bottomSheetProps = {}
    ↓
UI Component: BottomSheet animates out

---

## 15) Component and Function Maps

### UI Components

#### `Toast.tsx`
**Location**: `src/components/ui/Toast.tsx`
**Purpose**: Individual toast notification component
**Props**:
- `message` (string): Toast message text
- `type` ('success' | 'error' | 'info'): Toast type (affects icon and color)
- `onHide` (function): Callback when toast should be removed
- `duration` (number, default 2000ms): Auto-hide duration
**Behavior**: Animates in/out, auto-hides after duration, shows icon based on type

#### `ToastProvider.tsx`
**Location**: `src/components/ui/ToastProvider.tsx`
**Purpose**: Global toast provider that renders all active toasts from Zustand store
**Behavior**: Watches `uiStore.toasts`, renders `Toast` components, handles removal

#### `BottomSheet.tsx`
**Location**: `src/components/ui/BottomSheet.tsx`
**Purpose**: Reusable bottom sheet component with animations
**Props**:
- `visible` (boolean): Whether sheet is visible
- `onClose` (function): Close handler
- `title` (string, optional): Sheet title
- `children` (ReactNode): Sheet content
- `height` (number | string): Sheet height (pixels or percentage)
**Behavior**: Animates slide-up/down, backdrop overlay, handle bar, close button

#### `ModalManager.tsx`
**Location**: `src/components/ui/ModalManager.tsx`
**Purpose**: Global manager for bottom sheets, prevents modal-in-modal
**Behavior**: Watches `uiStore.activeBottomSheet`, conditionally renders appropriate sheet (ExercisePicker, SettingsMenu, etc.)

#### `ExercisePicker.tsx`
**Location**: `src/components/exercise/ExercisePicker.tsx`
**Purpose**: Exercise selection bottom sheet with search
**Props**:
- `onSelect` (function, optional): Callback when exercise selected
- `multiSelect` (boolean, default false): Allow multiple selections
**Behavior**: Loads exercises from `v2_exercises`, filters by search query, displays list, handles selection

#### `SettingsMenu.tsx`
**Location**: `src/components/settings/SettingsMenu.tsx`
**Purpose**: Settings menu bottom sheet
**Props**:
- `onClose` (function, optional): Close handler
**Behavior**: Displays menu items (Edit Profile, Notifications, Help), navigates to routes on selection

#### `WorkoutHeatmap.tsx`
**Location**: `src/components/workout/WorkoutHeatmap.tsx`
**Purpose**: Muscle stress heatmap visualization
**Props**:
- `userId` (string): User ID
- `dateRange` ({ start: Date, end: Date }): Date range for heatmap
- `onMuscleSelect` (function, optional): Callback when muscle selected
**Behavior**: Loads `v2_daily_muscle_stress` for date range, aggregates by muscle, displays color-coded grid

### Hooks

#### `useToast()`
**Location**: `src/hooks/useToast.ts`
**Purpose**: Convenience hook for showing toasts
**Returns**: `{ show, success, error, info }`
**Usage**: `const toast = useToast(); toast.success('Saved!');`

#### `useExercisePicker()`
**Location**: `src/hooks/useExercisePicker.ts`
**Purpose**: Convenience hook for opening exercise picker
**Returns**: `{ open, close }`
**Usage**: `const picker = useExercisePicker(); picker.open((exercise) => { ... });`

#### `useModal()`
**Location**: `src/hooks/useModal.ts`
**Purpose**: Convenience hook for modal/sheet management
**Returns**: `{ openSheet, closeSheet, isOpen }`
**Usage**: `const modal = useModal(); modal.openSheet('settingsMenu');`

### Query Functions

#### `getMergedExercise(exerciseId, userId)`
**Location**: `src/lib/supabase/queries/exercises.ts`
**Purpose**: Get merged exercise view (master defaults ⊕ user overrides)
**Returns**: `MergedExercise | null`
**Logic**:
1. Check for user custom exercise
2. If found, return custom (source: 'custom')
3. Otherwise, fetch master exercise
4. Fetch user overrides
5. Merge: override wins when non-null
6. Return merged (source: 'override' or 'master')

#### `listMergedExercises(userId, exerciseIds?)`
**Location**: `src/lib/supabase/queries/exercises.ts`
**Purpose**: Bulk version of getMergedExercise
**Returns**: `MergedExercise[]`
**Logic**: Same as getMergedExercise but for multiple exercises, optimized with bulk queries

#### `getExercisePrescription(exerciseId, goal, experience, mode)`
**Location**: `src/lib/supabase/queries/prescriptions.ts`
**Purpose**: Fetch prescription for exercise given context
**Returns**: `ExercisePrescription | null`
**Logic**: Query `v2_exercise_prescriptions` with exact match on (exercise_id, goal, experience, mode, is_active=true)

#### `getPrescriptionsForExercises(exerciseIds, goal, experience, mode)`
**Location**: `src/lib/supabase/queries/prescriptions.ts`
**Purpose**: Bulk prescription fetch
**Returns**: `Map<string, ExercisePrescription>`
**Logic**: Bulk query, returns map keyed by exercise_id for O(1) lookup

#### `createWorkoutSession(userId, templateId?, dayName?)`
**Location**: `src/lib/supabase/queries/workouts.ts`
**Purpose**: Create new workout session
**Returns**: `WorkoutSession | null`
**Logic**: INSERT into `v2_workout_sessions` with status='active'

#### `getActiveSession(userId)`
**Location**: `src/lib/supabase/queries/workouts.ts`
**Purpose**: Get user's active session
**Returns**: `WorkoutSession | null`
**Logic**: Query `v2_workout_sessions` WHERE user_id AND status='active', ORDER BY started_at DESC, LIMIT 1

#### `saveSessionSet(sessionExerciseId, setNumber, setData)`
**Location**: `src/lib/supabase/queries/workouts.ts`
**Purpose**: Save or update a set
**Returns**: `SessionSet | null`
**Logic**: Check if set exists, UPDATE if exists else INSERT

#### `getUserProfile(userId)`
**Location**: `src/lib/supabase/queries/users.ts`
**Purpose**: Get user profile
**Returns**: `UserProfile | null`
**Logic**: Query `v2_profiles` WHERE id=userId

#### `updateUserProfile(userId, updates)`
**Location**: `src/lib/supabase/queries/users.ts`
**Purpose**: Update user profile
**Returns**: `boolean` (success)
**Logic**: UPDATE `v2_profiles` SET updates WHERE id=userId

### Engine Functions

#### `selectExerciseTargets(exerciseId, userId, context, historyCount)`
**Location**: `src/lib/engine/targetSelection.ts`
**Purpose**: Select targets for single exercise using prescriptions
**Returns**: `ExerciseTarget | null`
**Logic**:
1. Get merged exercise (determine mode)
2. Fetch prescription (goal, experience, mode)
3. If no prescription → return null (data error)
4. Select targets within prescription band (historyCount determines lower-to-mid vs mid-to-upper)
5. Clamp to bounds
6. Return ExerciseTarget

#### `selectExerciseTargetsBulk(exerciseIds, userId, context, historyCounts)`
**Location**: `src/lib/engine/targetSelection.ts`
**Purpose**: Bulk version of selectExerciseTargets
**Returns**: `ExerciseTarget[]`
**Logic**: Same as selectExerciseTargets but for multiple exercises, filters out exercises without prescriptions

### Utility Functions

#### `devLog(module, payload)`
**Location**: `src/lib/utils/logger.ts`
**Purpose**: Structured dev logging
**Behavior**: Wrapped in `__DEV__` check, logs to console with module prefix

#### `devError(module, error, context?)`
**Location**: `src/lib/utils/logger.ts`
**Purpose**: Dev error logging
**Behavior**: Wrapped in `__DEV__` check, logs error with context

#### `validateMuscleKeys(muscleKeys, availableMuscles)`
**Location**: `src/lib/utils/validation.ts`
**Purpose**: Validate muscle keys exist in v2_muscles
**Returns**: `string[]` (array of invalid keys)
**Logic**: Check each key against availableMuscles Set, return invalid ones

#### `validateAndClampImplicitHits(implicitHits, availableMuscles)`
**Location**: `src/lib/utils/validation.ts`
**Purpose**: Validate and clamp implicit_hits values
**Returns**: `Record<string, number>` (validated object)
**Logic**: Validate keys exist, clamp values to 0-1, return validated object

### Zustand Stores

#### `uiStore`
**Location**: `src/stores/uiStore.ts`
**State**:
- `activeBottomSheet`: Current bottom sheet ID or null
- `bottomSheetProps`: Props for current bottom sheet
- `toasts`: Array of active toasts
**Actions**:
- `openBottomSheet(id, props)`: Open bottom sheet
- `closeBottomSheet()`: Close bottom sheet
- `showToast(message, type, duration)`: Show toast
- `removeToast(id)`: Remove toast

#### `userStore`
**Location**: `src/stores/userStore.ts`
**State**:
- `profile`: UserProfile | null
- `isLoading`: boolean
**Actions**:
- `setProfile(profile)`: Set user profile
- `updateProfile(updates)`: Update profile fields
- `clearProfile()`: Clear profile

#### `exerciseStore`
**Location**: `src/stores/exerciseStore.ts`
**State**:
- `searchQuery`: string
- `selectedExercises`: Exercise[]
- `isLoading`: boolean
**Actions**:
- `setSearchQuery(query)`: Set search query
- `setSelectedExercises(exercises)`: Set selected exercises
- `addSelectedExercise(exercise)`: Add exercise to selection
- `removeSelectedExercise(exerciseId)`: Remove exercise from selection
- `clearSelection()`: Clear all selections

#### `workoutStore`
**Location**: `src/stores/workoutStore.ts`
**State**:
- `activeSession`: ActiveSession | null
- `isLoading`: boolean
**Actions**:
- `setActiveSession(session)`: Set active session
- `updateSessionProgress(exerciseIndex, setIndex)`: Update progress
- `completeSession()`: Mark session as completed
- `abandonSession()`: Mark session as abandoned
- `clearSession()`: Clear active session

---

## 16) Connection Maps

### Store to Component Connections

```
uiStore
  ├─→ ToastProvider (watches toasts array)
  │   └─→ Toast (renders individual toasts)
  ├─→ ModalManager (watches activeBottomSheet)
  │   ├─→ BottomSheet (renders when activeBottomSheet !== null)
  │   │   ├─→ ExercisePicker (when activeBottomSheet === 'exercisePicker')
  │   │   └─→ SettingsMenu (when activeBottomSheet === 'settingsMenu')
  └─→ Any Component (via useToast, useModal hooks)
      └─→ Calls store actions (openBottomSheet, showToast, etc.)

userStore
  ├─→ Profile Screen (reads profile, calls updateProfile)
  ├─→ Workout Generation (reads goal, experience for context)
  └─→ Any Component (via useUserStore hook)

exerciseStore
  ├─→ ExercisePicker (reads searchQuery, selectedExercises)
  │   └─→ Calls setSearchQuery, addSelectedExercise
  └─→ Any Component (via useExerciseStore hook)

workoutStore
  ├─→ WorkoutActive Screen (reads activeSession, calls updateSessionProgress)
  ├─→ Home Screen (reads activeSession to show resume button)
  └─→ Any Component (via useWorkoutStore hook)
```

### Query to Store Connections

```
Query Functions (src/lib/supabase/queries/)
  ├─→ exercises.ts
  │   ├─→ getMergedExercise() → Used by engine, components
  │   └─→ listMergedExercises() → Used by engine, components
  ├─→ prescriptions.ts
  │   ├─→ getExercisePrescription() → Used by engine
  │   └─→ getPrescriptionsForExercises() → Used by engine
  ├─→ workouts.ts
  │   ├─→ createWorkoutSession() → Updates workoutStore
  │   ├─→ getActiveSession() → Updates workoutStore
  │   └─→ saveSessionSet() → Called from workout screen
  └─→ users.ts
      ├─→ getUserProfile() → Updates userStore
      └─→ updateUserProfile() → Updates userStore
```

### Component to Query Connections

```
Components
  ├─→ ExercisePicker
  │   └─→ supabase.from('v2_exercises').select() (direct query)
  ├─→ WorkoutHeatmap
  │   └─→ supabase.from('v2_daily_muscle_stress').select() (direct query)
  ├─→ WorkoutActive Screen
  │   ├─→ createWorkoutSession() → workouts.ts
  │   ├─→ saveSessionSet() → workouts.ts
  │   └─→ completeWorkoutSession() → workouts.ts
  └─→ Profile Screen
      ├─→ getUserProfile() → users.ts
      └─→ updateUserProfile() → users.ts
```

### Engine to Query Connections

```
Engine (src/lib/engine/)
  └─→ targetSelection.ts
      ├─→ getMergedExercise() → exercises.ts
      ├─→ getExercisePrescription() → prescriptions.ts
      └─→ getPrescriptionsForExercises() → prescriptions.ts
```

### UI Component Hierarchy

```
app/_layout.tsx (Root)
  ├─→ Stack Navigator (Expo Router)
  │   ├─→ app/index.tsx
  │   ├─→ app/login.tsx
  │   └─→ app/(tabs)/_layout.tsx
  │       └─→ app/(tabs)/index.tsx
  ├─→ ToastProvider (Global)
  │   └─→ Toast (per toast in array)
  └─→ ModalManager (Global)
      └─→ BottomSheet (when active)
          ├─→ ExercisePicker (conditional)
          └─→ SettingsMenu (conditional)
```

### Data Layer Connections

```
Database (Supabase)
  ├─→ v2_muscles (canonical)
  │   └─→ Referenced by: v2_exercises, v2_muscle_freshness, v2_daily_muscle_stress
  ├─→ v2_exercises (master, immutable)
  │   ├─→ Referenced by: v2_exercise_prescriptions, v2_ai_recommended_exercises
  │   ├─→ Referenced by: v2_user_exercise_overrides, v2_template_slots
  │   └─→ Referenced by: v2_session_exercises
  ├─→ v2_exercise_prescriptions (curated targets)
  │   └─→ Used by: engine/targetSelection.ts
  ├─→ v2_user_exercise_overrides (user customization)
  │   └─→ Merged with: v2_exercises (via getMergedExercise)
  ├─→ v2_user_custom_exercises (user-created)
  │   └─→ Alternative to: v2_exercises (via getMergedExercise)
  ├─→ v2_workout_templates (planning)
  │   ├─→ Has many: v2_template_days
  │   └─→ Referenced by: v2_workout_sessions
  ├─→ v2_workout_sessions (performed truth)
  │   └─→ Has many: v2_session_exercises
  └─→ v2_session_sets (performed truth)
      └─→ Used to derive: v2_daily_muscle_stress, v2_muscle_freshness
```

---

## 17) Algorithm Walkthroughs

### Target Selection Algorithm (Detailed)

**Input**: `exerciseId`, `userId`, `context: { goal, experience }`, `historyCount`

**Step-by-step**:

1. **Get Merged Exercise**
   ```
   exercise = getMergedExercise(exerciseId, userId)
   If exercise === null:
     - devError('Exercise not found')
     - Return null
   ```

2. **Determine Mode**
   ```
   If exercise.is_timed === true:
     mode = 'timed'
   Else:
     mode = 'reps'
   ```

3. **Fetch Prescription**
   ```
   prescription = getExercisePrescription(exerciseId, goal, experience, mode)
   If prescription === null:
     - devError('No prescription found')
     - Return null (data error - exercise excluded from generation)
   ```

4. **Select Sets**
   ```
   If historyCount < 3:  // New user
     sets = floor((prescription.sets_min + prescription.sets_max) / 2)
   Else:  // Experienced user
     sets = ceil((prescription.sets_min + prescription.sets_max) / 2)
   
   sets = clamp(sets, prescription.sets_min, prescription.sets_max)
   ```

5. **Select Reps or Duration**
   ```
   If mode === 'reps':
     If historyCount < 3:
       reps = floor((prescription.reps_min + prescription.reps_max) / 2)
     Else:
       reps = ceil((prescription.reps_min + prescription.reps_max) / 2)
     reps = clamp(reps, prescription.reps_min, prescription.reps_max)
     duration_sec = null
   
   Else if mode === 'timed':
     If historyCount < 3:
       duration_sec = floor((prescription.duration_sec_min + prescription.duration_sec_max) / 2)
     Else:
       duration_sec = ceil((prescription.duration_sec_min + prescription.duration_sec_max) / 2)
     duration_sec = clamp(duration_sec, prescription.duration_sec_min, prescription.duration_sec_max)
     reps = null
   ```

6. **Return Target**
   ```
   Return {
     exercise_id: exerciseId,
     sets: sets,
     reps: reps (if mode='reps'),
     duration_sec: duration_sec (if mode='timed'),
     mode: mode
   }
   ```

### Merged Exercise View Algorithm (Detailed)

**Input**: `exerciseId`, `userId`

**Step-by-step**:

1. **Check Custom Exercise**
   ```
   customExercise = SELECT * FROM v2_user_custom_exercises
     WHERE id = exerciseId AND user_id = userId
   
   If customExercise exists:
     Return {
       ...customExercise,
       source: 'custom'
     }
   ```

2. **Fetch Master Exercise**
   ```
   masterExercise = SELECT * FROM v2_exercises WHERE id = exerciseId
   
   If masterExercise === null:
     Return null
   ```

3. **Fetch User Overrides**
   ```
   override = SELECT * FROM v2_user_exercise_overrides
     WHERE exercise_id = exerciseId AND user_id = userId
   ```

4. **Merge Logic (Field-by-Field)**
   ```
   merged = {
     id: masterExercise.id,
     name: masterExercise.name,
     description: override?.description ?? masterExercise.description,
     density_score: override?.density_score_override ?? masterExercise.density_score,
     primary_muscles: override?.primary_muscles_override ?? masterExercise.primary_muscles,
     secondary_muscles: masterExercise.secondary_muscles,  // No override field
     implicit_hits: override?.implicit_hits_override ?? masterExercise.implicit_hits,
     is_unilateral: override?.is_unilateral_override ?? masterExercise.is_unilateral,
     setup_buffer_sec: override?.setup_buffer_sec_override ?? masterExercise.setup_buffer_sec,
     avg_time_per_set_sec: override?.avg_time_per_set_sec_override ?? masterExercise.avg_time_per_set_sec,
     is_timed: override?.is_timed_override ?? masterExercise.is_timed,
     equipment_needed: masterExercise.equipment_needed,  // No override field
     movement_pattern: masterExercise.movement_pattern,  // No override field
     tempo_category: masterExercise.tempo_category,  // No override field
     source: override ? 'override' : 'master'
   }
   ```

5. **Return Merged**
   ```
   Return merged
   ```

### Fatigue Calculation Algorithm (Detailed)

**Input**: `sessionSets: SessionSet[]`, `exercises: Map<exerciseId, MergedExercise>`

**Step-by-step**:

1. **Initialize Stress Map**
   ```
   muscleStress = Map<muscleKey, number>  // Initialize all to 0
   ```

2. **For Each Set**:
   ```
   For each set in sessionSets:
     a. Calculate Stimulus
        If set.rpe exists:
          stimulus = clamp((set.rpe - 5) / 5, 0, 1)
        Else if set.rir exists:
          rpe_est = clamp(10 - set.rir, 1, 10)
          stimulus = clamp((rpe_est - 5) / 5, 0, 1)
        Else:
          stimulus = 0.6
          devLog('Missing RPE/RIR', { sessionId, setNumber })
     
     b. Get Exercise Metadata
        exercise = exercises.get(set.exercise_id)
        If exercise === null: continue to next set
     
     c. Calculate Muscle Weights
        weights = Map<muscleKey, number>
        For each muscle in exercise.primary_muscles:
          weights[muscle] = 1.0
        For each (muscle, activation) in exercise.implicit_hits:
          weights[muscle] = activation  // 0-1
     
     d. Normalize Weights
        totalWeight = sum(weights.values())
        For each muscle in weights:
          weights[muscle] = weights[muscle] / totalWeight
     
     e. Accumulate Stress
        For each (muscle, weight) in weights:
          muscleStress[muscle] += stimulus * weight
   ```

3. **Aggregate by Date** (if needed)
   ```
   For each (muscle, stress) in muscleStress:
     dailyStress[date][muscle] += stress
   ```

4. **Update Cache** (optional)
   ```
   For each (muscle, stress) in dailyStress[date]:
     UPSERT v2_daily_muscle_stress
       SET stress = stress
       WHERE user_id = userId AND date = date AND muscle_key = muscle
   ```

5. **Calculate Freshness** (optional)
   ```
   For each muscle:
     currentFreshness = SELECT freshness FROM v2_muscle_freshness
       WHERE user_id = userId AND muscle_key = muscle
     
     fatigueDrop = k * dailyStress[date][muscle]  // k = 1.0
     newFreshness = clamp(currentFreshness - fatigueDrop, 0, 100)
     
     hoursSinceLastUpdate = (now() - last_trained_at) / 3600
     recovery = 25 * (hoursSinceLastUpdate / 24)
     finalFreshness = clamp(newFreshness + recovery, 0, 100)
     
     UPSERT v2_muscle_freshness
       SET freshness = finalFreshness, last_trained_at = now()
       WHERE user_id = userId AND muscle_key = muscle
   ```

---

## 18) State Management Flow

### Zustand Store Pattern

All stores follow this pattern:
```
Store Definition:
  - State: Plain object with initial values
  - Actions: Functions that update state
  - Selectors: Components subscribe to specific state slices

Usage:
  - Component: const value = useStore((state) => state.value)
  - Action: useStore.getState().action()
  - Or: const action = useStore((state) => state.action); action()
```

### Store Interaction Patterns

**Pattern 1: Component Reads State**
```
Component → useStore((state) => state.property) → Re-renders when property changes
```

**Pattern 2: Component Triggers Action**
```
Component → useStore.getState().action() → Store updates → Components re-render
```

**Pattern 3: Hook Wraps Store**
```
Component → useHook() → Returns { action1, action2, value } → Component uses
```

### Store Update Flow

```
1. User Action (e.g., clicks button)
   ↓
2. Component calls store action
   ↓
3. Store action updates state
   ↓
4. Zustand notifies subscribers
   ↓
5. Components re-render with new state
   ↓
6. UI updates
```

### Store Dependencies

**No Cross-Store Dependencies**: Stores are independent. If data needs to be shared:
- Pass as function parameters
- Use query functions to fetch fresh data
- Avoid store-to-store direct calls

**Example - Workout Session Creation**:
```
Component → createWorkoutSession(userId) → Returns session
Component → workoutStore.setActiveSession(session) → Updates store
Component re-renders with activeSession
```

### State Persistence

**Current Implementation**: No persistence (stores reset on app restart)
**Future Consideration**: Could add persistence via AsyncStorage for:
- `userStore.profile` (cache user profile)
- `workoutStore.activeSession` (resume workouts)

**Not Persisted**:
- `uiStore` (UI state is ephemeral)
- `exerciseStore` (search/selection is session-only)

---

## 19) Error Handling Patterns

### Query Function Error Handling

**Pattern**: All query functions return `null` or empty array on error, log via `devError`

```typescript
async function getMergedExercise(exerciseId, userId) {
  try {
    const { data, error } = await supabase.from('v2_exercises').select()
    if (error) {
      if (__DEV__) {
        devError('exercise-query', error, { exerciseId, userId })
      }
      return null
    }
    return data
  } catch (error) {
    if (__DEV__) {
      devError('exercise-query', error, { exerciseId, userId })
    }
    return null
  }
}
```

### UI Error Handling

**Pattern**: Show toast + devLog, don't crash

```typescript
try {
  const result = await someOperation()
  if (!result) {
    toast.error('Operation failed')
    if (__DEV__) {
      devError('module', new Error('Operation returned null'))
    }
    return
  }
  // Success path
} catch (error) {
  toast.error('An error occurred')
  if (__DEV__) {
    devError('module', error)
  }
}
```

### Validation Error Handling

**Pattern**: Two-layer validation (UI + DB)

**UI Layer**:
```typescript
function validateSetInput(reps, duration_sec) {
  if (reps !== null && duration_sec !== null) {
    toast.error('Cannot set both reps and duration')
    if (__DEV__) {
      devError('validation', new Error('Mode exclusivity violation'))
    }
    return false
  }
  if (reps === null && duration_sec === null) {
    toast.error('Must set either reps or duration')
    return false
  }
  if (reps !== null && (reps < 1 || reps > 50)) {
    toast.error('Reps must be between 1 and 50')
    return false
  }
  return true
}
```

**DB Layer**: CHECK constraints prevent invalid data from persisting

### Missing Data Error Handling

**Pattern**: Missing prescription = data error, exclude from generation

```typescript
const prescription = await getExercisePrescription(exerciseId, goal, experience, mode)
if (!prescription) {
  // Hard rule: no prescription = exclude exercise
  if (__DEV__) {
    devError('target-selection', new Error('No prescription found'), {
      exerciseId, goal, experience, mode
    })
  }
  return null  // Exercise excluded from generation
}
```

### Network Error Handling

**Pattern**: Graceful degradation, show user-friendly message

```typescript
try {
  const data = await supabase.from('v2_exercises').select()
  // Handle data
} catch (error) {
  if (error.message.includes('network') || error.message.includes('fetch')) {
    toast.error('Network error. Please check your connection.')
  } else {
    toast.error('An error occurred')
  }
  if (__DEV__) {
    devError('network', error)
  }
}
```

### RLS Error Handling

**Pattern**: RLS errors indicate permission issue, show appropriate message

```typescript
const { data, error } = await supabase.from('v2_exercises').insert(...)
if (error?.code === '42501') {  // Insufficient privilege
  toast.error('You do not have permission to perform this action')
  if (__DEV__) {
    devError('rls', error, { table: 'v2_exercises', operation: 'INSERT' })
  }
}
```

---

## 20) API/Query Patterns

### Standard Query Pattern

**Pattern**: Try-catch, error logging, null/empty return

```typescript
export async function getEntity(id: string): Promise<Entity | null> {
  if (__DEV__) {
    devLog('module', { action: 'getEntity', id })
  }

  try {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (__DEV__) {
        devError('module', error, { id })
      }
      return null
    }

    return data
  } catch (error) {
    if (__DEV__) {
      devError('module', error, { id })
    }
    return null
  }
}
```

### Bulk Query Pattern

**Pattern**: Return array, empty on error

```typescript
export async function listEntities(userId: string): Promise<Entity[]> {
  if (__DEV__) {
    devLog('module', { action: 'listEntities', userId })
  }

  try {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      if (__DEV__) {
        devError('module', error, { userId })
      }
      return []
    }

    return data || []
  } catch (error) {
    if (__DEV__) {
      devError('module', error, { userId })
    }
    return []
  }
}
```

### Create Pattern

**Pattern**: Return created entity or null

```typescript
export async function createEntity(userId: string, data: CreateInput): Promise<Entity | null> {
  if (__DEV__) {
    devLog('module', { action: 'createEntity', userId, dataKeys: Object.keys(data) })
  }

  try {
    const { data: created, error } = await supabase
      .from('table')
      .insert({ ...data, user_id: userId })
      .select()
      .single()

    if (error) {
      if (__DEV__) {
        devError('module', error, { userId, data })
      }
      return null
    }

    return created
  } catch (error) {
    if (__DEV__) {
      devError('module', error, { userId, data })
    }
    return null
  }
}
```

### Update Pattern

**Pattern**: Return boolean success

```typescript
export async function updateEntity(id: string, updates: Partial<Entity>): Promise<boolean> {
  if (__DEV__) {
    devLog('module', { action: 'updateEntity', id, updateKeys: Object.keys(updates) })
  }

  try {
    const { error } = await supabase
      .from('table')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      if (__DEV__) {
        devError('module', error, { id, updates })
      }
      return false
    }

    return true
  } catch (error) {
    if (__DEV__) {
      devError('module', error, { id, updates })
    }
    return false
  }
}
```

### Upsert Pattern

**Pattern**: Insert or update based on existence

```typescript
export async function saveSet(
  sessionExerciseId: string,
  setNumber: number,
  setData: SetData
): Promise<SessionSet | null> {
  // Check if exists
  const existing = await supabase
    .from('v2_session_sets')
    .select('id')
    .eq('session_exercise_id', sessionExerciseId)
    .eq('set_number', setNumber)
    .maybeSingle()

  if (existing?.data) {
    // Update
    return updateSet(existing.data.id, setData)
  } else {
    // Insert
    return createSet(sessionExerciseId, setNumber, setData)
  }
}
```

### Query with Joins Pattern

**Pattern**: Use Supabase's relational queries

```typescript
const { data } = await supabase
  .from('v2_daily_muscle_stress')
  .select('muscle_key, stress, v2_muscles!inner(display_name)')
  .eq('user_id', userId)
```

### Query with Filters Pattern

**Pattern**: Chain filters, use indexes

```typescript
const { data } = await supabase
  .from('v2_exercise_prescriptions')
  .select('*')
  .eq('exercise_id', exerciseId)
  .eq('goal', goal)
  .eq('experience', experience)
  .eq('mode', mode)
  .eq('is_active', true)
  .maybeSingle()  // Returns null if not found (vs .single() which throws)
```

### Loading State Pattern

**Pattern**: Component manages loading, query doesn't

```typescript
// Component
const [loading, setLoading] = useState(true)
const [data, setData] = useState(null)

useEffect(() => {
  setLoading(true)
  getEntity(id).then(result => {
    setData(result)
    setLoading(false)
  })
}, [id])
```

### Error State Pattern

**Pattern**: Component manages error state

```typescript
const [error, setError] = useState<string | null>(null)

try {
  const result = await getEntity(id)
  if (!result) {
    setError('Entity not found')
    return
  }
  setData(result)
} catch (err) {
  setError('An error occurred')
}
```

### Optimistic Update Pattern

**Pattern**: Update UI immediately, rollback on error

```typescript
// Optimistic update
const previousState = useStore.getState()
useStore.setState({ ...previousState, property: newValue })

try {
  const result = await updateEntity(id, { property: newValue })
  if (!result) {
    // Rollback
    useStore.setState(previousState)
    toast.error('Update failed')
  }
} catch (error) {
  // Rollback
  useStore.setState(previousState)
  toast.error('Update failed')
}

---

## 21) Tab Structure and Multi-Access Components

### Four Main Tabs

The app has four main tabs accessible via bottom tab navigation:

1. **Workout** (`app/(tabs)/index.tsx`)
   - Home/workout screen
   - Start/resume active workouts
   - Quick access to today's workout

2. **Plan** (`app/(tabs)/planner.tsx`)
   - Weekly workout planning
   - View/edit workout templates
   - Generate AI workouts

3. **Progress** (`app/(tabs)/progress.tsx`)
   - Workout history
   - Progress tracking
   - Muscle stress heatmap
   - Performance analytics

4. **Profile** (`app/(tabs)/profile.tsx`)
   - User profile
   - Settings/preferences
   - Equipment access
   - Goals and experience level

### Tab Layout Structure

```
app/(tabs)/
  ├── _layout.tsx        # Tab navigator configuration
  ├── index.tsx          # Workout tab (home)
  ├── planner.tsx        # Plan tab
  ├── progress.tsx       # Progress tab
  └── profile.tsx        # Profile tab
```

**Tab Icons** (from Archive):
- Workout: `Dumbbell`
- Plan: `Calendar`
- Progress: `TrendingUp`
- Profile: `Trophy`

### Multi-Access Components Pattern

Certain components need to be accessible from multiple tabs without duplicating code or creating navigation issues. These are implemented as **global bottom sheets** managed by Zustand.

#### Exercise Picker (Multi-Access)

**Accessed from**:
- Plan tab: Add exercise to workout template
- Workout tab: Add exercise to active workout
- Progress tab: Filter/search exercises in history
- Any tab: Quick exercise lookup

**Implementation**:
```
Any Tab Component:
  const picker = useExercisePicker()
  
  onPressAddExercise = () => {
    picker.open((exercise) => {
      // Handle selection (context-specific)
      addExerciseToTemplate(exercise)
      // or
      addExerciseToWorkout(exercise)
    })
  }
```

**Flow**:
1. Component calls `useExercisePicker().open(callback)`
2. `uiStore.openBottomSheet('exercisePicker', { onSelect: callback })`
3. `ModalManager` renders `BottomSheet` with `ExercisePicker` inside
4. User selects exercise
5. Callback fires with selected exercise
6. Bottom sheet closes automatically
7. Component handles exercise (context-specific)

#### Settings/Preferences Menu (Multi-Access)

**Accessed from**:
- Profile tab: Primary access point
- Any tab: Quick settings access (gear icon in header)

**Implementation**:
```
Any Tab Component:
  const modal = useModal()
  
  onPressSettings = () => {
    modal.openSheet('settingsMenu', { onClose: () => {} })
  }
```

**Flow**:
1. Component calls `useModal().openSheet('settingsMenu')`
2. `uiStore.openBottomSheet('settingsMenu')`
3. `ModalManager` renders `BottomSheet` with `SettingsMenu` inside
4. User selects menu item (e.g., "Edit Profile")
5. `SettingsMenu` navigates to route (e.g., `/edit-profile`)
6. Bottom sheet closes
7. User is on new route

#### Muscle Stress Heatmap (Multi-Access)

**Accessed from**:
- Progress tab: Primary view
- Plan tab: View recovery when planning
- Workout tab: Quick recovery check

**Implementation**:
```
Any Tab Component:
  import { WorkoutHeatmap } from '@/components/workout/WorkoutHeatmap'
  
  <WorkoutHeatmap
    userId={userId}
    dateRange={{ start: startDate, end: endDate }}
    onMuscleSelect={(muscleKey) => {
      // Handle muscle selection (context-specific)
    }}
  />
```

**Note**: Heatmap is a regular component, not a bottom sheet, because it's typically displayed inline within a tab's content.

### Multi-Access Pattern Rules

**When to use Bottom Sheet**:
- Quick actions (exercise picker, settings menu)
- Contextual overlays that don't need full screen
- Components accessed from 2+ tabs

**When to use Route**:
- Complex multi-step flows (edit profile, active workout)
- Full-screen experiences
- Components that need navigation history

**When to use Inline Component**:
- Display components (heatmap, charts)
- Components that are part of tab's primary content
- Components that don't need to overlay other content

### Tab-Specific Access Patterns

**Workout Tab**:
- Exercise Picker: Add exercise to active workout
- Settings: Quick access to preferences
- Heatmap: Optional recovery view

**Plan Tab**:
- Exercise Picker: Add exercise to template
- Settings: Quick access to preferences
- Heatmap: View recovery when planning workouts

**Progress Tab**:
- Exercise Picker: Filter/search exercises
- Settings: Quick access to preferences
- Heatmap: Primary muscle stress visualization

**Profile Tab**:
- Settings: Primary access (full settings menu)
- Exercise Picker: Not typically needed
- Heatmap: Not typically needed

### Implementation Example: Adding Exercise from Plan Tab

```typescript
// app/(tabs)/planner.tsx
import { useExercisePicker } from '@/hooks/useExercisePicker'

export default function PlannerTab() {
  const picker = useExercisePicker()
  
  const handleAddExercise = () => {
    picker.open((exercise) => {
      // Context-specific: Add to template
      addExerciseToTemplate(exercise)
      toast.success('Exercise added to template')
    })
  }
  
  return (
    <View>
      <Button onPress={handleAddExercise}>Add Exercise</Button>
      {/* ... rest of planner UI */}
    </View>
  )
}
```

### Implementation Example: Adding Exercise from Workout Tab

```typescript
// app/(tabs)/index.tsx
import { useExercisePicker } from '@/hooks/useExercisePicker'

export default function WorkoutTab() {
  const picker = useExercisePicker()
  const { activeSession } = useWorkoutStore()
  
  const handleAddExercise = () => {
    picker.open((exercise) => {
      // Context-specific: Add to active session
      addExerciseToSession(activeSession.id, exercise)
      toast.success('Exercise added to workout')
    })
  }
  
  return (
    <View>
      <Button onPress={handleAddExercise}>Add Exercise</Button>
      {/* ... rest of workout UI */}
    </View>
  )
}
```

**Key Point**: Same `ExercisePicker` component, same hook, but different callbacks based on context. The picker itself doesn't know or care which tab opened it.

---

## 22) Multi-Access Pages Pattern (Shared Routes)

Some screens must be reachable from multiple tabs (Workout, Plan, Progress, Profile) and must not be duplicated under `app/(tabs)/...`.

These are implemented as **shared Expo Router routes** (stack screens or modals), not bottom sheets.

### Rule

- If the user needs navigation history (back button) or the screen is "full experience": it is a **route**.
- If it is a quick overlay action used across tabs: it is a **global bottom sheet**.
- Never duplicate a page file under multiple tabs.

### Where Shared Pages Live

Use route groups to keep structure clean while keeping URLs simple:

- `app/(tabs)/...` = tab roots only
- `app/(stack)/...` = shared stack screens accessible from any tab
- `app/(modals)/...` = shared modal routes (presentation: modal)

**Note**: Route groups do not appear in the URL. For example, `app/(stack)/exercise/[id].tsx` is navigated to as `/exercise/123`.

### Examples of Multi-Access Pages (Shared Routes)

#### Exercise Detail

- **File**: `app/(stack)/exercise/[id].tsx`
- **Entry points**:
  - Workout tab: tap an exercise row
  - Plan tab: view slot exercise
  - Progress tab: tap history item
- **Navigation**: `router.push({ pathname: '/exercise/[id]', params: { id } })`

#### Active Workout

- **File**: `app/(stack)/workout/active.tsx`
- **Entry points**:
  - Workout tab: Start/Resume button
  - Plan tab: Start today's plan
- **Navigation**: `router.push('/workout/active')`

#### Session Detail (History)

- **File**: `app/(stack)/session/[id].tsx`
- **Entry points**:
  - Progress tab: tap session card
  - Workout tab: post-workout summary
- **Navigation**: `router.push({ pathname: '/session/[id]', params: { id } })`

#### Edit Profile

- **File**: `app/(modals)/edit-profile.tsx`
- **Entry points**:
  - Profile tab: primary access
  - Settings menu from any tab (sheet → route)
- **Navigation**: `router.push('/edit-profile')`
- **Presentation**: Modal (slides up from bottom)

### Navigation Usage Pattern (From Any Tab)

**Prefer direct route navigation for shared pages**:

```typescript
// From any tab component
import { useRouter } from 'expo-router'

const router = useRouter()

// Navigate to exercise detail
router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } })

// Navigate to active workout
router.push('/workout/active')

// Navigate to session detail
router.push({ pathname: '/session/[id]', params: { id: sessionId } })
```

**Bottom sheets may navigate to routes, but must close immediately**:

```typescript
// In SettingsMenu bottom sheet component
const router = useRouter()
const { closeBottomSheet } = useModal()

const handleEditProfile = () => {
  // 1) User taps item in sheet
  // 2) Navigate to route
  router.push('/edit-profile')
  // 3) Close bottom sheet immediately
  closeBottomSheet()
}
```

**Flow**:
1. User taps item in bottom sheet
2. `router.push(...)` navigates to route
3. `uiStore.closeBottomSheet()` closes the sheet
4. User sees the route screen

### Route Group Structure

```
app/
  ├── (tabs)/              # Tab roots only
  │   ├── _layout.tsx
  │   ├── index.tsx       # Workout tab
  │   ├── planner.tsx     # Plan tab
  │   ├── progress.tsx     # Progress tab
  │   └── profile.tsx      # Profile tab
  │
  ├── (stack)/            # Shared stack screens
  │   ├── exercise/
  │   │   └── [id].tsx    # Exercise detail
  │   ├── workout/
  │   │   └── active.tsx  # Active workout
  │   └── session/
  │       └── [id].tsx    # Session detail
  │
  └── (modals)/           # Shared modal routes
      └── edit-profile.tsx # Edit profile
```

### Root Layout Configuration

The root `app/_layout.tsx` must register all route groups:

```typescript
<Stack>
  {/* Tab navigation */}
  <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
  
  {/* Shared stack screens */}
  <Stack.Screen 
    name="exercise/[id]" 
    options={{ 
      gestureEnabled: true,
      animation: 'slide_from_right'
    }} 
  />
  <Stack.Screen 
    name="workout/active" 
    options={{ 
      gestureEnabled: true,
      animation: 'slide_from_right'
    }} 
  />
  <Stack.Screen 
    name="session/[id]" 
    options={{ 
      gestureEnabled: true,
      animation: 'slide_from_right'
    }} 
  />
  
  {/* Shared modal routes */}
  <Stack.Screen 
    name="edit-profile" 
    options={{ 
      presentation: 'modal',
      gestureEnabled: true
    }} 
  />
</Stack>
```

### Decision Matrix

| Component Type | Access Pattern | Implementation |
|---------------|----------------|----------------|
| Quick action (exercise picker) | Multiple tabs | Global bottom sheet |
| Quick menu (settings) | Multiple tabs | Global bottom sheet |
| Display component (heatmap) | Multiple tabs | Inline component |
| Full-screen experience | Multiple tabs | Shared route (stack) |
| Modal experience | Multiple tabs | Shared route (modal) |
| Tab-specific screen | Single tab | Tab route file |

### Benefits of This Pattern

1. **No Duplication**: Each page exists once, accessed from any tab
2. **Consistent Navigation**: Same route, same behavior, regardless of entry point
3. **Clean URLs**: Route groups don't appear in URLs (`/exercise/123`, not `/(stack)/exercise/123`)
4. **Type Safety**: Expo Router generates types for all routes
5. **Back Navigation**: Works correctly from any entry point

---

## 23) Theme Extraction Contract

**Purpose**: This section documents the exact theme tokens and components from the Archive that must be reused in V2. Do not recreate similar themes—use these exact values and locations.

### Color Palette (Exact Values)

**Archive Source**: Hardcoded in components (e.g., `Archive/app/(tabs)/_layout.tsx`, `Archive/src/components/Toast.tsx`)

**V2 Location**: `src/lib/utils/theme.ts` → `colors` object

| Token | Archive Value | V2 Location | Notes |
|-------|--------------|-------------|-------|
| Background | `#09090b` (zinc-950) | `colors.background` | Main app background |
| Card Background | `rgba(24, 24, 27, 0.9)` (zinc-900/90) | `colors.card` | Card/overlay backgrounds |
| Card Border | `#27272a` (zinc-800) | `colors.cardBorder` | Card borders |
| Primary Accent | `#a3e635` (lime-400) | `colors.primary` | Active states, icons, highlights |
| Primary Dark | `#84cc16` (lime-500) | `colors.primaryDark` | Hover/pressed states |
| Text Primary | `#ffffff` | `colors.textPrimary` | Main text |
| Text Secondary | `#a1a1aa` (zinc-400) | `colors.textSecondary` | Secondary text |
| Text Muted | `#71717a` (zinc-500) | `colors.textMuted` | Muted/disabled text |
| Error | `#ef4444` (red-500) | `colors.error` | Error states |
| Error Background | `rgba(239, 68, 68, 0.1)` | `colors.errorBg` | Error background |
| Error Text | `#fca5a5` (red-300) | `colors.errorText` | Error text |
| Border | `#27272a` (zinc-800) | `colors.border` | Default borders |
| Border Light | `#3f3f46` (zinc-700) | `colors.borderLight` | Lighter borders |

**Tab Bar Specific Colors** (from `Archive/app/(tabs)/_layout.tsx`):
- Tab Bar Active: `#a3e635` (lime-400) → Use `colors.primary`
- Tab Bar Inactive: `#a1a1aa` (zinc-400) → Use `colors.textSecondary`
- Tab Bar Background (web): `#09090b` (zinc-950) → Use `colors.background`
- Tab Bar Capsule: `#18181b` (zinc-900) → Use `colors.card` (opacity adjusted)
- Tab Bar Capsule Border: `#27272a` (zinc-800) → Use `colors.cardBorder`
- Sliding Circle: `#27272a` (zinc-800) → Use `colors.cardBorder`
- Tab Label Active: `#ffffff` → Use `colors.textPrimary`
- Tab Label Inactive: `#a1a1aa` (zinc-400) → Use `colors.textSecondary`

### Spacing Scale

**Archive Source**: Hardcoded values in StyleSheet (e.g., `padding: 16`, `gap: 4`)

**V2 Location**: `src/lib/utils/theme.ts` → `spacing` object

| Token | Archive Examples | V2 Location | Usage |
|-------|------------------|-------------|-------|
| xs | `4` (gap, padding) | `spacing.xs` | Tight spacing |
| sm | `8` (paddingVertical) | `spacing.sm` | Small spacing |
| md | `16` (paddingHorizontal, paddingBottom) | `spacing.md` | Default spacing |
| lg | `24` (borderRadius) | `spacing.lg` | Large spacing |
| xl | `32` | `spacing.xl` | Extra large spacing |
| xxl | `48` | `spacing.xxl` | Extra extra large spacing |

**Tab Bar Specific Spacing**:
- Tab Bar Padding Horizontal: `16` → Use `spacing.md`
- Tab Bar Padding Bottom: `16` → Use `spacing.md`
- Tab Bar Padding Top: `12` → Use `spacing.md` (slightly adjusted)
- Tab Bar Capsule Padding: `4` → Use `spacing.xs`
- Tab Bar Capsule Gap: `4` → Use `spacing.xs`
- Tab Button Padding Vertical: `8` → Use `spacing.sm`
- Tab Button Padding Horizontal: `4` → Use `spacing.xs`
- Tab Label Margin Top: `4` → Use `spacing.xs`

### Typography

**Archive Source**: Hardcoded in StyleSheet (e.g., `fontSize: 12`, `fontWeight: '500'`)

**V2 Location**: `src/lib/utils/theme.ts` → `typography` object

| Token | Archive Examples | V2 Location | Usage |
|-------|------------------|-------------|-------|
| xs | `12` (tab labels) | `typography.sizes.xs` | Small text |
| sm | `14` | `typography.sizes.sm` | Small body text |
| base | `16` | `typography.sizes.base` | Default body text |
| lg | `18` | `typography.sizes.lg` | Large body text |
| xl | `24` | `typography.sizes.xl` | Headings |
| 2xl | `32` | `typography.sizes['2xl']` | Large headings |
| 3xl | `42` | `typography.sizes['3xl']` | Extra large headings |

**Font Weights**:
- Normal: `'400'` → `typography.weights.normal`
- Medium: `'500'` (tab labels) → `typography.weights.medium`
- Semibold: `'600'` (active tab label) → `typography.weights.semibold`
- Bold: `'700'` → `typography.weights.bold`

### Border Radius

**Archive Source**: Hardcoded in StyleSheet (e.g., `borderRadius: 24`, `borderRadius: 36`)

**V2 Location**: `src/lib/utils/theme.ts` → `borderRadius` object

| Token | Archive Examples | V2 Location | Usage |
|-------|------------------|-------------|-------|
| sm | `8` | `borderRadius.sm` | Small rounded corners |
| md | `16` | `borderRadius.md` | Default rounded corners |
| lg | `24` (toast, cards) | `borderRadius.lg` | Large rounded corners |
| xl | `32` | `borderRadius.xl` | Extra large rounded corners |
| full | `9999` | `borderRadius.full` | Fully rounded (pills, circles) |

**Tab Bar Specific**:
- Icon Container: `20` (circle) → Use `borderRadius.full` with fixed size
- Tab Bar Capsule: `36` (full capsule) → Use `borderRadius.xl` or custom `36`

### Tab Bar Style Rules (Exact Specifications)

**Archive Source**: `Archive/app/(tabs)/_layout.tsx` → `CustomTabBar` component and styles

**V2 Location**: Must be implemented in `app/(tabs)/_layout.tsx` with exact same styling

**Critical Rules**:
1. **Capsule Design**: Tab bar uses a capsule shape (rounded pill) with sliding circle indicator
2. **Height**: Tab bar height is `72` pixels
3. **Capsule Background**: `#18181b` (zinc-900) with `1px` border `#27272a` (zinc-800)
4. **Capsule Border Radius**: `36` pixels (full capsule)
5. **Sliding Circle**: `40px × 40px` circle, `#27272a` (zinc-800) background, positioned absolutely
6. **Icon Size**: `24px` with `40px × 40px` container
7. **Icon Colors**: Active = `#a3e635` (lime-400), Inactive = `#a1a1aa` (zinc-400)
8. **Label Font**: `12px`, weight `500` (inactive) / `600` (active)
9. **Label Colors**: Active = `#ffffff`, Inactive = `#a1a1aa` (zinc-400)
10. **Position**: Absolute bottom on native, relative on web
11. **Web Background**: `#09090b` (zinc-950) wrapper to prevent white background
12. **Shadow**: `shadowColor: '#000000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.3`, `shadowRadius: 8`, `elevation: 10`

**Animation**: Sliding circle animates with `react-native-reanimated` using `withTiming` (300ms duration)

### Toast Component Styles (Exact Specifications)

**Archive Source**: `Archive/src/components/Toast.tsx`

**V2 Location**: `src/components/ui/Toast.tsx` (already updated to use theme)

**Critical Rules**:
1. **Background**: `rgba(24, 24, 27, 0.95)` (zinc-900/95) → Use `colors.card` with opacity
2. **Border**: `1px solid #27272a` (zinc-800) → Use `colors.cardBorder`
3. **Border Radius**: `24px` → Use `borderRadius.lg`
4. **Padding**: `20px` horizontal, `14px` vertical → Use `spacing.md` and `spacing.sm`
5. **Gap**: `12px` between icon and text → Use `spacing.md`
6. **Icon Color**: `#a3e635` (lime-400) → Use `colors.primary`
7. **Text Color**: `#ffffff` → Use `colors.textPrimary`
8. **Position**: Absolute top `60px`, centered horizontally
9. **Z-Index**: `9999`
10. **Animation**: Fade + slide from top (`-100px`), `300ms` in, `250ms` out

### Usage Pattern

**DO**:
```typescript
import { colors, spacing, borderRadius, typography } from '@/lib/utils/theme'

// Use theme tokens
<View style={{ backgroundColor: colors.background, padding: spacing.md }}>
  <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.base }}>
    Content
  </Text>
</View>
```

**DON'T**:
```typescript
// Don't hardcode colors
<View style={{ backgroundColor: '#09090b' }}>  // ❌

// Don't recreate similar values
const myColors = { primary: '#a4e636' }  // ❌ (slightly different)

// Don't use Tailwind classes for these exact values
<View className="bg-zinc-950">  // ❌ (use theme.ts instead)
```

### Theme File Location

**Single Source of Truth**: `src/lib/utils/theme.ts`

All theme tokens must be imported from this file. No hardcoded color/spacing values in components.

### Tab Bar Implementation

The tab bar must be implemented exactly as in `Archive/app/(tabs)/_layout.tsx`:
- Custom tab bar component with sliding circle indicator
- Exact same colors, spacing, and dimensions
- Same animation behavior
- Same platform-specific handling (web vs native)

**Reference**: See `Archive/app/(tabs)/_layout.tsx` lines 9-241 for complete implementation.

### Migration Notes

- All hardcoded colors in Archive → Use `colors.*` from theme.ts
- All hardcoded spacing in Archive → Use `spacing.*` from theme.ts
- All hardcoded font sizes → Use `typography.sizes.*` from theme.ts
- All hardcoded border radius → Use `borderRadius.*` from theme.ts
- Tab bar styling → Copy exact implementation from Archive
- Toast styling → Use theme tokens (already done in V2 Toast.tsx)

