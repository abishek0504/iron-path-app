# V2 Implementation Summary

This document tracks all completed V2 implementation work. It serves as a reference for understanding what's been built, how components work together, and patterns for adding new features.

## Completed Components

### 1. Architecture Documentation ✅
- `V2_ARCHITECTURE.md`: Complete system contract with schema, formulas, and rules
  - Data layering (canonical → prescriptions → user → planning → performed)
  - No modal-in-modal pattern
  - Prescription-based targets
  - RLS and immutability rules
  - File structure and naming conventions

### 2. Database Migrations ✅
- `supabase/migrations/20240101000000_create_v2_tables.sql`: All v2_* tables with constraints
  - `v2_muscles` - Canonical muscle keys
  - `v2_exercises` - Master exercise list (immutable from client)
  - `v2_exercise_prescriptions` - Curated programming targets
  - `v2_ai_recommended_exercises` - AI allow-list
  - `v2_user_exercise_overrides` - User-specific overrides
  - `v2_user_custom_exercises` - User-created exercises
  - `v2_workout_templates`, `v2_template_days`, `v2_template_slots` - Planning layer
  - `v2_workout_sessions`, `v2_session_exercises`, `v2_session_sets` - Performed truth
  - `v2_muscle_freshness`, `v2_daily_muscle_stress` - Derived caches
  - `v2_profiles` - User profiles and preferences

- `supabase/migrations/20240101000001_create_v2_rls_policies.sql`: RLS policies for all tables
  - Immutable tables: auth SELECT only
  - User-owned tables: CRUD for owner only (`user_id = auth.uid()`)

### 3. Core Infrastructure ✅

#### Logger (`src/lib/utils/logger.ts`)
- Structured dev logging with `devLog(module, payload)` and `devError(module, error, context)`
- All logs wrapped in `__DEV__` checks (never run in production)
- Logs only aggregates/state drivers, never per-item data in loops
- Used throughout all query functions and components

#### Theme (`src/lib/utils/theme.ts`)
- Centralized color palette (zinc-950 background, lime-400 primary, etc.)
- Spacing scale (xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48)
- Typography sizes and weights
- Border radius values
- **All components must use theme tokens, no hardcoded values**

#### Validation (`src/lib/utils/validation.ts`)
- `validateMuscleKeys()` - Validates muscle keys exist in v2_muscles
- `validateAndClampImplicitHits()` - Validates and clamps implicit_hits values (0-1)
- `validateCustomExerciseTargets()` - Validates custom exercise target bands (mode, sets, reps/duration bounds)
  - Validates mode is 'reps' or 'timed'
  - Validates sets bounds (1-10, sets_min <= sets_max)
  - Validates reps bounds for 'reps' mode (1-50, reps_min <= reps_max)
  - Validates duration bounds for 'timed' mode (5-3600, duration_sec_min <= duration_sec_max)
  - Validates primary_muscles against v2_muscles
  - Returns { valid: boolean, errors: string[] }

#### Edit Helpers (`src/lib/utils/editHelpers.ts`)
- `isStructureEdit(editType)` - Checks if edit is a structure edit (swapExercise, addSlot, removeSlot, reorderSlots, updateNotes, updateSetCountIntent)
- Defines structure vs load/performance edit types

#### Supabase Client (`src/lib/supabase/client.ts`)
- Configured with anon key + RLS (never service_role in app)
- Uses AsyncStorage for native, localStorage for web
- Auto-refreshes tokens and persists sessions

### 4. Zustand Stores ✅

All stores follow the same pattern: state + actions, with dev logging on state changes.

#### `src/stores/uiStore.ts` - Global UI State
- **State**:
   - `activeBottomSheet: BottomSheetId | null` - Currently open bottom sheet ID (kept during closing animation)
  - `bottomSheetProps: Record<string, any>` - Props for active sheet
  - `isBottomSheetOpen: boolean` - Whether sheet is currently open (false during closing animation)
  - `pendingBottomSheet: BottomSheetId | null` - Next sheet to open after current one closes
  - `pendingBottomSheetProps: Record<string, any>` - Props for pending sheet
  - `toasts: Array<{id, message, type, duration}>` - Active toast notifications
- **Actions**:
   - `openBottomSheet(id, props)` - Opens a bottom sheet (queues as pending if another is open); only triggers close when a sheet was already open to avoid instant close
   - `closeBottomSheet()` - Starts closing animation (sets isBottomSheetOpen=false, keeps activeBottomSheet)
  - `onBottomSheetClosed()` - Called after exit animation completes; clears activeBottomSheet and opens pending if exists
  - `showToast(message, type, duration)` - Shows a toast
  - `removeToast(id)` - Removes a toast
