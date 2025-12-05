# Adaptive Strength Training Engine - Complete Implementation Checklist

## Overview
This checklist ensures all features from the conversation history and plan are implemented. Items are checked off as they are completed.

---

## 1. CORE DATA STRUCTURE & SCHEMA ✅

### 1.1 Exercise Metadata Columns
- [x] `movement_pattern` enum in `exercises` and `user_exercises` tables
- [x] `tempo_category` enum in `exercises` and `user_exercises` tables
- [x] `setup_buffer_sec` (int) in `exercises` and `user_exercises` tables
- [x] `is_unilateral` (boolean) in `exercises` and `user_exercises` tables
- [x] `base_seconds_per_rep` (numeric) in `exercises` and `user_exercises` tables
- [x] `user_seconds_per_rep_override` (numeric) in `user_exercises` table (per-user time override)
- [x] TypeScript types regenerated in `src/types/supabase.ts`

### 1.2 Profile Preferences
- [x] `preferred_training_style` (text enum) in `profiles` table
- [x] `include_components` (jsonb) in `profiles` table with structure:
  - `include_tier1_compounds: boolean`
  - `include_tier2_accessories: boolean`
  - `include_tier3_prehab_mobility: boolean`
  - `include_cardio_conditioning: boolean`

### 1.3 Plan Data Structure
- [x] `plan_data.week_schedule[day].target_duration_min` (per-day duration target)
- [x] `plan_data.duration_target_min` (week-level default duration target)
- [x] `plan_data.weeks[weekKey].week_schedule[day]` (week-specific schedules)

### 1.4 Personal Record (PR) Fields
- [x] `pr_weight` (numeric) in `user_exercises` table
- [x] `pr_reps` (integer) in `user_exercises` table
- [x] `pr_performed_at` (timestamptz) in `user_exercises` table
- [x] TypeScript types updated in `src/types/supabase.ts`

---

## 2. TIME ESTIMATION SYSTEM

### 2.1 Deterministic Time Estimation Module ✅
- [x] `src/lib/timeEstimation.ts` created with `estimateExerciseDuration` function
- [x] Uses `movement_pattern`, `tempo_category`, `setup_buffer_sec`, `is_unilateral`
- [x] Applies fatigue multiplier based on exercise position
- [x] Returns `estimatedDurationSec` and `estimatedTimePerRepSec`
- [x] Dev-only logging for diagnostics

### 2.2 Time Estimation Persistence ✅
- [x] Schema supports `user_seconds_per_rep_override` in `user_exercises`
- [x] Logic to calculate and save `user_seconds_per_rep_override` when user edits set duration in `workout-sets.tsx`
- [x] Calculates `seconds_per_rep = total_duration / number_of_sets` for timed exercises
- [x] Saves to `user_exercises` table (creates or updates record)
- [x] Logic to use `user_seconds_per_rep_override` when available in time estimation (fallback to `base_seconds_per_rep`)
- [x] `estimateExerciseDuration` accepts `userSecondsPerRepOverride` and `baseSecondsPerRep` parameters
- [x] Priority order: user override > base > tempo-based calculation
- [x] Integrated into `planner-day.tsx` and `planner.tsx` time estimation

### 2.3 Time Estimation Display ✅
- [x] Estimated session duration shown in `planner-day.tsx` header
- [x] Estimated duration per day shown in `planner.tsx` week view cards (e.g., "~45 min")
- [x] Estimated duration per exercise shown on each exercise card in `planner-day.tsx` (e.g., "Est. time: ~5m")
- [x] Time estimation used in `planner-day.tsx` for rep-based exercises
- [x] `estimateDayDuration` helper function in `planner.tsx`
- [x] Fixed: Rest time for timed exercises added once per exercise (between exercises), not per set
- [x] Fixed: Rest time clamped at set level in `volumeTemplates.ts` and `workout-sets.tsx` (30-300 seconds)

---

## 3. VOLUME TEMPLATES & REALISTIC NUMBERS ✅

