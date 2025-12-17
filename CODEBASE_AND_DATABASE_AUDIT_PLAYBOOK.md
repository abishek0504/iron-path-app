## Codebase + Database Audit Playbook (V2)

This file is a **living plan + execution log** for auditing the entire app and database in **small, reviewable patches**.

- **Goal**: Inspect the full system end-to-end (routes → UI/state → Supabase queries → engine → database/RLS), document how everything is connected, identify what’s implemented vs. missing, and systematically find unused code/variables.
- **Outcome**: Someone can **recreate the current system (and extend it)** using this single file as the reference.

---

## How to use this file

- Treat each **Audit Patch** section below as a self-contained “slice.”
- For each patch:
  - Read the listed files.
  - Fill in the **Findings** tables in this file.
  - If code changes are needed later, implement them as a separate patch after the inspection patch.
- Keep changes small; avoid mixing refactors with discovery.

---

## Progress / TODOs (keep updated)

### Audit run metadata

- **Date started**: 2025-12-17
- **Workspace**: `/workspace`
- **Branch**: `cursor/codebase-and-database-audit-5bdb`

### TODO list

- [x] **Research**: Read core docs + migrations (`IMPLEMENTATION_SUMMARY.md`, `V2_ARCHITECTURE.md`, `README_V2.md`, Supabase migrations)
- [x] **Research**: Read runtime entrypoints (router layouts, Supabase client, key screens, core queries/engine)
- [ ] **Audit Patch 00**: Baseline tooling + repo inventory
- [ ] **Audit Patch 01**: Navigation + route map + labels/icons correctness
- [ ] **Audit Patch 02**: Global UI overlay system (bottom sheets, toasts) and state machine
- [ ] **Audit Patch 03**: Auth/session bootstrap + onboarding gating
- [ ] **Audit Patch 04**: Database schema + migrations + RLS policies verification
- [ ] **Audit Patch 05**: Query layer inventory + contracts + error/return conventions
- [ ] **Audit Patch 06**: Stores + hooks wiring (Zustand ↔ screens ↔ UI components)
- [ ] **Audit Patch 07**: Planner flow (template→days→slots) + edit scoping
- [ ] **Audit Patch 08**: Workout start flow (session creation + session_exercises + prefill sets)
- [ ] **Audit Patch 09**: Workout execution UI (what exists vs placeholder) + save semantics
- [ ] **Audit Patch 10**: Dashboard metrics + date range correctness + performance
- [ ] **Audit Patch 11**: Progress tab + derived caches (heatmap/freshness)
- [ ] **Audit Patch 12**: Engine: target selection, AI week generation, rebalance detection
- [ ] **Audit Patch 13**: Unused code/variables/components + safe removal plan
- [ ] **Audit Patch 14**: Types + schema drift control (Supabase generated types)
- [ ] **Audit Patch 15**: Security + privacy review (RLS, env handling, dev logging)

---

## System contract (non-negotiables)

These are the “hard rules” the codebase and database are intended to follow.

- **Strict data layering**: canonical → prescriptions → user customization → planning → performed truth → (optional) derived caches.
  - Contract reference: `./V2_ARCHITECTURE.md`
- **No modal-in-modal**:
  - Reusable quick UI uses **global bottom sheets**.
  - Deep flows use **routes**.
  - Root host: `./src/components/ui/ModalManager.tsx` mounted in `./app/_layout.tsx`.
- **Prescription-based targets**: never invent defaults (e.g., “3×10”). Missing prescription must be treated as a data error.
- **RLS + anon key only**: app must never ship `service_role`.
- **Dev diagnostics** must be dev-only and aggregate-only:
  - Wrap with `if (__DEV__)`.
  - Log state drivers + ranges + counts, not per-item rows.
  - Don’t add extra queries purely for logs.

---

## Repo entrypoints (what boots the app)

- **Root router layout**: `./app/_layout.tsx`
  - Mounts global UI (`ToastProvider`, `ModalManager`).
  - Registers stack screens (auth routes, tabs, modals).
- **Tabs layout + custom tab bar**: `./app/(tabs)/_layout.tsx`
  - Route-to-icon mapping must reflect the purpose:
    - `index` → Workout
    - `planner` → Plan
    - `progress` → Progress
    - `dashboard` → Dashboard
