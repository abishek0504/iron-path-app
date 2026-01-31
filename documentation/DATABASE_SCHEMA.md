# Database Schema

**Purpose**: Document database structure, migrations, and RLS policies.

## Migration Order

Apply migrations in this exact order:

1. **20240101000000_create_v2_tables.sql** - Creates all v2_* tables with base schema
2. **20240101000001_create_v2_rls_policies.sql** - Enables RLS and creates policies
3. **20250101000000_patch_c1_template_slots_custom_exercise_id.sql** - Adds custom_exercise_id to template slots
4. **20250101000001_patch_c2_session_exercises_custom_exercise_id.sql** - Verifies/adds custom_exercise_id to session exercises
5. **20250101000002_patch_d_custom_exercise_targets.sql** - Adds target band fields to custom exercises
6. **20250101000003_patch_h_remove_goal.sql** - Removes goal from profiles/prescriptions/slots
7. **20250101000004_seed_v2_muscles.sql** - Seeds 28 canonical muscles
8. **20250101000005_split_full_name.sql** - Splits full_name into first_name/last_name
9. **20260122000001_refine_implicit_hits.sql** - Updates implicit_hits to weighted coefficients (40+ exercises)
10. **20260122000002_seed_exercise_prescriptions.sql** - Seeds exercise prescriptions for all exercises
11. **20260122000004_add_suggested_weights.sql** - Adds suggested_weight_lbs/kg to prescriptions (45 exercises)
12. **20260128000000_seed_exercise_metadata.sql** - Seeds description, secondary_muscles, equipment_needed, movement_pattern, tempo_category
13. **20260128000001_seed_ai_recommended_exercises.sql** - Seeds AI allow-list with priority_order and notes (all exercises with prescriptions)
14. **20260128000002_seed_prescription_source_notes.sql** - Seeds source_notes explaining prescription rationale
15. **20260128000003_add_bw_multiplier_prescriptions.sql** - Adds suggested_weight_multiplier_bw (bodyweight-based default; no NULLs)
16. **20260130000001_add_fk_covering_indexes.sql** - Adds covering indexes for FK columns that lacked them (v2_user_exercise_prs, v2_workout_templates, v2_template_slots, v2_workout_sessions, v2_session_exercises); improves JOIN and CASCADE performance
17. **20260130000002_add_remaining_fk_indexes_and_prs_pk.sql** - Adds covering indexes for remaining FKs (muscle_key on v2_daily_muscle_stress/v2_muscle_freshness, custom_exercise_id on v2_template_slots, exercise_id on v2_user_exercise_overrides/v2_user_exercise_prs, custom_exercise_id on v2_user_exercise_prs); adds id PRIMARY KEY to v2_user_exercise_prs
18. **20260130000003_rls_auth_uid_initplan.sql** - RLS: replace `auth.uid()` with `(select auth.uid())` in all owner policies so PostgreSQL evaluates once (InitPlan) instead of per row; fixes "Auth RLS Initialization Plan" performance warning

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

v2_profiles (user settings)

v2_workout_templates (planning)
  └→ v2_template_days
      └→ v2_template_slots

v2_workout_sessions (performed truth)
  └→ v2_session_exercises
      └→ v2_session_sets

