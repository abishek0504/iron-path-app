# Data Flows

**Purpose**: Document how components, queries, and stores connect. Show critical user flows end-to-end.

## Query → Store → Component Patterns

###

 Pattern 1: Direct Query (No Store Caching)
```
Component mounts
  ↓
useEffect calls query function
  ↓
Query function hits Supabase
  ↓
Component sets local state
  ↓
Render with data
```

**Example: Planner loading template**
```typescript
// app/(tabs)/planner.tsx
useEffect(() => {
  const loadTemplate = async () => {
    const fullTemplate = await getTemplateWithDaysAndSlots(templateId);
    setTemplateData(fullTemplate);
  };
  loadTemplate();
}, [templateId]);
```

### Pattern 2: Store-Cached Data
```
Component mounts
  ↓
Check store for cached data
  ↓
If cached: use immediately
If not cached: query + update store
  ↓
Render with data
```

**Example: User profile**
```typescript
// app/edit-profile.tsx
const profile = useUserStore((state) => state.profile);

useEffect(() => {
  if (!profile) {
    const loadProfile = async () => {
      const data = await getUserProfile(userId);
      userStore.setProfile(data);
    };
    loadProfile();
  }
}, [profile, userId]);
```

### Pattern 3: Optimistic UI Updates
```
User action
  ↓
Update local state immediately (optimistic)
  ↓
Call mutation function (async)
  ↓
On success: keep optimistic state
On error: revert + show toast
```

**Example: Adding exercise slot**
```typescript
// app/(tabs)/planner.tsx
const handleAddExercise = async (exercise) => {
  // Optimistic: add to local state
  const newSlot = { id: tempId, exercise_id: exercise.id, ...};
  setSlots([...slots, newSlot]);
  
  // Async: save to database
  const savedSlot = await createTemplateSlot(dayId, { exerciseId: exercise.id });
  
  if (savedSlot) {
    // Replace temp with real
    setSlots(slots => slots.map(s => s.id === tempId ? savedSlot : s));
    toast.success('Exercise added');
  } else {
    // Revert optimistic update
    setSlots(slots => slots.filter(s => s.id !== tempId));
    toast.error('Failed to add exercise');
  }
};
```

## Critical User Flows

### Flow 1: Signup → Onboarding → Planner

```
1. User visits app
   └→ app/index.tsx checks session
       └→ No session: redirect to /get-started

2. User taps "Get Started"
   └→ Navigate to /signup

3. User fills signup form
   └→ supabase.auth.signUp()
   └→ If email confirmation: redirect to /signup-success
   └→ Else: redirect to /onboarding

4. Onboarding (multi-step)
   Step 1: Personal Info
     - first_name (required)
     - last_name (optional)
     - date_of_birth (calendar picker)
     - use_imperial (toggle)
     - current_weight (scrollable picker)
   
   Step 2: Experience & Training
     - experience_level (chips)
     - days_per_week (chips)
   
   Step 3: Equipment
     - equipment_access[] (multi-select chips)
   
   Submit:
     └→ createUserProfile(userId, profileData)
     └→ userStore.setProfile(profile)
     └→ getUserTemplates(userId)
         └→ If no template: createTemplate(userId)
             └→ ensureTemplateHasWeekDays(templateId)
     └→ Navigate to /(tabs)/planner

5. Planner loads
   └→ Fetch template with days and slots
   └→ Calculate targets for each slot
   └→ Display weekly plan
```

### Flow 2: Start Workout → Complete → View Progress

