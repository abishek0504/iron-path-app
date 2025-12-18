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
- [x] **Audit Patch 00**: Baseline tooling + repo inventory
- [x] **Audit Patch 01**: Navigation + route map + labels/icons correctness
- [x] **Audit Patch 02**: Global UI overlay system (bottom sheets, toasts) and state machine
- [x] **Audit Patch 03**: Auth/session bootstrap + onboarding gating
- [x] **Audit Patch 04**: Database schema + migrations + RLS policies verification
- [x] **Audit Patch 05**: Query layer inventory + contracts + error/return conventions
- [x] **Audit Patch 06**: Stores + hooks wiring (Zustand ↔ screens ↔ UI components)
- [x] **Audit Patch 07**: Planner flow (template→days→slots) + edit scoping
- [x] **Audit Patch 08**: Workout start flow (session creation + session_exercises + prefill sets)
- [x] **Audit Patch 09**: Workout execution UI (what exists vs placeholder) + save semantics
- [x] **Audit Patch 10**: Dashboard metrics + date range correctness + performance
- [x] **Audit Patch 11**: Progress tab + derived caches (heatmap/freshness)
- [x] **Audit Patch 12**: Engine: target selection, AI week generation, rebalance detection
- [x] **Audit Patch 13**: Unused code/variables/components + safe removal plan
- [x] **Audit Patch 14**: Types + schema drift control (Supabase generated types)
- [x] **Audit Patch 15**: Security + privacy review (RLS, env handling, dev logging)

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
| Node version | `v22.21.1` | Local toolchain version |
| Package manager | npm | `package-lock.json` exists |
| Typecheck command | Not defined | No `typecheck` script in `package.json` |
| Lint command | Not defined | No `lint` script in `package.json` |
| Test command | Not defined | No `test` script in `package.json` |

Additional Patch 00 notes (baseline):

- **npm scripts present**: `start`, `web`, `android`, `ios`, `ios:simulator`
- **TypeScript**: `strict: true`, `skipLibCheck: true`, path alias `@/*` → `./src/*` (`tsconfig.json`)
- **Babel plugins**: `nativewind/babel`, `react-native-reanimated/plugin` (`babel.config.js`)
- **Metro**: excludes `Archive/` via resolver blocklist (`metro.config.js`)
- **Expo config**: scheme `ironpath`, plugin `expo-router` (`app.json`)

---

### Patch 01 — Navigation + route map + labels/icons

- **Purpose**: Produce a definitive route map and ensure labels/icons match the route purpose.
- **Files (read-only)**:
  - `./app/_layout.tsx`
  - `./app/(tabs)/_layout.tsx`
  - All `./app/**/*.tsx` route files
- **Questions to answer**:
  - What routes exist (tabs vs stack vs modal presentation)?
  - Which route is considered the “active workout” route (canonical: `/workout/active`)?
  - Are tab labels/icons consistent with route purpose?
- **Artifacts to fill in**:

| Route | Type | Presentation | Entry points that navigate here | Status (implemented/placeholder) |
|---|---|---|---|---|
| `/` | bootstrap | stack | `app/index.tsx` | implemented |
| `/login` | auth | stack | `app/index.tsx`, `app/signup-success.tsx`, `app/signup.tsx`, `app/auth/callback.tsx`, `app/edit-profile.tsx`, `app/onboarding.tsx` | implemented |
| `/signup` | auth | stack | `app/login.tsx` | implemented |
| `/signup-success` | auth | stack | `app/signup.tsx` | implemented |
| `/onboarding` | flow | stack | `app/index.tsx`, `app/signup.tsx` | implemented |
| `/(tabs)` | tabs group | stack→tabs | `app/index.tsx`, `app/auth/callback.tsx`, `app/edit-profile.tsx` | implemented |
| `/(tabs)/index` | tab | tab | `app/(tabs)/_layout.tsx` | implemented |
| `/(tabs)/planner` | tab | tab | `app/(tabs)/_layout.tsx`, `app/onboarding.tsx` | implemented |
| `/(tabs)/progress` | tab | tab | `app/(tabs)/_layout.tsx` | placeholder |
| `/(tabs)/dashboard` | tab | tab | `app/(tabs)/_layout.tsx` | implemented |
| `/auth/forgot-password` | auth | modal | `app/login.tsx`, `app/edit-profile.tsx` | implemented |
| `/auth/change-email` | auth | modal | `src/components/settings/SettingsMenu.tsx` | implemented |
| `/auth/callback` | auth | modal | deep link redirect target | implemented |
| `/edit-profile` | modal | modal | `src/components/settings/SettingsMenu.tsx` | implemented |
| `/workout/active` | workout | modal | `app/(tabs)/index.tsx`, `app/(tabs)/planner.tsx` | placeholder |
| `/planner-day` | (registered screen) | stack (slide_from_right) | (no in-app navigation found yet) | **missing route file** |
| `/exercise-detail` | (registered screen) | modal | (no in-app navigation found yet) | **missing route file** |