- **Usage**: All bottom sheets and toasts managed here globally. State machine ensures proper exit animations and sequential sheet opening.

#### `src/stores/userStore.ts` - User Profile Cache
- **State**: `profile: UserProfile | null`, `isLoading: boolean`
- **Actions**: `setProfile()`, `updateProfile()`, `clearProfile()`
- **Usage**: Caches user profile to avoid repeated queries

#### `src/stores/exerciseStore.ts` - Exercise Search/Selection
- **State**: `searchQuery`, `selectedExercises[]`, `isLoading`
- **Actions**: `setSearchQuery()`, `addSelectedExercise()`, `removeSelectedExercise()`, etc.
- **Usage**: Used by ExercisePicker component

#### `src/stores/workoutStore.ts` - Active Workout State
- **State**: `activeSession: WorkoutSession | null`, `isLoading`
- **Actions**: `setActiveSession()`, `completeSession()`, `abandonSession()`, `clearSession()`
- **Usage**: Tracks current workout session state

### 5. Query Functions ✅

All query functions follow the same pattern:
- Use `devLog`/`devError` with `__DEV__` guards
- Return `null` or `[]` on error (never throw)
- Log aggregates only (counts, not per-item data)

#### `src/lib/supabase/queries/exercises.ts`
- `getMergedExercise({ exerciseId?, customExerciseId? }, userId)` - Gets merged view (master ⊕ overrides)
  - Accepts either `exerciseId` OR `customExerciseId` (exactly one required)
  - If `customExerciseId` provided, fetches from `v2_user_custom_exercises` directly
  - If `exerciseId` provided, checks custom exercises first, then master exercise + user overrides
  - Returns source: 'custom' | 'override' | 'master'
- `listMergedExercises(userId, exerciseIds?)` - Bulk version

#### `src/lib/supabase/queries/prescriptions.ts` ✅ **UPDATED (Patch H)**
- `getExercisePrescription(exerciseId, experience, mode)` - Single prescription lookup (goal removed)
- `getPrescriptionsForExercises(exerciseIds, experience, mode)` - Bulk lookup, returns Map (goal removed)

#### `src/lib/supabase/queries/workouts.ts` ✅ **UPDATED (Patch E, F)**
- `createWorkoutSession(userId, templateId?, dayName?)` - Creates active session
- `getActiveSession(userId)` - Gets user's active session
- `completeWorkoutSession(sessionId)` - Marks session as completed
- `getExerciseHistory(exerciseId, userId, limit)` - Gets recent history (completed sessions, exercise OR custom exercise) and returns safe empty `{ sets: [], lastRPE/RIR/Weight/Reps/Duration: null, avgRPE: null }` when none
- `prefillSessionSets(sessionId, sessionExercises, targets)` - Prefills session sets with progressive overload targets at session start
- `saveSessionSet(sessionExerciseId, setNumber, setData)` - Upserts a set
- `getLast7DaysSessionStructure(userId)` - Gets last 7 days of completed session structure for "Copy last week" feature ✅ **NEW (Patch E)**

#### `src/lib/supabase/queries/workouts_helpers.ts` ✅ **NEW (Patch B)**
- `getOrCreateActiveSessionForToday(userId, dayName?)` - Gets in-progress session for today, or creates new session for today
  - Used for "Today only" edit scope
  - Returns active session if exists, otherwise creates new session
- `applyStructureEditToSession(sessionId, edit)` - Applies structure edit to session (addSlot, removeSlot, swapExercise)
  - Used for "Today only" edit scope
  - Only updates structure (exercise_id, custom_exercise_id, sort_order), never weight/reps/duration

#### `src/lib/supabase/queries/users.ts`
- `getUserProfile(userId)` - Gets user profile
- `updateUserProfile(userId, updates)` - Updates profile
- `createUserProfile(userId, profile)` - Creates profile on signup

