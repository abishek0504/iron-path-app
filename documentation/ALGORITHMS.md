# Algorithms

**Purpose**: Document mathematical formulas and algorithms with worked examples.

## Target Selection Algorithm

**Location**: `src/lib/engine/targetSelection.ts`

### Purpose
Select workout targets for an exercise using prescription bands with progressive overload. Never invent generic defaults.

### Inputs
- `exerciseRef`: `{ exerciseId? | customExerciseId? }` (XOR constraint)
- `userId`: User ID for history lookup
- `context`: `{ experience }` for prescription lookup
- `historyCount`: Number of previous sessions (affects default selection)

### Algorithm Steps

**1. Fetch Merged Exercise** (determines mode)
```
exercise = getMergedExercise(exerciseRef, userId)
mode = exercise.is_timed ? 'timed' : 'reps'
```

**2. Fetch Prescription or Custom Bands**
```
if (exercise.source === 'custom'):
  prescription = exercise's own target bands (sets_min/max, reps_min/max, duration_sec_min/max)
else:
  prescription = getExercisePrescription(exerciseId, experience, mode)

if (!prescription):
  return null  // Data error - exclude from generation
```

**3. Get Exercise History** (for progressive overload)
```
history = getExerciseHistory(exerciseKey, userId, limit=5)
hasHistory = history.sets.length > 0
```

**4. Select Sets Within Band**
```
if (historyCount < 3):  // New user
  sets = floor((sets_min + sets_max) / 2)
else:  // Experienced
  sets = ceil((sets_min + sets_max) / 2)

sets = clamp(sets, sets_min, sets_max)
```

**5. Select Reps or Duration with Progressive Overload**

**Reps Mode:**
```
if (hasHistory AND lastReps >= reps_max * 0.9 AND avgRPE <= 7):
  // Hit top of band with acceptable effort → increase weight
  weight = lastWeight + max(lastWeight * 0.025, 2.5)
  reps = reps_min  // Reset to bottom of band
else if (hasHistory):
  // Increase reps toward top
  reps = min(lastReps + 1, reps_max)
  weight = lastWeight
else:
  // No history: use default selection (mid-range)
  reps = historyCount < 3 ? floor((reps_min + reps_max) / 2) : ceil((reps_min + reps_max) / 2)
  reps = clamp(reps, reps_min, reps_max)
```

**Timed Mode:**
```
if (hasHistory):
  // Increase duration toward top
  duration_sec = min(lastDuration + 5, duration_sec_max)
else:
  // No history: use default selection
  duration_sec = historyCount < 3 ? floor((min + max) / 2) : ceil((min + max) / 2)

duration_sec = clamp(duration_sec, duration_sec_min, duration_sec_max)
```

**6. Return Target**
```
return {
  exercise_id: exerciseKey,
  sets,
  reps or duration_sec (depending on mode),
  weight (if reps mode with progressive overload),
  mode
}
```

### Worked Examples

**Example 1: Bench Press (Reps, Intermediate, First Time)**
```
Input:
  - Exercise: Bench Press (reps mode)
  - Experience: intermediate
  - Prescription: sets_min=3, sets_max=4, reps_min=8, reps_max=12
  - historyCount: 0 (no sessions yet)
  - hasHistory: false

Calculation:
  sets = floor((3 + 4) / 2) = floor(3.5) = 3
  reps = floor((8 + 12) / 2) = floor(10) = 10

Output: { exercise_id, sets: 3, reps: 10, mode: 'reps' }
```

**Example 2: Bench Press (After Progress)**
```
Input:
  - Same exercise, prescription
  - historyCount: 5 (experienced)
  - hasHistory: true
  - lastReps: 12 (hit top of band)
  - lastWeight: 135 lbs
  - avgRPE: 7 (acceptable effort)

Check: lastReps (12) >= reps_max * 0.9 (10.8)? YES
Check: avgRPE (7) <= 7? YES

Calculation:
  weight = 135 + max(135 * 0.025, 2.5) = 135 + max(3.375, 2.5) = 138.375
  reps = reps_min = 8 (reset to bottom)

Output: { exercise_id, sets: 4, reps: 8, weight: 138.375, mode: 'reps' }
```