Patch 01 notes:

- **Active workout route**: consolidated to `/workout/active` (`app/(stack)/workout/active.tsx`); stale `/workout-active` route removed.
- **Registered-but-missing routes**: `app/_layout.tsx` registers `planner-day` and `exercise-detail`, but there are no corresponding route files under `app/` today.

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
| `exercisePicker` | `src/components/exercise/ExercisePicker.tsx` | `src/hooks/useExercisePicker.ts` (used by `app/(tabs)/planner.tsx`) | `{ onSelect: (exercise) => void; multiSelect?: boolean }` |
| `settingsMenu` | `src/components/settings/SettingsMenu.tsx` | `src/components/ui/TabHeader.tsx` (settings gear → `openSheet('settingsMenu')`) | `{ onClose?: () => void }` |
| `planDayPicker` | `src/components/ui/PlanDayPicker.tsx` | `app/(tabs)/index.tsx` (`openSheet('planDayPicker', ...)`) | `{ selectedDayName: string; todayDayName: string; days: {dayName; hasWorkout}[]; onSelect(dayName); onResetToToday() }` |

Patch 02 notes:

- **Single-host overlay**: `ModalManager` is mounted once in `app/_layout.tsx` and renders at most one `BottomSheet` at a time based on `uiStore.activeBottomSheet`.
- **Queueing behavior**: `uiStore.openBottomSheet()` queues `pendingBottomSheet` when another sheet is open, triggers `closeBottomSheet()`, and `onBottomSheetClosed()` opens the pending sheet after the exit animation completes.

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

Patch 03 findings:

- **Session persistence** (`src/lib/supabase/client.ts`):
  - Web: `localStorage` + `detectSessionInUrl: true`
  - Native: `AsyncStorage` + `detectSessionInUrl: false`
- **Onboarding “required fields” mismatch**:

| Source | Required fields for “done onboarding” |
|---|---|
| `README_V2.md` | `full_name`, `age`, `current_weight`, `use_imperial`, `experience_level`, `days_per_week`, `equipment_access[]` |
| `app/index.tsx` bootstrap gate | `experience_level`, `days_per_week`, `equipment_access[]` (non-empty) |
| `app/onboarding.tsx` validation | `fullName`, `age` (13–120), `weight` (>0), `experience`, `daysPerWeek` (1–7), `equipment[]` (non-empty), `useImperial` (toggle stored) |

- **Auth flows**:
  - Signup (`app/signup.tsx`): if Supabase returns `data.session`, route → `/onboarding`; else → `/signup-success` (email confirmation flow).
  - Forgot password (`app/auth/forgot-password.tsx`): uses `redirectTo = EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? Linking.createURL('/auth/callback')`.
  - Change email (`app/auth/change-email.tsx`): uses `emailRedirectTo = EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? Linking.createURL('/auth/callback')`.
  - Callback (`app/auth/callback.tsx`): exchanges `code` for session; `type=email_change` routes to `/(tabs)`; password reset routes to `/login` after setting password.

