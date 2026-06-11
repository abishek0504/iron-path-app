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

## State management

**Stores (Zustand)** live in `src/stores/`. Screens use them for shared, cross-screen state.

| Store | Purpose | Used by |
|-------|---------|--------|
| **userStore** | Profile (id, experience_level, current_weight, use_imperial, etc.). Single source of truth for current user. | index (set after auth), login (set after login), onboarding, edit-profile, dashboard, planner, workout active, add-exercise, add-exercise-edit, prs |
| **uiStore** | Bottom sheets (exercisePicker, planDayPicker, etc.), toasts, `plannerNeedsRefetch` flag. Prevents modal-in-modal. | Planner, Workout tab, add-exercise-edit, dashboard, progress, edit-profile, auth screens |

Active workout and exercise selection use **local state** (no workoutStore or exerciseStore): the active workout screen owns execution state; the add-exercise screen and the ExercisePicker component use local search state.

**Profile flow:** Set in store by: root index (after auth), login (after sign-in), onboarding (after save), edit-profile (after load/update), dashboard (if missing, fetch and set). Other screens read `useUserStore((s) => s.profile)` and optionally `setProfile` / `updateProfile`.

**Fetch-on-mount + guards:** Workout tab, Planner, Dashboard, and “today session” in Planner all use:
- **In-flight ref:** `loadInFlightRef` (or equivalent) so a load does not start while a previous one is still running; avoids overlapping requests and flicker.
- **Focus throttle (Workout tab):** `useFocusEffect` only triggers reload if last focus load was more than 4s ago.
- **Stable callbacks:** Load functions use minimal deps (e.g. `[profile]` only) and functional state updates where they merge into existing state, so effect loops (e.g. “load → set state → callback recreated → effect runs again”) do not occur.

**Planner-specific:** `loadTodaySessionExercises` uses functional updates for `setExerciseNames` / `setSlotTargets` and depends only on `[profile]`; `loadTemplateInFlightRef` and `recoveryAttemptedThisFocusRef` plus 5s throttle prevent failed-to-load infinite retry. **Plan tab useFocusEffect** reads `loadTemplate` / `loadTodaySessionExercises` / `loadTodaySessions` from refs (not from the effect’s dependency array) so the effect does not re-run when those callback identities change (e.g. when `hasInitializedSelection` flips and recreates `loadTemplate`), which would otherwise re-trigger the prescription/exercise/workout/target-selection cascade repeatedly. **loadTemplate** loads sessions for the selected day (not always today): uses `selectedDayNameRef` when `hasInitializedSelection`, else today/first day; sets `selectedDayNameRef` before `loadSessionsForDay` so the stale guard matches. **Refetch throttle:** `lastPlanRefetchRef` + `REFETCH_THROTTLE_MS` (3s) — plannerNeedsRefetch and recovery paths skip `loadTemplate` if within 3s to prevent loops when effect re-runs after `templateData` changes.

## Cache and invalidation

**Caches** live in `src/lib/cache/`. All use short TTL (90s) and in-memory Maps. Mutations must invalidate so the next read is fresh.

| Cache | Keys | Invalidate when |
|-------|------|------------------|
| **templateCache** | `templates:${userId}`, `template:${templateId}` | Template/slot mutations: `invalidateTemplate(templateId)` or `invalidateTemplates(userId)`. Called from planner (add/remove slot, delete session, generate AI, copy last week), add-exercise-edit (add to template, edit slot), onboarding (create template). |
| **sessionsCache** | `sessionsInRange:${userId}:${startIso}:${endIso}` | Session completed or deleted: `invalidateSessionsInRangeForUser(userId)`. Called from active workout (completeWorkoutSession), planner (delete container), SessionDetailSheet (delete session). |
| **exerciseCache** | `mergedExercises:${userId}:...` | Custom exercise create/update/delete: `invalidateMergedExercisesForUser(userId)`. Called inside customExerciseMutations. |
| **dashboardStatsCache** | `profile:${userId}`, `weightHistory:${userId}:${limit}`, `yearStats:${userId}`, etc. | Profile: `invalidateProfileCache(userId)` after updateUserProfile (edit-profile, onboarding). Weight: `invalidateWeightCache(userId)` after insertWeightLog (WeightTrackerCard, onboarding); invalidates all `weightHistory:${userId}:*` keys. |

**Persistent source of truth:** Supabase (v2_* tables). Auth session is persisted by the Supabase client (AsyncStorage on native, localStorage on web) so users stay logged in. **App data (templates, sessions, exercises, profile) is not persisted to disk**—it lives in in-memory caches (90s TTL) and Zustand; screens fetch from Supabase on load.

**Why no AsyncStorage for app data (current = best for this scope):** One source of truth avoids sync bugs, stale local data, and invalidation complexity. Cold start always shows fresh data from the server. Adding a persisted app-data layer is only worth it if you need **offline support** (show last-known data when network is down) or **faster perceived load** (paint from disk immediately, then revalidate). If you add it later: decide what to persist (e.g. profile, last template, recent sessions), a TTL or explicit invalidation, and a read-through pattern; document that strategy here.