#### `src/lib/supabase/queries/templates.ts` ✅ **UPDATED (Patch C, E, H)**
- `getUserTemplates(userId)` - Gets all user templates (including system templates)
- `getTemplateWithDaysAndSlots(templateId)` - Gets full template with nested days and slots
- `createTemplate(userId, name?)` - Creates new template (defaults to 'Weekly Plan')
- `upsertTemplateDay(templateId, dayName, sortOrder)` - Creates/updates template day
- `ensureTemplateHasWeekDays(templateId)` - Ensures template has all 7 weekdays (Sunday-Saturday) with sort_order 0-6 ✅ **NEW**
- `createTemplateSlot(dayId, input)` - Adds exercise slot to day (accepts `exerciseId` OR `customExerciseId`, exactly one required)
- `updateTemplateSlot(slotId, updates)` - Updates slot (supports `exercise_id`, `custom_exercise_id`, experience/notes) - goal removed
- `deleteTemplateSlot(slotId)` - Removes slot
- `deleteTemplateDay(dayId)` - Removes day (cascades to slots)
- `applyStructureEditToTemplate(templateId, edit)` - Applies structure edit to template (for "From next week onward" scope) ✅ **NEW (Patch B)**
- `applySessionStructureToTemplate(userId, templateId, structure)` - Copies session structure into template (for "Copy last week" feature) ✅ **NEW (Patch E)**

### 6. UI Components ✅

#### Global UI Components (`src/components/ui/`)

##### `Toast.tsx` - Individual Toast Notification
- Props: `message`, `type: 'success' | 'error' | 'info'`, `onHide`, `duration`
- Animates in/out, auto-hides after duration
- Uses theme colors (primary for success, error for errors)

##### `ToastProvider.tsx` - Global Toast Manager
- Renders all active toasts from `uiStore.toasts`
- Mounted once in root layout
- Handles toast removal automatically

##### `BottomSheet.tsx` - Reusable Bottom Sheet Component ✅ **NEW**
- **Purpose**: Prevents modal-in-modal by being managed globally
- **Props**:
  - `visible: boolean` - Controls visibility
  - `onClose: () => void` - Close handler
  - `title?: string` - Optional header title
  - `children: ReactNode` - Sheet content
  - `height?: number | string` - Height in pixels or percentage (default: '80%')
- **Features**:
  - Slide-up/down animations using React Native Animated
  - Backdrop overlay with tap-to-close
  - Handle bar at top
  - Close button in header (if title provided)
  - Uses theme colors and spacing
- **Usage**: Never instantiate directly. Use via `ModalManager` and `useModal()` hook.

##### `ModalManager.tsx` - Global Modal/Sheet Manager ✅ **NEW**
- **Purpose**: Single source of truth for all bottom sheets (prevents modal-in-modal)
- **How it works**:
  1. Watches `uiStore.activeBottomSheet` state
  2. Conditionally renders appropriate sheet component based on ID
  3. Only one sheet can be open at a time
- **Registered Sheets**:
  - `'exercisePicker'` → Renders `ExercisePicker` component
  - `'settingsMenu'` → Renders `SettingsMenu` component
- **Adding new sheets**: Add new conditional render block in `ModalManager.tsx`
- **Mounted**: Once in root `app/_layout.tsx`

##### `TabHeader.tsx` - Shared Tab Header Component ✅ **NEW**
- **Purpose**: Consistent header across all tabs with settings gear
- **Props**: `title: string`, `tabId: 'workout' | 'plan' | 'progress' | 'profile'`
- **Features**:
  - Title on left
  - Settings gear icon on right (opens settings menu via `useModal()`)
  - Uses theme typography and spacing
- **Usage**: Used in all tab screens (`app/(tabs)/*.tsx`)

#### Domain Components

##### `src/components/exercise/ExercisePicker.tsx`
- Exercise selection bottom sheet
- Loads exercises from `v2_exercises`
- Search/filter functionality
- Single or multi-select modes
- **Access**: Via `useExercisePicker()` hook, opens via `uiStore`

##### `src/components/settings/SettingsMenu.tsx`
- Settings menu bottom sheet
- Menu items navigate to routes (e.g., Edit Profile)
- **Access**: Via `useModal()` hook or TabHeader settings gear

##### `src/components/settings/CustomExerciseForm.tsx`
- Scaffold for creating/editing custom exercises (minimal structure)
- TODO: Full implementation with form fields and validation
- Uses `validateCustomExerciseTargets()` helper
- Fields: name, description, primary_muscles[], implicit_hits{}, mode, target bands

##### `EditScopePrompt.tsx` - Edit Scope Selection ✅ **NEW (Patch B)**
- **Purpose**: Prompts user to choose scope when making structure edits
- **Props**:
  - `visible: boolean` - Whether prompt is visible
  - `onSelect: (scope: EditScope) => void` - Callback with selected scope ('today' | 'thisWeek' | 'nextWeek')
  - `onCancel: () => void` - Cancel handler
