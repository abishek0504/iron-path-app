# Database Schema

**Purpose**: Document database structure, migrations, and RLS policies.

**Last Updated**: 2026-07-23

## Migration Order

Apply migrations in this exact order:

1. **20240101000000_create_v2_tables.sql** - Creates all v2_* tables with base schema
2. **20240101000001_create_v2_rls_policies.sql** - Enables RLS and creates policies
3. **20250101000000_patch_c1_template_slots_custom_exercise_id.sql** - Adds custom_exercise_id to template slots
4. **20250101000001_patch_c2_session_exercises_custom_exercise_id.sql** - Verifies/adds custom_exercise_id to session exercises
5. **20250101000002_patch_d_custom_exercise_targets.sql** - Adds target band fields to custom exercises
6. **20250101000003_patch_h_remove_goal.sql** - Removes goal from profiles/prescriptions/slots (note: the live schema retains `goal` columns; see v2_exercise_prescriptions below)
7. **20250101000004_seed_v2_muscles.sql** - Seeds 28 canonical muscles
8. **20250101000005_split_full_name.sql** - Splits full_name into first_name/last_name
9. **20260122000000_trigger_muscle_freshness_update.sql** - Trigger on session completion that calls the `update-muscle-freshness` Edge Function via pg_net
10. **20260122000001_refine_implicit_hits.sql** - Updates implicit_hits to weighted coefficients (40+ exercises)
11. **20260122000002_seed_exercise_prescriptions.sql** - Seeds exercise prescriptions for all exercises
12. **20260122000003_fix_performed_at_default.sql** - Drops DEFAULT now() from v2_session_sets.performed_at (sets were being marked complete on creation)
13. **20260122000004_add_suggested_weights.sql** - Adds suggested_weight_lbs/kg to prescriptions (45 exercises)
14. **20260122000005_create_template_slot_sets.sql** - Adds v2_template_slot_sets for per-slot default sets (later removed)
15. **20260122000006_remove_template_slot_sets.sql** - Drops v2_template_slot_sets; prefill always uses prescriptions + history
16. **20260128000000_seed_exercise_metadata.sql** - Seeds description, secondary_muscles, equipment_needed, movement_pattern, tempo_category
17. **20260128000001_seed_ai_recommended_exercises.sql** - Seeds AI allow-list with priority_order and notes (all exercises with prescriptions)
18. **20260128000002_seed_prescription_source_notes.sql** - Seeds source_notes explaining prescription rationale
19. **20260128000003_add_bw_multiplier_prescriptions.sql** - Adds suggested_weight_multiplier_bw (bodyweight-based default; no NULLs)
20. **20260128000004_add_user_default_targets.sql** - Adds default_set_count/weight/reps/duration_sec/rest_sec to v2_user_exercise_overrides
21. **20260129000000_create_v2_user_exercise_prs.sql** - Creates v2_user_exercise_prs PR cache + trigger on completed sets
22. **20260129000001_backfill_v2_user_exercise_prs.sql** - Backfills PRs from existing completed sets
23. **20260129000002_pr_types_reps_and_timed.sql** - Adds pr_type ('weight' | 'reps_only' | 'timed') and duration_sec to PRs; unique per (user, exercise, pr_type)
24. **20260129000003_backfill_pr_reps_only_and_timed.sql** - Backfills reps_only and timed PRs
25. **20260129000010_create_v2_support.sql** - Creates v2_support (Help & Support contact form submissions)
26. **20260130000000_create_v2_weight_logs.sql** - Creates v2_weight_logs (weight history); backfills one row per profile with current_weight
27. **20260130000001_add_fk_covering_indexes.sql** - Adds covering indexes for FK columns that lacked them (v2_user_exercise_prs, v2_workout_templates, v2_template_slots, v2_workout_sessions, v2_session_exercises); improves JOIN and CASCADE performance
28. **20260130000002_add_remaining_fk_indexes_and_prs_pk.sql** - Adds covering indexes for remaining FKs (muscle_key on v2_daily_muscle_stress/v2_muscle_freshness, custom_exercise_id on v2_template_slots, exercise_id on v2_user_exercise_overrides/v2_user_exercise_prs, custom_exercise_id on v2_user_exercise_prs); adds id PRIMARY KEY to v2_user_exercise_prs
29. **20260130000003_rls_auth_uid_initplan.sql** - RLS: replace `auth.uid()` with `(select auth.uid())` in all owner policies so PostgreSQL evaluates once (InitPlan) instead of per row; fixes "Auth RLS Initialization Plan" performance warning
30. **20260312000000_add_vsit_timed_prescription.sql** - Adds missing timed prescription for V-Sit and ensures it is in the AI allow-list
31. **20260312000001_ensure_ai_exercises_have_mode_prescriptions.sql** - Removes AI allow-list entries lacking a mode-matching prescription (reps exercises need 'reps', timed need 'timed')
32. **20260508000000_tighten_system_template_rls.sql** - Splits template RLS into SELECT (owner OR system) and INSERT/UPDATE/DELETE (owner only); closes the system-template write hole
33. **20260508000001_account_soft_delete.sql** - Adds deleted_at/scheduled_purge_at to v2_profiles for account soft delete with 30-day grace period
34. **20260508000002_create_v2_ai_generations.sql** - Creates v2_ai_generations (AI generation audit log + rate-limit ledger)
35. **20260510000000_health_hk_links_session_validation.sql** - Adds hk_workout_uuid (sessions) and hk_sample_uuid (weight logs) with unique partial indexes; creates v2_health_sync; tightens RPE (0-10) and RIR (0-15) checks
36. **20260609000000_workout_flow_set_types_supersets_rest.sql** - Adds set_type to v2_session_sets; superset_group + rest_sec to v2_session_exercises and v2_template_slots
37. **20260609000001_pr_trigger_exclude_warmups.sql** - PR trigger ignores warm-up sets (set_type = 'warmup'); pins function search_path
38. **20260609000002_purge_soft_deleted_accounts_cron.sql** - pg_cron job (daily 03:00 UTC) hard-deletes auth.users past scheduled_purge_at; v2_* data cascades
39. **20260609000003_security_advisor_remediation.sql** - Pins function search_paths, revokes EXECUTE on trigger functions, drops broad avatars-bucket policies, revokes all anon grants on v2_* tables
40. **20260610000000_ai_generations_openai_source.sql** - Allows 'openai' as a v2_ai_generations.source value (backend moved from Gemini to OpenAI)
41. **20260611120000_import_master_exercises_from_csv.sql** - Master exercise import from `supabase/seed/master_exercises_and_stretches_expanded_advanced.csv`: 388 exercises (45 updates, 343 inserts), including 48 stretches
42. **20260611120001_add_is_stretch_to_v2_exercises.sql** - Adds is_stretch boolean to v2_exercises (mobility/stretch entries vs strength)
43. **20260611120002_add_adductors_muscle_key.sql** - Adds 'adductors' as a 29th canonical muscle key (lower_body_front)
44. **20260611120003_seed_prescriptions_for_new_exercises.sql** - Rule-based prescriptions for new exercises (stretch timed holds, timed strength, rep bands tiered by density_score)
45. **20260611120004_refresh_ai_recommended_exercises.sql** - Refreshes AI allow-list: all non-stretch exercises with mode-matching prescriptions; priority by density_score; stretches deactivated
46. **20260611200000_pr_trigger_exclude_stretches.sql** - PR trigger ignores stretch sets (`is_stretch = true` on linked exercise)
47. **20260612120000_add_subscription_fields_to_v2_profiles.sql** - Adds `subscription_tier`, `subscription_expires_at`, `revenuecat_app_user_id` to v2_profiles
48. **20260613000000_create_workout_presets.sql** - Workout presets table + slots + RLS
49. **20260614080000_vibesec_security_hardening.sql** - VibeSec security hardening (subscription INSERT protection, soft-delete triggers, support message length)
50. **20260614120000_deferred_security_fixes.sql** - Deferred avatar storage policy fixes
51. **20260616120000_ai_generation_jobs.sql** - `v2_ai_generation_jobs` idempotency table
52. **20260616120100_commit_ai_generation_rpc.sql** - `commit_ai_generation` + `purge_expired_ai_generation_jobs` RPCs
53. **20260617120000_v2_profiles_first_name_not_null.sql** - Backfills blank `first_name` and enforces NOT NULL
54. **20260618120000_v2_profiles_app_tour_completed_at.sql** - Adds `app_tour_completed_at` for first-run app tour completion tracking
55. **20260618201017_create_waitlist.sql** - Creates `waitlist` table
56. **20260618201026_waitlist_lockdown_grants.sql** - Locks down `waitlist` grants (RLS enabled, no client policy; service-role only)
57. **20260723000000_prelaunch_security_perf_hardening.sql** - Advisor remediation: revokes EXECUTE on `commit_ai_generation` / `purge_expired_ai_generation_jobs` from client roles, re-creates `v2_user_exercise_prs` select policy with init-plan `auth.uid()`, adds 5 FK covering indexes
58. **20260723000001_fix_v2_profiles_first_name_nullable.sql** - Drops NOT NULL on `v2_profiles.first_name` so signup trigger succeeds before onboarding collects the name
59. **20260723010000_workout_session_origin_dedup.sql** - Adds `origin` ('auto' | 'manual') to `v2_workout_sessions` + partial unique index to dedupe auto-materialized sessions per day
60. **20260723020000_revoke_graphql_from_client_roles.sql** - Revokes `graphql`/`graphql_public` schema usage + function execute from `anon`/`authenticated` (app uses PostgREST only; defense-in-depth against GraphQL schema discovery)

