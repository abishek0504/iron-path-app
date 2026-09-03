# Implementation Status

**Last Updated**: 2026-09-03  

## Summary

**Overall progress**: Feature-complete for App Store submission. Several previously-listed blockers are now **resolved** (verified 2026-07-23): legal pages return HTTP 200 at `tryironpath.com/privacy` and `/terms`; `eas.json` submit `ascAppId` (`6793811855`) and `appleTeamId` (`JWUD8ZKQLN`) are set; Sentry DSN + org (`ironpath`/`apple-ios`) are configured in `eas.json`/`app.json`; and the iOS privacy manifest includes `CrashData`. RevenueCat + App Store Connect products, entitlement, offering, webhook, and API keys are set up (2026-08-02). The only remaining **external/manual** items are verifying offerings load and completing a sandbox purchase/restore on TestFlight, then the final TestFlight pass.

**Core systems**:

- ✅ Database schema, RLS (including system-template tighten), migrations for Health linkage + audit tables
- ✅ Auth, soft-delete grace + restore prompt on login; **pg_cron purge job** hard-deletes accounts past `scheduled_purge_at`
- ✅ Onboarding (~5-step), edit profile
- ✅ Planner with drag reorder, templates, superset chips, AI day generation (**OpenAI** via Edge Function, strict JSON-schema output with history-aware targets; migrated from Gemini 2026-06-10)
- ✅ Workout tab + active workout: per-exercise rest timers, set types (warm-up/drop/failure), supersets with alternating execution + shared rest, previous-performance inline, replace/reorder/add(multi-select) mid-workout
- ❌ Smart Adjust / Rebalance — Removed (was glitched; race with auto-materialize injected unplanned/duplicate sessions)
- ✅ Dashboard / progress surfaces
- ✅ Muscle heatmap via `react-native-body-highlighter` (Skia removed)
- ✅ GitHub Actions workflow (TypeScript + Vitest on push/PR)
- ✅ Theme tokens for heatmap / RPE zones + modal dimming across light/dark
- ✅ Local reminders + tap deep-link to tabs
- ✅ Sentry SDK + `@sentry/react-native/expo` plugin (dSYM upload; DSN in `eas.json`, org `ironpath`/project `apple-ios` in `app.json`)
- ✅ Apple Health: `@kingstinct/react-native-healthkit` wired — real authorization, HKWorkout on completion, body mass on weight log, HK UUID dedupe, `v2_health_sync` ledger, 30-day body-mass import
- ✅ watchOS mirror + standalone: exclusive `control_device` ownership, phone mirror via WCSession, watch-owned workouts with local engine + Supabase outbox (`targets/watch/`, `modules/watch-connectivity/`)
- ✅ Privacy manifest wired via `expo.ios.privacyManifests` in app.json
- ✅ Supabase security advisors remediated (search_path pins, trigger fn EXECUTE revokes, avatars bucket policies, anon table grants revoked)
- ✅ Exercise library expanded to **388 master entries** (340 strength + 48 stretches) via CSV import (`supabase/seed/master_exercises_and_stretches_expanded_advanced.csv`, migration 20260611120000); `is_stretch` column added; `adductors` muscle key added (29 canonical muscles); rule-based prescriptions seeded for all new exercises (1,164 active); AI allow-list refreshed to 340 non-stretch exercises
- ✅ AI generation supports a `stretchCount` constraint: `generate-workout` appends stretch/mobility work per session; planner opens `GenerateDayForm` with a 0–5 stretch picker (defaults to 0)
- ✅ AI generate **replaces** the day’s unperformed plan (`clear_plan_day_for_ai_replace` inside `commit_ai_generation`; client fallback in `src/lib/ai/clearPlanDay.ts`) and **hard-filters** day focus / avoid-muscles / duplicate names (`src/lib/ai/dayFocus.ts`, copied in `supabase/functions/generate-workout/dayFocus.ts`). Push cannot emit Hip Thrust; the same lift cannot be written seven times.
- ✅ `update-muscle-freshness` excludes warm-up sets from stress (`.neq('set_type','warmup')`, deployed v13); warm-up `set_type` now preserved on tap/watch set completion, so the PR-trigger warmup race is fixed
- ✅ Bundled exercise images: 388 illustrations in `assets/exercises/`, mapped via `src/lib/exerciseImages.ts` (no runtime generation pipeline)