- **Behavior**: Shows modal with options:
  - "Today only (default)" - Writes to active session or creates new session for today
  - "This week only" - Disabled (TODO: not implemented yet)
  - "From next week onward" - Updates template structure
- **Usage**: Shown after structure edits (add/remove/swap/reorder slot) in planner

##### `SmartAdjustPrompt.tsx` - Muscle Coverage Rebalancing Prompt ✅ **NEW (Patch G)**
- **Purpose**: Prompts user when muscle coverage gaps are detected before starting workout
- **Props**:
  - `visible: boolean` - Whether prompt is visible
  - `rebalanceResult: RebalanceResult | null` - Result from `needsRebalance()` check
  - `onContinue: () => void` - Continue without changes handler
  - `onSmartAdjust: () => void` - Smart adjust handler
  - `onCancel: () => void` - Cancel handler
- **Behavior**: Shows modal with detected gaps and options:
  - "Smart Adjust (for today)" - Rebalances today's session to cover missed muscles
  - "Continue Anyway" - Proceed with current plan without changes
- **Usage**: Shown before starting workout if `needsRebalance()` detects gaps

##### `src/components/workout/WorkoutHeatmap.tsx`
- Muscle stress heatmap visualization
- Loads from `v2_daily_muscle_stress`
- Displays color-coded grid by muscle and date

### 7. Engine Logic ✅

#### `src/lib/engine/rebalance.ts` - Muscle Coverage Rebalancing ✅ **NEW (Patch G)**
- **`needsRebalance(userId, templateId?, dayName?)`**
  - Checks for muscle coverage gaps by analyzing last `N_SESSIONS_LOOKBACK` (6) completed sessions
  - Gets all session exercises from recent sessions
  - Determines primary muscles hit via `getMergedExercise()`
  - Compares against all canonical muscles from `v2_muscles`
  - Returns `RebalanceResult` with `needsRebalance` boolean, `reasons` array, and `missedMuscles` array
  - Minimal V2: Avoids freshness dependency unless `v2_muscle_freshness` cache exists
  - Constants: `N_SESSIONS_LOOKBACK = 6`, `MIN_GAP_MUSCLES = 1`
- **Hard rule**: Only detects gaps, does not automatically rebalance (user must choose via Smart Adjust prompt)

#### `src/lib/engine/weekGeneration.ts` - AI Week Generation ✅ **NEW**
- **`generateWeekForTemplate(template, userId, profile)`**
  - Fetches exercises from `v2_ai_recommended_exercises` (top 20 by priority)
  - Returns array of exercise IDs for AI generation
  - TODO: Full AI logic integration (currently returns allow-list exercises)
  - Used by "Generate with AI" button in planner

#### `src/lib/engine/targetSelection.ts` - Prescription-Based Target Selection with Progressive Overload ✅ **UPDATED (Patch F, Patch 07)**
- **`selectExerciseTargets({ exerciseId?, customExerciseId? }, userId, context, historyCount)`**
  - XOR input enforced; merged exercise lookup handles master/custom
  - Custom exercises use their own target bands (mode/sets/reps/duration) from `v2_user_custom_exercises`; masters fetch prescriptions
  - Returns `null` if bands/prescription missing (never invent defaults)
  - Uses `getExerciseHistory` keyed by the provided exercise/custom id for progressive overload
  - Progressive overload rules unchanged; clamps to band
- **`selectExerciseTargetsBulk(exercises[], userId, context, historyCounts)`**
  - Accepts array of `{ exerciseId?, customExerciseId? }`, delegates to single-path for mixed master/custom support
- **Hard rule**: Never invents generic defaults (3x10, 60s). Missing prescription = exclude from generation.
- **Progressive overload rule**: Never writes into templates. Only adjusts next session's suggested targets based on performed truth.

### 8. Hooks ✅

All hooks provide convenience wrappers around Zustand stores.

#### `src/hooks/useToast.ts`
- Returns: `{ show(), success(), error(), info() }`
- Usage: `const toast = useToast(); toast.success('Saved!');`

#### `src/hooks/useExercisePicker.ts`
- Returns: `{ open(onSelect, multiSelect?), close() }`
- Usage: `const picker = useExercisePicker(); picker.open((exercise) => { ... });`
- Opens `ExercisePicker` bottom sheet via `uiStore`

#### `src/hooks/useModal.ts`
- Returns: `{ openSheet(id, props?), closeSheet(), isOpen }`
- Usage: `const modal = useModal(); modal.openSheet('settingsMenu');`
- Manages bottom sheets via `uiStore`

### 9. Navigation & Layout ✅