## Table Relationships

```
v2_muscles (canonical reference)
  ↓ (referenced by validation layer)
v2_exercises (master list)
  ├→ v2_exercise_prescriptions (curated targets)
  ├→ v2_ai_recommended_exercises (AI allow-list)
  ├→ v2_user_exercise_overrides (user customization)
  └→ v2_template_slots, v2_session_exercises (usage)

v2_user_custom_exercises (user-created)
  └→ v2_template_slots, v2_session_exercises (usage)

v2_profiles (user settings, soft-delete markers)

v2_workout_templates (planning)
  └→ v2_template_days
      └→ v2_template_slots

v2_workout_presets (saved workout bundles)
  └→ v2_workout_preset_slots

v2_workout_sessions (performed truth)
  └→ v2_session_exercises
      └→ v2_session_sets
          └→ v2_user_exercise_prs (PR cache, trigger-maintained)

v2_muscle_freshness, v2_daily_muscle_stress (derived caches)

v2_weight_logs (weight history)
v2_health_sync (HealthKit sync ledger)
v2_ai_generations (AI generation audit log / rate limits)
v2_support (Help & Support submissions)
```

## Core Tables

### Canonical Reference

#### v2_muscles
**Purpose**: Single source of truth for muscle keys. All muscle references validate against this.

**29 Muscles Organized by Functional Groups:**
- **Upper Body Push** (7): chest, upper_chest, lower_chest, anterior_deltoids, lateral_deltoids, posterior_deltoids, triceps
- **Upper Body Pull** (6): lats, upper_back, lower_back, traps, biceps, forearms
- **Core** (2): abs, obliques
- **Lower Body Front** (3): quads, hip_flexors, adductors (added 2026-06-11 for inner-thigh work)
- **Lower Body Back** (4): hamstrings, glutes, calves, soleus
- **Stabilizers** (7): rotator_cuff, serratus_anterior, transverse_abdominis, glute_medius, glute_minimus, piriformis, tibialis_anterior

**Philosophy**: Focus on functionally distinct muscle groups for compound movements (not individual muscle heads unless functionally different like upper/lower chest for incline/decline variations).

**RLS**: Auth SELECT only (immutable from client)

#### v2_exercises
**Purpose**: Master exercise list, immutable from client.

**Size**: 388 exercises (340 strength + 48 stretches) since the 2026-06-11 master import from `supabase/seed/master_exercises_and_stretches_expanded_advanced.csv` (45 updates to existing rows, 343 inserts).