```
1. User taps "Start" on Workout tab
   └→ app/(tabs)/index.tsx
   └→ needsRebalance(userId, templateId, dayName)
       └→ If gaps detected: show SmartAdjustPrompt
           ├→ "Continue anyway": proceed to step 2
           └→ "Smart adjust": applyRebalanceToSession() adds catch-up exercises

2. Create workout session
   └→ createWorkoutSession(userId, templateId, dayName)
       └→ INSERT into v2_workout_sessions (status='active')
       └→ INSERT into v2_session_exercises (from template slots)
       └→ For each exercise:
           └→ selectExerciseTargets({ exerciseId?, customExerciseId? }, userId, context)
               └→ getMergedExercise() → determine mode
               └→ getExercisePrescription() → get target bands
               └→ getExerciseHistory() → check for progressive overload
               └→ Calculate targets within bands (uses suggested_weight if no history)
           └→ prefillSessionSets(sessionId, sessionExercises, targetsMap)
               └→ INSERT into v2_session_sets (prefilled with targets, performed_at=NULL)
   └→ Navigate to /workout/active

3. User performs workout (exercise-by-exercise flow)
   └→ app/(stack)/workout/active.tsx
   └→ WorkoutPhase state machine: 'execution' → 'rest' → 'logging' → next exercise
   
   EXECUTION PHASE (per exercise):
   └→ Display current exercise name
   └→ Display exercise notes (if available from template slot)
   └→ Display current exercise with all sets
   └→ For each set:
       └→ User views default weight/reps from prefill
       └→ User adjusts RPE slider (1-10) - saved in real-time
       └→ User taps "Complete Set" button
           └→ markSetComplete(setId, { reps, weight, duration_sec, rpe })
               └→ UPDATE v2_session_sets SET
                   weight = ?, reps = ?, rpe = ?, performed_at = NOW()
               └→ CRITICAL: performed_at timestamp marks set as truly complete
           └→ If last set: advance to LOGGING phase
           └→ Else: advance to REST phase
   
   REST PHASE (between sets):
   └→ Automatic rest timer (90-180s based on RPE)
   └→ User can skip or wait
   └→ Returns to EXECUTION phase for next set
   
   LOGGING PHASE (after all sets for exercise):
   └→ Display batch logging screen
   └→ Show all sets with editable weight/reps/RPE fields
   └→ RPE sliders allow final adjustments
   └→ User taps "Save & Continue"
       └→ Validate: weight ≥ 0, reps > 0 (or duration > 0)
       └→ For each edited set:
           └→ markSetComplete(setId, { updated values })
       └→ Load weight suggestion for next exercise
       └→ Advance to next exercise (back to EXECUTION phase)
   
   WORKOUT COMPLETE:
   └→ All exercises completed
   └→ User taps "Finish Workout"
   └→ completeWorkoutSession(sessionId)
       └→ UPDATE v2_workout_sessions SET
           status='completed', completed_at=NOW()
       └→ Edge Function triggered (database trigger)
           └→ Updates v2_muscle_freshness with continuous decay

4. Resume mid-workout (CRITICAL for Continue button)
   └→ User exits during workout (presses back)
   └→ Session stays status='active'
   └→ Sets with performed_at NOT NULL = completed
   └→ Sets with performed_at NULL = not started
   └→ User returns to Workout tab
       └→ useFocusEffect calls loadTodayWorkout()
       └→ getActiveSession() finds session with completed sets
       └→ hasActiveWorkout = (completedSets.length > 0 && allSets.length > completedSets.length)
       └→ "Continue" button appears ✅
   └→ User taps "Continue"
       └→ Navigate to /workout/active
       └→ Resume at first incomplete exercise

5. User views progress
   └→ Navigate to Progress tab
   └→ app/(tabs)/progress.tsx
   └→ Calendar view (week or month)
   └→ getSessionsInRange(userId, startIso, endIso)
       └→ SELECT sessions WHERE completed_at >= start AND completed_at < end
       └→ Group by date (using completed_at, not day_name)
   └→ Display calendar with dots on dates with sessions
   └→ User taps date
   └→ Show SessionDetailSheet
       └→ Fetch sessions for that date
       └→ listMergedExercises() to resolve exercise names
       └→ Display session details
```

### Flow 3: Edit Exercise → Scope Selection → Database Write

```
1. User taps "Add Exercise" in Planner
   └→ app/(tabs)/planner.tsx
   └→ useExercisePicker.open(onSelect)
       └→ uiStore.openBottomSheet('exercisePicker', { onSelect })
       └→ ModalManager renders ExercisePicker

2. User selects exercise in picker
   └→ ExercisePicker calls onSelect(exercise)
   └→ uiStore.closeBottomSheet()
   └→ Planner sets pendingEdit = { type: 'addSlot', exercise }
   └→ Show EditScopePrompt

3. User selects scope
   └→ EditScopePrompt calls onSelect(scope)
   
   If scope === 'today':
     └→ getOrCreateActiveSessionForToday(userId, dayName)
         └→ Check for active session
         └→ If exists: return session
         └→ Else: createWorkoutSession(userId, null, dayName) for today
     └→ applyStructureEditToSession(sessionId, edit)
         └→ createSessionExercise(sessionId, { exerciseId, sortOrder })
             └→ INSERT into v2_session_exercises
     └→ Reload session data
   
   If scope === 'nextWeek':
     └→ applyStructureEditToTemplate(templateId, edit)
         └→ createTemplateSlot(dayId, { exerciseId, sortOrder })
             └→ INSERT into v2_template_slots
     └→ Reload template data

4. Recalculate targets
   └→ For each new slot:
       └→ selectExerciseTargets({ exerciseId }, userId, context)
       └→ Update targets map
   └→ Re-render with new targets displayed

5. Show success toast
   └→ toast.success('Exercise added')
```