#### `app/_layout.tsx` - Root Layout
- Sets up Expo Router Stack navigator
- Registers all routes (tabs, modals, stack screens)
- Mounts global UI components:
  - `<ToastProvider />` - Renders all toasts
  - `<ModalManager />` - Manages all bottom sheets
- Platform-specific handling (web vs native)
- Web scrollbar styles import

#### Onboarding (post-auth, minimal) ✅ **NEW**
- Trigger: after login/sign-up, index route checks session → loads `v2_profiles`; missing required fields routes to `/onboarding`.
- Required fields: `experience_level`, `days_per_week`, `equipment_access[]` (multi-select).
- Submit: saves via `createUserProfile`/`updateUserProfile`, updates `userStore`, auto-creates user template if none and runs `ensureTemplateHasWeekDays`, then routes to Plan tab.
- Validation: required fields block continue, inline red error text, Supabase errors surfaced (no silent failures).

#### `app/(tabs)/_layout.tsx` - Tab Navigator ✅ **NEW**
- **Custom Tab Bar**: Implements capsule-style tab bar with sliding circle indicator
- **Features**:
  - Capsule background (`#18181b` zinc-900) with border
  - Sliding circle indicator (40px) that animates between tabs
  - Icons: Dumbbell (Workout), Calendar (Plan), TrendingUp (Progress), Trophy (Profile)
  - Active tab: lime-400 icon + white text, semibold weight
  - Inactive tab: zinc-400 icon + zinc-400 text, medium weight
  - Height: 72px
  - Uses `react-native-reanimated` for smooth animations
  - Platform-specific positioning (absolute on native, relative on web)
- **Tabs**:
  - `index` - Workout tab
  - `planner` - Plan tab
  - `progress` - Progress tab
  - `profile` - Profile tab

### 10. Planner Implementation ✅ **NEW**