## Feature Matrix

### Authentication & User Management

| Feature | Status | Notes |
|---------|--------|-------|
| Signup with email/password | ✅ Complete | Supabase Auth |
| Login | ✅ Complete | Session persisted |
| Email confirmation | ✅ Complete | Configurable in Supabase |
| Forgot password | ✅ Complete | Email reset link |
| Change email | ✅ Complete | Re-auth required |
| Logout | ✅ Complete | Clears session + store |
| Session persistence | ✅ Complete | AsyncStorage |
| Auth guards | ✅ Complete | Bootstrap checks session |

### Onboarding

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-step flow (≈5 steps) | ✅ Complete | Profile, training, equipment, review |

| First/last name | ✅ Complete | Split from full_name |
| Date of birth | ✅ Complete | Calendar picker |
| Weight input | ✅ Complete | Scrollable picker |
| Imperial/metric toggle | ✅ Complete | Persisted in profile |
| Experience level | ✅ Complete | Beginner/Intermediate/Advanced |
| Days per week | ✅ Complete | 2-7 days |
| Equipment access | ✅ Complete | Multi-select chips |
| Template creation | ✅ Complete | Auto-creates on completion |
| 7-day week setup | ✅ Complete | Ensures all weekdays exist |
| Validation | ✅ Complete | Required fields enforced |
| Edit profile | ✅ Complete | Modal screen |

### Planner (Template Management)

| Feature | Status | Notes |
|---------|--------|-------|
| View template with days | ✅ Complete | Fetches full hierarchy |
| Add exercise to day | ✅ Complete | Exercise picker |
| Remove exercise | ✅ Complete | Swipe-to-delete |
| Reorder exercises | ✅ Complete | Draggable list + `reorderTemplateSlots` |
| Date context (Today vs Future) | ✅ Complete | useDateContext; no Edit Scope modal |
| Target display | ✅ Complete | Shows sets/reps/duration from prescriptions |
| Custom exercise creation | ✅ Complete | `app/create-custom-exercise.tsx` → `createUserCustomExercise`; name, mode, muscles, set/rep or duration bands, equipment |
| Custom exercise editing / delete | ✅ Complete | Edit via same screen (`customExerciseId` param); delete via long-press in `app/add-exercise.tsx` |
| Exercise notes | ✅ Complete | Per slot |
| Missing prescription warning | ✅ Complete | Shows "Missing targets" |
| Empty day state | ✅ Complete | Add first exercise prompt |
| Day navigation | ✅ Complete | Horizontal scroll |
| Today Only badge | ✅ Complete | Diff session vs template; badge only when not in template |
| Save to Routine | ✅ Complete | Promote Today Only exercise to template for that day |

### AI Generation

| Feature | Status | Notes |
|---------|--------|-------|
| Allow-list filtering | ✅ Complete | v2_ai_recommended_exercises (340 non-stretch exercises, refreshed 2026-06-11) |
| Fatigue simulation | ✅ Complete | In-flight stress tracking |
| Greedy scoring | ✅ Complete | Priority - penalty |
| Zone detection | ✅ Complete | Green/yellow/red |
| Prescription-based targets | ✅ Complete | Uses target bands |
| Exercise distribution | ✅ Complete | 2-3 per day |
| OpenAI Edge generate-workout | ✅ Complete | Planner calls `generateAiDay`; AI prescribes sets/reps/weight. Pro quota: `PRO_WEEKLY_QUOTA = 40` successful generations per rolling 7 days (server-enforced, source=openai) |
| Generate button UI | ✅ Complete | Planner |
| Loading state | ✅ Complete | Spinner while generating |
| Error handling | ✅ Complete | Returns empty on error |
| Stretch append (`stretchCount`) | ✅ Complete | Edge Function validates 0–5 stretches/session; planner UI in `GenerateDayForm.tsx` (0–5 picker, default 0) |

