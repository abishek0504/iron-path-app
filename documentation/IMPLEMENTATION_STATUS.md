# Implementation Status

**Last Updated**: 2026-01-21  
**Purpose**: Track what's implemented, what's TODO, and known issues.

## Summary

**Overall Progress**: ~95% of core features implemented

**Core Systems**:
- ✅ Database schema and RLS policies
- ✅ Authentication and onboarding
- ✅ Template management (Planner)
- ✅ Target selection with progressive overload
- ✅ Session creation and prefill
- ✅ Dashboard metrics
- ✅ Progress calendar views
- ✅ Active workout execution (swipe-to-complete UI)
- ✅ AI week generation (engine complete)
- ✅ Rebalance detection and apply (Smart Adjust)
- ✅ Advanced fatigue model (Banister continuous decay)
- ✅ Weighted implicit hits (biomechanically accurate)
- ✅ Skia-powered muscle heatmap visualization

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
| Multi-step flow (3 steps) | ✅ Complete | Personal, Training, Equipment |
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
| Reorder exercises | ⚠️ TODO | Drag-and-drop |
| Edit scope selection | ✅ Complete | Today vs Next Week |
| Target display | ✅ Complete | Shows sets/reps/duration from prescriptions |
| Custom exercise creation | ✅ Complete | With target bands (Patch D) |
| Custom exercise editing | ✅ Complete | Inline form |
| Exercise notes | ✅ Complete | Per slot |
| Missing prescription warning | ✅ Complete | Shows "Missing targets" |
| Empty day state | ✅ Complete | Add first exercise prompt |
| Day navigation | ✅ Complete | Horizontal scroll |

### AI Generation

| Feature | Status | Notes |
|---------|--------|-------|
| Allow-list filtering | ✅ Complete | v2_ai_recommended_exercises |
| Fatigue simulation | ✅ Complete | In-flight stress tracking |
| Greedy scoring | ✅ Complete | Priority - penalty |
| Zone detection | ✅ Complete | Green/yellow/red |
| Prescription-based targets | ✅ Complete | Uses target bands |
| Exercise distribution | ✅ Complete | 2-3 per day |
| Generate button UI | ⚠️ TODO | Add to Planner |
| Loading state | ⚠️ TODO | Show progress |
| Error handling | ✅ Complete | Returns empty on error |

### Workout Execution

| Feature | Status | Notes |
|---------|--------|-------|
| Rebalance check | ✅ Complete | Detects muscle gaps |
| SmartAdjustPrompt | ✅ Complete | Continue vs Smart Adjust |
| Smart Adjust apply | ✅ Complete | Adds catch-up exercises to session |
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
| Rest timer | ⚠️ TODO | Automatic between sets |
| Exercise notes display | ✅ Complete | Shows slot notes from template |
| Add exercise mid-workout | ⚠️ TODO | Dynamic structure edit |
| Remove exercise mid-workout | ⚠️ TODO | Dynamic structure edit |
| Abandon workout | ⚠️ TODO | Update status to abandoned |

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
| Heatmap display (Skia) | ✅ Complete | GPU-accelerated 28-muscle visualization |
| Muscle freshness | ✅ Complete | Continuous decay via Edge Function |
| Stress calculation | ✅ Complete | Weighted biomechanical model |
| Empty states | ✅ Complete | No data messages |

### Exercise Management

| Feature | Status | Notes |
|---------|--------|-------|
| Exercise picker | ✅ Complete | Global bottom sheet |
| Search exercises | ✅ Complete | Filters by name |
| Multi-select mode | ⚠️ TODO | Select multiple at once |
| Exercise metadata display | ✅ Complete | Name, muscles |
| Custom exercise creation | ✅ Complete | Full form with targets |
| Custom exercise editing | ✅ Complete | In picker or planner |
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
| Change password | ⚠️ TODO | Supabase endpoint exists |
| Logout | ✅ Complete | Clear session + stores |
| Unit preference | ✅ Complete | Imperial/metric |
| Theme toggle | ⚠️ TODO | Light/dark mode |
| Notifications | ⚠️ TODO | Workout reminders |

### Global UI Components

| Feature | Status | Notes |
|---------|--------|-------|
| BottomSheet | ✅ Complete | Animated, backdrop, gestures |
| ModalManager | ✅ Complete | Single instance in root |
| Toast notifications | ✅ Complete | Success/error/info |
| ToastProvider | ✅ Complete | Queue management |
| DatePicker | ✅ Complete | Calendar interface |
| PlanDayPicker | ✅ Complete | Day selection sheet |
| EditScopePrompt | ✅ Complete | Today vs Next Week |
| SmartAdjustPrompt | ✅ Complete | Continue vs Smart Adjust |
| ConfirmDialog | ✅ Complete | Reusable confirmation |
| TabHeader | ✅ Complete | Consistent tab headers |

### State Management (Zustand)

| Feature | Status | Notes |
|---------|--------|-------|
| uiStore | ✅ Complete | Bottom sheets + toasts |
| userStore | ✅ Complete | Profile cache |
| exerciseStore | ✅ Complete | Picker state |
| workoutStore | ⚠️ Unused | Created but not used |
| Sheet queueing | ✅ Complete | Sequential opening |
| State persistence | ⚠️ Partial | Only userStore persisted |

### Database & Queries

