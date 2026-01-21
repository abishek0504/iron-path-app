# System Architecture

**Purpose**: Document core architectural decisions and WHY they were made.

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

### 5. RLS & Immutability (WHY: Security and data integrity)

**Immutable Tables** (auth SELECT only):
- `v2_muscles` - Canonical muscle keys
- `v2_exercises` - Master exercise list
- `v2_exercise_prescriptions` - Curated targets
- `v2_ai_recommended_exercises` - AI allow-list

**User-Owned Tables** (user CRUD via RLS):
- `v2_profiles` - User settings
- `v2_user_exercise_overrides` - Exercise customizations
- `v2_user_custom_exercises` - User-created exercises
- `v2_workout_templates` + children - Planning
- `v2_workout_sessions` + children - Performed truth
- `v2_muscle_freshness`, `v2_daily_muscle_stress` - Caches

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

**Security Risk Identified:**
- System templates (`user_id IS NULL`) allow writes from any auth user
- Current RLS: `USING (user_id = auth.uid() OR user_id IS NULL)`
- Risk: Clients could modify system templates
- **TODO**: Tighten policy or remove system template concept

### 3.1 Frictionless Logging Pattern (Active Workout)

**Location**: `app/(stack)/workout/active.tsx`, `src/components/workout/ActiveSetCard.tsx`

User research indicates high churn when logging is tedious. We adopt a "Management by Exception" philosophy.

**Assumption:** The user follows the plan 90% of the time.

**Interaction Pattern:**
- **Swipe Right** gesture on a Set Card instantly logs the pre-filled target values (Weight/Reps) as performed
- **Tap** the card opens the full editor only when the user deviates from the plan
- **Optimistic UI**: Changes appear immediately, with background sync to database
- **Error Handling**: Failed saves show toast notification and revert UI state

**Set Card States:**
1. **Collapsed (Default)**: Shows summary "Set 1: 135 lbs × 10 reps @ RPE 8"
2. **Expanded (Editing)**: Shows editable TextInputs for Weight, Reps, RPE slider
3. **Completed**: Green checkmark indicator, slightly faded appearance

**Implementation:**
- Uses `@shopify/flash-list` for performant list rendering (hundreds of sets)
- `react-native-reanimated` for smooth swipe gestures
- `react-native-gesture-handler` for touch handling

### 4.1 High-Performance Visualization

**Location**: `src/components/visualizations/BodyHeatmap.tsx`

To visualize the 28-muscle freshness state without dropping frames during navigation, we utilize `@shopify/react-native-skia`. Standard SVGs are too heavy for complex animations on mobile devices.

**Logic:** Map `v2_muscle_freshness` values (0-100) to a color interpolation:
- 0-30: Red (#ef4444) - Fully fatigued
- 31-60: Orange (#f97316) - Moderate fatigue
- 61-80: Yellow (#eab308) - Light fatigue
- 81-100: Green (#22c55e) - Fully recovered

**Implementation:**
- Uses Skia Canvas for GPU-accelerated rendering
- 28 SVG paths mapped to canonical muscle keys from `v2_muscles`
- ViewBox: `0 0 360 720` for consistent scaling
- Real-time color updates based on freshness queries
- No frame drops even during navigation transitions

**Performance Benefits:**
- Standard SVG: ~15-20ms render time per frame
- Skia rendering: ~2-3ms render time per frame
- Allows smooth animations and transitions

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

**`exerciseStore`**: Exercise selection
- Search query
- Selected exercises
- Used by picker only

**`workoutStore`**: Active session
- Current workout state
- Progress tracking
- **STATUS**: Currently unused (sessions fetched directly via queries)

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

### WorkoutPhase Enum
```typescript
type WorkoutPhase = 'execution' | 'rest' | 'logging' | 'complete';
```

### Phase Transitions

**EXECUTION Phase** (performing sets):
- Display current exercise with all sets
- User adjusts RPE slider for active set
- User taps "Complete Set" button
- `markSetComplete(setId, { reps, weight, rpe })` called
  - **CRITICAL**: Always sets `performed_at = NOW()` to mark set as complete
- Transition:
  - If last set of exercise → LOGGING phase
  - Else → REST phase

**REST Phase** (between sets):
- Automatic countdown timer (90-180s based on RPE)
- User can skip or wait
- Transition:
  - Timer ends or skip pressed → EXECUTION phase (next set)

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
  - Database trigger fires Edge Function for muscle freshness update
- Navigate back to Workout tab

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
- `/login`, `/signup` - Auth
- `/onboarding` - Multi-step setup
- `/(tabs)/*` - Main app tabs
- `/workout/active` - Active workout (modal presentation)
- `/edit-profile` - Profile editing (modal presentation)

**Tab Routes** (bottom tab bar):
- `/(tabs)/index` - Workout (today's plan)
- `/(tabs)/planner` - Plan (template management)
- `/(tabs)/progress` - Progress (calendar views)
- `/(tabs)/dashboard` - Dashboard (metrics, PRs)

**Bottom Sheets** (global overlays):
- `exercisePicker` - Exercise selection
- `settingsMenu` - Settings options
- `planDayPicker` - Choose plan day
- `muscleStatus` - Heatmap display

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
    exercise/         # Exercise-specific
    settings/         # Settings-specific
    workout/          # Workout-specific
    progress/         # Progress-specific
  hooks/              # React hooks (useToast, useModal, etc.)
  lib/
    engine/           # Business logic (algorithms)
    supabase/
      client.ts       # Supabase client config
      queries/        # Query functions (organized by domain)
    utils/            # Pure utilities
  stores/             # Zustand stores
  types/              # TypeScript types

supabase/
  migrations/         # SQL migrations (apply in order)
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