### Workout Execution

| Feature | Status | Notes |
|---------|--------|-------|
| Rebalance check | ❌ Removed | Muscle-gap detection removed |
| SmartAdjustPrompt | ❌ Removed | Component deleted |
| Smart Adjust apply | ❌ Removed | Catch-up injection removed |
| Session creation | ✅ Complete | From template or standalone |
| Exercise prefill | ✅ Complete | Copies from template slots |
| Target calculation | ✅ Complete | Progressive overload with suggested weights |
| Set prefill | ✅ Complete | Prefills with targets, performed_at=NULL |
| Active workout UI | ✅ Complete | Exercise-by-exercise flow with phases |
| Set completion tracking | ✅ Complete | performed_at timestamp marks completion |
| Batch logging screen | ✅ Complete | Log all sets after exercise complete |
| Edit weight/reps/duration | ✅ Complete | In batch logging screen |
| RPE input | ✅ Complete | Interactive slider with color zones |
| Save changes | ✅ Complete | markSetComplete with performed_at |
| Complete workout | ✅ Complete | Triggers Edge Function for freshness |
| Resume active session | ✅ Complete | Continue button appears correctly |
| Exit mid-workout | ✅ Complete | Progress saved, resume on return |
| Weight suggestions | ✅ Complete | From history or prescription seed data |
| Exercise info display | ✅ Complete | Shows target muscles and tips |
| Keyboard dismiss | ✅ Complete | Done/Next buttons on inputs |
| Rest timer | ✅ Complete | Auto-start; per-exercise `rest_sec` → per-set → 90s default |
| Exercise notes display | ✅ Complete | Shows slot notes from template |
| Add exercise mid-workout | ✅ Complete | Multi-select picker, batch prefill |
| Remove exercise mid-workout | ✅ Complete | Overflow menu (completed-set guard) |
| Replace exercise mid-workout | ✅ Complete | In-place swap, blocked once sets are completed |
| Reorder exercises mid-workout | ✅ Complete | Modal with up/down controls |
| Set types | ✅ Complete | Warm-up/drop/failure; warm-ups excluded from PRs + volume |
| Supersets | ✅ Complete | `superset_group` on slots/session exercises; alternating execution, shared rest |
| Previous performance inline | ✅ Complete | "Last time" in execution + logging phases |
| Abandon workout | ✅ Complete | `abandonWorkoutSession` (status='abandoned') |
| Apple Watch mirror | ✅ Complete | State pushed via WCSession; watch Complete Set reuses `handleCompleteSet` |
| Smart Refresh staleness | ✅ Complete | Structural, target, biomechanical (optional) |
| Smart Refresh button/sheet | ✅ Complete | Orange/Red; confirmation sheet + Apply |
| Smart Refresh merge | ✅ Complete | Protect performed_at; delete divergent; insert from template |

### Progress Tracking

| Feature | Status | Notes |
|---------|--------|-------|
| Calendar view (weekly) | ✅ Complete | Shows 7-day week |
| Calendar view (monthly) | ✅ Complete | Shows full month grid |
| Session indicators | ✅ Complete | Dots on dates with sessions |
| Date selection | ✅ Complete | Tap to view sessions |
| SessionDetailSheet | ✅ Complete | Shows exercises + sets |
| Exercise name resolution | ✅ Complete | Handles master + custom |
| Set details | ✅ Complete | Weight/reps/duration/RPE |
| Empty state | ✅ Complete | "No workouts" message |
| Date range queries | ✅ Complete | Uses completed_at |
| View toggle | ✅ Complete | Week ↔ Month |

### Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Weekly completion metric | ✅ Complete | Completed vs target |
| Week range calculation | ✅ Complete | Sunday-Saturday, local time |
| Recent sessions list | ✅ Complete | Last 5 completed |
| Top PRs | ✅ Complete | Weight + duration PRs |
| PR recency sorting | ✅ Complete | Most recent first |
| Muscle status button | ✅ Complete | Opens heatmap |
| Heatmap display | ✅ Complete | `react-native-body-highlighter` visualization, 29 muscle keys mapped (Skia removed) |
| Muscle freshness | ✅ Complete | Edge Function on session complete; heatmap computes freshness on read (decay from last_trained_at) so recovery shows on rest days |
| Stress calculation | ✅ Complete | Weighted biomechanical model |
| Empty states | ✅ Complete | No data messages |

### Exercise Management

| Feature | Status | Notes |
|---------|--------|-------|
| Exercise picker | ✅ Complete | Global bottom sheet |
| Search exercises | ✅ Complete | Filters by name |
| Master exercise library | ✅ Complete | 388 entries (340 strength + 48 stretches) imported from CSV 2026-06-11 |
| Stretch entries (`is_stretch`) | ✅ Complete | Flagged separately; timed prescriptions seeded; excluded from AI strength selection |
| Exercise images | ✅ Complete | 388 bundled JPGs in `assets/exercises/` + `src/lib/exerciseImages.ts` |
| Multi-select mode | ✅ Complete | Checkmark selection + "Add N exercises" footer |
| Exercise metadata display | ✅ Complete | Name, muscles |
| Custom exercise creation | ✅ Complete | `app/create-custom-exercise.tsx`, entry point in Add Exercise header |
| Custom exercise editing | ✅ Complete | Edit/delete affordances on custom rows in Add Exercise |
| Exercise overrides | ✅ Complete | User customization |
| Merged exercise view | ✅ Complete | Override ?? master |
| Primary muscles | ✅ Complete | From metadata |
| Implicit hits | ✅ Complete | Secondary muscle activation |

### Prescriptions & Targets

| Feature | Status | Notes |
|---------|--------|-------|
| Prescription lookup | ✅ Complete | By exercise/experience/mode |
| Target band enforcement | ✅ Complete | No defaults without prescription |
| Progressive overload (reps) | ✅ Complete | Weight increase at top of band |
| Progressive overload (timed) | ✅ Complete | Duration increase |
| Custom exercise targets | ✅ Complete | Own target bands (Patch D) |
| Missing prescription handling | ✅ Complete | Exclude + warn |
| History lookup | ✅ Complete | Last 5 sessions |
| RPE consideration | ✅ Complete | Weight increase if RPE ≤ 7 |

### Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Settings menu | ✅ Complete | Global bottom sheet |
| Edit profile | ✅ Complete | Modal screen |
| Change email | ✅ Complete | With re-auth |
| Change password | ✅ Complete | `app/auth/change-password.tsx`, re-auth + update |
| Logout | ✅ Complete | Clear session + stores |
| Unit preference | ✅ Complete | Imperial/metric |
| Theme toggle | ✅ Complete | Light/Dark/System cycle in SettingsMenu (`ThemeContext`) |
| Notifications | ✅ Complete | Workout reminders screen + local notifications with tab deep-link |

### Global UI Components

| Feature | Status | Notes |
|---------|--------|-------|
| BottomSheet | ✅ Complete | Animated, backdrop, gestures |
| ModalManager | ✅ Complete | Single instance in root |
| Toast notifications | ✅ Complete | Success/error/info |
| ToastProvider | ✅ Complete | Queue management |
| DatePicker | ✅ Complete | Calendar interface |
| PlanDayPicker | ✅ Complete | Day selection sheet |
| EditScopePrompt | ✅ Removed | Replaced by date-context model (Today vs Future) |
| SmartAdjustPrompt | ❌ Removed | Component deleted |
| ConfirmDialog | ✅ Complete | Reusable confirmation |
| TabHeader | ✅ Complete | Consistent tab headers |