### Flow 4: AI Generation → Target Selection → Session Creation

```
1. User taps "Generate with AI" in Planner
   └→ app/(tabs)/planner.tsx
   └→ generateWeekForTemplate(template, userId, profile)
       
       Phase 1: Front-load all data (NO SQL in loop)
         └→ Fetch AI allow-list (v2_ai_recommended_exercises, limit 50)
         └→ listMergedExercises(userId, exerciseIds)
             └→ Get primary_muscles + implicit_hits for all candidates
         └→ getMuscleStressStats(userId, last48h)
             └→ Calculate current fatigue from performed truth
         └→ getPrescriptionsForExercises(exerciseIds, experience, mode)
             └→ Get target bands for all candidates
       
       Phase 2: Build exercise stress profiles
         └→ For each candidate:
             └→ TargetSets = round((sets_min + sets_max) / 2)
             └→ Normalize muscle weights (primary=1.0, implicit=value, sum=1.0)
             └→ basePriority from priority_order
       
       Phase 3: Greedy selection with in-flight fatigue simulation
         └→ Initialize SimulatedFatigueState(currentStress)
         └→ Loop: pick highest-scoring exercise not in red zone
             └→ Calculate worstFraction across muscles
             └→ Determine zone (green/yellow/red)
             └→ Apply penalty: green=0, yellow=0.5*basePriority, red=∞
             └→ Score = basePriority - penalty
             └→ Select best, update simulated fatigue
             └→ EstimatedStress_m = TargetSets * 0.7 * NormalizedWeight_m
         └→ Return ordered exercise IDs
   
   └→ Distribute exercises across template days (2-3 per day)
   └→ For each exercise:
       └→ createTemplateSlot(dayId, { exerciseId, sortOrder })
   └→ Fetch exercise names
   └→ Calculate targets for all slots
   └→ Reload template
   └→ toast.success('Week generated')

2. User starts workout with AI-generated plan
   └→ Follows normal "Start Workout" flow (Flow 2)
```

### Flow 5: Dashboard Display → Stress Calculation → Database Query

```
1. Dashboard tab loads
   └→ app/(tabs)/dashboard.tsx
   └→ Parallel queries:
       ├→ getUserProfile(userId) → display weekly completion vs days_per_week
       ├→ getSessionsInRange(userId, thisWeekStart, thisWeekEnd)
       │   └→ Calculate week boundaries (Sunday-Saturday, local time)
       │   └→ Convert to ISO strings
       │   └→ SELECT sessions WHERE completed_at >= start AND completed_at < end
       │   └→ Count for "This week completed" metric
       ├→ getRecentSessions(userId, limit=5)
       │   └→ SELECT sessions WHERE status='completed' ORDER BY completed_at DESC
       │   └→ Display as list with dates
       └→ getTopPRs(userId, limit=3)
           └→ Parallel queries for weight-based and duration-based PRs
           └→ Merge and sort by recency
           └→ Display top 3

2. User taps muscle status icon (heatmap)
   └→ Open muscleStatus bottom sheet
   └→ Calculate stress for display
       └→ getMuscleStressStats(userId, startIso, endIso)
           └→ SELECT sessions + exercises + sets in range
           └→ For each set:
               ├→ Calculate stimulus from RPE/RIR (or default 0.6)
               ├→ Get exercise metadata (primary_muscles, implicit_hits)
               ├→ Normalize muscle weights
               └→ Accumulate: stress[m] += stimulus * normalized_weight
           └→ Return Map<muscle_key, stress_value>
       └→ Fetch v2_muscles for display_name
       └→ Pass to WorkoutHeatmap component as stressData
   └→ WorkoutHeatmap renders (purely presentational)
       └→ Color each muscle by stress value (theme tokens)
```

## Bottom Sheet State Machine