- **Initial bootstrap route**: `./app/index.tsx`
  - Reads Supabase session.
  - Loads profile (`getUserProfile`) into store.
  - Redirects to `/(tabs)` if required profile fields exist; otherwise `/onboarding`.

---

## Database: schema + RLS (source of truth)

### Migrations to apply (in order)

- `./supabase/migrations/20240101000000_create_v2_tables.sql`
- `./supabase/migrations/20240101000001_create_v2_rls_policies.sql`
- Patch migrations (schema evolutions):
  - `./supabase/migrations/20250101000000_patch_c1_template_slots_custom_exercise_id.sql`
  - `./supabase/migrations/20250101000003_patch_h_remove_goal.sql`

### Core tables (conceptual model)

- **Canonical reference**
  - `v2_muscles`
  - `v2_exercises`
- **Curated prescriptions**
  - `v2_exercise_prescriptions` (note: goal removed by Patch H; unique key becomes `(exercise_id, experience, mode)`)
- **AI allow-list**
  - `v2_ai_recommended_exercises`
- **User customization**
  - `v2_user_exercise_overrides`
  - `v2_user_custom_exercises`
  - `v2_profiles`
- **Planning**
  - `v2_workout_templates`
  - `v2_template_days`
  - `v2_template_slots` (supports `exercise_id` XOR `custom_exercise_id`)
- **Performed truth**
  - `v2_workout_sessions`
  - `v2_session_exercises` (supports `exercise_id` XOR `custom_exercise_id`)
  - `v2_session_sets` (reps XOR duration_sec; must have at least one)
- **Derived caches (rebuildable)**
  - `v2_muscle_freshness`
  - `v2_daily_muscle_stress`

### DB rebuild prerequisites (for the app to work)

To get meaningful UI behavior (planner targets, AI generation), the DB needs seed data:

- **Required**:
  - `v2_muscles`: canonical muscle keys
  - `v2_exercises`: exercise catalog
  - `v2_exercise_prescriptions`: targets per exercise
- **Optional but used by features**:
  - `v2_ai_recommended_exercises`: AI generation allow-list

---

## Runtime flows (what connects to what)

### Auth + onboarding gate

- Entry: `./app/index.tsx`
- Session API: `./src/lib/supabase/client.ts`
- Profile queries: `./src/lib/supabase/queries/users.ts`
- Onboarding screen: `./app/onboarding.tsx`

**Key gate fields used by `/`**:
- `experience_level`
- `days_per_week`
- `equipment_access[]` (must be non-empty)

### Planning → performed truth

- Planner screen: `./app/(tabs)/planner.tsx`
- Planning queries: `./src/lib/supabase/queries/templates.ts`
- Performed truth queries: `./src/lib/supabase/queries/workouts.ts`
- Session edit helpers (today-only scope): `./src/lib/supabase/queries/workouts_helpers.ts`
- Target selection engine: `./src/lib/engine/targetSelection.ts`

### Workout tab (home)

- Workout tab: `./app/(tabs)/index.tsx`
  - Reads templates, loads selected plan day slots.
  - Checks active session + “completed today” state.
  - Uses a plan-day picker bottom sheet (`planDayPicker`).

### Dashboard (profile tab)

- Dashboard tab: `./app/(tabs)/dashboard.tsx`
  - Week range computed on-device.
  - Fetches sessions in range + recent sessions + top PRs.
  - Resolves exercise names via `listMergedExercises`.

---

## Audit Patch template (copy this per patch)

### Patch XX — <name>

- **Purpose**:
- **Files (read-only)**:
- **Questions to answer**:
- **Contracts to verify**:
- **Dev-only diagnostics to add (if needed)**:
- **Artifacts to fill in (in this file)**:
- **Done when**:

---

## Audit patches (the plan)

### Patch 00 — Baseline repo inventory + commands

- **Purpose**: Establish a repeatable baseline for inspection: dependency graph, TypeScript config, linting, and how to run the app.
- **Files (read-only)**:
  - `./package.json`, `./tsconfig.json`, `./babel.config.js`, `./metro.config.js`, `./app.json`, `./tailwind.config.js`, `./nativewind-env.d.ts`
- **Questions to answer**:
  - What commands exist (build/start/lint/typecheck/test)?
  - What environments are expected (web/native)?
  - Any missing scripts we should add later (only after audit)?
- **Artifacts to fill in**:

| Item | Value | Notes |
|---|---|---|
| Node version |  |  |
| Package manager | npm | `package-lock.json` exists |
| Typecheck command |  |  |
| Lint command |  |  |
| Test command |  |  |

---

### Patch 01 — Navigation + route map + labels/icons

- **Purpose**: Produce a definitive route map and ensure labels/icons match the route purpose.
- **Files (read-only)**:
  - `./app/_layout.tsx`
  - `./app/(tabs)/_layout.tsx`
  - All `./app/**/*.tsx` route files
- **Questions to answer**:
  - What routes exist (tabs vs stack vs modal presentation)?
  - Which route is considered the “active workout” route (there are multiple: `/workout-active`, `/(stack)/workout/active`, `/workout/active`)?
  - Are tab labels/icons consistent with route purpose?
- **Artifacts to fill in**:

| Route | Type | Presentation | Entry points that navigate here | Status (implemented/placeholder) |
|---|---|---|---|---|
| `/` | bootstrap | stack | `app/index.tsx` |  |
| `/login` | auth | stack | `app/index.tsx` |  |
| `/onboarding` | flow | stack | `app/index.tsx` |  |
| `/(tabs)/index` | tab | tab | `/(tabs)/_layout.tsx` |  |
| `/(tabs)/planner` | tab | tab | `/(tabs)/_layout.tsx` |  |
| `/(tabs)/progress` | tab | tab | `/(tabs)/_layout.tsx` |  |
| `/(tabs)/dashboard` | tab | tab | `/(tabs)/_layout.tsx` |  |

---

### Patch 02 — Global UI overlay system (bottom sheets + toasts)

- **Purpose**: Verify the “no modal-in-modal” contract and document how overlays are orchestrated.
- **Files (read-only)**:
  - `./src/stores/uiStore.ts`
  - `./src/components/ui/BottomSheet.tsx`
  - `./src/components/ui/ModalManager.tsx`
  - `./src/components/ui/Toast.tsx`, `./src/components/ui/ToastProvider.tsx`
  - `./src/hooks/useModal.ts`, `./src/hooks/useToast.ts`
- **Questions to answer**:
  - What bottom sheet IDs exist and where are they opened?
  - How does the pending-sheet queue behave?
  - Are there any screens still doing modal-in-modal patterns?
- **Artifacts to fill in**:

| BottomSheetId | Component rendered | Opened from (files) | Props contract |
|---|---|---|---|
| `exercisePicker` |  |  |  |
| `settingsMenu` |  |  |  |
| `planDayPicker` |  |  |  |

---

### Patch 03 — Auth/session bootstrap + onboarding gating

- **Purpose**: Document auth flows and ensure profile gating logic is consistent.
- **Files (read-only)**:
  - `./src/lib/supabase/client.ts`
  - `./app/index.tsx`
  - `./app/login.tsx`, `./app/signup.tsx`, `./app/signup-success.tsx`
  - `./app/auth/forgot-password.tsx`, `./app/auth/change-email.tsx`, `./app/auth/callback.tsx`
  - `./app/onboarding.tsx`
  - `./src/lib/supabase/queries/users.ts`
- **Questions to answer**:
  - What are the required onboarding fields, and are they consistent between `README_V2.md` and `app/index.tsx`?
  - Where do auth errors surface (toast vs inline text vs console)?
  - How does session persistence differ between web and native?
- **Dev-only diagnostics to add (if needed)**:
  - On bootstrap: log `{ hasSession, hasProfile, hasRequiredFields }`.

---

### Patch 04 — Database schema + migrations + RLS

- **Purpose**: Produce a definitive DB contract and confirm migrations match the runtime expectations.
- **Files (read-only)**:
  - All `./supabase/migrations/*.sql`
- **Questions to answer**:
  - Are all columns used by the app present (e.g., `custom_exercise_id` in template slots and session exercises)?
  - Are unique constraints aligned with code expectations (especially prescriptions after Patch H)?
  - Does RLS match the intended access model (immutable vs user-owned)?
- **Artifacts to fill in**:

| Table | Owned by | RLS policy summary | App reads? | App writes? | Notes |
|---|---|---|---|---|---|
| `v2_exercises` | system | auth SELECT only |  | no |  |
| `v2_user_custom_exercises` | user | owner CRUD |  |  |  |
| `v2_workout_sessions` | user | owner CRUD |  |  |  |