**Key Fields:**
- `density_score` (0-10): Exercise quality rating
- `primary_muscles[]`: Array of muscle keys
- `secondary_muscles[]`: Array of secondary muscles involved (nullable, seeded from biomechanics research)
- `implicit_hits{}`: JSONB map of muscle_key → activation (0-1)
  - **Weighted Activation Schema**: Coefficients distinguish Primary Movers (1.0) from Major Synergists (0.6-0.9) and Stabilizers (0.3-0.5)
  - Example: Bench Press `{"triceps": 0.6, "anterior_deltoids": 0.5}` - triceps contributes 60% of the stress a primary mover would
  - Allows the fatigue engine to accurately accrete stress to secondary muscles without overestimating total fatigue
- `description`: Exercise description and form cues (nullable, seeded with instructional text)
- `equipment_needed[]`: Array of required equipment (nullable, empty array = bodyweight)
- `movement_pattern`: Primary movement pattern classification (nullable)
  - Values: `push`, `pull`, `squat`, `hinge`, `lunge`, `carry`, `rotation`, `anti-rotation`
  - Based on NSCA movement pattern framework
- `tempo_category`: Tempo classification (nullable)
  - Values: `explosive` (maximal velocity, power-focused), `controlled` (moderate tempo, hypertrophy-focused), `isometric` (static hold)
  - Based on ACSM tempo guidelines
- `is_unilateral`: Doubles time estimate if true
- `avg_time_per_set_sec`: Includes rest between sets
- `is_timed`: Boolean flag for timed vs reps mode
- `is_stretch`: True for mobility/stretch entries; excluded from AI strength selection (added 2026-06-11, NOT NULL DEFAULT false)

**Constraints:**
- `density_score` CHECK (>= 0 AND <= 10)
- `primary_muscles` validated against v2_muscles (validation layer)
- `implicit_hits` keys validated against v2_muscles (validation layer)

**RLS**: Auth SELECT only

**Indexes:**
- `idx_v2_exercises_density_score` for sorting/filtering

### Prescriptions & AI

#### v2_exercise_prescriptions
**Purpose**: Curated programming targets per exercise by context.

**Key Fields:**
- `exercise_id`, `goal`, `experience`, `mode` - lookup key. Patch H (20250101000003) was written to drop `goal`, but the live schema retains it (generated types show `goal` NOT NULL); newer migrations (20260312000000, 20260611120003) write `goal = 'hypertrophy'` and conflict on `(exercise_id, goal, experience, mode)`.
- `sets_min/max` (1-10)
- `reps_min/max` (1-50, only if mode='reps')
- `duration_sec_min/max` (5-3600, only if mode='timed')
- `suggested_weight_multiplier_bw`: **Bodyweight multiplier for suggested weight (NOT NULL DEFAULT 0).** suggested_weight = current_weight × this. Single default per exercise/experience (no ranges). Represents **working weight** for the prescribed rep range (not 1RM). Research, rationale, and guidelines for all multipliers and for adding new exercises: see [PRESCRIPTION_RATIONALE.md](PRESCRIPTION_RATIONALE.md). Seeded in 20260128000003; prescriptions created by 20260611120003 keep the default 0 (bodyweight).
- `suggested_weight_lbs/kg`: Legacy fixed weights (nullable); runtime prefers multiplier × profile.current_weight with fallback 150 lb / 70 kg.
- `source_notes`: Research-backed notes explaining prescription rationale (seeded 2026-01-28)

**Seeding for the 2026-06-11 master import (20260611120003)**, rule-based and idempotent:
- Stretches (is_stretch, timed): 1-2 sets × 30-45s (beginner) up to 2-3 × 45-90s (advanced)
- Timed strength (planks, dead hangs): 3 × 20-30s (beginner) up to 4-5 × 45-60s (advanced)
- Rep-based strength, tiered by density_score: ≥8 → 3×8-12 / 3-4×6-10 / 4-5×5-8; 6-7 → 3×8-12 / 3-4×8-12 / 3-4×6-10; ≤5 → 3×10-15 / 3-4×10-15 / 3-4×8-12 (beginner / intermediate / advanced)

**Constraints:**
- Mode-specific target bands (reps XOR duration)
- Sets bounds: 1 <= sets_min <= sets_max <= 10
- Reps bounds: 1 <= reps_min <= reps_max <= 50 (reps mode)
- Duration bounds: 5 <= duration_sec_min <= duration_sec_max <= 3600 (timed mode)

**RLS**: Auth SELECT only

**Indexes:**
- `idx_v2_exercise_prescriptions_lookup` on (exercise_id, experience, mode, is_active)

**How prescriptions are selected**
- Lookup key: `(exercise_id, experience, mode)` with `is_active = true`. One row per exercise per experience level per mode (reps vs timed).
- Code: `getExercisePrescription(exerciseId, experience, mode)` in `src/lib/supabase/queries/prescriptions.ts`. Used by `selectExerciseTargets()` in `src/lib/engine/targetSelection.ts` and by week generation in `src/lib/engine/weekGeneration.ts`.
- Custom exercises do not use this table; `selectExerciseTargets()` reads target bands off the custom exercise when present, otherwise falls back to defaults (see v2_user_custom_exercises note on target bands).

**Why rows look similar (bands vs weights)**
- Rep/set **bands** (e.g. beginner 3 sets, 8–12 reps) are shared by design across many rep-based exercises for hypertrophy. So Chin Up and Squat can have the same sets_min/max and reps_min/max for a given experience/mode. That is intentional: the band is “do 8–12 reps in 3 sets,” not “do the same weight.”
- What differs per exercise is **suggested_weight_multiplier_bw**: e.g. Squat (Barbell) 0.85/1.5/1.75× BW; Chin Up (Supinated) 0 (bodyweight-only). Suggested weight is always calculated: current_weight × multiplier (fallback 150 lb / 70 kg when profile has no current_weight). No NULLs: bodyweight exercises use multiplier 0 so suggested weight = 0. So “different exercises use different prescriptions” means: same rep band is possible, but each exercise has its own row and its own starting weight (or NULL for bodyweight).