**Location**: `src/stores/uiStore.ts`, `src/components/ui/ModalManager.tsx`

### States
```
State 1: No sheet open
  - activeBottomSheet = null
  - isBottomSheetOpen = false
  - pendingBottomSheet = null

State 2: Sheet open
  - activeBottomSheet = sheetId
  - isBottomSheetOpen = true
  - pendingBottomSheet = null

State 3: Sheet closing (animation)
  - activeBottomSheet = sheetId (kept for animation)
  - isBottomSheetOpen = false
  - pendingBottomSheet = null or nextSheetId

State 4: Sheet closed, pending next
  - activeBottomSheet = null
  - isBottomSheetOpen = false
  - pendingBottomSheet = nextSheetId (briefly, before opening)
```

### Transitions

**Open sheet (no sheet currently open)**
```
openBottomSheet(sheetId, props)
  └→ Set activeBottomSheet = sheetId
  └→ Set bottomSheetProps = props
  └→ Set isBottomSheetOpen = true
  └→ ModalManager renders BottomSheet with visible=true
```

**Open sheet (another sheet already open)**
```
openBottomSheet(sheetId, props)
  └→ Set pendingBottomSheet = sheetId
  └→ Set pendingBottomSheetProps = props
  └→ Call closeBottomSheet()  // Close current sheet first
```

**Close sheet**
```
closeBottomSheet()
  └→ Set isBottomSheetOpen = false
  └→ Keep activeBottomSheet (for exit animation)
  └→ BottomSheet animates out
  └→ After animation: calls onClosed()
```

**Animation complete**
```
onBottomSheetClosed()
  └→ Set activeBottomSheet = null
  └→ Clear bottomSheetProps
  └→ If pendingBottomSheet exists:
      └→ Call openBottomSheet(pendingBottomSheet, pendingBottomSheetProps)
      └→ Clear pendingBottomSheet
```

### Example: Sequential Sheet Opening

```
User action: Open settings menu
  └→ openBottomSheet('settingsMenu')
      └→ activeBottomSheet = 'settingsMenu'
      └→ isBottomSheetOpen = true

User action: Tap "Change Email" in settings
  └→ openBottomSheet('changeEmail')
      └→ pendingBottomSheet = 'changeEmail'
      └→ closeBottomSheet()
          └→ isBottomSheetOpen = false (starts exit animation)
          └→ activeBottomSheet still 'settingsMenu' (for animation)
      
Exit animation completes
  └→ onBottomSheetClosed()
      └→ activeBottomSheet = null
      └→ See pendingBottomSheet = 'changeEmail'
      └→ openBottomSheet('changeEmail')
          └→ activeBottomSheet = 'changeEmail'
          └→ isBottomSheetOpen = true
          └→ pendingBottomSheet = null
```

## Component Communication Patterns

### Parent → Child (Props)
```typescript
// Parent passes data down
<ExercisePicker 
  onSelect={(exercise) => handleSelect(exercise)}
  multiSelect={false}
/>

// Child receives and uses
interface Props {
  onSelect: (exercise: Exercise) => void;
  multiSelect?: boolean;
}
```

### Child → Parent (Callbacks)
```typescript
// Parent provides callback
const handleSelect = (exercise) => {
  // Parent handles the selection
};

// Child calls callback
<TouchableOpacity onPress={() => props.onSelect(exercise)}>
```

### Sibling → Sibling (Shared Store)
```typescript
// Component A sets state
const openSheet = useUIStore(state => state.openBottomSheet);
openSheet('exercisePicker', { onSelect });

// Component B (ModalManager) reads state
const activeBottomSheet = useUIStore(state => state.activeBottomSheet);
```

### Global State Broadcast (Zustand)
```typescript
// Any component can update
userStore.setProfile(newProfile);

// Any component receives update
const profile = useUserStore(state => state.profile);
// Re-renders automatically when profile changes
```

## Query Dependencies

### Templates Hierarchy
```
getTemplateWithDaysAndSlots(templateId)
  ├→ SELECT v2_workout_templates WHERE id = templateId
  ├→ SELECT v2_template_days WHERE template_id = templateId
  └→ SELECT v2_template_slots WHERE day_id IN (dayIds)
```