**Example 3: Plank (Timed, Beginner, First Time)**
```
Input:
  - Exercise: Plank (timed mode)
  - Experience: beginner
  - Prescription: sets_min=3, sets_max=3, duration_sec_min=30, duration_sec_max=60
  - historyCount: 0
  - hasHistory: false

Calculation:
  sets = floor((3 + 3) / 2) = 3
  duration_sec = floor((30 + 60) / 2) = 45

Output: { exercise_id, sets: 3, duration_sec: 45, mode: 'timed' }
```

**Example 4: Plank (After Progress)**
```
Input:
  - Same exercise
  - historyCount: 3
  - hasHistory: true
  - lastDuration: 50 seconds

Calculation:
  duration_sec = min(50 + 5, 60) = 55
  duration_sec = clamp(55, 30, 60) = 55

Output: { exercise_id, sets: 3, duration_sec: 55, mode: 'timed' }
```

### Suggested Weight and Progression Rationale

**Full rationale, research, and guidelines**: See [PRESCRIPTION_RATIONALE.md](PRESCRIPTION_RATIONALE.md).

**Suggested weight (no history):**
```
weight = round(bw × suggested_weight_multiplier_bw × 2) / 2
```
- `bw` = user's current_weight from profile, or fallback 150 lb / 70 kg.
- Multiplier = **working weight** as fraction of BW for the prescribed rep range (not 1RM). Bodyweight-only exercises use 0.

**Weight progression (with history, when user hits top of rep band at acceptable RPE):**
```
weight = lastWeight + max(lastWeight × 0.025, 2.5)
```
- Minimum increase 2.5 lb; otherwise 2.5% of last weight. Rounded to nearest 0.5. Aligns with evidence-based 2–10% load progression (ACSM, NASM).

**Duration progression (timed):** `duration_sec = min(lastDuration + 5, duration_sec_max)`.

## Fatigue Model (Stress Calculation)

**Location**: `src/lib/supabase/queries/workouts.ts` (`getMuscleStressStats`)

### Purpose
Calculate muscle stress from performed sets using effort signal and muscle weighting.

### Constants
- `DEFAULT_STIMULUS = 0.6`: Fallback when RPE/RIR missing
- `RPE_THRESHOLD = 5`: RPE values below this contribute zero stress

### Per-Set Stimulus Calculation

**If RPE exists:**
```
stimulus = clamp((rpe - 5) / 5, 0, 1)

Examples:
  RPE 1-5: stimulus = 0 (too easy to count)
  RPE 7: stimulus = (7-5)/5 = 0.4
  RPE 8: stimulus = (8-5)/5 = 0.6
  RPE 10: stimulus = (10-5)/5 = 1.0
```

**Else if RIR exists:**
```
rpe_est = clamp(10 - rir, 1, 10)
stimulus = clamp((rpe_est - 5) / 5, 0, 1)

Examples:
  RIR 3: rpe_est = 7, stimulus = 0.4
  RIR 0: rpe_est = 10, stimulus = 1.0
```

**Else (no effort signal):**
```
stimulus = DEFAULT_STIMULUS = 0.6
// Log warning once per session
```

### Muscle Weighting

**Build raw weights:**
```
for each muscle m in primary_muscles:
  w_m = 1.0

for each muscle m in implicit_hits:
  w_m = implicit_hits[m]  // 0-1 value from exercise metadata
```

**Normalize to sum = 1:**
```
W = Σ w_m (sum of all weights)
p_m = w_m / W (normalized weight per muscle)
```

### Stress Accumulation

**Per set:**
```
for each muscle m:
  muscle_stress[m] += stimulus * p_m
```

**Aggregation (per date):**
```
daily_muscle_stress[user, date, m] = Σ muscle_stress[m] across all sets that date
```

### Worked Example

**Exercise: Bench Press**
```
primary_muscles: ["chest", "triceps", "anterior_deltoids"]
implicit_hits: { "core": 0.3, "lats": 0.2 }
```

**Performed: 3 sets @ RPE 8**

**Step 1: Calculate stimulus**
```
RPE = 8
stimulus = (8 - 5) / 5 = 0.6
```

**Step 2: Build muscle weights**
```
chest: 1.0
triceps: 1.0
anterior_deltoids: 1.0
core: 0.3
lats: 0.2

W = 1.0 + 1.0 + 1.0 + 0.3 + 0.2 = 3.5
```