### State Management (Zustand)

| Feature | Status | Notes |
|---------|--------|-------|
| uiStore | ✅ Complete | Bottom sheets + toasts |
| userStore | ✅ Complete | Profile cache |
| Sheet queueing | ✅ Complete | Sequential opening |
| State persistence | ⚠️ Partial | Auth session only (Supabase client); app data in-memory |

### Database & Queries

| Feature | Status | Notes |
|---------|--------|-------|
| All v2_* tables | ✅ Complete | Base + patches applied |
| RLS policies | ✅ Complete | Owner-based security |
| Muscle seeding | ✅ Complete | 29 canonical muscles (adductors added 2026-06-11) |
| Query error handling | ✅ Complete | Try/catch + null returns |
| Dev logging | ✅ Complete | `__DEV__` wrapped |
| Type generation | ✅ Complete | Generated `src/types/supabase.gen.ts` (`npx supabase gen types`) re-exported via `supabase.ts` |
| Derived caches | ⚠️ Partial | Freshness via Edge Function; daily stress computed on-demand |

### Engine Algorithms

| Feature | Status | Notes |
|---------|--------|-------|
| Target selection | ✅ Complete | With progressive overload |
| Fatigue model (stress) | ✅ Complete | Stimulus × normalized weights |
| Fatigue model (Banister) | ✅ Complete | Continuous decay with λ constants |
| Weighted implicit hits | ✅ Complete | All 388 exercises carry weighted `implicit_hits` (CSV import 2026-06-11) |
| AI week generation | ✅ Complete | Greedy selector |
| Rebalance detection | ❌ Removed | Muscle gap analysis removed |
| Rebalance apply | ❌ Removed | Catch-up injection removed |
| Time estimation | ✅ Complete | `src/lib/utils/timeEstimation.ts` implements the ALGORITHMS formula (`estimateExerciseTimeSec` / `estimateSessionTimeSec`) |

## Known Issues / Remaining Manual Steps

### Resolved (verified 2026-07-23)

- ✅ **Apple submission IDs** — `eas.json` `submit.production.ios.ascAppId` (`6793811855`) and `appleTeamId` (`JWUD8ZKQLN`) are set.
- ✅ **Legal pages** — `tryironpath.com/privacy` and `/terms` return HTTP 200 (curl-verified).
- ✅ **Sentry** — DSN set in `eas.json` production env; `app.json` Sentry plugin org `ironpath` / project `apple-ios`.
- ✅ **iOS privacy manifest** — includes `NSPrivacyCollectedDataTypeCrashData`.

### Resolved (verified 2026-08-02)

- ✅ **RevenueCat + App Store Connect setup** — products (`ironpath_pro_monthly`/`ironpath_pro_annual`), entitlement `ironpath_pro`, default offering, webhook, and API keys configured (`eas.json` / env). See `SUBSCRIPTION_SETUP.md`.
- ⛔ **Supabase leaked-password protection** — advisor WARN accepted as **permanently out of scope** (dashboard toggle unavailable / cannot enable). Do not treat as open work.

### Blocking submission (external, not code)

1. **Sandbox purchase verify** — ensure App Store Connect Paid Apps agreement is **Active** (tax + banking, including Canada GST/HST Form 506 when required); confirm TestFlight paywall loads store packages (trial CTA enabled); complete sandbox purchase/restore. See `SUBSCRIPTION_SETUP.md`.
2. **Final TestFlight pass** — run core flows on a physical device (workout, watch mirror, HealthKit, paywall).

### Non-blocking

3. **Partial Derived Cache Implementation**
   - **Impact**: v2_muscle_freshness updated via Edge Function; v2_daily_muscle_stress still computed on-demand
   - **Future**: Add daily stress cache rebuild job if needed

## Completed Features (Recent)