**Cleanup:** Planner trims `exerciseNames`/`slotTargets` to current sessions + today template when loading today's sessions (so deleted-session data does not linger). Session delete uses `deleteSessionWithExercises` (session_exercises then session) and invalidates sessions cache.

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
               └→ getExercisePrescription() → get target bands (exercise_id + experience + mode)
               └→ getExerciseHistory() → check for progressive overload
               └→ Calculate targets within bands (uses suggested_weight if no history; bodyweight exercises use NULL weight)
           └→ Build targetsMap entry for this exercise:
               └→ sets = prescription sets
               └→ reps/duration/weight = prescription targets (with progressive overload if history exists)
   (Flow: prescription fills initial targets → user edits and saves → next time algorithm uses tracked values from history to suggest new targets within the same band.)
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
       └→ getSessionsForToday() loads all sessions for today (multi-workout-per-day)
       └→ selectedWorkoutIndex = first incomplete session (or 0 if all complete)
       └→ hasActiveWorkout = selected session is active and has ≥1 set performed
       └→ "Continue" button appears for that workout ✅
   └→ User taps "Continue"
       └→ Navigate to /workout/active with params.sessionId = selectedSession.id
       └→ Active screen loads that session (getSessionById when sessionId param present)
       └→ Resume at first incomplete exercise

5. Multi-workout-per-day (multiple sessions same day)
   └→ Workout tab loads getSessionsForToday(userId, todayStartIso, tomorrowStartIso)
       └→ Returns all sessions for today (active + completed), ordered by started_at ascending
   └→ Default view: first incomplete workout (first session with status !== 'completed'); if all complete, show first (index 0)
   └→ "Add Workout" (header): createWorkoutSession(); loadTodayWorkout(undefined, { selectLast: true })
   └→ "Change" opens WorkoutPicker only when more than one workout for the day (sessionsToday.length > 1); list "Workout 1", "Workout 2", … (✓ if completed); onSelect(index) → setSelectedWorkoutIndex(index); loadTodayWorkout(index)
   └→ Start/Continue/Complete: per selected workout. If selected session completed → greyed "Complete"; if active with save point → "Continue" (navigate with sessionId); else "Start" (create or use session, navigate with sessionId)
   └→ If user deletes a session in Progress tab, that session is removed from DB; next Workout tab load shows remaining sessions; deleted workout no longer appears (so it is "not done" and won’t be loaded as completed)
   └→ Planner: Unified flow — template is the plan. Add Exercise and Generate with AI both add to template; syncTemplateSlotToSessionsForDay syncs new slots to existing sessions for that day. Add Exercise available at template level (when no sessions or empty plan) and inside each workout container. Workout containers (Workout 1, Workout 2, …) show session exercises; when no sessions, template slots shown with Add Exercise. Add-exercise-edit: todayOnly off → add to template + sync to sessions; todayOnly on → add to session only.
   └→ Workout tab: exercises shown are always for the selected workout only (one session’s v2_session_exercises). No mixing with template or other sessions; when no sessions exist for today, template for the selected plan day is shown so user can Start.
   └→ workout/active: accepts sessionId route param; when present, getSessionById(userId, sessionId) instead of getActiveSession(userId)

6. User views progress
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

### Flow 3: Add Exercise → Date Context → Database Write

```
1. User taps "Add Exercise" in Planner
   └→ app/(tabs)/planner.tsx
   └→ useExercisePicker.open(onSelect)
       └→ uiStore.openBottomSheet('exercisePicker', { onSelect })
       └→ ModalManager renders ExercisePicker

2. User selects exercise in picker
   └→ ExercisePicker calls onSelect(exercise)
   └→ uiStore closes bottom sheet
   └→ Planner inspects selected day’s `day.day_name`

3. Date context decides write target (no scope prompt)

   If selected day is **Today**:
     └→ getOrCreateActiveSessionForToday(userId, dayName)
         └→ Check for active session
         └→ If exists: return session
         └→ Else: createWorkoutSession(userId, null, dayName) for today
     └→ applyStructureEditToSession(sessionId, {
           type: 'addSlot',
           exerciseId,
           customExerciseId: undefined,
           sortOrder,
           experience: profile.experience_level
         })
         └→ INSERT into v2_session_exercises (instance, Today-only)
     └→ Reload today’s session exercises

   If selected day is **Future** (not Today):
     └→ applyStructureEditToTemplate(templateId, {
           type: 'addSlot',
           dayId,
           exerciseId,
           customExerciseId: undefined,
           sortOrder
         })
         └→ createTemplateSlot(dayId, { exerciseId, sortOrder })
             └→ INSERT into v2_template_slots (structure only)
     └→ Reload template data

4. Recalculate targets for display
   └→ For each template slot:
       └→ selectExerciseTargets({ exerciseId }, userId, context)
       └→ Update targets map used for projected targets
   └→ Re-render Planner with updated targets

5. Show success toast
   └→ Today: `toast.success("Exercise added to today's session")`
   └→ Future: `toast.success('Exercise added to plan')`
```