**Step 3: Normalize**
```
p_chest = 1.0 / 3.5 = 0.286
p_triceps = 1.0 / 3.5 = 0.286
p_anterior_deltoids = 1.0 / 3.5 = 0.286
p_core = 0.3 / 3.5 = 0.086
p_lats = 0.2 / 3.5 = 0.057
```

**Step 4: Accumulate stress (3 sets)**
```
stress_chest = 3 * 0.6 * 0.286 = 0.515
stress_triceps = 3 * 0.6 * 0.286 = 0.515
stress_anterior_deltoids = 3 * 0.6 * 0.286 = 0.515
stress_core = 3 * 0.6 * 0.086 = 0.155
stress_lats = 3 * 0.6 * 0.057 = 0.103
```

### 2.2 Advanced Fatigue Modeling: Continuous Decay (Banister Model)

**Location**: `supabase/functions/update-muscle-freshness/index.ts`

The previous 48-hour hard lookback was a static proxy that failed to account for the magnitude of systemic fatigue or non-linear recovery curves. To align with biomechanical reality, we are migrating to a modified Banister Impulse-Response model.

**Mathematical Formulation:**
```
Fatigue(t) = Fatigue₀ × e^(-λ × t)
```

Where:
* `Fatigue₀`: Normalized fatigue (0-100) at end of last session
* `t`: Hours since last session
* `λ`: Decay constant specific to muscle group size and CNS demand

**Decay Constants (λ):**
* **Slow Recovery** (λ=0.020, Half-life ~35h): Lower Back (Erectors), Hamstrings
* **Medium Recovery** (λ=0.041, Half-life ~17h): Chest, Quads, Lats, Glutes, Upper Back, Traps, Core
* **Fast Recovery** (λ=0.099, Half-life ~7h): Deltoids, Biceps, Triceps, Calves, Forearms
* **Stabilizers** (λ=0.060, Half-life ~12h): Rotator Cuff, Serratus, Deep Core, Glute Med/Min

**Implementation:**
- Triggered automatically when a workout session is marked as 'completed'
- Edge Function calculates stress per muscle using existing stress calculation logic
- For muscles hit in session: `freshness = 0` (fully fatigued)
- For all other muscles: Apply decay formula based on hours elapsed since last trained
- Updates `v2_muscle_freshness` table with new freshness values (0-100)

**Example Calculation:**
```
Chest muscle last trained 24 hours ago with initial fatigue = 100 (0% fresh)
λ = 0.041 (medium recovery)
t = 24 hours

Fatigue(24) = 100 × e^(-0.041 × 24)
           = 100 × e^(-0.984)
           = 100 × 0.374
           = 37.4

Freshness = 100 - 37.4 = 62.6% recovered
```

**Heatmap: compute freshness on read**

**Location**: `src/lib/utils/muscleFreshness.ts`, `src/components/workout/WorkoutHeatmap.tsx`

The heatmap shows current recovery (0–100) per muscle. So that recovery updates on rest days (without completing another workout), freshness is **computed on read** from `last_trained_at` using the same decay formula:

- Load rows from `v2_muscle_freshness` (muscle_key, last_trained_at).
- For each row: `freshness_now = computeFreshnessNow(muscle_key, last_trained_at)`.
- Formula: at `last_trained_at`, fatigue = 100 (freshness 0). Fatigue(t) = 100 × e^(-λ × t), Freshness(t) = 100 - Fatigue(t). λ from `MUSCLE_DECAY_LAMBDA` (matches Edge Function).

So the heatmap reflects current recovery even when the user has not completed a workout since the last one; no scheduled job is required.

### Auto-Regulation Data Input

**Location**: `src/components/workout/RPESlider.tsx`

Text entry for RPE is high-friction and prone to user error. We replace this with a visual slider that provides qualitative feedback, ensuring consistent data for the auto-regulation engine.

**Visual Feedback:** Slider positions map to text labels:
- RPE 1-5: "Warmup" (Green zone - too easy to count for stress)
- RPE 6-7: "Easy" / "Moderate" (Yellow zone - building work capacity)
- RPE 8-9: "Hard" / "Very Hard" (Orange zone - hypertrophy sweet spot)
- RPE 10: "Max Effort" (Red zone - maximal exertion, occasional use)