- **Error surfacing patterns (by screen)**:
  - `login.tsx`, `signup.tsx`: inline `errorText` (no toast).
  - `forgot-password.tsx`, `change-email.tsx`: inline info + toast via `uiStore.showToast`.
  - `auth/callback.tsx`: inline status + toast via `uiStore.showToast`.
  - Missing Supabase env vars: dev-only `console.warn` in `src/lib/supabase/client.ts`.

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
| `v2_muscles` | system | auth SELECT only | yes | no | Used by rebalance (`v2_muscles.key`) |
| `v2_exercises` | system | auth SELECT only | yes | no | Used by exercise picker + merged view |
| `v2_exercise_prescriptions` | system | auth SELECT only | yes | no | Patch H removes `goal`; code queries `(exercise_id, experience, mode)` |
| `v2_ai_recommended_exercises` | system | auth SELECT only | yes | no | Used by AI week generation allow-list |
| `v2_user_exercise_overrides` | user | owner CRUD (`user_id = auth.uid()`) | yes | no (no UI write path found) | Read during merged exercise lookup |
| `v2_user_custom_exercises` | user | owner CRUD (`user_id = auth.uid()`) | yes | no (no UI write path found) | Patch D adds target-band columns + constraints |
| `v2_profiles` | user | owner CRUD (`id = auth.uid()`) | yes | yes | Onboarding + edit-profile update this table |
| `v2_workout_templates` | user/system | owner OR `user_id IS NULL` | yes | yes | RLS allows writes when `user_id IS NULL` |
| `v2_template_days` | user/system | owner via template (includes `user_id IS NULL`) | yes | yes | Created/ensured by `ensureTemplateHasWeekDays()` |
| `v2_template_slots` | user/system | owner via template (includes `user_id IS NULL`) | yes | yes | Patch C1 adds `custom_exercise_id` + XOR check |
| `v2_workout_sessions` | user | owner CRUD (`user_id = auth.uid()`) | yes | yes | Created by planner; deleted by workout reset; completed by complete flow |
| `v2_session_exercises` | user | owner via session | yes | yes | XOR constraint for exercise vs custom exercise (Patch C2 reinforces) |
| `v2_session_sets` | user | owner via session | yes | yes | Prefill creates rows; save updates/upserts rows |
| `v2_muscle_freshness` | user | owner CRUD | no (not referenced) | no | Intended derived cache; no app rebuild job found yet |
| `v2_daily_muscle_stress` | user | owner CRUD | no (not referenced) | no | `WorkoutHeatmap` component exists but is not imported by any current route |

Patch 04 notes:

