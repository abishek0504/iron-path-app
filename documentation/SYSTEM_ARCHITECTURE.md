# System Architecture

**Purpose**: Document core architectural decisions and WHY they were made.

**Last Updated**: 2026-06-11

## Core Principles

### 1. Strict Data Layering (WHY: Prevent data corruption and ensure single source of truth)

```
Canonical Reference (immutable) 
  ↓
Curated Prescriptions (admin-managed)
  ↓
User Customization (user overrides)
  ↓
Planning (templates = structure/intent)
  ↓
Performed Truth (sessions/sets = what actually happened)
  ↓ (optional)
Derived Caches (rebuildable from performed truth)
```

**Hard Rules:**
- Planning proposes; performed truth records
- Never invent generic defaults (3×10, 60s) - always use prescriptions
- Progressive overload never writes into templates
- Templates store structure only, never weight/reps/duration
- Master data is immutable from client (RLS enforces)

### 2. No Modal-in-Modal Pattern (WHY: Prevent navigation hell and state bugs)

**Problem Solved:** Opening a modal inside another modal creates:
- State management nightmares
- Broken animations
- Confusing UX

**Solution:**
- **Quick actions** = Global bottom sheets (Zustand-managed)
  - Exercise picker
  - Settings menu
  - Plan day picker
  - Muscle status viewer
- **Deep flows** = Stack routes (Expo Router)
  - Active workout
  - Edit profile
  - Auth screens

**Implementation:**
- Single `ModalManager` component mounted in root layout
- `uiStore` manages which sheet is open (only one at a time)
- Queue system for sequential sheet opening
- Exit animations complete before clearing state

### 3. Prescription-Based Targets (WHY: No meaningless defaults, research-backed programming)

**Problem Solved:** Generic defaults (3×10 for everything) don't match exercise physiology.

**Solution:**
- Every exercise has curated targets in `v2_exercise_prescriptions`
- Context-aware: `(exercise_id, experience, mode)` → target bands
- Missing prescription = data error (exclude from generation, show warning)
- History adjusts within prescription band (progressive overload)

**Example:**
- Plank: 3×60s (timed mode, beginner)
- Bench Press: 3-4×8-12 (reps mode, intermediate)
- Bicep Curls: 3-4×10-15 (reps mode, beginner)

### 4. Merged Exercise View (WHY: User customization without corrupting global data)

**Pattern:**
```typescript
getMergedExercise({ exerciseId?, customExerciseId? }, userId)
// Returns: master defaults ⊕ non-null user overrides
// OR: custom exercise if customExerciseId provided
```

**Used everywhere:**
- Engine target selection
- AI week generation
- Workout display
- Exercise picker

**Flow:**
1. Check if custom exercise (user-created)
2. If custom → return custom exercise directly
3. Else → fetch master + fetch overrides → merge

### 5. Planning vs Performed Truth Set Defaults (WHY: Editable plan, accurate history)

**Problem Solved:** Users need to plan exercises for future weeks without corrupting performed-truth history or global prescriptions.

**Solution:**
- **Planning layer:** `v2_template_slots` stores exercise structure only (which exercises, in what order, with what experience level).
- **Performed truth:** `v2_session_sets` stores actual sets performed.
- **Flow:**
  - Planner edits:
    - Users can add/remove exercises and set experience level for future weeks.
    - No editable defaults for sets/reps/weight - templates store structure only.
  - Start workout:
    - Planner/Workout tab loads template slots.
    - Always uses prescriptions + history via `selectExerciseTargets()` to determine prefill targets.
    - `prefillSessionSets` writes `v2_session_sets` rows with these intelligent starting values.
  - Active workout:
    - User edits and completes sets.
    - `markSetComplete` updates `v2_session_sets` and sets `performed_at`.

This keeps **plan editing** (structure) and **performed truth** cleanly separated. Prescriptions + history provide intelligent prefill, and users can adjust during the workout if needed.

### 5.1 Context-Aware View Controller (Planner and Workout tabs)

**Constraint:** Planner and Workout remain separate tabs; no unified timeline replaces tabbed navigation. Context-aware logic lives within the existing tab structure.