**Color Gradient:**
```
Green (1-5) → Yellow (6-7) → Orange (8-9) → Red (10)
```

**Implementation:**
- Uses `@react-native-community/slider` for smooth touch interaction
- Integer steps 1-10 for discrete RPE values
- Real-time label updates as user drags slider
- Integrated into ActiveSetCard expanded state

## AI Week Generation (Biomechanical Fatigue Simulator)

**Location**: `src/lib/engine/weekGeneration.ts`

### Purpose
Generate exercise selection for a week using an allow-list with fatigue-aware greedy scoring.

### Constants
```
ESTIMATED_STIMULUS = 0.7  // Assumed effort per set (~RPE 8)
MAX_FATIGUE_PER_MUSCLE = 10  // Normalization factor
GREEN_THRESHOLD = 0.5  // 0-50% stress
RED_THRESHOLD = 0.85  // >85% stress (hard stop)
```

### Algorithm Overview

**1. Load Allow-List** (v2_ai_recommended_exercises, limit 50)
```
candidates = fetch exercises with priority_order (lower = higher priority)
```

**2. Front-Load All Supporting Data**
```
- mergedExercises = listMergedExercises(userId, exerciseIds)
  → Get primary_muscles + implicit_hits for each exercise
- prescriptions = getPrescriptionsForExercises(exerciseIds, experience, mode)
  → Get sets_min/sets_max for target calculation
- currentStress = getMuscleStressStats(userId, last48h)
  → Get real fatigue from performed truth
```

**3. Build Exercise Stress Profiles**
```
for each candidate:
  TargetSets = round((sets_min + sets_max) / 2)
  
  // Build normalized muscle weights (same as fatigue model)
  for muscle m in primary_muscles: w_m = 1.0
  for muscle m in implicit_hits: w_m = implicit_hits[m]
  W = Σ w_m
  NormalizedWeight_m = w_m / W
  
  basePriority = derived from priority_order
  
  profile = {
    exerciseId,
    targetSets,
    perMuscleWeights: { muscle_key: NormalizedWeight_m },
    basePriority
  }
```

**4. Initialize Simulated Fatigue State**
```
fatigueState = new SimulatedFatigueState(currentStress)
// This is ephemeral, never written to database
```

**5. Greedy Selection Loop** (NO SQL in loop)
```
selected = []

while (candidates remaining):
  for each candidate:
    // Get worst normalized fatigue fraction across all muscles it hits
    worstFraction = 0
    for muscle m in candidate.perMuscleWeights:
      current_stress = fatigueState.getFatigue()[m] || 0
      fraction = clamp(current_stress / MAX_FATIGUE_PER_MUSCLE, 0, 1)
      worstFraction = max(worstFraction, fraction)
    
    // Determine zone and penalty
    if (worstFraction <= GREEN_THRESHOLD):
      zone = 'green'
      penalty = 0
    else if (worstFraction <= RED_THRESHOLD):
      zone = 'yellow'
      penalty = 0.5 * basePriority
    else:
      zone = 'red'
      penalty = Infinity  // Hard stop
    
    score = basePriority - penalty
  
  // Pick highest scoring candidate (skip if all in red zone)
  bestCandidate = candidate with max score
  
  if (bestCandidate.zone === 'red'):
    break  // All remaining exercises would overtrain
  
  selected.push(bestCandidate.exerciseId)
  
  // Update simulated fatigue
  exerciseTotalStress = targetSets * ESTIMATED_STIMULUS
  for muscle m in bestCandidate.perMuscleWeights:
    delta = exerciseTotalStress * NormalizedWeight_m
    fatigueState.addStress(m, delta)
  
  remove bestCandidate from candidates

return selected
```

### Worked Example

**Scenario**: User has done heavy chest work in last 48h

**Step 1: Current Stress** (from last 48h)
```
chest: 8.0
triceps: 6.0
anterior_deltoids: 4.0
(all other muscles: 0)
```

**Step 2: Candidate Exercises**

**Exercise A: Bench Press**
```
primary_muscles: [chest, triceps, anterior_deltoids]
Normalized weights (equal split): chest=0.33, triceps=0.33, anterior_deltoids=0.33
TargetSets = 4
basePriority = 10
```

**Exercise B: Lat Pulldown**
```
primary_muscles: [lats, biceps]
Normalized weights: lats=0.5, biceps=0.5
TargetSets = 4
basePriority = 9
```