- **Schema evolution checkpoints**:
  - Patch C1: `v2_template_slots.custom_exercise_id` + XOR constraint with `exercise_id`.
  - Patch C2: reinforces `v2_session_exercises.custom_exercise_id` + XOR constraint (table already had it in base migration).
  - Patch D: adds target-band fields (`mode`, `sets_min/max`, `reps_min/max`, `duration_sec_min/max`) + CHECK constraints to `v2_user_custom_exercises` and **backfills existing rows** with `mode='reps'`, `3–4` sets, `8–12` reps when `mode IS NULL`.
  - Patch H: removes `goal` from `v2_profiles`, `v2_exercise_prescriptions`, and `v2_template_slots`; consolidates prescriptions before dropping the column.

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
| `queries/exercises.ts` | `getMergedExercise` | `{ exerciseId?; customExerciseId? }`, `userId` | `MergedExercise \u007c null` | returns `null` | `app/(tabs)/planner.tsx`, `app/(tabs)/index.tsx`, `src/lib/engine/rebalance.ts`, `src/lib/engine/targetSelection.ts` |
| `queries/exercises.ts` | `listMergedExercises` | `userId`, `exerciseIds?` | `MergedExercise[]` | returns `[]` | `app/(tabs)/planner.tsx`, `app/(tabs)/dashboard.tsx` |
| `queries/prescriptions.ts` | `getExercisePrescription` | `exerciseId`, `experience`, `mode` | `ExercisePrescription \u007c null` | returns `null` | `src/lib/engine/targetSelection.ts` |
| `queries/prescriptions.ts` | `getExercisePrescriptions` | `exerciseId` | `ExercisePrescription[]` | returns `[]` | (no runtime usage found) |
| `queries/prescriptions.ts` | `getPrescriptionsForExercises` | `exerciseIds[]`, `experience`, `mode` | `Map<exercise_id, ExercisePrescription>` | returns empty `Map` | `src/lib/engine/targetSelection.ts` |
| `queries/users.ts` | `getUserProfile` | `userId` | `UserProfile \u007c null` | returns `null` | `app/index.tsx`, `app/onboarding.tsx`, `app/edit-profile.tsx`, `app/(tabs)/dashboard.tsx` |
| `queries/users.ts` | `updateUserProfile` | `userId`, `updates` | `boolean` | returns `false` | `app/onboarding.tsx`, `app/edit-profile.tsx` |
| `queries/users.ts` | `createUserProfile` | `userId`, `profile` | `boolean` | returns `false` | `app/onboarding.tsx` |
| `queries/templates.ts` | `getUserTemplates` | `userId` | `TemplateSummary[]` | returns `[]` | `app/onboarding.tsx`, `app/(tabs)/planner.tsx`, `app/(tabs)/index.tsx` |
| `queries/templates.ts` | `getTemplateWithDaysAndSlots` | `templateId` | `FullTemplate \u007c null` | returns `null` | `app/(tabs)/planner.tsx`, `app/(tabs)/index.tsx` |
| `queries/templates.ts` | `createTemplate` | `userId`, `name?` | `Template \u007c null` | returns `null` | `app/onboarding.tsx`, `app/(tabs)/planner.tsx` |
| `queries/templates.ts` | `upsertTemplateDay` | `templateId`, `dayName`, `sortOrder` | `TemplateDay \u007c null` | returns `null` | `src/lib/supabase/queries/templates.ts` (`ensureTemplateHasWeekDays`) |
| `queries/templates.ts` | `ensureTemplateHasWeekDays` | `templateId` | `TemplateDay[]` | returns `[]` | `app/onboarding.tsx`, `app/(tabs)/planner.tsx` |
| `queries/templates.ts` | `createTemplateSlot` | `dayId`, `{ exerciseId?; customExerciseId?; experience?; notes?; sortOrder }` | `TemplateSlot \u007c null` | returns `null` | `app/(tabs)/planner.tsx`, `src/lib/supabase/queries/templates.ts` (helpers) |
| `queries/templates.ts` | `updateTemplateSlot` | `slotId`, `updates` | `boolean` | returns `false` | `src/lib/supabase/queries/templates.ts` (`applyStructureEditToTemplate`) |
| `queries/templates.ts` | `applySessionStructureToTemplate` | `userId`, `templateId`, `structure[]` | `boolean` | returns `false` | `app/(tabs)/planner.tsx` |
| `queries/templates.ts` | `applyStructureEditToTemplate` | `templateId`, `edit` | `boolean` | returns `false` | `app/(tabs)/planner.tsx` |
| `queries/templates.ts` | `deleteTemplateSlot` | `slotId` | `boolean` | returns `false` | `src/lib/supabase/queries/templates.ts` (`applyStructureEditToTemplate`) |
| `queries/templates.ts` | `deleteTemplateDay` | `dayId` | `boolean` | returns `false` | (no runtime usage found) |
| `queries/workouts.ts` | `createWorkoutSession` | `userId`, `templateId?`, `dayName?` | `WorkoutSession \u007c null` | returns `null` | `app/(tabs)/planner.tsx`, `src/lib/supabase/queries/workouts_helpers.ts` |
| `queries/workouts.ts` | `getActiveSession` | `userId` | `WorkoutSession \u007c null` | returns `null` | `app/(tabs)/index.tsx` |
| `queries/workouts.ts` | `completeWorkoutSession` | `sessionId` | `boolean` | returns `false` | (no runtime usage found) |
| `queries/workouts.ts` | `saveSessionSet` | `sessionExerciseId`, `setNumber`, `setData` | `SessionSet \u007c null` | returns `null` | (no runtime usage found) |
| `queries/workouts.ts` | `getSessionsInRange` | `userId`, `startIso`, `endIso` | `WorkoutSession[]` | returns `[]` | `app/(tabs)/dashboard.tsx` |
| `queries/workouts.ts` | `getRecentSessions` | `userId`, `limit=5` | `WorkoutSession[]` | returns `[]` | `app/(tabs)/dashboard.tsx` |
| `queries/workouts.ts` | `getTopPRs` | `userId`, `limit=3` | `TopPR[]` | returns `[]` | `app/(tabs)/dashboard.tsx` |
| `queries/workouts.ts` | `prefillSessionSets` | `sessionId`, `sessionExercises[]`, `targets Map` | `boolean` | returns `false` | `app/(tabs)/planner.tsx` |
| `queries/workouts.ts` | `getLast7DaysSessionStructure` | `userId` | `{ dayName; exercises[] }[]` | returns `[]` | `app/(tabs)/planner.tsx` |
| `queries/workouts.ts` | `getExerciseHistory` | `exerciseId`, `userId`, `limit` | **missing export** | n/a | referenced by `src/lib/engine/targetSelection.ts` |
| `queries/workouts_helpers.ts` | `getOrCreateActiveSessionForToday` | `userId`, `dayName?` | `WorkoutSession \u007c null` | returns `null` | `app/(tabs)/planner.tsx` |
| `queries/workouts_helpers.ts` | `createSessionExercise` | `sessionId`, `{ exerciseId?; customExerciseId?; sortOrder }` | `SessionExercise \u007c null` | returns `null` | `src/lib/supabase/queries/workouts_helpers.ts` (`applyStructureEditToSession`) |
| `queries/workouts_helpers.ts` | `applyStructureEditToSession` | `sessionId`, `edit` | `boolean` | returns `false` | `app/(tabs)/planner.tsx` |