### Flow 4: AI Generation → Target Selection → Session Creation

```
1. User taps "Generate with AI" in Planner (per day, picks sessionsPerDay 0-6)
   └→ app/(tabs)/planner.tsx → runGenerateWithAI(sessionsPerDay)
   └→ sessionsPerDay = 0 → rest day (clear slots + unstarted session exercises, no AI call)
   └→ generateAiDay({ template, userId, profile, dayIndex, sessionsPerDay })
       └→ src/lib/ai/generateWorkoutDay.ts
       └→ supabase.functions.invoke('generate-workout', { templateId, dayName, sessionsPerDay })

2. Edge Function: supabase/functions/generate-workout (OpenAI-powered)
   └→ Auth via JWT; template ownership check; rolling 24h quota (10/day, v2_ai_generations)
   └→ Context gathering (computed fresh per request, never persisted):
       ├→ Allow-list: v2_ai_recommended_exercises + v2_exercises metadata (limit 80)
       ├→ Profile: experience, equipment, days_per_week, preferred_training_style (split),
       │   workout_days, use_imperial, current/goal weight
       ├→ Muscle freshness: v2_muscle_freshness (last 48h, RPE/RIR-driven)
       ├→ Per-exercise history: v2_session_sets via completed sessions (last 60 days,
       │   warmups excluded, capped 300 rows) → per-exercise summary
       │   { last_performed, last_set, top_set, avg_rpe, recent_set_count }
       └→ Split compliance: "training day N of M this week" computed from workout_days
   └→ OpenAI chat.completions (default gpt-5-mini, OPENAI_MODEL overridable)
       └→ Strict structured outputs (response_format json_schema, strict: true)
       └→ Output: sessions[][] of { exercise_id, sets, reps, duration_sec, weight, target_rpe }
       └→ Prompt enforces: allow-list only, split compliance, freshness avoidance,
           progressive overload from history (RPE-based up/hold/back-off)
   └→ Server validation: allow-list check + dedupe + target bounds clamping
       └→ Invalid exercise IDs dropped; invalid targets nulled (exercise kept)
   └→ Audit row to v2_ai_generations (source 'openai' | 'fallback' | 'error')

3. Planner consumes result
   └→ For each AI exercise plan:
       └→ createTemplateSlot(dayId, { exerciseId, sortOrder })
       └→ INSERT v2_session_exercises into existing/new session
       └→ Targets: AI-prescribed (sets/reps/weight/duration) when present,
           else selectExerciseTargets() prescription fallback
   └→ prefillSessionSets(sessionId, sessionExercises, targetsMap)
   └→ invalidateTemplate + invalidateSessionsInRangeForUser + Reload template
   └→ toast.success('{day} generated · N AI left today')
```

### Flow 5: Smart Refresh (Active Workout)

```
1. User is in Active Workout (session loaded from template + day)
   └→ app/(stack)/workout/active.tsx
   └→ After loadActiveSession: if session.template_id && session.day_name
       └→ getTemplateSlotsForDay(templateId, dayName)
       └→ getLastCompletedWorkoutAt(userId)
       └→ detectSessionStaleness({ session, sessionExercises, templateSlots, lastCompletedWorkoutAt })
       └→ setStaleness({ structural, biomechanical, target })

2. Refresh button in header
   └→ Orange when structural or target divergence; Red when biomechanical
   └→ If no divergence: tap runs handleRecalculateTargets (recalc incomplete set targets only)
   └→ If divergence: tap opens confirmation sheet
       └→ getSmartRefreshPlan(sessionId, templateId, dayName, userId)
       └→ setRefreshPlan(plan); setShowRefreshSheet(true)

3. Smart Refresh confirmation sheet
   └→ SmartRefreshConfirmationSheet shows: Additions, Removals, Adjustments
   └→ User taps "Apply Updates"
       └→ applySmartRefresh(sessionId, templateId, dayName, userId, experience)
           └→ Protected = session exercises with any set.performed_at
           └→ DELETE v2_session_exercises not in template and not protected
           └→ INSERT new session exercises from template; prefillSessionSets with selectExerciseTargets
       └→ loadActiveSession(); close sheet; toast.success('Workout updated from plan')
```

### Flow 6: Dashboard Display → Stress Calculation → Database Query

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
   └→ WorkoutHeatmap loads freshness and renders
       └→ SELECT v2_muscle_freshness (muscle_key, last_trained_at) for user_id
       └→ For each row: computeFreshnessNow(muscle_key, last_trained_at) using Banister decay (src/lib/utils/muscleFreshness.ts) so recovery shows on rest days
       └→ If table empty but user has completed session: invoke update-muscle-freshness Edge Function once (backfill), then reload
       └→ BodyHeatmap colors muscles by freshness (0 = fatigued, 100 = recovered)
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