### 3.1 Volume Template Module
- [x] `src/lib/volumeTemplates.ts` created with `applyVolumeTemplate` function
- [x] Infers volume category from exercise name (upper_compound, lower_compound, accessory, calf_core, cardio, other)
- [x] Clamps `target_sets`, `target_reps`, `rest_time_sec` to realistic ranges:
  - Tier 1 compounds: 3-5 sets, 3-8 reps, 90-210s rest
  - Accessories: 2-4 sets, 8-15 reps, 45-90s rest
  - Calves/core: 3-5 sets, 10-20 reps, 30-75s rest
  - Cardio: 1-4 "sets", short work, 30-90s rest

### 3.2 Integration with AI Generation
- [x] `applyVolumeTemplate` called in `adaptiveWorkoutEngine.ts` after `normalizeExercise`
- [x] `applyVolumeTemplate` called in `planner-day.tsx` `generateForDay` after exercise conversion

---

## 4. HISTORY-AWARE PROGRESSION SYSTEM ✅

### 4.1 Progression Metrics Module
- [x] `src/lib/progressionMetrics.ts` created
- [x] `getExerciseHistory(userId, exerciseName)` fetches recent logs
- [x] `computeExerciseHistoryMetrics(logs)` computes:
  - `hasHistory`, `lastLog`, `lastSuccessful`
  - `recentFailures`, `trend` (progressing/flat/struggling)
  - `estimatedTrainingMax` (1RM via Epley formula)
- [x] Dev-only logging

### 4.2 Progression Rules Engine
- [x] `src/lib/progressionEngine.ts` created
- [x] `computeProgressionSuggestion(input)` function:
  - No history: Uses `getHeuristicStartingWeight` (realistic, non-null)
  - Progressing: Increases weight by 2.5-5%
  - Struggling: Deloads by 5-10%, may reduce sets
  - Flat: Keeps weights, may adjust rep ranges
- [x] Bodyweight detection: Only `0` is bodyweight, `null` needs suggestion
- [x] Heuristic starting weights: Upper ~25kg, Lower ~50kg, fallback ~20kg
- [x] PR integration: Uses Personal Record (PR) when available, takes precedence over recent logs
- [x] PR-based progression: When PR is higher than recent logs, starts at 85% of PR for safety
- [x] Dev-only logging

### 4.3 Integration with Week Generation
- [x] `planner.tsx` `generateWorkoutPlan`:
  - Fetches workout_logs for all exercises in generated plan
  - Fetches PRs from `user_exercises` for all exercises
  - Computes metrics per exercise
  - Gets progression suggestions (with PR data)
  - Fills blank set weights (respects existing weights and bodyweight=0)

### 4.4 Integration with Day Generation
- [x] `planner-day.tsx` `generateForDay`:
  - Fetches workout_logs for generated exercises
  - Fetches PRs from `user_exercises` for generated exercises
  - Computes metrics per exercise
  - Gets progression suggestions (with PR data)
  - Fills blank set weights

### 4.5 Workout Sets Editor Pre-fill ✅
- [x] `workout-sets.tsx` loads progression suggestions when opening exercise
- [x] Fetches workout_logs and computes metrics
- [x] Fetches PR from `user_exercises` for the exercise
- [x] Gets progression suggestions (with PR data) and pre-fills weight fields (if null/undefined)
- [x] Respects existing weights and bodyweight flags

---

## 5. ADAPTIVE WORKOUT ENGINE ✅

### 5.1 Core Engine Module
- [x] `src/lib/adaptiveWorkoutEngine.ts` created
- [x] `generateWeekScheduleWithAI` function:
  - Uses `buildFullPlanPrompt` with tier preferences
  - Normalizes exercises
  - Applies volume templates
  - Creates sets arrays (bodyweight vs timed vs loaded)

### 5.2 AI Prompt Integration
- [x] `src/lib/aiPrompts.ts` `buildFullPlanPrompt`:
  - Includes "WORKOUT COMPONENT PREFERENCES" block
  - Includes "TIME GUIDELINES" block (Goldilocks 45-60 min default)
  - Clarifies that exact weights assigned by progression engine
  - Requests relative difficulty/intensity patterns