Patch 05 notes:

- **Error-return contract is not uniform across modules**: some functions return `null`, others `[]`, others `false`, others an empty `Map`. Within each module it’s mostly consistent, but cross-module callers must handle different failure shapes.
- **Resolved**: `getExerciseHistory` is implemented in `queries/workouts.ts` (completed sessions only, exercise OR custom exercise match, safe empty object when no history) so `targetSelection` no longer crashes.

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
| `uiStore` | `activeBottomSheet`, `bottomSheetProps`, `isBottomSheetOpen`, `pendingBottomSheet`, `pendingBottomSheetProps`, `toasts[]` | `openBottomSheet`, `closeBottomSheet`, `onBottomSheetClosed`, `showToast`, `removeToast` | `src/components/ui/ModalManager.tsx`, `src/components/ui/ToastProvider.tsx`, `src/hooks/useModal.ts`, `src/hooks/useToast.ts`, `src/hooks/useExercisePicker.ts`, `app/(tabs)/dashboard.tsx`, `app/auth/*`, `src/components/*` | Bottom sheet queueing state machine lives here |
| `userStore` | `profile`, `isLoading` | `setProfile`, `updateProfile`, `clearProfile` | `app/index.tsx`, `app/onboarding.tsx`, `app/(tabs)/planner.tsx`, `app/(tabs)/dashboard.tsx`, `app/edit-profile.tsx` | Cache only; DB writes happen via `queries/users.ts` |
| `exerciseStore` | `searchQuery`, `selectedExercises[]`, `isLoading` | `setSearchQuery`, `setSelectedExercises`, `addSelectedExercise`, `removeSelectedExercise`, `clearSelection` | `src/components/exercise/ExercisePicker.tsx` | `selectedExercises` not used outside picker currently |
| `workoutStore` | `activeSession`, `isLoading` | `setActiveSession`, `updateSessionProgress`, `completeSession`, `abandonSession`, `clearSession` | (no runtime usage found) | Likely intended for active workout execution screen (currently placeholder) |

Patch 06 notes:

- `workoutStore` exists but is not imported by any current route/component; state is currently derived directly from Supabase queries in the tab screens.

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

Patch 07 findings:

- **Scope prompt wiring**: planner stores a `pendingEdit` then shows `EditScopePrompt`; scope routes writes to either `workouts_helpers` (“today”) or `templates` (“nextWeek”).
- **Scope coverage**:
  - `today`: supports `addSlot` only; `removeSlot` is explicitly TODO and surfaces a toast.
  - `thisWeek`: disabled (TODO).
  - `nextWeek`: supports `addSlot`/`removeSlot` via `applyStructureEditToTemplate`; `reorderSlots` TODO.
- **Target computation**: Fixed — `selectExerciseTargets` now accepts `{ exerciseId?, customExerciseId? }` (XOR) and planner passes both, so custom exercises use the merged view and custom target bands; missing bands fail safely.

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