**Chin-ups vs squats (harder vs easier)**
- Chin-ups are harder per rep than squats. The system does not give “the same amount” of work: it gives the same **rep band** (e.g. 8–12) and **exercise-specific starting weight**. For chin-ups, multiplier = 0 so suggested weight = 0 (bodyweight; user can add weight via belt). For squats, multiplier = 0.85/1.5/1.75× BW so suggested = e.g. 128 lbs for 150 lb beginner. So the first time: chin-up suggests “3 sets × 8–12 reps” at bodyweight; squat suggests “3 sets × 8–12 reps” at 95 lbs (beginner). After the user logs sessions, the algorithm uses **tracked values** (last weight, last reps, RPE) to progress: for chin-ups progress is usually more reps or added weight (belt/dumbbell) within the band; for squats it is weight increases when hitting top of rep band at acceptable RPE.

**End-to-end flow: prescription → user edit → algorithm**
1. **Fill from prescription**: When starting a session, `selectExerciseTargets()` uses the prescription band (sets/reps or duration) and, if no history, **suggested weight = current_weight × suggested_weight_multiplier_bw** (fallback 150 lb or 70 kg). Always a number; no NULLs. Targets are prefilled into `v2_session_sets` (e.g. 3 sets × 10 reps @ 128 lbs for 150 lb beginner squat).
2. **User edits**: The user can change weight, reps, RPE, and duration before or after completing a set. Saving marks the set complete (`performed_at` set) and stores the actual values in `v2_session_sets`.
3. **Algorithm uses tracked values**: On the next session, `getExerciseHistory()` returns last weight, last reps, last duration, and average RPE. `selectExerciseTargets()` uses that for progressive overload: e.g. if last reps ≥ 90% of reps_max and RPE ≤ 7, suggest weight increase and reset reps to reps_min; otherwise suggest lastReps+1 at same weight. So future targets are driven by **performed truth**, not by the static prescription; the prescription only defines the valid band and the initial/default suggestion.

**Patch H Impact:**
- Migration intended to remove `goal` and key on `(exercise_id, experience, mode)`; consolidated duplicates (preferred hypertrophy if existed)
- Live schema retains `goal` (all rows use 'hypertrophy'); effective uniqueness is `(exercise_id, goal, experience, mode)`

#### v2_ai_recommended_exercises
**Purpose**: AI allow-list. Only exercises in this table can be selected by AI generation.

**Key Fields:**
- `exercise_id` (PRIMARY KEY, FK to v2_exercises)
- `priority_order`: Lower = higher priority in selection (1 = highest priority)
  - **Priority Tiers**: 1-10 (foundational compounds), 11-20 (secondary compounds), 21-30 (assistance), 31-40 (isolation), 41+ (core/stability)
  - Based on exercise hierarchy: compound movements prioritized over isolation exercises
- `notes`: Exercise description and programming rationale (seeded 2026-01-28)
- `is_active`: Soft delete flag

**Seeding**: Originally all exercises with active prescriptions (20260128000001). Refreshed 2026-06-11 (20260611120004): all **non-stretch** exercises with a mode-matching active prescription (reps exercises need a 'reps' prescription, timed need 'timed'); priority_order assigned by density_score (≥9 → 10, ≥8 → 20, ≥6 → 30, ≥4 → 40, else 50); stretch entries deactivated. 20260312000001 also removes entries lacking a mode-matching prescription.

**RLS**: Auth SELECT only

**Indexes:**
- `idx_v2_ai_recommended_exercises_active` on (is_active, priority_order)

### User Customization

#### v2_user_exercise_overrides
**Purpose**: User-specific overrides for master exercises. Non-null overrides take precedence.

**Key Fields:**
- PRIMARY KEY: `(user_id, exercise_id)`
- Override fields: `*_override` suffix (density_score_override, primary_muscles_override, etc.)
- **User default targets** (migration 20260128000004): `default_set_count`, `default_weight`, `default_reps`, `default_duration_sec`, `default_rest_sec`. Used to prefill add-exercise-edit and future workouts from the user's last-saved values. Prescriptions remain suggested starting values; once the user edits and taps Done (edit-slot), these defaults persist.

**Merge Rule**: `merged_value = override ?? master_default`

**RLS**: Owner CRUD (`user_id = auth.uid()`)

#### v2_user_custom_exercises
**Purpose**: User-created exercises not in master list.

**Key Fields:** Same as v2_exercises (including `is_stretch`).

**Note on target bands**: Patch D (20250101000002) added `mode`, `sets_min/max`, `reps_min/max`, `duration_sec_min/max` with prescription-style CHECK constraints, but the live schema (per generated types in `src/types/supabase.gen.ts`) does not currently include these columns. `selectExerciseTargets()` still reads bands from custom exercises when present and falls back to defaults otherwise.

**RLS**: Owner CRUD (`user_id = auth.uid()`)

#### v2_profiles
**Purpose**: User settings and preferences.

**Key Fields:**
- `id` (PRIMARY KEY, FK to auth.users)
- `first_name`, `last_name` (split from full_name in Patch; `first_name` NOT NULL enforced in 20260617120000)
- `date_of_birth`
- `experience_level`, `days_per_week`, `equipment_access[]`, `workout_days[]`
- `use_imperial`: Boolean for unit system
- `current_weight`, `goal_weight`, `height`, `gender`, `goal`, `preferred_training_style`, `avatar_url` (all nullable)
- `subscription_tier` (NOT NULL DEFAULT 'free'), `subscription_expires_at`, `revenuecat_app_user_id` (20260612120000; synced from RevenueCat webhook)
- `app_tour_completed_at`: Set when user completes or skips the post-onboarding app tour (20260618120000)
- `deleted_at`, `scheduled_purge_at`: Account soft delete (20260508000001). delete-account sets both (purge = now + 30d); Restore during the grace window sets both back to NULL. A pg_cron job (`purge-soft-deleted-accounts`, daily 03:00 UTC, 20260609000002) hard-deletes `auth.users` rows past `scheduled_purge_at`; every v2_* table cascades. Partial index `idx_v2_profiles_scheduled_purge_at` supports the purge query.

**Required for Onboarding:**
- `first_name`, `date_of_birth`, `current_weight`, `use_imperial`, `experience_level`, `days_per_week`, `equipment_access[]`

**RLS**: Owner CRUD (`id = auth.uid()`)

**Patch H Impact**: Intended to remove `goal`; live schema retains it as a nullable column

**Patch (20250101000005) Impact**:
- Removed `full_name`
- Added `first_name` (required), `last_name` (optional)
- Migration splits existing full_name on first space
- NOT NULL on `first_name` enforced in migration 20260617120000 (legacy NULL/blank rows backfilled to `'User'`)