### 5.3 Smart Compression Logic ✅
- [x] `src/lib/smartCompression.ts` created with `applySmartCompression` function
- [x] Logic to:
  - Calculate estimated total duration for a day
  - If exceeds target: reduce rest times, reduce sets on Tier 2/3, remove Tier 3, reduce Tier 1 sets, remove Tier 2
  - Strategies applied in order until target is met
- [x] Integration into `adaptiveWorkoutEngine.ts` after volume templates applied
- [x] Called when `durationTargetMin` is provided in `generateWeekScheduleWithAI`

---

## 6. RECOVERY & COVERAGE AWARENESS ⚠️ PARTIAL

### 6.1 Movement Pattern Tagging ✅
- [x] Schema supports `movement_pattern` enum
- [x] `src/lib/movementPatterns.ts` created with `inferMovementPattern` function
- [x] Heuristic tagging function infers patterns: squat, hinge, lunge, push_vert, push_horiz, pull_vert, pull_horiz, carry
- [x] Integrated into `adaptiveWorkoutEngine.ts` - automatically tags exercises during generation
- [x] Helper functions: `getMovementPatternLabel`, `getAllMovementPatterns`
- [ ] Backfill existing exercises with movement patterns (optional - can be done via migration)

### 6.2 Coverage Analysis Module ✅
- [x] `src/lib/coverageAnalysis.ts` created
- [x] `analyzeCoverage` function analyzes week schedule + recent workout logs:
  - Counts sets per movement pattern per week
  - Flags under-served patterns (< 3 sets per week)
  - Flags over-served patterns (> 15 sets or > 2x average)
  - Tracks last worked date per pattern
- [x] Integration into AI prompts via `buildFullPlanPrompt`
- [x] `getCoverageSummary` helper for UI display
- [x] Recommendations generated for missing essential patterns (squat, hinge, push_horiz, pull_horiz)

### 6.3 Recovery Heuristics ✅
- [x] `src/lib/recoveryHeuristics.ts` created
- [x] `analyzeRecovery` function tracks last heavy session date per movement pattern from `workout_logs`
- [x] Minimum recovery hours per pattern: squat (48h), hinge (72h), others (48h), carry (24h)
- [x] `canScheduleExercise` function checks if exercise can be safely scheduled
- [x] When generating new week:
  - Analyzes recent logs for recovery conflicts
  - Generates warnings for patterns worked <48-72 hours ago
  - Provides recommendations for scheduling
- [x] Integration into `adaptiveWorkoutEngine.ts` - passes recovery analysis to AI prompt
- [x] Integration into AI prompts via `buildFullPlanPrompt`

---

## 7. UI ENHANCEMENTS

### 7.1 Profile Tab - Workout Preferences Display ✅
- [x] `app/(tabs)/profile.tsx` shows "AI Workout Style" card
- [x] Displays `preferred_training_style` label
- [x] Displays included components summary (Tier 1 · Tier 2 · Mobility · Cardio)
- [x] Visible without needing to tap "Edit"

### 7.2 Profile Tab - Edit Preferences ✅
- [x] `app/edit-profile.tsx` has "Workout Components" section
- [x] Style pills (Comprehensive, Strength + accessories, Calisthenics, Cardio only)
- [x] Toggles for Tier 1, Tier 2, Tier 3, Cardio/Conditioning
- [x] Changes persisted to `profiles.preferred_training_style` and `profiles.include_components`
- [x] Unsaved-changes logic includes preferences

### 7.3 Onboarding Integration ✅
- [x] `app/onboarding.tsx` infers `preferred_training_style` from goal
- [x] Saves style + default components to `profiles` table

### 7.4 Planner Tab - Week View Preferences Summary ✅
- [x] `app/(tabs)/planner.tsx` shows preference card when no plan exists
- [x] Displays style and components summary

### 7.5 Planner Tab - Week Generation Duration Control ✅
- [x] Duration target control (chips: 30m, 45m, 60m, 75m) in `planner.tsx` "Generate" flow
- [x] Stored in `plan_data.duration_target_min` (week-level)
- [x] Passed to `generateWeekScheduleWithAI` for Smart Compression
- [x] Loaded from `plan_data` when loading active plan
- [x] Default value: 45 minutes