Patch 08 findings:

- **DB writes on “Start this day”** (`app/(tabs)/planner.tsx`):
  - Inserts `v2_workout_sessions` via `createWorkoutSession(userId, templateId, dayName)` with `status='active'`.
  - For each template slot: inserts `v2_session_exercises` (structure only) with `exercise_id` XOR `custom_exercise_id`, plus `sort_order`.
  - Prefills `v2_session_sets` via `prefillSessionSets(...)`:
    - Creates `set_number = 1..target.sets` rows.
    - Inserts target `reps`/`weight`/`duration_sec` with `rpe/rir/rest_sec/notes` as `null`.
- **Prefill semantics vs schema**:
  - The schema defaults `v2_session_sets.performed_at` to `now()`. Prefilling targets therefore creates rows that look “performed” by timestamp, even though they are intended as editable starting targets.
- **Custom exercise handling**: **Fixed (Patch 07 + Patch 08)**:
  - Session structure and start flow carry `exercise_id` XOR `custom_exercise_id`.
  - Prefill uses targets keyed by XOR IDs; engine calls expect `{ exerciseId?, customExerciseId? }`.
- **Completion wiring**:
  - Planner navigates to `/workout/active` after creating the session; there is no completion/abandon path wired from the placeholder active-workout screens yet.

---

### Patch 09 — Active workout execution UI + save semantics

- **Purpose**: Determine what the “active workout” UI currently is (placeholder vs full), and document the intended save/complete lifecycle.
- **Files (read-only)**:
  - `./app/(stack)/workout/active.tsx`
  - Any `saveSessionSet` call sites
- **Questions to answer**:
  - Which route is the real one the app uses today?
  - Is session completion wired (`completeWorkoutSession`) and where?
  - Is `saveSessionSet` used anywhere yet?

Patch 09 findings:

- **Active workout route**: Consolidated to `/workout/active` (`app/(stack)/workout/active.tsx`); planner updated to use this route and stale `app/workout-active.tsx` removed.
- **Execution flow**: Still placeholder; no `saveSessionSet(...)`/`completeWorkoutSession(...)` call sites yet.

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

Patch 10 findings:

- **Week range definition** (`app/(tabs)/dashboard.tsx`): computes local Sunday-start week boundaries and converts to ISO strings for querying. **Fixed**: Verified and documented Sunday-Saturday week calculation logic.
- **Query timestamp mismatch**: **Fixed**
  - Dashboard labels metric as "This week completed workouts", but `getSessionsInRange(...)` filters on `v2_workout_sessions.started_at` (not `completed_at`).
  - **Resolution**: Updated `getSessionsInRange` to filter by `completed_at` instead of `started_at`, and added `.not('completed_at', 'is', null)` to ensure only sessions with completion timestamps are included.
- **PRs implementation bias**: **Fixed**
  - `getTopPRs(...)` currently filters sets with `weight IS NOT NULL` and orders by `weight desc`, so timed PRs (`duration_sec`) are not discoverable by this query path.
  - **Resolution**: Refactored `getTopPRs` to fetch both weight-based and duration-based PRs in parallel, then merge and return top results sorted by recency. Now supports hybrid PR ranking for both rep-based and timed exercises.

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

Patch 11 findings:

- `app/(tabs)/progress.tsx` is a placeholder with TODO guidance about grouping by `completed_at` / `performed_at` and not `day_name`.
- `src/components/workout/WorkoutHeatmap.tsx` queries `v2_daily_muscle_stress` and aggregates client-side; it is **not imported by any current route**, and `onMuscleSelect` is currently unused in the component.
- No in-repo jobs/processes were found that rebuild `v2_daily_muscle_stress` or `v2_muscle_freshness` from performed truth.

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
  - Does AI generation only use the allow-list, and how does it respect current fatigue?
  - Rebalance: is it detection-only and does it avoid per-item logging?

Patch 12 findings:

- **Target selection** (`src/lib/engine/targetSelection.ts`):
  - Missing prescription → returns `null` (hard failure path), with dev error logs.
  - Progressive overload uses performed history via `getExerciseHistory` (completed sessions only, keyed by master/custom id) and always clamps inside the prescription/custom band.
  - Custom exercises are handled via their own target-band fields on `v2_user_custom_exercises`; masters read from `v2_exercise_prescriptions`.