| Feature | Status | Notes |
|---------|--------|-------|
| All v2_* tables | ✅ Complete | Base + patches applied |
| RLS policies | ✅ Complete | Owner-based security |
| Muscle seeding | ✅ Complete | 28 canonical muscles |
| Query error handling | ✅ Complete | Try/catch + null returns |
| Dev logging | ✅ Complete | `__DEV__` wrapped |
| Type generation | ⚠️ Manual | Hand-typed interfaces |
| Derived caches | ⚠️ Unused | Tables exist, no rebuild jobs |

### Engine Algorithms

| Feature | Status | Notes |
|---------|--------|-------|
| Target selection | ✅ Complete | With progressive overload |
| Fatigue model (stress) | ✅ Complete | Stimulus × normalized weights |
| Fatigue model (Banister) | ✅ Complete | Continuous decay with λ constants |
| Weighted implicit hits | ✅ Complete | 40+ exercises seeded |
| AI week generation | ✅ Complete | Greedy selector |
| Rebalance detection | ✅ Complete | Muscle gap analysis |
| Rebalance apply | ✅ Complete | Adds catch-up exercises |
| Time estimation | ⚠️ TODO | Formula defined, not implemented |

## Known Issues

### High Priority

1. **System Templates RLS Risk**
   - **Impact**: Clients could write to system templates (user_id IS NULL)
   - **Status**: Current RLS: `USING (user_id = auth.uid() OR user_id IS NULL)`
   - **Fix**: Tighten policy or remove system template concept

2. **Partial Derived Cache Implementation**
   - **Impact**: v2_muscle_freshness now updated via Edge Function, v2_daily_muscle_stress still unused
   - **Status**: Freshness cache active, daily stress cache still computed on-demand
   - **Future**: Add daily stress cache rebuild job if needed

### Medium Priority

3. **No AI Generation UI**
   - **Impact**: Can't trigger AI generation from app
   - **Status**: Engine complete, button/UI TODO
   - **Next**: Add "Generate with AI" button to Planner

4. **workoutStore Unused**
   - **Impact**: Store created but not used
   - **Status**: Sessions fetched directly via queries
   - **Decision**: Remove or implement active session tracking

5. **TypeScript Types Manual**
   - **Impact**: Risk of schema drift
   - **Status**: Hand-typed interfaces in query files
   - **Fix**: Generate from schema regularly

### Low Priority

6. **No Exercise Reordering**
   - **Impact**: Can't rearrange exercise order in day
   - **Status**: TODO
   - **Next**: Add drag-and-drop UI

7. **No Multi-Select in Exercise Picker**
   - **Impact**: Must add exercises one by one
   - **Status**: TODO
   - **Next**: Add multi-select mode with batch addition

8. **No Theme Toggle**
   - **Impact**: Always light mode
   - **Status**: Theme system exists, no toggle UI
   - **Next**: Add dark mode support

9. **No Rest Timer**
   - **Impact**: Manual timing between sets
   - **Status**: TODO
   - **Next**: Add automatic rest timer based on RPE

10. **No Abandon Workout**
    - **Impact**: Active sessions stay active indefinitely
    - **Status**: TODO
    - **Next**: Add option to abandon workout (set status='abandoned')

## Completed Features (Recent)

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
- ✅ Built Skia-powered muscle heatmap (28 muscles, GPU-accelerated)
- ✅ Implemented Smart Adjust apply logic (catch-up exercises)
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

### Phase 1: Complete Core Workout Flow ✅ MOSTLY COMPLETE
1. ✅ Build active workout UI
   - ✅ Interactive set editing (swipe-to-complete)
   - ✅ RPE input (slider with color zones)
   - ⚠️ Rest timer (TODO)
   - ✅ Exercise notes display (Complete)
2. ✅ Implement save/complete logic
3. ⚠️ Add workout resumption (check for active on boot)
4. ⚠️ Test end-to-end workout flow

### Phase 2: AI & Rebalance ✅ MOSTLY COMPLETE
1. ⚠️ Add "Generate with AI" button to Planner (engine ready)
2. ⚠️ Implement loading state for AI generation
3. ✅ Implement rebalance apply logic
4. ✅ Advanced fatigue model (Banister continuous decay)
5. ✅ Weighted implicit hits with biomechanical accuracy

### Phase 3: UX Improvements
1. Add exercise reordering (drag-and-drop)
2. Add multi-select to exercise picker
3. Add dark mode toggle
4. Improve empty states
5. Add workout history viewer

### Phase 4: Advanced Features
1. Implement derived cache rebuild jobs
2. Add PR tracking and history
3. Add workout analytics
4. Add exercise substitution suggestions
5. Add workout templates library

### Phase 5: Polish & Performance
1. Add unit tests
2. Optimize queries (pagination, indexes)
3. Add offline support
4. Improve error handling
5. Add onboarding walkthrough

## Testing Checklist

### Core Flows to Test Before Release
- [ ] Signup → Onboarding → Create Template → View Planner
- [ ] Add Exercise → Select Scope → See in Planner
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
3. **Verify Seed Data** (28 muscles must exist)
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
- ⚠️ System template RLS needs tightening
- ⚠️ No rate limiting on queries
- ⚠️ No input sanitization (rely on RLS)

## Accessibility Status

- ⚠️ Not yet audited
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