---

### Patch 05 — Query layer inventory + contracts

- **Purpose**: Catalog every query function, its inputs/outputs, and how errors are handled.
- **Files (read-only)**:
  - `./src/lib/supabase/queries/*.ts`
- **Questions to answer**:
  - Which functions return `null` vs `[]` vs `false` on failure? Is it consistent?
  - Do queries follow aggregate-only dev logs?
  - Are there N+1 query patterns in UI paths that need later optimization?
- **Artifacts to fill in**:

| Module | Function | Inputs | Output | On error | Used by (files) |
|---|---|---|---|---|---|
| `queries/exercises.ts` | `getMergedExercise` |  |  |  |  |
| `queries/templates.ts` | `ensureTemplateHasWeekDays` |  |  |  |  |
| `queries/workouts.ts` | `getSessionsInRange` |  |  |  |  |

---

### Patch 06 — Stores + hooks wiring

- **Purpose**: Map global state: what’s stored, who writes it, and who depends on it.
- **Files (read-only)**:
  - `./src/stores/*.ts`
  - `./src/hooks/*.ts`
- **Questions to answer**:
  - Which pieces of state are source-of-truth vs cached copies?
  - Any unused store fields/actions?
  - Any coupling between stores and UI that violates layering?
- **Artifacts to fill in**:

| Store | State fields | Actions | Used by (files) | Notes |
|---|---|---|---|---|
| `uiStore` |  |  |  |  |
| `userStore` |  |  |  |  |
| `workoutStore` |  |  |  |  |

---

### Patch 07 — Planner flow (template → days → slots) + edit scoping

- **Purpose**: Trace the Plan tab end-to-end and confirm the structure-vs-performance separation.
- **Files (read-only)**:
  - `./app/(tabs)/planner.tsx`
  - `./src/lib/supabase/queries/templates.ts`
  - `./src/lib/supabase/queries/workouts_helpers.ts`
  - `./src/components/ui/EditScopePrompt.tsx`
- **Questions to answer**:
  - Does adding/removing slot correctly prompt for scope and route the write appropriately?
  - What scopes are implemented vs TODO?
  - Are targets computed using the correct exercise identifier (master vs custom)?
- **Dev-only diagnostics to add (if needed)**:
  - On load: selected weekday, templateId, dayCount, slotCount.
  - On target calc: effective experience, slotCounts (with/without prescription).

---

### Patch 08 — Start workout flow (session creation + prefill)

- **Purpose**: Trace the “Start this day” flow and validate writes to performed-truth tables.
- **Files (read-only)**:
  - `./app/(tabs)/planner.tsx` (start flow)
  - `./src/lib/supabase/queries/workouts.ts` (`createWorkoutSession`, `prefillSessionSets`)
  - `./src/lib/engine/targetSelection.ts`
  - `./src/lib/engine/rebalance.ts`
- **Questions to answer**:
  - Exactly what gets written when a workout starts?
  - Are prefilled sets considered “planned targets” (not performed) and how does that reconcile with `performed_at` defaults?
  - Are custom exercises handled consistently end-to-end?

---

### Patch 09 — Active workout execution UI + save semantics

- **Purpose**: Determine what the “active workout” UI currently is (placeholder vs full), and document the intended save/complete lifecycle.
- **Files (read-only)**:
  - `./app/workout-active.tsx`
  - `./app/(stack)/workout/active.tsx`
  - Any `saveSessionSet` call sites
- **Questions to answer**:
  - Which route is the real one the app uses today?
  - Is session completion wired (`completeWorkoutSession`) and where?
  - Is `saveSessionSet` used anywhere yet?

---

### Patch 10 — Dashboard metrics + date range correctness

- **Purpose**: Validate date-range queries, streak logic, and avoid performance regressions.
- **Files (read-only)**:
  - `./app/(tabs)/dashboard.tsx`
  - `./src/lib/supabase/queries/workouts.ts`
- **Questions to answer**:
  - Are week ranges computed correctly for the product definition (Sunday-start week)?
  - Are queries using the correct timestamp fields (`completed_at` vs `started_at`)?
  - Any N+1 behavior in exercise name resolution?
- **Dev-only diagnostics to add (if needed)**:
  - Log `{ weekStartLocal, weekEndLocal, startIso, endIso, thisWeekCount, recentCount, prsCount }` once per load.