- **AI week generation — biomechanical simulator** (`src/lib/engine/weekGeneration.ts`):
  - Uses `v2_ai_recommended_exercises` as an allow-list of candidate exercises (with `priority_order` as base priority).
  - Front-loads all data in one go (no SQL in the selection loop):
    - Merged exercise metadata from `listMergedExercises(userId, exerciseIds)` for `primary_muscles` + `implicit_hits`.
    - Prescription bands from `getPrescriptionsForExercises(exerciseIds, experience, mode)` (same bands used by `selectExerciseTargets`).
    - Real fatigue from last 48h performed truth via `getMuscleStressStats(userId, startIso, endIso)` as the initial `MuscleStressMap`.
  - For each candidate builds an `ExerciseStressProfile`:
    - `TargetSets = round((sets_min + sets_max) / 2)` from the prescription/custom band.
    - `perMuscleWeights` from `primary_muscles` (1.0 each) plus `implicit_hits` weights, then normalized so the sum is 1.0 (this is `NormalizedMuscleWeight`).
    - `basePriority` derived from `priority_order` (lower order → higher base priority).
  - Initializes a `SimulatedFatigueState` with `getMuscleStressStats` output and then runs a greedy, slot-by-slot loop:
    - For each candidate, computes the worst normalized fatigue fraction across its muscles:
      - `fraction_m = clamp(stress_m / MAX_FATIGUE_PER_MUSCLE, 0, 1)`.
      - `worstFraction = max_m fraction_m`.
    - Applies zone scoring:
      - Green zone (`worstFraction <= 0.5`): `FatiguePenalty = 0`.
      - Yellow zone (`0.5 < worstFraction <= 0.85`): `FatiguePenalty = 0.5 * basePriority`.
      - Red zone (`worstFraction > 0.85`): `FatiguePenalty = ∞` (exercise is hard-blocked for this run).
    - Computes `Score = basePriority - FatiguePenalty` and picks the highest-scoring exercise; after each pick, calls `registerExercise(profile)` to add:
      - `EstimatedStress_per_muscle = TargetSets * 0.7 * NormalizedMuscleWeight_m`.
    - Stops when either all remaining candidates are in the red zone or the candidate set is exhausted.
  - Returns an ordered list of `exercise_id`s that naturally pivots away from already-fatigued muscles while still honoring the allow-list and prescription bands.
- **Rebalance detection** (`src/lib/engine/rebalance.ts`):
  - Detection-only (returns reasons + missed muscles; does not apply edits).
  - Aggregates muscles hit from `primary_muscles` and the keys of `implicit_hits`, and is used as a pre-start safety net (`needsRebalance`) before starting a session from the planner.

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
| `src/stores/workoutStore.ts` | module | Store is not imported by any current route/component | `V2_ARCHITECTURE.md` (docs only) |  |
| `src/components/workout/WorkoutHeatmap.tsx` | component | Not imported by any current route | `V2_ARCHITECTURE.md`, `IMPLEMENTATION_SUMMARY.md` (docs only) |  |
| `src/lib/supabase/queries/workouts.ts::completeWorkoutSession` | function | No call sites found outside query module/docs | `IMPLEMENTATION_SUMMARY.md`, `V2_ARCHITECTURE.md` (docs only) |  |
| `src/lib/supabase/queries/workouts.ts::saveSessionSet` | function | No call sites found outside query module/docs | `IMPLEMENTATION_SUMMARY.md`, `V2_ARCHITECTURE.md` (docs only) |  |
| `src/lib/supabase/queries/templates.ts::deleteTemplateDay` | function | No call sites found outside query module/docs | `IMPLEMENTATION_SUMMARY.md` (docs only) |  |
| `src/lib/supabase/queries/prescriptions.ts::getExercisePrescriptions` | function | No call sites found outside query module/docs | `V2_ARCHITECTURE.md` (docs only) |  |
| `app/_layout.tsx` screen name `planner-day` | route registration | Screen registered but route file does not exist | (no route file under `app/`) |  |
| `app/_layout.tsx` screen name `exercise-detail` | route registration | Screen registered but route file does not exist | (no route file under `app/`) |  |