### Leftover prelaunch fixes (2026-09-03)
- ✅ Adductors heatmap λ `0.060` on client matches `update-muscle-freshness` (`b1f948f`)
- ✅ AI generate 403 is `forbidden` (not “Session expired”); 401 unchanged (`1893973`)
- ✅ Standalone Watch JSON integers parse `NSNumber` via `intFromPayload` (`9532748`)
- ✅ Per-set rest max 3600s in UI + `v2_session_sets` CHECK (`ca22d9d`; applied live 2026-09-03)
- ✅ Account purge deletes `avatars` storage objects before `auth.users` (`281365e`; applied live 2026-09-03)

### Exercise Library Expansion & Image Pipeline (2026-06-11)
- ✅ Imported 388 master entries (45 updates + 343 inserts; 340 strength + 48 stretches) from `supabase/seed/master_exercises_and_stretches_expanded_advanced.csv` (migration 20260611120000, generated by `scripts/generate-exercise-import-sql.mjs`)
- ✅ Added `is_stretch` flag to `v2_exercises` (20260611120001)
- ✅ Added `adductors` canonical muscle key + heatmap slug mapping (20260611120002; `muscleHeatmapSlugs.ts`)
- ✅ Seeded rule-based prescriptions for all new exercises — stretches get timed holds, strength gets experience-banded reps (20260611120003; 1,164 active prescriptions live)
- ✅ Refreshed AI allow-list to all 340 non-stretch exercises with density-based priority (20260611120004)
- ✅ Stretch-aware AI generation: `generate-workout` accepts `stretchCount` (0–5) and appends stretches from a dedicated stretch catalog (deployed v14); planner UI in `GenerateDayForm` defaults to 0; user can select 0–5 per generation
- ✅ AI generate replaces the day’s unperformed plan and hard-filters day focus / avoid-muscles / duplicate exercise names (`dayFocus.ts` + `clear_plan_day_for_ai_replace`). Keep `src/lib/ai/dayFocus.ts` and `supabase/functions/generate-workout/dayFocus.ts` identical.
- ✅ Bundled exercise images: 388 JPGs in `assets/exercises/` wired through `src/lib/exerciseImages.ts` (full master catalog; no runtime generation)
- ✅ `update-muscle-freshness` excludes warm-up sets from stress (deployed v13)
- ✅ Warm-up `set_type` preserved when completing sets via tap/watch — fixes the warmup PR race
- ✅ `getExerciseHistory` excludes warm-ups from progressive-overload/weight-suggestion history
- ✅ Set-type (warm-up) editing added to `app/add-exercise-edit.tsx`

### AI Backend Migration to OpenAI (2026-06-10)
- ✅ `generate-workout` rewritten for OpenAI structured outputs (strict JSON schema, history-aware targets); Gemini removed
- ✅ `v2_ai_generations.source` constraint extended with `'openai'` (migration 20260610000000); legacy `gemini` rows preserved
- ✅ Live verification: at least one `source='openai'` generation row in production

### Workout Flow, PRs & Ops Hardening (2026-06-09)
- ✅ Set types (normal/warmup/drop/failure), supersets, per-exercise rest (`20260609000000`)
- ✅ PR trigger excludes warm-ups (`20260609000001`)
- ✅ pg_cron purge job for soft-deleted accounts (`20260609000002`)
- ✅ Security advisor remediation: search_path pins, EXECUTE revokes, avatars policies, anon grants (`20260609000003`)