### Planning Layer

#### v2_workout_templates
**Purpose**: Workout plan templates. Structure and intent only, never hardcoded targets.

**Key Fields:**
- `user_id` (nullable): NULL = system template, UUID = user template
- `name`: Default 'Weekly Plan'
- `is_active`: Soft delete

**RLS**: SELECT `user_id = (select auth.uid()) OR user_id IS NULL`; INSERT/UPDATE/DELETE owner only (`user_id = (select auth.uid())`)

**Security Fix (2026-05-08)**: Migration 20260508000000 split the old FOR ALL policy so system templates (user_id IS NULL) are readable but no longer writable by clients.

#### v2_template_days
**Purpose**: Days within a template.

**Key Fields:**
- `template_id` (FK to v2_workout_templates)
- `day_name`: e.g., "Monday", "Day 1"
- `sort_order`: Display order
- UNIQUE `(template_id, day_name)`

**Pattern**: Planner ensures all 7 weekdays exist (Sunday=0 to Saturday=6)

**RLS**: Via template — SELECT allows owner OR system template; writes require template ownership (20260508000000)

#### v2_template_slots
**Purpose**: Exercise slots within a day. Stores intent only, targets come from prescriptions.

**Key Fields:**
- `day_id` (FK to v2_template_days)
- `exercise_id` XOR `custom_exercise_id` (CHECK constraint enforces exactly one)
- `experience`: Optional override for prescription lookup
- `notes`: User notes
- `sort_order`: Display order within day
- `superset_group` (nullable integer, 20260609000000): Slots in the same day sharing this integer form a superset when copied to sessions
- `rest_sec` (nullable, 0-3600, 20260609000000): Per-slot rest override, copied to session exercises when materialized

**Patch C1 Impact**: Added `custom_exercise_id` + XOR constraint

**Patch H Impact**: Intended to remove `goal`; live schema retains it as a nullable column

**RLS**: Via template (transitive through days) — SELECT allows system templates; writes require ownership (20260508000000)


### Performed Truth

#### v2_workout_sessions
**Purpose**: Performed workout sessions. The truth source for what actually happened.

**Key Fields:**
- `template_id` (nullable): Source template if any
- `day_name`: Planned day label (metadata only - use timestamps for grouping)
- `status`: 'active' | 'completed' | 'abandoned'
- `started_at`, `completed_at`
- `origin` (20260723010000): 'auto' | 'manual' (default 'manual'). 'auto' marks planner-materialized sessions; a partial unique index (`uq_v2_workout_sessions_auto_per_day`) prevents duplicate auto sessions per user/day. Backlogged/manual logs use 'manual'.
- `hk_workout_uuid` (nullable, 20260510000000): Apple Health HKWorkout UUID after successful export; unique partial index prevents duplicate exports

**RLS**: Owner CRUD (`user_id = auth.uid()`)

**Indexes:**
- `idx_v2_workout_sessions_user` on (user_id, started_at)
- `uq_v2_workout_sessions_auto_per_day` — partial unique on (user_id, day_name, started_at::date) WHERE origin = 'auto'

**Important**: `day_name` is metadata. Progress tracking must group by `completed_at` timestamp, not `day_name`.

#### v2_session_exercises
**Purpose**: Exercises performed in a session.

**Key Fields:**
- `session_id` (FK to v2_workout_sessions)
- `exercise_id` XOR `custom_exercise_id` (CHECK constraint)
- `sort_order`: Order within session
- `superset_group` (nullable integer, 20260609000000): Exercises sharing this integer alternate as a superset with a shared rest timer
- `rest_sec` (nullable, 0-3600, 20260609000000): Per-exercise rest override; null falls back to set-level rest_sec, then app default

**Patch C2 Impact**: Verified/reinforced XOR constraint

**RLS**: Owner via session (transitive)

**Indexes:**
- `idx_v2_session_exercises_session` on (session_id, sort_order)

#### v2_session_sets
**Purpose**: Individual sets performed. Must have reps OR duration_sec (not both, not neither).

**Key Fields:**
- `session_exercise_id` (FK to v2_session_exercises)
- `set_number`: 1, 2, 3, ...
- `reps` (1-50) XOR `duration_sec` (5-3600) - CHECK constraints enforce
- `weight` (>= 0)
- `rpe` (0-10, widened from 1-10 in 20260510000000) XOR `rir` (0-15) - CHECK constraints enforce
- `rest_sec` (0-600)
- `set_type` (20260609000000): 'normal' | 'warmup' | 'drop' | 'failure' (NOT NULL DEFAULT 'normal'). Warm-up sets are excluded from PR and volume calculations.
- `notes`: Optional per-set notes
- `performed_at`: Timestamp when set was completed (NULL = not performed; DEFAULT dropped in 20260122000003)

**Constraints:**
- Reps/duration exclusivity: `NOT (reps IS NOT NULL AND duration_sec IS NOT NULL)`
- At least one required: `reps IS NOT NULL OR duration_sec IS NOT NULL`
- RPE/RIR exclusivity: `NOT (rpe IS NOT NULL AND rir IS NOT NULL)`
- `set_type IN ('normal', 'warmup', 'drop', 'failure')`

**RLS**: Owner via session (transitive through session_exercises)

**Indexes:**
- `idx_v2_session_sets_exercise` on (session_exercise_id, set_number)

**Prefill & Completion Semantics**:
- **Prefill**: When workout starts, sets are INSERTed with target values (weight, reps, rpe) but `performed_at = NULL`
- **In Progress**: User views defaults, adjusts RPE, taps "Complete Set"
- **Completed**: `markSetComplete()` UPDATEs the set with final values AND sets `performed_at = NOW()`
- **CRITICAL**: `performed_at` is the ONLY field that determines if a set is truly complete
- **Resume Logic**: Query `WHERE performed_at IS NOT NULL` to find completed sets
- **Continue Button**: Appears when `SUM(performed_at IS NOT NULL) > 0 AND SUM(performed_at IS NULL) > 0`

**Bug Fix (2026-01-21)**: `markSetComplete` originally only updated weight/reps/rpe but never set `performed_at`. This caused the "Continue" button to never appear after exiting mid-workout. Fixed by always setting `performed_at: new Date().toISOString()` in the UPDATE.