**Planner tab:**
- **useDateContext(selectedDayName)** drives Today vs Future from the selected day in the day strip.
- **Today** (selected day === current weekday): Add/remove write to **session** (`v2_session_exercises`). "Today Only" badge shown only for session exercises that are **not** in the template for that day (diff by `exercise_id`/`custom_exercise_id`). "Save to Routine" on Today Only cards promotes the exercise to `v2_template_slots` for that day.
- **Future** (selected day !== today): Add/remove write to **template** (`v2_template_slots`) only.
- No Edit Scope modal; scope is implicit from date context. Removing a session exercise shows toast "Exercise removed from today's session."

**Workout tab:**
- Dedicated "Today" / active session screen. No date picker; always the current active session.

### 5.2 Smart Refresh Engine (Active Workout)

**Purpose:** Re-sync the active session with the template and latest history when the plan or body has diverged, without losing performed truth.

**Staleness detection** (`detectSessionStaleness` in `src/lib/engine/sessionStaleness.ts`):
1. **Structural:** Template slot order/ids vs session exercise order/ids (excluding today-only) differ.
2. **Target freshness:** Last completed workout `completed_at` > session `started_at` (progressive overload calc is stale).
3. **Biomechanical (optional):** Any primary muscle freshness < 30% (requires `v2_muscle_freshness` and exercise primary muscles).

**Active Workout UI:**
- Refresh button in header: **Orange** when structural or target divergence; **Red** when biomechanical. Tapping opens **Smart Refresh confirmation sheet** (non-blocking overlay) with proposed additions, removals, and "Recalculating targets from latest history," then **Apply Updates**.
- **Merge logic** (`getSmartRefreshPlan` + `applySmartRefresh` in `workouts_helpers.ts`): Never delete session exercises that have at least one set with `performed_at`. Delete unprotected session exercises not in template; insert from template; prefill new exercises with `selectExerciseTargets`; leave performed sets untouched.

### 6. RLS & Immutability (WHY: Security and data integrity)

**Immutable Tables** (auth SELECT only):
- `v2_muscles` - Canonical muscle keys (includes `adductors`)
- `v2_exercises` - Master exercise list (388 entries after the 2026-06 CSV import; `is_stretch` flags mobility/stretch entries)
- `v2_exercise_prescriptions` - Curated targets
- `v2_ai_recommended_exercises` - AI allow-list

**User-Owned Tables** (user CRUD via RLS):
- `v2_profiles` - User settings (+ `deleted_at` / `scheduled_purge_at` soft-delete markers)
- `v2_user_exercise_overrides` - Exercise customizations
- `v2_user_custom_exercises` - User-created exercises
- `v2_workout_templates` + children - Planning
- `v2_workout_sessions` + children - Performed truth
- `v2_muscle_freshness`, `v2_daily_muscle_stress` - Caches
- `v2_weight_logs` - Body-weight log entries
- `v2_user_exercise_prs` - PR cache (maintained by upsert trigger; warm-ups excluded)
- `v2_health_sync` - Apple Health import/export ledger
- `v2_support` - Help & Support submissions
- `v2_ai_generations` - AI generation audit (owner SELECT only; rows written by the generate-workout Edge Function via service role)

**RLS Enforcement:**
```sql
-- User-owned pattern:
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid())

-- Transitive ownership (via template):
USING (
  EXISTS (
    SELECT 1 FROM v2_workout_templates t
    WHERE t.id = slots.template_id
    AND t.user_id = auth.uid()
  )
)
```

**System Template Hardening (resolved 2026-05):**
- Previous `FOR ALL` policies let any auth user write rows with `user_id IS NULL` (system templates)
- Migration `20260508000000_tighten_system_template_rls.sql` split policies: SELECT allows owner OR system, INSERT/UPDATE/DELETE are owner-only (same pattern on `v2_template_days`/`v2_template_slots` via EXISTS on the parent template)

### 3.1 Frictionless Logging Pattern (Active Workout)

**Location**: `app/(stack)/workout/active.tsx`, `src/components/workout/RPESlider.tsx`

User research indicates high churn when logging is tedious. We adopt a "Management by Exception" philosophy: the plan pre-fills targets; the user only edits when they deviate.