v2_muscle_freshness, v2_daily_muscle_stress (derived caches)
```

## Core Tables

### Canonical Reference

#### v2_muscles
**Purpose**: Single source of truth for muscle keys. All muscle references validate against this.

**28 Muscles Organized by Functional Groups:**
- **Upper Body Push** (7): chest, upper_chest, lower_chest, anterior_deltoids, lateral_deltoids, posterior_deltoids, triceps
- **Upper Body Pull** (6): lats, upper_back, lower_back, traps, biceps, forearms
- **Core** (2): abs, obliques
- **Lower Body Front** (2): quads, hip_flexors
- **Lower Body Back** (4): hamstrings, glutes, calves, soleus
- **Stabilizers** (7): rotator_cuff, serratus_anterior, transverse_abdominis, glute_medius, glute_minimus, piriformis, tibialis_anterior

**Philosophy**: Focus on functionally distinct muscle groups for compound movements (not individual muscle heads unless functionally different like upper/lower chest for incline/decline variations).

**RLS**: Auth SELECT only (immutable from client)

#### v2_exercises
**Purpose**: Master exercise list, immutable from client.

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
- `exercise_id`, `experience`, `mode` - UNIQUE key (goal removed in Patch H)
- `sets_min/max` (1-10)
- `reps_min/max` (1-50, only if mode='reps')
- `duration_sec_min/max` (5-3600, only if mode='timed')
- `suggested_weight_multiplier_bw`: **Bodyweight multiplier for suggested weight (no NULLs).** suggested_weight = current_weight × this. Single default per exercise/experience (no ranges). Represents **working weight** for the prescribed rep range (not 1RM). Research, rationale, and guidelines for all multipliers and for adding new exercises: see [PRESCRIPTION_RATIONALE.md](PRESCRIPTION_RATIONALE.md). Seeded in 20260128000003.
- `suggested_weight_lbs/kg`: Legacy fixed weights (nullable); runtime prefers multiplier × profile.current_weight with fallback 150 lb / 70 kg.
- `source_notes`: Research-backed notes explaining prescription rationale (seeded 2026-01-28)

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
- Custom exercises do not use this table; they use their own target bands from `v2_user_custom_exercises` (sets_min/max, reps_min/max, duration_sec_min/max).

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
- Removed `goal` column
- Consolidated duplicates (preferred hypertrophy if existed)
- New unique key: `(exercise_id, experience, mode)`

#### v2_ai_recommended_exercises
**Purpose**: AI allow-list. Only exercises in this table can be selected by AI generation.

**Key Fields:**
- `exercise_id` (PRIMARY KEY, FK to v2_exercises)
- `priority_order`: Lower = higher priority in selection (1 = highest priority)
  - **Priority Tiers**: 1-10 (foundational compounds), 11-20 (secondary compounds), 21-30 (assistance), 31-40 (isolation), 41+ (core/stability)
  - Based on exercise hierarchy: compound movements prioritized over isolation exercises
- `notes`: Exercise description and programming rationale (seeded 2026-01-28)
- `is_active`: Soft delete flag

**Seeding**: All exercises with active prescriptions are automatically added to AI allow-list (migration 20260128000001)

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

**Key Fields:** Same as v2_exercises PLUS target band fields (added in Patch D):
- `mode` (reps | timed)
- `sets_min/max`, `reps_min/max`, `duration_sec_min/max`

**Constraints:** Same as v2_exercise_prescriptions (mode-gated target bands)

**RLS**: Owner CRUD (`user_id = auth.uid()`)

**Patch D Impact:**
- Added target band fields
- Backfilled existing rows with mode='reps', 3-4 sets, 8-12 reps
- Added CHECK constraints matching prescription constraints

#### v2_profiles
**Purpose**: User settings and preferences.

**Key Fields:**
- `id` (PRIMARY KEY, FK to auth.users)
- `first_name`, `last_name` (split from full_name in Patch)
- `date_of_birth`, `age` (deprecated - calculate from DOB)
- `experience_level`, `days_per_week`, `equipment_access[]`
- `use_imperial`: Boolean for unit system

**Required for Onboarding:**
- `first_name`, `date_of_birth`, `current_weight`, `use_imperial`, `experience_level`, `days_per_week`, `equipment_access[]`

**RLS**: Owner CRUD (`id = auth.uid()`)

**Patch H Impact**: Removed `goal` column

**Patch (20250101000005) Impact**:
- Removed `full_name`
- Added `first_name` (required), `last_name` (optional)
- Migration splits existing full_name on first space

### Planning Layer

#### v2_workout_templates
**Purpose**: Workout plan templates. Structure and intent only, never hardcoded targets.

**Key Fields:**
- `user_id` (nullable): NULL = system template, UUID = user template
- `name`: Default 'Weekly Plan'
- `is_active`: Soft delete

**RLS**: `user_id = auth.uid() OR user_id IS NULL`

**Security Risk**: Current RLS allows clients to write to system templates (user_id IS NULL). Consider tightening.

#### v2_template_days
**Purpose**: Days within a template.

**Key Fields:**
- `template_id` (FK to v2_workout_templates)
- `day_name`: e.g., "Monday", "Day 1"
- `sort_order`: Display order
- UNIQUE `(template_id, day_name)`

**Pattern**: Planner ensures all 7 weekdays exist (Sunday=0 to Saturday=6)

**RLS**: Owner via template (`template.user_id = auth.uid() OR template.user_id IS NULL`)

#### v2_template_slots
**Purpose**: Exercise slots within a day. Stores intent only, targets come from prescriptions.

**Key Fields:**
- `day_id` (FK to v2_template_days)
- `exercise_id` XOR `custom_exercise_id` (CHECK constraint enforces exactly one)
- `experience`: Optional override for prescription lookup
- `notes`: User notes
- `sort_order`: Display order within day

**Patch C1 Impact**: Added `custom_exercise_id` + XOR constraint

**Patch H Impact**: Removed `goal` field

**RLS**: Owner via template (transitive through days)


### Performed Truth

#### v2_workout_sessions
**Purpose**: Performed workout sessions. The truth source for what actually happened.

**Key Fields:**
- `template_id` (nullable): Source template if any
- `day_name`: Planned day label (metadata only - use timestamps for grouping)
- `status`: 'active' | 'completed' | 'abandoned'
- `started_at`, `completed_at`

**RLS**: Owner CRUD (`user_id = auth.uid()`)

**Indexes:**
- `idx_v2_workout_sessions_user` on (user_id, started_at)

**Important**: `day_name` is metadata. Progress tracking must group by `completed_at` timestamp, not `day_name`.

#### v2_session_exercises
**Purpose**: Exercises performed in a session.

**Key Fields:**
- `session_id` (FK to v2_workout_sessions)
- `exercise_id` XOR `custom_exercise_id` (CHECK constraint)
- `sort_order`: Order within session

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
- `rpe` (1-10) XOR `rir` - CHECK constraints enforce
- `rest_sec` (0-600)
- `performed_at`: Timestamp when set was completed (NULL = not performed)

**Constraints:**
- Reps/duration exclusivity: `NOT (reps IS NOT NULL AND duration_sec IS NOT NULL)`
- At least one required: `reps IS NOT NULL OR duration_sec IS NOT NULL`
- RPE/RIR exclusivity: `NOT (rpe IS NOT NULL AND rir IS NOT NULL)`

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

### Derived Caches (Optional, Rebuildable)

#### v2_muscle_freshness
**Purpose**: Muscle recovery state (0-100). Rebuildable from v2_session_sets.

**Key Fields:**
- PRIMARY KEY: `(user_id, muscle_key)`
- `freshness` (0-100): 0 = fully fatigued, 100 = fully recovered
- `last_trained_at`

**RLS**: Owner CRUD

**Status**: Table exists but no rebuild job implemented yet. Engine uses direct session analysis instead.

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

### User-Owned Tables (Transitive Ownership)

**v2_workout_templates**:
```sql
USING (user_id = auth.uid() OR user_id IS NULL)
-- ⚠️ Risk: Allows writes to system templates
```

**v2_template_days** (via template):
```sql
USING (
  EXISTS (
    SELECT 1 FROM v2_workout_templates
    WHERE id = template_days.template_id
    AND (user_id = auth.uid() OR user_id IS NULL)
  )
)
```

**v2_template_slots** (via template through days):
```sql
USING (
  EXISTS (
    SELECT 1 FROM v2_template_days
    JOIN v2_workout_templates ON templates.id = days.template_id
    WHERE days.id = slots.day_id
    AND (templates.user_id = auth.uid() OR templates.user_id IS NULL)
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

## Seeding Required Data

### Critical: v2_muscles
Run migration `20250101000004_seed_v2_muscles.sql` to insert 28 canonical muscles.

**Idempotent**: Uses `ON CONFLICT (key) DO NOTHING` so safe to re-run.

**Required for:**
- Exercise metadata validation
- Heatmap display
- Rebalance detection
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

**Coverage**: All exercises referenced in prescriptions migration (40+ exercises) have complete metadata seeded.

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
- **Coverage**: All prescriptions have source notes explaining programming decisions

## Type Generation

After schema changes:
```bash
npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
```

**Current Status**: `src/types/supabase.ts` is placeholder. Query modules use hand-typed interfaces. Consider generating types to prevent drift.

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
**Check**: When was `src/types/supabase.ts` last generated?  
**Fix**: Regenerate types after schema changes