#### v2_user_exercise_prs
**Purpose**: PR cache, one row per (user, exercise, pr_type). Maintained by trigger `trigger_session_set_pr_upsert` on v2_session_sets (created 20260129000000).

**Key Fields:**
- `id` (PRIMARY KEY, added in 20260130000002)
- `exercise_id` XOR `custom_exercise_id` (CHECK constraint)
- `pr_type` (20260129000002): 'weight' (weight NOT NULL) | 'reps_only' (bodyweight reps) | 'timed' (duration_sec NOT NULL)
- `weight`, `reps`, `duration_sec`: PR values per type
- `set_id`, `session_exercise_id`, `session_id`, `performed_at`: Provenance of the PR set

**Trigger Logic**: On set completion (`performed_at` set), upserts the matching PR row if the new set beats the current PR (weight has priority over reps). Warm-up sets (`set_type = 'warmup'`) never register as PRs (20260609000001). Backfilled from history in 20260129000001/20260129000003.

**RLS**: Owner CRUD (`user_id = auth.uid()`)

**Indexes:**
- Unique partial: `(user_id, exercise_id, pr_type)` and `(user_id, custom_exercise_id, pr_type)`
- `idx_v2_user_exercise_prs_user_order` for leaderboard-style ordering, plus FK covering indexes (20260130000001/2)

### User Data & Logs

#### v2_weight_logs
**Purpose**: Weight log history (20260130000000). `v2_profiles.current_weight` remains the latest value for app-wide use.

**Key Fields:**
- `weight` (> 0), `recorded_at`
- `hk_sample_uuid` (nullable, 20260510000000): Apple Health HKQuantitySample UUID for bodyMass write deduplication (unique partial index)

**RLS**: Owner CRUD (`user_id = auth.uid()`)

**Indexes:** `idx_v2_weight_logs_user_recorded` on (user_id, recorded_at DESC)

#### v2_health_sync
**Purpose**: HealthKit sync ledger (20260510000000) — last successful pull/push per logical type.

**Key Fields:**
- `user_id` (PRIMARY KEY, FK to auth.users)
- `last_synced_at`, `types` (JSONB, per-category timestamps)

**RLS**: Owner CRUD (`user_id = (select auth.uid())`)

#### v2_ai_generations
**Purpose**: Audit log + rate-limit ledger for AI workout generation (20260508000002). Every `generate-workout` Edge Function call records a row to enforce a per-user daily quota and observe model usage, latency, and fallback rates.

**Key Fields:**
- `source` (CHECK, updated 20260610000000): 'openai' (OpenAI response used) | 'gemini' (legacy Gemini response) | 'fallback' (deterministic engine used) | 'error' (no result)
- `template_id` (nullable, ON DELETE SET NULL), `day_name`, `sessions_per_day`, `exercise_count`, `model`, `latency_ms`, `error_code`

**RLS**: Owner SELECT only; no INSERT/UPDATE/DELETE policies, so only the service role (used inside the Edge Function) can write.

**Indexes:** `idx_v2_ai_generations_user_created` on (user_id, created_at DESC) for the rate-limit query

#### v2_support
**Purpose**: Help & Support contact-form submissions (20260129000010).

**Key Fields:** `name`, `email`, `message`

**RLS**: Owner INSERT and SELECT only (`user_id = auth.uid()`)

**Indexes:** `idx_v2_support_user_id`, `idx_v2_support_created_at`

### Derived Caches (Optional, Rebuildable)

#### v2_muscle_freshness
**Purpose**: Muscle recovery state (0-100). Updated by Edge Function on session complete; heatmap computes current freshness on read from `last_trained_at` + decay formula so recovery shows on rest days.

**Key Fields:**
- PRIMARY KEY: `(user_id, muscle_key)`
- `freshness` (0-100): value at last Edge Function run (used as cache)
- `last_trained_at`: when this muscle was last trained (set on session complete); used with decay formula on read

**RLS**: Owner CRUD

**Status**: Edge Function `update-muscle-freshness` runs on session complete. Heatmap loads rows and uses `computeFreshnessNow(muscle_key, last_trained_at)` in `src/lib/utils/muscleFreshness.ts` (Banister decay) so the map reflects current recovery without needing another completed workout.

#### v2_daily_muscle_stress
**Purpose**: Daily muscle stress aggregation for heatmap. Rebuildable from v2_session_sets.

**Key Fields:**
- PRIMARY KEY: `(user_id, date, muscle_key)`
- `stress`: Accumulated stress value

**RLS**: Owner CRUD

**Indexes:**
- `idx_v2_daily_muscle_stress_user_date` on (user_id, date)

**Status**: Table exists but no rebuild job implemented. Dashboard/heatmap compute stress on-demand via `getMuscleStressStats()`.

## RLS Policies Summary

### Immutable Tables (Auth SELECT Only)
- `v2_muscles`: `USING (true)` for authenticated
- `v2_exercises`: `USING (true)` for authenticated
- `v2_exercise_prescriptions`: `USING (true)` for authenticated
- `v2_ai_recommended_exercises`: `USING (true)` for authenticated

### User-Owned Tables (Direct Ownership)
- `v2_profiles`: `USING (id = auth.uid())`
- `v2_user_exercise_overrides`: `USING (user_id = auth.uid())`
- `v2_user_custom_exercises`: `USING (user_id = auth.uid())`
- `v2_workout_sessions`: `USING (user_id = auth.uid())`
- `v2_muscle_freshness`: `USING (user_id = auth.uid())`
- `v2_daily_muscle_stress`: `USING (user_id = auth.uid())`
- `v2_user_exercise_prs`: `USING (user_id = auth.uid())`
- `v2_weight_logs`: `USING (user_id = auth.uid())`
- `v2_health_sync`: `USING (user_id = auth.uid())`

### Restricted-Write Tables
- `v2_ai_generations`: Owner SELECT only; writes via service role (Edge Function) only
- `v2_support`: Owner INSERT and SELECT only (no UPDATE/DELETE)

### User-Owned Tables (Transitive Ownership)