#### `app/(tabs)/planner.tsx` - Weekly Planner Screen
- **Features**:
  - Auto-creates default template if user has none
  - Always shows full week (Sunday-Saturday) with all 7 days
  - Ensures all 7 template days exist via `ensureTemplateHasWeekDays()`
  - Day selector defaults to today's weekday on first load
  - Day selector (horizontal scrollable list) always shows all 7 days in fixed order
  - Selected day shows:
    - Exercise slots with names and calculated targets
    - "Add Exercise" button (opens ExercisePicker)
    - "Generate with AI" button
    - "Start this day" button (creates workout session with selected day's `day_name`)
  - Rest days (days with no slots) show "No exercises scheduled" but still allow Add/Generate
  - Empty states for no templates, no days, no slots
  - Loading states during template/slot operations

#### Slot Management ✅ **UPDATED (Patch B)**
- **Adding Exercise**:
  1. User taps "Add Exercise"
  2. `ExercisePicker` opens via `useExercisePicker()` hook
  3. User selects exercise
  4. **Edit scope prompt appears** (Patch B)
  5. User chooses scope:
     - **"Today only"**: Creates/gets active session for today, applies edit via `applyStructureEditToSession()`
     - **"From next week onward"**: Creates slot in template via `createTemplateSlot()`, updates template structure
  6. Optimistic UI update adds slot to local state
  7. Fetches exercise name and calculates target
  8. Shows success toast
- **Removing Exercise**:
  1. User taps "Remove" on slot
  2. **Edit scope prompt appears** (Patch B)
  3. User chooses scope:
     - **"Today only"**: Applies edit to active session via `applyStructureEditToSession()`
     - **"From next week onward"**: Removes from template via `deleteTemplateSlot()`
  4. Optimistic UI update removes from local state and targets map
  5. Shows success toast
- **Edit Scoping Rules** (Patch B):
  - Structure edits (add/remove/swap/reorder slot) always prompt for scope
  - Load/performance edits (weight, reps, duration, RPE/RIR) never prompt (always apply to current session)
  - Template changes require explicit user choice (never silent mutation)
  - Progressive overload never writes into templates
- **Target Calculation**:
  - On template load, calculates targets for all slots
  - Uses `selectExerciseTargets()` with slot context (experience overrides or profile defaults) - goal removed
  - Displays as "X sets × Y reps" or "X sets × Y min"
  - Shows "Missing targets" in red/italic if no prescription found
  - Recalculates when slots are added/removed

#### AI Generation ✅ **UPDATED**
- **"Generate with AI" Button**:
  1. Calls `generateWeekForTemplate()` to fetch exercise IDs from `v2_ai_recommended_exercises` (top 20 by priority)
  2. Distributes exercises across days (2-3 per day, round-robin)
  3. Creates slots for each exercise in template
  4. Fetches exercise names and calculates targets
  5. Updates template data and recalculates all targets
  6. Shows success toast
- **Future Enhancement**: Can integrate with AI service to intelligently select exercises based on muscle coverage, recovery, etc.

#### Copy Last Week Feature ✅ **NEW (Patch E)**
- **"Copy last week" Button**:
  1. User taps "Copy last week" button on selected day
  2. Calls `getLast7DaysSessionStructure(userId)` to fetch last 7 days of completed session structure
  3. If no sessions found: Shows error toast
  4. Calls `applySessionStructureToTemplate(userId, templateId, structure)` to copy structure into template
  5. Clears existing template slots and recreates from session structure
  6. Reloads template to reflect changes
  7. Shows success toast
- **Behavior**: 
  - Copies exercise structure (exercise_id, custom_exercise_id, order) from last 7 days
  - Does NOT copy weights/reps/duration (structure only)
  - Creates/updates template days based on session day_names
  - Explicit button action, not automatic mutation

#### Start Workout Integration ✅ **UPDATED (Patch F, G)**
- **"Start this day" Button**:
  1. **Pre-start check**: Calls `needsRebalance()` to detect muscle coverage gaps
  2. If gaps detected: Shows `SmartAdjustPrompt` with reasons
     - User can choose "Continue anyway" (proceed without changes)
     - User can choose "Smart adjust" (TODO: full implementation coming soon)
  3. If no gaps or user chooses "Continue anyway":
     - Creates workout session via `createWorkoutSession(userId, templateId, dayName)`
     - Creates session exercises from template slots (INSERT into `v2_session_exercises`)
     - For each exercise, calculates progressive overload targets via `selectExerciseTargets()`
     - Prefills session sets via `prefillSessionSets()` with starting targets (reps/weight/duration)
       - These are "starting targets" that the user edits, NOT "already performed" values
       - User edits these values during workout, and final saved values become the performed truth
     - Navigates to `/workout-active` route
     - Shows success toast
  4. Error handling with toast notifications

### 11. Workout Tab Implementation ✅ **NEW**

#### `app/(tabs)/index.tsx` - Workout Tab Screen
- **Features**:
  - Shows today's workout from active template
  - Pulsing circular button with ripple effect (every 5 seconds)
  - Button states: "Start" (no session), "Continue" (active session), "Completed" (checkmark)
  - Plan day selector with bottom sheet; defaults to current weekday; can borrow another plan day
  - Exercise preview showing first 3 exercises + "+X more" indicator
  - Rest day handling with special UI
  - Rest day CTA switches to "Choose a workout day" and opens the plan day picker
  - Reset workout modal (appears when active workout exists)
  - Ambient glow effects for visual appeal
  - Greeting based on time of day (Good Morning/Afternoon/Evening)
  - Auto-refreshes on tab focus
- **Data Loading**:
  - Gets user's active template via `getUserTemplates()`
  - Gets today's day slots via `getTemplateWithDaysAndSlots()`
  - Allows selecting any template day for today's session (borrowing plan day)
  - Loads exercise names via `getMergedExercise()` for each slot
  - Checks active session via `getActiveSession()`
  - Checks completed session status from today
- **Navigation**: Routes to `/workout/active` (placeholder route created)
- **Theme**: Uses all theme tokens, no hardcoded values
- **Dev Logging**: All operations wrapped in `__DEV__` checks

#### Placeholder Active Workout Route ✅ **NEW**
- **File**: `app/(stack)/workout/active.tsx`
- **Purpose**: Placeholder screen for active workout feature (full implementation coming soon)
- **Features**: Simple screen with back button, uses theme tokens, follows V2 patterns
- **Route**: Registered in `app/_layout.tsx` as route group `(stack)/workout/active`

### 12. Configuration Files ✅
- `package.json` - Dependencies (Zustand, react-native-reanimated, etc.)
- `tsconfig.json` - TypeScript configuration
- `babel.config.js` - Babel configuration
- `tailwind.config.js` - Tailwind configuration (for NativeWind)
- `app.json` - Expo configuration
- `styles/scrollbar.css` - Web scrollbar styles

### 13. Documentation ✅
- `README_V2.md` - V2 project overview and setup instructions
- `src/types/README.md` - Type generation instructions
- `V2_ARCHITECTURE.md` - Complete system contract

## Key Features Implemented

1. **No Modal-in-Modal**: All overlays managed globally via Zustand `uiStore`
   - Single `ModalManager` component renders all bottom sheets
   - Only one sheet can be open at a time
   - Sheets are not routes (use `useModal()` hook, not `router.push()`)

2. **Merged Exercise View**: Global defaults ⊕ user overrides
   - `getMergedExercise()` checks custom → master + overrides
   - Used everywhere (picker, engine, planner)

3. **Prescription-Based Targets**: Never invents generic defaults
   - All targets come from `v2_exercise_prescriptions`
   - Missing prescription = data error (exclude from generation, show warning)
   - History adjusts within prescription band

4. **RLS & Immutability**: Client read-only for master data
   - `v2_exercises`, `v2_exercise_prescriptions` are immutable from client
   - User customization via `v2_user_exercise_overrides` and `v2_user_custom_exercises`
   - All writes use anon key + RLS (never service_role)

5. **Dev Logging**: Structured logging throughout
   - All logs wrapped in `__DEV__` checks
   - Logs aggregates only (counts, not per-item data)
   - Module-based logging (`devLog('module-name', payload)`)

6. **Validation Layer**: Shared validation helpers
   - Muscle key validation against `v2_muscles`
   - Implicit hits clamping (0-1)

7. **Type Safety**: Instructions for type generation from DB schema
   - Run `npx supabase gen types typescript` after schema changes

8. **Theme System**: Centralized styling
   - All colors, spacing, typography in `src/lib/utils/theme.ts`
   - No hardcoded values in components
   - Consistent design across app

9. **Custom Tab Bar**: Capsule-style with sliding indicator
   - Smooth animations with react-native-reanimated
   - Platform-specific positioning
   - Theme-based colors
    - **Mobile touch safety**: Decorative overlay views (e.g., glow backgrounds) must set `pointerEvents="none"` so they do not intercept taps on header/actions.

10. **Planner with Templates**: Full weekly planning system
    - Normalized template schema (templates → days → slots)
    - Prescription-based target calculation
    - AI generation support
    - Start workout integration

11. **Workout Tab with Pulsing Button**: Today's workout display
    - Pulsing circular button with ripple animation
    - Start/Continue/Completed states
    - Exercise preview and rest day handling
    - Reset workout functionality
12. **Profile Tab Dashboard**: Read-only widgets
    - Location: `app/(tabs)/dashboard.tsx`
    - Widgets: weekly completion vs `days_per_week`, streak, top PRs, recent sessions, connect health placeholder
    - Edit link routes to existing edit-profile modal; dev logs under `profile-dashboard`
    - Edit modal exits back to the originating tab/stack via `router.back()` with `/(tabs)` fallback when no history is present
13. **Auth Email Flows**
    - Forgot password: `app/auth/forgot-password.tsx` sends reset email with redirect to `/auth/callback`
    - Change email: `app/auth/change-email.tsx` sends verification to new email with redirect to `/auth/callback`
    - Callback handler: `app/auth/callback.tsx` exchanges code, finalizes password reset or email confirmation, then routes to login/tabs; dev logs wrapped in `__DEV__`

## Patterns for Adding New Features

### Adding a New Bottom Sheet

1. **Create the component** (e.g., `src/components/myfeature/MySheet.tsx`)
   - Component should accept props it needs
   - Don't wrap in `BottomSheet` - that's handled by `ModalManager`

2. **Register in `ModalManager.tsx`**:
   ```typescript
   <BottomSheet
     visible={activeBottomSheet === 'mySheet'}
     onClose={closeBottomSheet}
     title="My Sheet"
     {...bottomSheetProps}
   >
     <MySheet {...bottomSheetProps} />
   </BottomSheet>
   ```

3. **Create a hook** (optional, for convenience):
   ```typescript
   // src/hooks/useMySheet.ts
   export function useMySheet() {
     const openBottomSheet = useUIStore((state) => state.openBottomSheet);
     return {
       open: (props) => openBottomSheet('mySheet', props),
     };
   }
   ```

4. **Use in components**:
   ```typescript
   const mySheet = useMySheet();
   mySheet.open({ onSelect: (data) => { ... } });
   ```

### Adding a New Query Function

1. **Create in appropriate file** (e.g., `src/lib/supabase/queries/myfeature.ts`)
2. **Follow the pattern**:
   ```typescript
   export async function getMyData(userId: string): Promise<MyData[]> {
     if (__DEV__) {
       devLog('myfeature-query', { action: 'getMyData', userId });
     }
     
     try {
       const { data, error } = await supabase
         .from('v2_my_table')
         .select('*')
         .eq('user_id', userId);
       
       if (error) {
         if (__DEV__) {
           devError('myfeature-query', error, { userId });
         }
         return [];
       }
       
       return data || [];
     } catch (error) {
       if (__DEV__) {
         devError('myfeature-query', error, { userId });
       }
       return [];
     }
   }
   ```

3. **Log aggregates only**: Counts, not per-item data

### Adding a New Tab Screen

1. **Create file**: `app/(tabs)/mytab.tsx`
2. **Use `TabHeader`**:
   ```typescript
   import { TabHeader } from '../../src/components/ui/TabHeader';
   
   export default function MyTab() {
     return (
       <SafeAreaView style={styles.container} edges={['top']}>
         <TabHeader title="My Tab" tabId="mytab" />
         {/* Your content */}
       </SafeAreaView>
     );
   }
   ```

3. **Register in `app/(tabs)/_layout.tsx`**:
   ```typescript
   <Tabs.Screen 
     name="mytab" 
     options={{ title: "My Tab" }} 
   />
   ```

4. **Add icon** in `CustomTabBar` if needed

### Adding a New Store

1. **Create file**: `src/stores/myStore.ts`
2. **Follow the pattern**:
   ```typescript
   import { create } from 'zustand';
   import { devLog } from '../lib/utils/logger';
   
   interface MyState {
     data: MyData | null;
     setData: (data: MyData) => void;
   }
   
   export const useMyStore = create<MyState>((set) => ({
     data: null,
     setData: (data) => {
       if (__DEV__) {
         devLog('my-store', { action: 'setData', hasData: !!data });
       }
       set({ data });
     },
   }));
   ```

3. **Use in components**: `const data = useMyStore((state) => state.data);`

## Next Steps

1. **Apply Migrations**: Run the SQL migrations in Supabase
2. **Generate Types**: Run `npx supabase gen types typescript --project-id <id> > src/types/supabase.ts`
3. **Populate Master Data**: 
   - Add muscles to `v2_muscles`
   - Add exercises to `v2_exercises`
   - Add prescriptions to `v2_exercise_prescriptions` (critical - planner won't work without these)
   - Add AI recommended exercises to `v2_ai_recommended_exercises`
4. **Build Remaining Screens**: 
   - ✅ Planner tab - COMPLETED
   - ✅ Home/workout tab (`app/(tabs)/index.tsx`) - COMPLETED
   - Progress tab (`app/(tabs)/progress.tsx`) - Placeholder exists
   - Profile tab (`app/(tabs)/profile.tsx`) - Placeholder exists
5. **Implement Active Workout Screen**: Build the full workout execution screen at `app/(stack)/workout/active.tsx` (placeholder created)
6. **Implement Session Detail Screen**: Build history detail at `app/session/[id].tsx`
7. **Implement Exercise Detail Screen**: Build exercise detail at `app/exercise/[id].tsx`

## Architecture Compliance

All implementation follows the V2_ARCHITECTURE.md contract:
- ✅ Data layering (canonical → prescriptions → user → planning → performed)
- ✅ No modal-in-modal (bottom sheets via Zustand, routes for complex flows)
- ✅ Prescription-based targets (never invent defaults)
- ✅ Merged exercise view (used everywhere)
- ✅ RLS policies (immutable master data, user-owned customization)
- ✅ DB constraints (prevent invalid data)
- ✅ Validation layer (muscle keys, implicit hits)
- ✅ Dev logging (structured, conditional)
- ✅ Theme system (centralized, no hardcoded values)
- ✅ Custom tab bar (capsule design with sliding indicator)
- ✅ Planner with normalized templates (templates → days → slots)

## Important Notes for New Developers

1. **Never create modals inside modals** - Use `useModal()` hook and `ModalManager`
2. **Never hardcode colors/spacing** - Use theme tokens from `src/lib/utils/theme.ts`
3. **Never invent exercise targets** - Always fetch from prescriptions, return null if missing
4. **Always use merged exercise view** - Use `getMergedExercise()`, never query `v2_exercises` directly
5. **Always log with `__DEV__` checks** - Use `devLog()`/`devError()`, log aggregates only
6. **Always handle errors gracefully** - Return null/[] from queries, show toast to user
7. **Always use Zustand for global state** - Don't use Context API or prop drilling
8. **Always follow query patterns** - Try/catch, dev logging, null/[] returns on error
9. **Always use TabHeader in tabs** - Provides consistent header with settings gear
10. **Always use hooks for UI actions** - `useToast()`, `useExercisePicker()`, `useModal()`