### 7.6 Planner Tab - Estimated Durations Per Day ✅
- [x] Calculate estimated duration for each day in week view using `estimateDayDuration` helper
- [x] Display estimated time in day cards (e.g., "~45 min" text)
- [x] Uses same logic as `planner-day.tsx` (calls `estimateExerciseDuration` for rep-based exercises)

### 7.7 Planner Day - Duration Target Control ✅
- [x] `app/planner-day.tsx` has duration target chips (30m, 45m, 60m, 75m)
- [x] Stored in `dayData.target_duration_min`
- [x] Persisted to `plan_data.weeks[weekKey].week_schedule[day].target_duration_min`
- [x] Saved immediately on selection

### 7.8 Planner Day - Estimated Session Time ✅
- [x] `app/planner-day.tsx` calculates `estimatedDurationSec` using `estimateSessionDuration`
- [x] Displays "Estimated session: Xm · Target Ym" in header
- [x] Updates when exercises change

### 7.9 Planner Day - Weight Display ✅
- [x] Exercise cards show weight in set rows:
  - "BW" for bodyweight (weight === 0)
  - "X lbs" for loaded exercises
  - "—" only if truly null/undefined (shouldn't happen after progression)

### 7.10 Planner Day - Estimated Time Per Exercise ✅
- [x] Each exercise card displays estimated time (e.g., "Est. time: ~5m")
- [x] Estimated time calculated from sets, reps, rest, and exercise metadata
- [x] Updates reactively when exercises change

### 7.11 Planner Day - Personal Record (PR) Display & Editing ✅
- [x] PR displayed on each exercise card (for non-timed exercises)
- [x] PR shows weight and reps (e.g., "PR: 100 lbs × 6")
- [x] PR is tappable to edit via modal
- [x] PR modal allows editing weight and reps
- [x] PR can be cleared (set to empty)
- [x] PR loaded from `user_exercises` when loading exercises
- [x] PR auto-updates when workout logs are saved (highest weight for loaded, highest reps for bodyweight, highest duration for timed)

### 7.12 Workout Sets Editor - Weight Pre-fill ✅
- [x] `app/workout-sets.tsx` loads progression suggestions on open (in `loadData`)
- [x] Fetches workout_logs, computes metrics, gets suggestions
- [x] Fetches PR from `user_exercises` for the exercise
- [x] Pre-fills weight inputs with suggested weights (if null/undefined)
- [x] Respects existing weights and bodyweight flags

### 7.13 Planner Tab - useFocusEffect Fix ✅
- [x] Fixed dependency coupling issue in `planner.tsx`
- [x] `loadActivePlan` no longer depends on `hasInitiallyLoaded` state
- [x] Uses parameter-based approach to distinguish initial load vs refresh
- [x] Prevents unnecessary plan refetches when navigating back to planner tab

---

## 8. PERSONAL RECORD (PR) SYSTEM ✅

### 8.1 PR Module
- [x] `src/lib/personalRecord.ts` created
- [x] `computePRFromLogs(logs)` function to compute PR from workout logs
- [x] `getExercisePR(userId, exerciseName)` function to fetch PR from database or compute from logs
- [x] `saveExercisePR(userId, exerciseName, pr)` function to save/update PR
- [x] `maybeUpdatePRFromLog(userId, exerciseName, weight, reps, isTimed)` function for auto-update

### 8.2 PR Auto-Update Logic
- [x] PR auto-updates when workout logs are saved in `workout-active.tsx`
- [x] For timed exercises: compares duration (stored in reps field) - higher is better
- [x] For non-bodyweight exercises: compares weight - higher is better
- [x] For bodyweight exercises: compares reps - higher is better
- [x] Only updates if new record exceeds current PR

### 8.3 PR Integration with Progression
- [x] Progression engine accepts `personalRecord` in input
- [x] PR takes precedence over recent logs for baseline weight calculation
- [x] When PR is higher than recent logs, progression starts at 85% of PR for safety
- [x] All progression calls (planner.tsx, planner-day.tsx, workout-sets.tsx) pass PR data

---

## 9. TRAINING PREFERENCES MODULE ✅

### 8.1 Core Module
- [x] `src/lib/trainingPreferences.ts` created
- [x] `TrainingStyleId` type and `ComponentPreferences` interface
- [x] `getDefaultComponentsForStyle(style)` function
- [x] `deriveStyleFromGoal(goal)` function
- [x] `deriveStyleAndComponentsFromProfile(profile)` function
- [x] `serializeComponentsForStorage(components)` function
- [x] `describeComponentsForPrompt(style, components)` function
- [x] `getTrainingStyleLabel(style)` function (exported for UI)

---

## 10. SAFETY & DEV DIAGNOSTICS ✅

### 9.1 Dev-Only Logging
- [x] Progression engine logs suggestions (inputs/outputs)
- [x] Progression metrics logs computed metrics
- [x] Time estimation logs calculations
- [x] All wrapped in `if (__DEV__)` blocks

### 9.2 Non-Destructive Defaults
- [x] Progression engine falls back to heuristics if history missing
- [x] Volume templates provide safe defaults
- [x] Time estimation provides safe defaults
- [x] App never becomes unusable if any part fails

---

## 11. INTEGRATION & TESTING

### 11.1 Week Generation Flow
- [x] `planner.tsx` → `generateWeekScheduleWithAI` → volume templates → progression → save
- [x] Week-level duration target passed to engine
- [x] Smart Compression applied if duration exceeds target

### 11.2 Day Generation Flow
- [x] `planner-day.tsx` → `generateForDay` → volume templates → progression → save
- [x] Day-level duration target saved and displayed
- [x] Smart Compression applied if duration exceeds target

### 11.3 Manual Exercise Addition
- [x] Exercise select → workout-sets editor → save
- [x] Workout-sets editor pre-fills weights from progression

### 11.4 Time Override Flow ✅
- [x] User edits set duration in workout-sets editor
- [x] Calculate `seconds_per_rep = total_duration / number_of_sets` (for timed exercises)
- [x] Save to `user_exercises.user_seconds_per_rep_override` in `handleSave`
- [x] Future time estimations use override instead of base
- [x] Integrated into `estimateExerciseDuration` with priority: user override > base > tempo
- [x] Integrated into `planner-day.tsx` and `planner.tsx` time estimation

---

## SUMMARY

### ✅ Completed (50+ items)
- Core data structure & schema (including PR fields)
- Time estimation module (deterministic) with user override support
- Volume templates
- History-aware progression (metrics + engine)
- Personal Record (PR) system (module, auto-update, UI, integration)
- Integration with week/day generation
- Profile/onboarding UI for preferences
- Planner day duration controls
- Estimated time per exercise on cards
- Training preferences module
- Movement pattern tagging (heuristic inference)
- Coverage analysis module
- Recovery heuristics
- Dev diagnostics
- Bug fixes (useFocusEffect coupling, estimateDayDuration for timed exercises, rest time clamping)

### ⚠️ Partially Complete (0 items)
- All major features implemented

### ❌ Missing (1 item - Optional)
- Backfill existing exercises with movement patterns (optional - can be done via database migration)

---

## NEXT STEPS (Priority Order)

1. ✅ **Week-level duration target control** - COMPLETED
2. ✅ **Smart Compression logic** - COMPLETED
3. ✅ **Workout Sets editor weight pre-fill** - COMPLETED
4. ✅ **Time override persistence** - COMPLETED (save implemented, usage in estimation pending)
5. ✅ **Estimated durations in week view** - COMPLETED
6. ✅ **Estimated time per exercise on cards** - COMPLETED
7. ✅ **Personal Record (PR) system** - COMPLETED
8. ✅ **PR auto-update on log save** - COMPLETED
9. ✅ **PR integration with progression** - COMPLETED
10. ✅ **Bug fixes** - COMPLETED (useFocusEffect, estimateDayDuration, rest time clamping)
11. ✅ **Coverage analysis module** - COMPLETED
12. ✅ **Recovery heuristics** - COMPLETED
13. ✅ **Movement pattern tagging** - COMPLETED
14. ✅ **Time override usage in estimation** - COMPLETED
15. **Backfill existing exercises with movement patterns** - Optional database migration task