Since 20260508000000, template-family policies are split per operation: SELECT allows owner OR system (user_id IS NULL); INSERT/UPDATE/DELETE require ownership.

**v2_workout_templates**:
```sql
-- SELECT
USING (user_id = (select auth.uid()) OR user_id IS NULL)
-- INSERT/UPDATE/DELETE
USING (user_id = (select auth.uid()))
```

**v2_template_days** (via template; SELECT shown, writes require template ownership):
```sql
USING (
  EXISTS (
    SELECT 1 FROM v2_workout_templates
    WHERE id = template_days.template_id
    AND (user_id = (select auth.uid()) OR user_id IS NULL)
  )
)
```

**v2_template_slots** (via template through days; SELECT shown, writes require template ownership):
```sql
USING (
  EXISTS (
    SELECT 1 FROM v2_template_days
    JOIN v2_workout_templates ON templates.id = days.template_id
    WHERE days.id = slots.day_id
    AND (templates.user_id = (select auth.uid()) OR templates.user_id IS NULL)
  )
)
```

**v2_session_exercises** (via session):
```sql
USING (
  EXISTS (
    SELECT 1 FROM v2_workout_sessions
    WHERE id = session_exercises.session_id
    AND user_id = auth.uid()
  )
)
```

**v2_session_sets** (via session through exercises):
```sql
USING (
  EXISTS (
    SELECT 1 FROM v2_session_exercises
    JOIN v2_workout_sessions ON sessions.id = exercises.session_id
    WHERE exercises.id = sets.session_exercise_id
    AND sessions.user_id = auth.uid()
  )
)
```

### Anon Role Lockdown (2026-06-09)
Migration 20260609000003 revokes all `anon` grants on every v2_* table (and sets default privileges so future tables are not anon-granted). All app queries run as `authenticated` behind RLS. It also revokes EXECUTE on trigger functions (`handle_new_user`, `trigger_upsert_exercise_pr`) from public/anon/authenticated and pins `search_path` on SECURITY DEFINER functions.

## Seeding Required Data

### Critical: v2_muscles
Run migration `20250101000004_seed_v2_muscles.sql` to insert 28 canonical muscles, then `20260611120002_add_adductors_muscle_key.sql` for the 29th (adductors).

**Idempotent**: Uses `ON CONFLICT (key) DO NOTHING` so safe to re-run.

**Required for:**
- Exercise metadata validation
- Heatmap display
- Muscle coverage analysis

### Optional: Exercises and Prescriptions
For app to function, need at a minimum:
- Sample exercises in `v2_exercises`
- Prescriptions for those exercises in `v2_exercise_prescriptions`
- AI recommendations in `v2_ai_recommended_exercises` (if using AI generation)

**Without prescriptions**: Planner will show "Missing targets" and exclude exercises from AI generation.

### Exercise Metadata Seeding (2026-01-28)
Migration `20260128000000_seed_exercise_metadata.sql` fills missing fields in `v2_exercises`:
- **description**: Exercise descriptions and form cues based on biomechanics best practices
- **secondary_muscles**: Secondary muscles involved (complementary to `implicit_hits` weighted coefficients)
- **equipment_needed**: Required equipment arrays (empty array = bodyweight exercises)
- **movement_pattern**: Classification using NSCA framework (push, pull, squat, hinge, lunge, carry, rotation, anti-rotation)
- **tempo_category**: Tempo classification (explosive, controlled, isometric) based on ACSM guidelines

**Data Sources**: 
- EMG research and biomechanics literature for muscle activation patterns
- NSCA movement pattern classification system
- ACSM tempo guidelines for repetition duration
- Exercise form best practices from strength training literature

**Coverage**: All exercises referenced in prescriptions migration (40+ exercises) had complete metadata seeded; superseded for most rows by the 2026-06-11 master import below.

### AI Recommended Exercises Seeding (2026-01-28)
Migration `20260128000001_seed_ai_recommended_exercises.sql` seeds `v2_ai_recommended_exercises`:
- **Priority Order**: Based on exercise hierarchy (compound movements first, isolation last)
  - Tier 1 (1-10): Foundational compounds (Squat, Deadlift, Bench Press, etc.)
  - Tier 2 (11-20): Secondary compounds (Incline Press, Hip Thrust, etc.)
  - Tier 3 (21-30): Assistance/accessory compounds
  - Tier 4 (31-40): Isolation exercises
  - Tier 5 (41+): Core/stability exercises
- **Notes**: Exercise descriptions and programming rationale for each exercise
- **Coverage**: All exercises with active prescriptions are eligible for AI generation

### Prescription Source Notes Seeding (2026-01-28)
Migration `20260128000002_seed_prescription_source_notes.sql` fills `source_notes` in `v2_exercise_prescriptions`:
- **Purpose**: Explains prescription rationale and target band sources
- **Content**: Research-backed notes about why specific rep/set ranges are recommended
- **Examples**: 
  - Beginner hypertrophy: "8-12 reps optimize muscle growth for novices"
  - Advanced hypertrophy: "5-8 reps emphasize strength-endurance"
  - Isometric targets: Explains time-under-tension principles
- **Coverage**: All prescriptions as of 2026-01-28 have source notes; rule-based prescriptions added 2026-06-11 do not set source_notes

### Master Exercise Import (2026-06-11)
Migration `20260611120000_import_master_exercises_from_csv.sql` (auto-generated from `supabase/seed/master_exercises_and_stretches_expanded_advanced.csv`) brings `v2_exercises` to **388 exercises** (45 updates to existing rows, 343 inserts; 340 strength + 48 stretches). Follow-up migrations in the same batch:
- `20260611120001`: Adds `is_stretch` to v2_exercises
- `20260611120002`: Adds `adductors` muscle key (29 canonical muscles)
- `20260611120003`: Rule-based prescriptions for all new exercises (stretch timed holds, timed strength, rep bands tiered by density_score)
- `20260611120004`: Refreshes the AI allow-list (non-stretch exercises with mode-matching prescriptions, priority by density_score; stretches deactivated)

## Type Generation

After schema changes:
```bash
npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.gen.ts
```

**Current Status**: `src/types/supabase.gen.ts` is generated from the live database and reflects the current schema. Regenerate after every applied migration to prevent drift.

## Schema Evolution Patterns