### Merged Exercise View
```
getMergedExercise({ exerciseId }, userId)
  ├→ SELECT v2_exercises WHERE id = exerciseId
  └→ SELECT v2_user_exercise_overrides WHERE exercise_id = exerciseId AND user_id = userId
  └→ Merge: override ?? master

OR

getMergedExercise({ customExerciseId }, userId)
  └→ SELECT v2_user_custom_exercises WHERE id = customExerciseId AND user_id = userId
```

### Exercise History
```
getExerciseHistory(exerciseKey, userId, limit)
  ├→ SELECT v2_workout_sessions WHERE user_id = userId AND status = 'completed'
  ├→ SELECT v2_session_exercises WHERE session_id IN (sessionIds)
  │   AND ((exercise_id = key AND custom_exercise_id IS NULL) OR
  │        (custom_exercise_id = key AND exercise_id IS NULL))
  └→ SELECT v2_session_sets WHERE session_exercise_id IN (exerciseIds)
  └→ Aggregate: last values, averages
```

### Muscle Stress Stats
```
getMuscleStressStats(userId, startIso, endIso)
  ├→ SELECT v2_workout_sessions WHERE user_id = userId
  │   AND status = 'completed'
  │   AND completed_at >= start AND completed_at < end
  ├→ SELECT v2_session_exercises WHERE session_id IN (sessionIds)
  ├→ SELECT v2_session_sets WHERE session_exercise_id IN (exerciseIds)
  ├→ For each set:
  │   ├→ getMergedExercise({ exerciseId OR customExerciseId }, userId)
  │   ├→ Calculate stimulus from RPE/RIR
  │   ├→ Get muscle weights (primary + implicit, normalized)
  │   └→ Accumulate stress per muscle
  └→ Return Map<muscle_key, total_stress>
```

## Navigation Flow

### Tab Navigation
```
User taps tab
  └→ Expo Router handles navigation
  └→ Unmount old tab component
  └→ Mount new tab component
  └→ useEffect runs for new tab
  └→ Load data
  └→ Render
```

### Stack Navigation
```
User action triggers navigation
  └→ router.push('/route') or router.navigate('/route')
  └→ Expo Router pushes to stack
  └→ Slide animation (platform-specific)
  └→ Mount new screen
  └→ Load data
  └→ Render
```

### Modal Navigation
```
User action triggers modal
  └→ router.push('/route') with modal presentation
  └→ Expo Router presents modally
  └→ Slide-up animation
  └→ Mount modal screen
  └→ Back button or gesture dismisses
  └→ router.back() returns to previous screen
```

### Bottom Sheet (Global Overlay)
```
User action triggers sheet
  └→ useModal().openSheet(sheetId, props)
  └→ uiStore updates (state machine)
  └→ ModalManager re-renders
  └→ BottomSheet animates in
  └→ User interacts
  └→ Close gesture or button
  └→ BottomSheet animates out
  └→ onClosed callback clears state
```

## Error Propagation

### Query Error → Component
```
Query function (returns null on error)
  └→ Component receives null
  └→ Check if null
  ├→ If null: show error state or empty state
  └→ If data: render normally
```

### Mutation Error → User Feedback
```
Mutation function (returns false on error)
  └→ Component checks return value
  ├→ If true: toast.success()
  └→ If false: toast.error()
```

### Validation Error → Inline Display
```
User input
  └→ Client validation
  ├→ If invalid: set errorMessage state
  └→ If valid: proceed with mutation
```

### Network Error → Retry or Fallback
```
Query fails (network issue)
  └→ Query returns null
  └→ Component checks null
  └→ Show "Failed to load" message
  └→ Provide retry button
      └→ Retry calls query again
```

## Performance Optimizations

### Batch Queries
```
// Bad: N queries in loop
for (const id of exerciseIds) {
  const exercise = await getMergedExercise({ exerciseId: id }, userId);
}

// Good: Single bulk query
const exercises = await listMergedExercises(userId, exerciseIds);
```

### Memoization
```typescript
// Expensive calculation
const targets = useMemo(() => {
  return slots.map(slot => calculateTarget(slot, profile));
}, [slots, profile]);
```

### Debounced Search
```typescript
// Debounce search input
const debouncedSearch = useMemo(
  () => debounce((query) => performSearch(query), 300),
  []
);
```

### Optimistic Updates
```typescript
// Update UI immediately, sync in background
const handleDelete = async (id) => {
  setItems(items => items.filter(i => i.id !== id));
  const success = await deleteItem(id);
  if (!success) {
    // Revert on failure
    setItems(previousItems);
  }
};
```