### Phase 1-3: Biomechanics & Active Workout (2026-01-21)
- ✅ Upgraded fatigue model to Banister continuous decay
- ✅ Deployed Edge Function for automatic muscle freshness updates
- ✅ Created database trigger on session completion
- ✅ Migrated implicit_hits to weighted coefficients (40+ exercises seeded)
- ✅ Implemented exercise-by-exercise active workout flow
- ✅ Created batch logging screen with editable fields
- ✅ Implemented set completion tracking with performed_at timestamps
- ✅ Fixed markSetComplete to always set performed_at (CRITICAL BUG FIX)
- ✅ Implemented Continue button logic for mid-workout exits
- ✅ Added suggested_weight_lbs/kg to v2_exercise_prescriptions
- ✅ Seeded realistic starting weights for 45 exercises
- ✅ Created interactive RPE slider with color zones
- ✅ Built muscle heatmap (28 muscles; uses react-native-body-highlighter). **Platform:** Dev build/simulator = full body view. Expo Go = list fallback (muscle groups + %) so heatmap data is visible without native body highlighter. Web = "Please open on mobile to see full heatmap."
- ✅ Implemented Smart Adjust apply logic (catch-up exercises) — later removed (2026-07-23)
- ✅ Installed @shopify/flash-list and @shopify/react-native-skia
- ✅ Added keyboard dismiss functionality (Done/Next buttons)
- ✅ Implemented exercise info display (muscles, tips)
- ✅ Fixed bottom sheet UI (removed non-functional drag handle)
- ✅ Improved SessionExerciseEditSheet header layout

### Patch H - Remove Goal (2026-01-XX)
- ✅ Removed `goal` from prescriptions (holistic approach)
- ✅ Updated unique key to `(exercise_id, experience, mode)`
- ✅ Migrated existing data (consolidated duplicates)
- ✅ Removed `goal` from profiles and slots

### Patch D - Custom Exercise Targets (2026-01-XX)
- ✅ Added target bands to custom exercises
- ✅ `mode`, `sets_min/max`, `reps_min/max`, `duration_sec_min/max`
- ✅ Backfilled existing custom exercises
- ✅ CHECK constraints matching prescriptions

### Patches C1/C2 - XOR Constraints (2026-01-XX)
- ✅ Added `custom_exercise_id` to template slots
- ✅ Added `custom_exercise_id` to session exercises
- ✅ CHECK constraints enforce exactly one ID

### Split Full Name (2026-01-XX)
- ✅ Split `full_name` into `first_name` + `last_name`
- ✅ Migration splits on first space
- ✅ Onboarding updated to use first_name

### Progress Calendar Enhancement (2026-01-19)
- ✅ Weekly calendar view
- ✅ Monthly calendar view
- ✅ View toggle
- ✅ Session detail sheet
- ✅ Date-based session queries

### Dashboard Query Fixes (2026-01-19)
- ✅ Fixed "This week" query to use `completed_at`
- ✅ Added `.not('completed_at', 'is', null)` filter
- ✅ Refactored PRs to include weight + duration
- ✅ Hybrid PR ranking by recency

## Roadmap

### Phase 1: Complete Core Workout Flow ✅ COMPLETE
1. ✅ Build active workout UI
   - ✅ Interactive set editing (exercise-by-exercise phases with Complete Set + batch logging)
   - ✅ RPE input (slider with color zones)
   - ✅ Rest timer (auto-start, per-exercise `rest_sec`)
   - ✅ Exercise notes display
2. ✅ Implement save/complete logic
3. ✅ Add workout resumption (Continue button, resumes at first incomplete set)
4. ✅ End-to-end workout flow (manual TestFlight pass still pending)

### Phase 2: AI & Rebalance ✅ COMPLETE
1. ✅ "Generate with AI" button in Planner (OpenAI Edge Function, structured outputs)
2. ✅ Loading overlay + quota display for AI generation
3. ❌ Rebalance apply logic (Smart Adjust) — removed 2026-07-23 (glitched; race with auto-materialize)
4. ✅ Advanced fatigue model (Banister continuous decay)
5. ✅ Weighted implicit hits with biomechanical accuracy

### Phase 3: UX Improvements ✅ COMPLETE
1. ✅ Exercise reordering (drag-and-drop in planner; reorder modal in active workout)
2. ✅ Multi-select in exercise picker
3. ✅ Dark mode toggle (Light/Dark/System)
4. ✅ Empty states across tabs
5. ✅ Workout history viewer (progress calendar + session detail sheet)