**Step 3: Compute Zones**

**Bench Press:**
```
Worst fraction:
  chest: 8.0 / 10 = 0.8
  triceps: 6.0 / 10 = 0.6
  anterior_deltoids: 4.0 / 10 = 0.4
  worstFraction = max(0.8, 0.6, 0.4) = 0.8

Zone: yellow (0.5 < 0.8 <= 0.85)
Penalty: 0.5 * 10 = 5
Score: 10 - 5 = 5
```

**Lat Pulldown:**
```
Worst fraction:
  lats: 0 / 10 = 0
  biceps: 0 / 10 = 0
  worstFraction = 0

Zone: green (0 <= 0.5)
Penalty: 0
Score: 9 - 0 = 9
```

**Step 4: Selection**
```
Lat Pulldown has higher score (9 > 5)
→ Select Lat Pulldown first

Update simulated state:
  stress_lats += 4 * 0.7 * 0.5 = 1.4
  stress_biceps += 4 * 0.7 * 0.5 = 1.4
```

**Result**: Algorithm naturally pivots away from fatigued chest muscles toward fresh back muscles.

## Rebalance Detection

**Location**: `src/lib/engine/rebalance.ts`

### Purpose
Detect muscle coverage gaps by analyzing recent sessions. Prompt user before starting workout if gaps found.

### Constants
```
N_SESSIONS_LOOKBACK = 6  // Analyze last 6 completed sessions
MIN_GAP_MUSCLES = 1  // Minimum missed muscles to trigger prompt
```

### Algorithm

**1. Get Recent Completed Sessions**
```
sessions = fetch last N_SESSIONS_LOOKBACK completed sessions
if (no sessions): return no rebalance needed
```

**2. Get All Session Exercises**
```
sessionExercises = fetch all exercises from recent sessions
  (includes both exercise_id and custom_exercise_id)
```

**3. Determine Muscles Hit**
```
allMusclesHit = Set()

for each sessionExercise:
  exercise = getMergedExercise({ exerciseId OR customExerciseId }, userId)
  
  // Add primary muscles
  for muscle in exercise.primary_muscles:
    allMusclesHit.add(muscle)
  
  // Add implicit hits
  for muscle in Object.keys(exercise.implicit_hits):
    allMusclesHit.add(muscle)
```

**4. Compare Against All Canonical Muscles**
```
allMuscles = fetch all keys from v2_muscles

missedMuscles = []
for muscle in allMuscles:
  if (muscle not in allMusclesHit):
    missedMuscles.push(muscle)
```

**5. Check Threshold**
```
if (missedMuscles.length >= MIN_GAP_MUSCLES):
  return {
    needsRebalance: true,
    reasons: ["X muscles not hit in last N sessions: ..."],
    missedMuscles
  }
else:
  return { needsRebalance: false, reasons: [], missedMuscles: [] }
```

### Worked Example

**Scenario**: User has done 6 sessions focused on upper body

**Step 1: Muscles Hit**
```
From 6 sessions:
  chest, triceps, anterior_deltoids, lats, biceps, upper_back, traps, abs
```

**Step 2: All Canonical Muscles** (28 total)
```
Upper Push (7): chest, upper_chest, lower_chest, anterior_deltoids, lateral_deltoids, posterior_deltoids, triceps
Upper Pull (6): lats, upper_back, lower_back, traps, biceps, forearms
Core (2): abs, obliques
Lower Front (2): quads, hip_flexors
Lower Back (4): hamstrings, glutes, calves, soleus
Stabilizers (7): rotator_cuff, serratus_anterior, transverse_abdominis, glute_medius, glute_minimus, piriformis, tibialis_anterior
```

**Step 3: Find Gaps**
```
Missed muscles:
  upper_chest, lower_chest, lateral_deltoids, posterior_deltoids,
  lower_back, forearms, obliques,
  quads, hip_flexors,
  hamstrings, glutes, calves, soleus,
  rotator_cuff, serratus_anterior, transverse_abdominis,
  glute_medius, glute_minimus, piriformis, tibialis_anterior

Total: 20 muscles missed
```

**Step 4: Result**
```
{
  needsRebalance: true,
  reasons: ["20 muscles not hit in last 6 sessions: upper_chest, lower_chest, lateral_deltoids, posterior_deltoids, lower_back..."],
  missedMuscles: [all 20 muscles]
}
```