### Adding Nullable Column
```sql
ALTER TABLE v2_table ADD COLUMN IF NOT EXISTS new_column type;
```

### Adding Non-Null Column with Backfill
```sql
-- Step 1: Add as nullable
ALTER TABLE v2_table ADD COLUMN IF NOT EXISTS new_column type;

-- Step 2: Backfill existing rows
UPDATE v2_table SET new_column = default_value WHERE new_column IS NULL;

-- Step 3: Add constraint
ALTER TABLE v2_table ADD CONSTRAINT constraint_name CHECK (new_column IS NOT NULL);
```

### Removing Column (Safe)
```sql
ALTER TABLE v2_table DROP COLUMN IF EXISTS old_column;
```

### Idempotent Constraint Addition
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constraint_name') THEN
    ALTER TABLE v2_table ADD CONSTRAINT constraint_name CHECK (...);
  END IF;
END $$;
```

## Common Queries

### Find User's Active Session
```sql
SELECT * FROM v2_workout_sessions
WHERE user_id = auth.uid()
AND status = 'active'
ORDER BY started_at DESC
LIMIT 1;
```

### Get Template with Days and Slots
```sql
SELECT t.*, d.*, s.*
FROM v2_workout_templates t
LEFT JOIN v2_template_days d ON d.template_id = t.id
LEFT JOIN v2_template_slots s ON s.day_id = d.id
WHERE t.id = $1
ORDER BY d.sort_order, s.sort_order;
```

### Get Completed Sessions in Range
```sql
SELECT * FROM v2_workout_sessions
WHERE user_id = auth.uid()
AND status = 'completed'
AND completed_at >= $1
AND completed_at < $2
ORDER BY completed_at DESC;
```

### Get Exercise History (with XOR handling)
```sql
SELECT se.*, ss.*
FROM v2_session_exercises se
JOIN v2_session_sets ss ON ss.session_exercise_id = se.id
JOIN v2_workout_sessions ws ON ws.id = se.session_id
WHERE ws.user_id = auth.uid()
AND ws.status = 'completed'
AND (
  (se.exercise_id = $1 AND se.custom_exercise_id IS NULL) OR
  (se.custom_exercise_id = $1 AND se.exercise_id IS NULL)
)
ORDER BY ws.completed_at DESC, ss.set_number ASC
LIMIT 100;
```

## Performance Considerations

### Indexes Created
Base migration and later migrations create indexes for:
- **Foreign keys**: Every FK column has a covering index (FK column as leftmost column). Migrations `20260130000001_add_fk_covering_indexes.sql` and `20260130000002_add_remaining_fk_indexes_and_prs_pk.sql` add indexes for all FKs (e.g. `v2_user_exercise_prs` session_exercise_id, session_id, set_id, exercise_id, custom_exercise_id; `v2_daily_muscle_stress`/`v2_muscle_freshness` muscle_key; `v2_template_slots` custom_exercise_id; `v2_user_exercise_overrides` exercise_id). Improves JOIN and CASCADE performance.
- Query-heavy columns (user_id, started_at, completed_at)
- Composite indexes for complex lookups (e.g. prescription lookup, session_exercises by session_id + sort_order)

### RLS Policy Performance
- **auth.uid() in policies**: Use `(select auth.uid())` so PostgreSQL evaluates it once (InitPlan) instead of per row. Migration `20260130000003_rls_auth_uid_initplan.sql` applies this to all owner policies; avoids "Auth RLS Initialization Plan" linter warning.
- Policies use indexed columns (user_id, id)
- Transitive policies may be slower (nested EXISTS queries)
- Consider materialized user-permission views for complex policies (future optimization)

### Query Optimization Tips
- Use bulk queries (`.in()`) instead of loops
- Fetch related data in one query where possible
- Use indexes in WHERE clauses
- Avoid SELECT * in production (but okay for small tables)

## Conventions for new tables and migrations

When adding new tables or RLS policies, follow these so the Supabase linter and advisor do not flag performance issues:

1. **Primary key**: Every table must have a primary key (surrogate `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` or a composite PK). Tables without a PK are inefficient at scale and trigger the "No Primary Key" linter warning.
2. **Foreign key covering index**: For every `REFERENCES` column, create an index where that column is the **leftmost** column (e.g. `CREATE INDEX idx_tablename_fk_col ON tablename(fk_col);`). Composite indexes (e.g. `(user_id, exercise_id)`) only "cover" the first column for the FK on that column. If the FK is the second column, add a separate single-column index. This avoids "Unindexed foreign keys" and improves JOIN/CASCADE performance.
3. **RLS and auth.uid()**: In policy expressions use `(select auth.uid())` instead of `auth.uid()` so PostgreSQL evaluates it once (InitPlan) instead of per row. Example: `USING (user_id = (select auth.uid()))`. Avoids "Auth RLS Initialization Plan" performance warning.

**Check before merging**: Run the Supabase database linter (Dashboard → Database → Linter / Advisor) and fix any reported issues, or add a migration that addresses them.

## Database Maintenance

### Regular Tasks
- Monitor RLS policy performance
- Check for slow queries
- Vacuum tables periodically
- Update table statistics

### Monitoring
- Watch for RLS policy violations (auth errors in logs)
- Monitor query performance (Supabase dashboard)
- Track database size growth
- Check index usage

### Backup Strategy
- Supabase automatic backups (check your plan)
- Export schema regularly (migrations are version controlled)
- Test restore procedures

## Troubleshooting

### RLS Issues
**Symptom**: Queries return empty even though data exists  
**Check**: Is RLS enabled? Do policies match user context?  
**Debug**: Check `auth.uid()` value, test policy with service_role  

### Constraint Violations
**Symptom**: INSERT/UPDATE fails with CHECK constraint error  
**Check**: Validate data before insert, check constraint definition  
**Debug**: Read error message for constraint name, check table definition  

### Performance Degradation
**Symptom**: Queries slow down over time  
**Check**: Missing indexes? RLS policy doing table scans?  
**Debug**: Use EXPLAIN ANALYZE, check slow query logs  

### Type Drift
**Symptom**: TypeScript types don't match database schema  
**Check**: When was `src/types/supabase.gen.ts` last generated?  
**Fix**: Regenerate types after schema changes