**Assumption:** The user follows the plan 90% of the time.

**Interaction Pattern:**
- **Exercise-by-exercise flow**: EXECUTION → REST → LOGGING phases (see Active Workout State Machine below)
- **Tap "Complete Set"** (on-screen or Apple Watch) logs pre-filled target weight/reps/duration; preserves `set_type` (warm-up/drop/failure)
- **Batch logging screen** after each exercise: editable weight, reps, duration, and RPE sliders for all sets in that exercise
- **Optimistic UI**: Changes appear immediately, with background sync to database
- **Error Handling**: Failed saves show toast notification

**Implementation:**
- `@shopify/flash-list` for performant list rendering
- `react-native-reanimated` and `react-native-gesture-handler` for bottom sheets and transitions
- Apple Watch mirror via `modules/watch-connectivity/` (validated `sessionId` / `setNumber` on completion events)

### 4.1 Muscle Freshness Visualization

**Location**: `src/components/visualizations/BodyHeatmap.tsx`, `src/components/workout/WorkoutHeatmap.tsx`

Maps `v2_muscle_freshness` values (0–100) to recovery colors using `react-native-body-highlighter` (29 canonical muscle keys from `v2_muscles`):

- 0–30: Red (#ef4444) — fully fatigued
- 31–60: Orange (#f97316) — moderate fatigue
- 61–80: Yellow (#eab308) — light fatigue
- 81–100: Green (#22c55e) — fully recovered

**Platform behavior:**
- **Dev build / simulator**: full body diagram
- **Expo Go / web**: list fallback (muscle groups + percentages) when the native body highlighter is unavailable

### 4.2 Exercise images (bundled assets)

Master exercise illustrations ship as static JPGs in `assets/exercises/`, mapped by `src/lib/exerciseImages.ts`. `getExerciseImage(exerciseName)` returns the bundled asset (e.g. hero image in `add-exercise-edit`); custom exercises return null. There is no runtime image generation or storage bucket.

## State Management (Zustand)

**WHY Zustand:** Lightweight, no boilerplate, works with React Native.

### Store Separation

**`uiStore`**: Global UI state
- Bottom sheets (activeBottomSheet, queueing)
- Toasts (array of notifications)
- Never persisted

**`userStore`**: Profile cache
- Cached profile data
- Avoids repeated queries
- Cleared on logout

### State Update Pattern

```typescript
// Pattern: action logs, updates state, triggers re-renders
const useUIStore = create<UIState>((set) => ({
  activeBottomSheet: null,
  openBottomSheet: (id, props) => {
    if (__DEV__) devLog('ui-store', { action: 'openBottomSheet', id });
    set({ activeBottomSheet: id, bottomSheetProps: props });
  },
}));
```

## Active Workout State Machine

### WorkoutPhase Type
```typescript
// app/(stack)/workout/active.tsx — discriminated union, not a plain enum
type WorkoutPhase =
  | { type: 'execution'; setIndex: number }
  | { type: 'rest'; nextExerciseIndex: number; nextSetIndex: number }
  | { type: 'logging' }
  | { type: 'complete' };
```

### Phase Transitions

**EXECUTION Phase** (performing sets):
- Display current exercise, set type badge (warm-up/drop/failure), previous performance ("Last time"), and superset position when grouped
- User adjusts RPE slider for active set
- User taps "Complete Set" (on-screen or on the paired Apple Watch)
- `markSetComplete(setId, { reps, weight, rpe })` called
  - **CRITICAL**: Always sets `performed_at = NOW()` to mark set as complete
- Transition via `findNextStep` ([`src/lib/engine/workoutFlow.ts`](../src/lib/engine/workoutFlow.ts)):
  - Superset member with incomplete sets remaining mid-round → EXECUTION on the partner exercise, no rest
  - Round wrapped (or solo exercise, next set) → REST phase
  - Group/exercise fully complete → LOGGING phase

**REST Phase** (between sets):
- Automatic countdown timer; duration resolves per-exercise `rest_sec` → per-set `rest_sec` → 90s default (`resolveRestSec`)
- User can skip or wait
- Transition:
  - Timer ends or skip pressed → EXECUTION phase (next set, possibly on the next superset member)

**LOGGING Phase** (batch editing after exercise):
- Display all sets for current exercise
- Editable weight/reps/duration/RPE fields
- RPE sliders allow final adjustments
- User taps "Save & Continue"
- Validation: weight ≥ 0, reps > 0 (or duration > 0)
- For each edited set: `markSetComplete(setId, updatedValues)`
- Load weight suggestion for next exercise
- Transition:
  - If more exercises remain → EXECUTION phase (first set of next exercise)
  - Else → COMPLETE phase

**COMPLETE Phase** (workout finished):
- Display summary: "All sets complete"
- User taps "Finish Workout"
- `completeWorkoutSession(sessionId)` called
  - UPDATE v2_workout_sessions SET status='completed', completed_at=NOW()
  - update-muscle-freshness Edge Function runs (database trigger, plus a direct client invoke as fallback)
  - `writeCompletedWorkoutToHealth(sessionId)` mirrors the session to Apple Health as an HKWorkout (traditional strength training) when access is granted
  - `invalidateMuscleFreshnessCache(userId)` so the heatmap refetches
- Navigate back to Workout tab
- (An explicit mid-workout bail-out instead calls `abandonWorkoutSession`, which sets status='abandoned' and skips the freshness update)

### Apple Health integration (architecture)

**JS entry:** [`src/lib/health/healthIntegration.ts`](../src/lib/health/healthIntegration.ts), implemented on `@kingstinct/react-native-healthkit` (lazy-loaded; no-ops in Expo Go/web/Android). `completeWorkoutSession` calls `writeCompletedWorkoutToHealth`; [`insertWeightLog`](../src/lib/supabase/queries/weight.ts) calls `writeBodyMassToHealth` with kg converted from the user’s display unit (`healthDisplayUnit`). `importHealthSamplesForDashboard` pulls the last 30 days of external body-mass samples into `v2_weight_logs` (converted to the user's display unit) and runs after a successful connect on [`app/health-connect.tsx`](../app/health-connect.tsx).

**DB linkage:** `hk_workout_uuid`, `hk_sample_uuid`, `v2_session_health_metrics`, `v2_health_sync`. Idempotent writes.

**Native config:** the `@kingstinct/react-native-healthkit` Expo plugin adds the HealthKit entitlement and usage strings at prebuild (`app.json`); versions are pinned (`react-native-nitro-modules@0.32.0`, healthkit `13.1.4`) for Expo SDK 54 compatibility.

### watchOS companion (architecture)

Native SwiftUI mirror app managed by `@bacons/apple-targets` (sources in `targets/watch/`). **`WatchHealthWorkoutManager`** runs `HKWorkoutSession` for live heart rate; sends `heartRate` and `workoutEnded` (with `hkWorkoutUuid`) to the phone. iPhone module (`modules/watch-connectivity/`) wraps `WCSession`:

- Phone → watch: [`active.tsx`](../app/(stack)/workout/active.tsx) pushes workout state via `updateApplicationContext`.
- Watch → phone: set completion, HR snapshots, workout UUID. **Phone remains canonical Supabase writer.**

See [`native/watch/README.md`](../native/watch/README.md) for build steps.

### Workout analytics (architecture)

**Engine:** [`src/lib/analytics/`](../src/lib/analytics/). **Queries:** [`analytics.ts`](../src/lib/supabase/queries/analytics.ts). **UI:** Progress tab (Calendar/Trends/Exercises), exercise detail screen, session stats in `SessionDetailSheet`.

### Set Completion Tracking

**Database Contract**:
```sql
-- Prefill on session creation
INSERT INTO v2_session_sets (
  session_exercise_id, set_number,
  weight, reps, rpe,
  performed_at  -- NULL = not performed
) VALUES (...);

-- Mark complete when user taps "Complete Set"
UPDATE v2_session_sets
SET 
  weight = $1,
  reps = $2,
  rpe = $3,
  performed_at = NOW()  -- ← CRITICAL: This timestamp is the source of truth
WHERE id = $4;
```

**Resume Logic**:
```typescript
// Check for incomplete workout
const completedSets = sets.filter(s => s.performed_at !== null);
const hasActiveWorkout = 
  completedSets.length > 0 && 
  completedSets.length < sets.length;

// Show "Continue" button if true
```

### Critical Bug Fix (2026-01-21)

**Problem**: `markSetComplete` originally only updated weight/reps/rpe but never set `performed_at`. This caused:
- Sets appeared complete in UI but database had `performed_at = NULL`
- "Continue" button never appeared after exiting mid-workout
- Progress not saved

**Solution**: Modified `markSetComplete` to ALWAYS include:
```typescript
{
  ...values,
  performed_at: new Date().toISOString()
}
```

## Navigation System (Expo Router)

### Route Types

**Stack Routes** (slide animations):
- `/` - Bootstrap/auth check
- `/get-started` - Landing page
- `/login`, `/signup`, `/signup-success` - Auth
- `/onboarding` - Multi-step setup
- `/(tabs)/*` - Main app tabs
- `/workout/active` - Active workout (modal presentation)
- `/edit-profile` - Profile editing (modal presentation)
- `/add-exercise`, `/add-exercise-edit` - Exercise search and slot editing
- `/prs` - Personal records
- `/health-connect` - Apple Health connection
- `/help-support`, `/workout-reminders` - Settings sub-screens

**Tab Routes** (bottom tab bar):
- `/(tabs)/index` - Workout (today's plan)
- `/(tabs)/planner` - Plan (template management)
- `/(tabs)/progress` - Progress (calendar views)
- `/(tabs)/dashboard` - Dashboard (metrics, PRs)

**Bottom Sheets** (global overlays, `BottomSheetId` in `src/stores/uiStore.ts`):
- `exercisePicker` - Exercise selection
- `settingsMenu` - Settings options
- `planDayPicker` - Choose plan day
- `workoutPicker` - Choose among today's workouts
- `muscleStatus` - Heatmap display
- `sessionDetail` - Session details from Progress calendar

### Navigation Guards

**Bootstrap Flow** (`app/index.tsx`):
```
1. Check Supabase session
2. If no session → /get-started (landing page)
3. If session → load profile
4. If profile missing required fields → /onboarding
5. Else → /(tabs) (main app)
```

**Onboarding Gate**:
- Required fields: `first_name`, `date_of_birth`, `current_weight`, `use_imperial`, `experience_level`, `days_per_week`, `equipment_access[]`
- Multi-step flow (3 steps)
- Creates template + ensures 7 weekdays on completion

## Error Handling Patterns

### Query Functions

**Pattern:**
```typescript
// 1. Log action with __DEV__ guard
if (__DEV__) devLog('module', { action, params });

// 2. Try/catch wraps everything
try {
  const { data, error } = await supabase.from('table').select();
  
  // 3. Handle Supabase errors
  if (error) {
    if (__DEV__) devError('module', error, context);
    return null; // or [] for lists
  }
  
  // 4. Return data or fallback
  return data || null;
} catch (error) {
  if (__DEV__) devError('module', error, context);
  return null;
}
```

**Never throw** - Always return null/[]/false and let caller handle.

### UI Error Display

**Patterns:**
- **Inline errors**: Auth screens (red text below input)
- **Toast notifications**: CRUD operations (success/error/info)
- **Empty states**: No data scenarios (helpful messaging)

**Example:**
```typescript
const handleSave = async () => {
  const success = await updateProfile(userId, updates);
  if (success) {
    toast.success('Profile updated');
  } else {
    toast.error('Failed to update profile');
  }
};
```

### Dev Logging Rules

**When to log:**
- Query start: action + key params
- Query result: aggregates only (counts, not per-item data)
- Errors: full error + context
- State changes: before/after values (simple objects)

**Never log:**
- Per-item data in loops
- Sensitive data (passwords, tokens)
- In production (`__DEV__` guards all logs)

## File Organization

```
app/                    # Expo Router (file-based routing)
  _layout.tsx          # Root: Stack + global UI (Toast, ModalManager)
  (tabs)/              # Tab group
    _layout.tsx        # Custom tab bar with sliding indicator
    index.tsx          # Workout tab
    planner.tsx        # Plan tab
    progress.tsx       # Progress tab
    dashboard.tsx      # Dashboard tab
  (stack)/             # Stack screens (modals)
    workout/
      active.tsx       # Active workout execution
  auth/                # Auth flows
  *.tsx                # Other routes (onboarding, edit-profile, etc.)

src/
  components/          # React components
    ui/               # Global reusable UI
    ai/               # AI generation UI
    exercise/         # Exercise-specific
    settings/         # Settings-specific
    workout/          # Workout-specific
    progress/         # Progress-specific
    visualizations/   # BodyHeatmap (body-highlighter)
  hooks/              # React hooks (useToast, useModal, etc.)
  lib/
    ai/               # generateWorkoutDay (Edge Function client)
    cache/            # In-memory TTL caches (template, sessions, exercises, dashboard, freshness)
    engine/           # Business logic (targets, staleness, workout flow)
    health/           # Apple Health integration
    supabase/
      client.ts       # Supabase client config
      queries/        # Query functions (organized by domain)
    utils/            # Pure utilities
    exerciseImages.ts # Static name → bundled asset map
  stores/             # Zustand stores
  types/              # TypeScript types

assets/exercises/      # Bundled exercise illustrations (JPG, generated)

scripts/               # Dev tooling (SQL import generation)

supabase/
  migrations/         # SQL migrations (apply in order)
  functions/          # Edge Functions: generate-workout, update-muscle-freshness,
                      #   delete-account, revenuecat-webhook
  seed/               # Master exercise CSV source

modules/watch-connectivity/  # Local Expo Module wrapping WCSession (iPhone side)
targets/watch/               # SwiftUI watchOS companion (@bacons/apple-targets)
```

## Naming Conventions

### Database (PostgreSQL)
- Tables: `v2_` prefix + `snake_case` (e.g., `v2_workout_sessions`)
- Columns: `snake_case` (e.g., `exercise_id`, `sets_min`)
- Booleans: `is_` prefix (e.g., `is_active`, `is_timed`)
- Timestamps: `*_at` suffix (e.g., `created_at`, `performed_at`)

### Code (TypeScript/JavaScript)
- Components: `PascalCase` (e.g., `ExercisePicker`, `BottomSheet`)
- Functions: `camelCase` (e.g., `getMergedExercise`, `selectTargets`)
- Variables: `camelCase` (e.g., `exerciseId`, `targetSets`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_SETS`, `STIMULUS_DEFAULT`)
- Hooks: `use` prefix + `camelCase` (e.g., `useToast`, `useModal`)
- Stores: `camelCase` + `Store` suffix (e.g., `uiStore`, `userStore`)

### Conventions
- IDs always end with `Id` (e.g., `exerciseId`, not `exercise`)
- Counts end with `Count` (e.g., `setCount`, not `sets`)
- Arrays are plural (e.g., `exercises`, not `exerciseList`)
- Booleans start with `is`/`has` (e.g., `isLoading`, `hasError`)

## Key Architectural Decisions Log

### Decision: Remove `goal` from prescriptions
**When**: Patch H (migration 20250101000003)  
**Why**: Holistic approach - all goals (strength, hypertrophy, mobility) met through comprehensive full-body workouts  
**Impact**: Unique key changed from `(exercise_id, goal, experience, mode)` to `(exercise_id, experience, mode)`  
**Migration**: Consolidate duplicates (prefer hypertrophy if exists), drop column, update constraint  

### Decision: Split `full_name` into `first_name` and `last_name`
**When**: Patch (migration 20250101000005)  
**Why**: Better data granularity, internationalization support, forms require first name only  
**Impact**: Onboarding requires `first_name` (required), `last_name` (optional)  

### Decision: Add target bands to custom exercises
**When**: Patch D (migration 20250101000002)  
**Why**: Custom exercises need their own target ranges (can't reference prescriptions)  
**Impact**: `v2_user_custom_exercises` has `mode`, `sets_min/max`, `reps_min/max`, `duration_sec_min/max`  
**Validation**: Same CHECK constraints as prescriptions  

### Decision: XOR constraint for exercise references
**When**: Base migration + Patches C1/C2  
**Why**: Template slots and session exercises can reference EITHER master OR custom exercise (not both, not neither)  
**Implementation**: CHECK constraint `(exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)`  

### Decision: Set types, supersets, and rest overrides as columns (not new tables)
**When**: Migration 20260609000000  
**Why**: Workout-flow parity (warm-up/drop/failure sets, alternating supersets, per-exercise rest) without new join tables  
**Impact**: `v2_session_sets.set_type` (warm-ups excluded from PR/volume calcs), `superset_group` + `rest_sec` on `v2_session_exercises` and `v2_template_slots`; pure transition logic lives in `src/lib/engine/workoutFlow.ts`  

### Decision: Stretches live in `v2_exercises` with an `is_stretch` flag
**When**: Migrations 20260611120000-20260611120004 (CSV master import + flag)  
**Why**: Reuse prescriptions, sessions, and image pipeline for mobility work instead of a parallel table  
**Impact**: 388 master exercises after import; AI generation excludes stretches from the strength catalog and only includes them when the user requests a per-session `stretchCount`  

### Decision: Use Expo Router instead of React Navigation
**Why**: File-based routing, simpler, better DX, built-in for Expo  
**Trade-off**: Less flexible than React Navigation but much easier to maintain  

### Decision: Zustand over Redux/MobX/Context
**Why**: Minimal boilerplate, works great with React Native, no providers needed  
**Trade-off**: No time-travel debugging, but we don't need it  

### Decision: TypeScript strict mode
**Why**: Catch errors at compile time, better IDE support, self-documenting interfaces  
**Trade-off**: More upfront typing work, but pays off quickly  

## Security Considerations

### Authentication
- Supabase Auth with email/password
- Session stored in AsyncStorage (native) or localStorage (web)
- Auto-refresh tokens
- RLS enforces user boundaries

### Account Lifecycle (soft-delete + purge)
- **Delete** (App Store Guideline 5.1.1(v)): `requestAccountDeletion()` invokes the `delete-account` Edge Function, which sets `v2_profiles.deleted_at` and `scheduled_purge_at = now() + 30 days`, then revokes refresh tokens
- **Restore**: during the grace period, login detects the soft-delete markers and offers Restore (`restoreAccount` clears both columns via owner RLS)
- **Purge**: nightly pg_cron job `purge_soft_deleted_accounts()` hard-deletes expired `auth.users` rows (batched); all `v2_*` data cascades via `ON DELETE CASCADE`

### API Keys
- Only anon key in client
- Service role NEVER in app code
- RLS policies prevent unauthorized access

### Data Validation
- TypeScript types (compile-time)
- Database CHECK constraints (runtime)
- Validation helpers (UI layer)
- RLS policies (security layer)

### Sensitive Data
- Passwords never logged
- Auth tokens never logged
- User data isolated via RLS
- Dev logs wrapped in `__DEV__`

## Performance Considerations

### Database
- Indexes on foreign keys
- Indexes on query-heavy columns (user_id, started_at)
- RLS policies use indexed columns
- Bulk queries where possible

### Client
- Query results cached in stores
- Optimistic UI updates
- Lazy loading (route-based code splitting via Expo Router)
- Image optimization

### Future Optimizations
- Derived cache rebuilds (muscle freshness, daily stress)
- Pagination for long lists
- Virtual scrolling for large datasets
- Service worker for offline support (web)

## Development Workflow

### Adding New Features
1. Update schema if needed (migration file)
2. Add query functions (src/lib/supabase/queries/)
3. Add business logic (src/lib/engine/) if needed
4. Add UI components (src/components/)
5. Add route (app/) or bottom sheet (ModalManager)
6. Update IMPLEMENTATION_STATUS.md

### Debugging
- Check dev logs in console (wrapped in `__DEV__`)
- Use React DevTools
- Check Supabase logs for RLS/query issues
- Use TypeScript errors as guide

### Testing Strategy
- Manual testing during development
- Type safety via TypeScript
- Database constraints prevent bad data
- **TODO**: Add automated tests

## References

- Expo Router docs: https://docs.expo.dev/router/introduction/
- Zustand docs: https://github.com/pmndrs/zustand
- Supabase docs: https://supabase.com/docs
- React Native docs: https://reactnative.dev/