### Phase 4: Advanced Features
1. ⚠️ Implement derived cache rebuild jobs (daily stress still on-demand)
2. ✅ PR tracking and history (`app/prs.tsx`, dashboard Top PRs, warm-ups excluded)
3. ⚠️ Add workout analytics — **In progress 2026-06-17**: Progress tab Trends/Exercises segments, `src/lib/analytics/*`, `analytics.ts` queries, exercise detail screen, session health metrics.
4. ⚠️ Add exercise substitution suggestions
5. ⚠️ Add workout templates library

### Phase 5: Polish & Performance
1. ✅ Unit tests (Vitest: date utils, muscle freshness, workout flow; CI on push/PR)
2. ⚠️ Optimize queries (pagination, indexes)
3. ⚠️ Add offline support (watch set-completions queue offline; app itself is online-only)
4. ✅ Error handling (toasts, auth-error surfacing, graceful AI fallback)
5. ✅ Add onboarding walkthrough (post-profile spotlight tour → paywall)

## Testing Checklist

### Core Flows to Test Before Release
- [ ] Signup → Onboarding → Create Template → View Planner
- [ ] Add Exercise (Today vs Future date context) → See in Planner
- [ ] Remove Exercise → Confirm → Removed
- [ ] Start Workout → Create Session → See Active Workout
- [ ] Complete Workout → See in Progress Calendar
- [ ] View Progress → Tap Date → See Session Details
- [ ] Dashboard Metrics → Verify Accuracy
- [ ] Muscle Heatmap → Verify Stress Calculation
- [ ] Custom Exercise → Create → Use in Plan
- [ ] Edit Profile → Save → Persists
- [ ] Logout → Login → Session Restored

### Edge Cases to Test
- [ ] Missing prescriptions → Shows warning
- [ ] No exercises in allow-list → AI fails gracefully
- [ ] All muscles in red zone → AI stops selection
- [ ] XOR violation → Query returns null
- [ ] RLS policy → Can't access other user's data
- [ ] Network error → Shows error message + retry

## Migration Path for Existing Users

If deploying to users with existing data:

1. **Backup Database** before migrations
2. **Apply Patches in Order** (C1, C2, D, H, split_full_name)
3. **Verify Seed Data** (29 muscles must exist, including `adductors`)
4. **Test RLS Policies** (ensure no unauthorized access)
5. **Monitor Logs** for errors post-deployment
6. **Provide Support** for users with issues

## Contributing Guidelines

When adding new features:
1. ✅ Follow existing patterns (see `DATA_FLOWS.md`)
2. ✅ Add dev logging for debugging
3. ✅ Handle errors gracefully (return null/[])
4. ✅ Update this file (IMPLEMENTATION_STATUS.md)
5. ✅ Test on multiple platforms
6. ✅ Consider RLS implications
7. ✅ Follow naming conventions

## Performance Benchmarks

Target performance (not yet measured):
- App cold start: < 3 seconds
- Page navigation: < 300ms
- Query response: < 500ms
- AI generation: < 5 seconds

## Security Audit Status

- ✅ RLS policies implemented
- ✅ Only anon key in client
- ✅ Auth guards on routes
- ✅ JWT-hardened `update-muscle-freshness`; system templates read-only except owner writes
- ⚠️ No rate limiting on queries
- ⚠️ No input sanitization (rely on RLS)

## Accessibility Status

- ⚠️ Tab bar + settings rows labeled; full VoiceOver pass still recommended
- ⚠️ No screen reader testing
- ⚠️ No keyboard navigation testing
- ⚠️ Color contrast not verified

## Documentation Status

- ✅ System architecture documented
- ✅ Database schema documented
- ✅ Algorithms documented with examples
- ✅ Data flows documented
- ✅ Setup guide complete
- ✅ This status file maintained
- ⚠️ Component prop documentation minimal (rely on TypeScript)
- ⚠️ API documentation minimal (rely on function signatures)