**Step 5: User Action**
```
Show SmartAdjustPrompt with:
  - "Continue anyway" (proceed without changes)
  - "Smart adjust" (apply rebalance logic)
```

### 5.1 Explicit Catch-Up Logic (Smart Adjust)

**Location**: `src/lib/engine/rebalance.ts` (`getRebalanceExercises`)

While the fatigue model handles recovery, "Rebalance" handles neglect.

**Gap Detection:** Identify muscles not hit in the last 6 sessions.

**Correction Algorithm:** If `needsRebalance` is true, the generator must inject a high-priority compound exercise for the missed muscle (e.g., Squats for Legs) into the *start* of the active session, potentially displacing lower-priority accessory movements to maintain time constraints.

**Selection Criteria:**
1. Query `v2_exercises` where `primary_muscles` overlaps with `missedMuscles`
2. Filter by:
   - Exercise is in `v2_ai_recommended_exercises` (allow-list)
   - Exercise has prescription for user's experience level
   - Prefer compound movements (density_score > 7)
3. Select top 2-3 exercises that cover the most missed muscles
4. Return exercise IDs

**Application:**
- When user selects "Smart Adjust" in SmartAdjustPrompt
- Fetch active session ID
- Call `getRebalanceExercises(missedMuscles, userId)`
- Insert session exercises into `v2_session_exercises` with `sort_order = -1, -2, -3` (to appear first)
- Prefill sets for new exercises using progressive overload targets
- Show toast: "Added X catch-up exercises"
- Navigate to active workout

## Time Estimation Formula

**Location**: Documented in architecture, not yet implemented as function

### Formula

```
For each exercise:
  S = target_sets
  Tset = avg_time_per_set_sec (includes rest between sets)
  Tsetup = setup_buffer_sec (one-time overhead)
  U = is_unilateral ? 2 : 1 (doubles time if unilateral)
  
  exercise_time_sec = Tsetup + (S * Tset * U)

For session:
  session_time_sec = Σ exercise_time_sec
```

### Example

**Exercise 1: Barbell Bench Press**
```
S = 4 sets
Tset = 120 seconds (includes rest)
Tsetup = 30 seconds
U = 1 (bilateral)

time = 30 + (4 * 120 * 1) = 30 + 480 = 510 seconds = 8.5 minutes
```

**Exercise 2: Dumbbell Lunges (Unilateral)**
```
S = 3 sets
Tset = 90 seconds
Tsetup = 20 seconds
U = 2 (unilateral - do both sides)

time = 20 + (3 * 90 * 2) = 20 + 540 = 560 seconds = 9.3 minutes
```

**Session Total:**
```
510 + 560 = 1070 seconds = 17.8 minutes (for 2 exercises)
```

## Edge Cases and Validation

### Target Selection Edge Cases

1. **No prescription exists**: Return null (exclude from generation)
2. **No history but historyCount > 0**: Use default mid-range selection
3. **History exists but incomplete** (missing weight/reps): Fall back to default
4. **Custom exercise missing target bands**: Return null (data error)
5. **XOR violation** (both or neither ID provided): Return null with error

### Fatigue Model Edge Cases

1. **No RPE or RIR**: Use DEFAULT_STIMULUS (0.6) and log warning
2. **RPE <= 5**: stimulus = 0 (too easy to count)
3. **Empty primary_muscles**: Skip exercise (validation error)
4. **Empty implicit_hits**: Only use primary muscles (valid)
5. **Divide by zero** (W = 0): Should never happen with validation

### AI Generation Edge Cases

1. **No allow-list exercises**: Return empty array
2. **No prescriptions for exercises**: Exclude those exercises
3. **All exercises in red zone**: Stop selection (prevent overtraining)
4. **Empty current stress**: Start with zero stress for all muscles
5. **Missing merged exercise**: Skip that exercise

### Rebalance Detection Edge Cases

1. **No completed sessions**: Return no rebalance needed
2. **No canonical muscles in database**: Return no rebalance needed (can't check)
3. **Empty session exercises**: Return no rebalance needed
4. **getMergedExercise fails**: Skip that exercise (log error)
5. **All muscles covered**: Return needsRebalance=false