---

### Patch 11 — Progress tab + derived caches (heatmap/freshness)

- **Purpose**: Define how Progress will be built and validate existing derived-cache usage.
- **Files (read-only)**:
  - `./app/(tabs)/progress.tsx`
  - `./src/components/workout/WorkoutHeatmap.tsx`
  - DB tables: `v2_daily_muscle_stress`, `v2_muscle_freshness`
- **Questions to answer**:
  - Is heatmap wired to real data today?
  - What jobs/process rebuild derived caches (if any)?

---

### Patch 12 — Engine: targets, AI week generation, rebalance

- **Purpose**: Document the business logic layer and its dependencies.
- **Files (read-only)**:
  - `./src/lib/engine/targetSelection.ts`
  - `./src/lib/engine/weekGeneration.ts`
  - `./src/lib/engine/rebalance.ts`
  - `./src/lib/supabase/queries/prescriptions.ts`
- **Questions to answer**:
  - Does target selection correctly treat missing prescriptions as a hard failure?
  - Does AI generation only use the allow-list?
  - Rebalance: is it detection-only and does it avoid per-item logging?

---

### Patch 13 — Unused code/variables/components + safe removal plan

- **Purpose**: Identify dead code and define the safe removal approach.
- **Inputs**:
  - TypeScript diagnostics (unused imports/vars).
  - ESLint (if configured).
  - Grep-based reference checks for files/components.
- **Rules**:
  - Remove only after confirming no runtime imports and no route linkage.
  - Prefer deleting in one patch per feature area.
- **Artifacts to fill in**:

| Item | Type | Why unused | Where referenced (should be none) | Removal patch ID |
|---|---|---|---|---|
|  | component |  |  |  |
|  | function |  |  |  |

---

### Patch 14 — Types + schema drift control

- **Purpose**: Ensure the repo has a single source of truth for Supabase types and a repeatable update flow.
- **Files**:
  - `./src/types/supabase.ts`
  - `./src/types/README.md`
- **Questions**:
  - Are the generated types aligned with current migrations?
  - Is `supabase.ts` checked in and used anywhere (or are query modules hand-typing)?

---

### Patch 15 — Security + privacy review

- **Purpose**: Confirm RLS, client auth usage, and safe logging.
- **Scope**:
  - Confirm immutable tables are read-only.
  - Confirm user-owned tables enforce `auth.uid()`.
  - Confirm no secrets are logged.
  - Confirm dev logging is aggregate-only.

---

## Findings (fill as you execute patches)

### Implemented vs not implemented (feature-level)

| Feature | Intended behavior | Implementation status | Files | Notes |
|---|---|---|---|---|
| Planner weekly template |  |  | `app/(tabs)/planner.tsx` |  |
| Edit scoping: Today only |  |  |  |  |
| Edit scoping: This week only |  |  |  |  |
| Edit scoping: Next week onward |  |  |  |  |
| Active workout execution UI |  |  |  |  |
| Progress tab |  |  |  |  |
| Heatmap |  |  |  |  |
| Smart Adjust (rebalance apply) |  |  |  |  |

---

## Recreate-from-scratch blueprint (high level)

This section is the “if you had to rebuild it” guide.

### 1) Tech stack

- **App runtime**: Expo + Expo Router
- **State**: Zustand
- **Backend**: Supabase (Postgres + Auth + RLS)
- **UI**: React Native primitives + theme tokens (`./src/lib/utils/theme.ts`)

### 2) Minimum environment

- `.env` with:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 3) Database setup

- Apply migrations in order (see “Migrations to apply”).
- Seed:
  - `v2_muscles`
  - `v2_exercises`
  - `v2_exercise_prescriptions`
  - (optional) `v2_ai_recommended_exercises`

### 4) App architecture

- **Routes** live under `./app/`.
- **Domain logic** lives under `./src/lib/engine/`.
- **Supabase access** is isolated in `./src/lib/supabase/`:
  - `client.ts` exports configured client.
  - `queries/` contains all DB read/write wrappers.
- **Global UI overlays** are centralized:
  - `uiStore` is the state machine.
  - `ModalManager` is the single host.

### 5) The core data model in one sentence

- Templates store **structure**, sessions/sets store **truth**, and targets come from **prescriptions** adjusted by **performed history**.