---

### Patch 14 — Types + schema drift control

- **Purpose**: Ensure the repo has a single source of truth for Supabase types and a repeatable update flow.
- **Files**:
  - `./src/types/supabase.ts`
  - `./src/types/README.md`
- **Questions**:
  - Are the generated types aligned with current migrations?
  - Is `supabase.ts` checked in and used anywhere (or are query modules hand-typing)?

Patch 14 findings:

- `src/types/supabase.ts` is currently a **placeholder** (not generated types), so there is no enforced schema/type contract in the repo yet.
- Supabase query modules define their own interfaces (hand-typed) and do not reference `Database` types today.
- The documented generation command exists (`src/types/README.md`), but there is no repo script/CI check that ensures it was run after migrations.

---

### Patch 15 — Security + privacy review

- **Purpose**: Confirm RLS, client auth usage, and safe logging.
- **Scope**:
  - Confirm immutable tables are read-only.
  - Confirm user-owned tables enforce `auth.uid()`.
  - Confirm no secrets are logged.
  - Confirm dev logging is aggregate-only.

Patch 15 findings:

- **Client keying**: app uses `EXPO_PUBLIC_SUPABASE_ANON_KEY` via `src/lib/supabase/client.ts` (no `service_role` usage found).
- **RLS risk (system templates)**: `v2_workout_templates` policy allows `user_id IS NULL` for `FOR ALL` with `WITH CHECK`, meaning authenticated clients can potentially write to “system” templates (and by extension days/slots via “owner via template” policies).
- **Dev logging**: logging is consistently wrapped in `if (__DEV__)`; most logs are state drivers + aggregates. No env secrets are logged by the app code paths reviewed.

---

## Findings (fill as you execute patches)

### Implemented vs not implemented (feature-level)

| Feature | Intended behavior | Implementation status | Files | Notes |
|---|---|---|---|---|
| Planner weekly template | Always show 7 days, manage slots, compute targets from prescriptions, start a day into a session | implemented (with TODOs) | `app/(tabs)/planner.tsx` | Target selection uses merged exercise view + `getExerciseHistory`; custom-exercise path supported via XOR IDs |
| Edit scoping: Today only | Structure edits apply to an active “today” session (create if missing) | partially implemented | `app/(tabs)/planner.tsx`, `src/lib/supabase/queries/workouts_helpers.ts`, `src/components/ui/EditScopePrompt.tsx` | `addSlot` supported; `removeSlot`/`swapExercise`/`reorderSlots` are not implemented for sessions |
| Edit scoping: This week only | Structure edits apply only for current week instance | not implemented | `src/components/ui/EditScopePrompt.tsx`, `app/(tabs)/planner.tsx` | Disabled/stubbed with TODO |
| Edit scoping: Next week onward | Structure edits apply to template | partially implemented | `src/lib/supabase/queries/templates.ts`, `app/(tabs)/planner.tsx` | `addSlot`/`removeSlot`/`swapExercise` supported; `reorderSlots` TODO |
| Active workout execution UI | Execute a session: track sets, save, complete | placeholder | `app/(stack)/workout/active.tsx` | Consolidated: `/workout/active` canonical; `app/workout-active.tsx` removed |
| Progress tab | Charts/analytics over performed truth | implemented (history list) | `app/(tabs)/progress.tsx` | Shows completed sessions list (date, name, exercise count) from `getRecentSessions` + `v2_session_exercises` |
| Heatmap | Show daily muscle stress grid | implemented (sensors) | `src/components/workout/WorkoutHeatmap.tsx`, `app/(tabs)/dashboard.tsx`, `src/components/ui/ModalManager.tsx` | Uses `getMuscleStressStats` over performed sets, presentational `WorkoutHeatmap` on Dashboard + global `muscleStatus` sheet |
| Smart Adjust (rebalance apply) | If gaps detected, propose minimal changes and optionally apply | partially implemented | `src/lib/engine/rebalance.ts`, `src/components/ui/SmartAdjustPrompt.tsx`, `app/(tabs)/planner.tsx` | Detection + prompt exist; “Smart adjust” apply is TODO |

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
