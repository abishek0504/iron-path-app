# Prescription Rationale and Guidelines

**Purpose**: Document the research, science, and biomechanics behind every prescription value (rep/set bands, suggested weight multipliers, progression logic) and provide guidelines for adding future exercises.

**Last Updated**: 2026-06-11

---

## 1. Definition of Values

### 1.1 Suggested Weight Multiplier (`suggested_weight_multiplier_bw`)

- **Meaning**: Suggested **working weight** as a fraction of bodyweight (BW).  
  `suggested_weight = current_weight × suggested_weight_multiplier_bw`  
  This is the load the user is expected to use for the **prescribed rep range** (e.g. 8–12 or 6–10 reps), not a 1-rep max (1RM).
- **Why working weight, not 1RM**: Hypertrophy prescriptions use rep ranges where load is typically **65–80% of 1RM** (e.g. 8 reps ≈ 80% 1RM, 12 reps ≈ 70% 1RM). Our multipliers are set so that the suggested weight is realistic for the band (e.g. 3×8–12 for beginners). Sources: NSCA load charts; 60–75% 1RM for hypertrophy (Dr Muscle, BJSM meta-analyses).
- **Units**: Same as `current_weight` (lbs or kg). Fallback BW when profile has no weight: 150 lb / 70 kg.
- **Bodyweight-only exercises**: Multiplier = 0 (pull-up, push-up, dip, plank, etc.). User can add external load (e.g. weight belt) and enter it manually.

### 1.2 Rep and Set Bands

- **Sets**: `sets_min`–`sets_max` define the allowable number of sets per exercise per session.
- **Reps (reps mode)**: `reps_min`–`reps_max` define the target rep range per set.
- **Duration (timed mode)**: `duration_sec_min`–`duration_sec_max` define hold/walk duration per set.

Evidence: Meta-analyses (e.g. BJSM 2023, umbrella reviews) show hypertrophy occurs across **~5–30 reps** when taken close to failure; **3–5 sets** per muscle per session are effective; **8–12 reps** remain a common moderate range. Rep-based bands are **tiered by `density_score`** (rule-based seed in migration `20260611120003_seed_prescriptions_for_new_exercises.sql`); curated prescriptions for the original main lifts keep the same compound bands:

**Compound (density_score ≥ 8):**

| Experience   | Sets   | Reps  | Rationale |
|-------------|--------|--------|-----------|
| Beginner    | 3      | 8–12   | Lower volume, moderate reps; build technique and work capacity. |
| Intermediate| 3–4    | 6–10   | More volume and slightly heavier; strength–hypertrophy overlap. |
| Advanced    | 4–5    | 5–8    | Higher volume, heavier loads; more strength-oriented. |

**Moderate / accessory (density_score 6–7):**

| Experience   | Sets   | Reps  |
|-------------|--------|--------|
| Beginner    | 3      | 8–12   |
| Intermediate| 3–4    | 8–12   |
| Advanced    | 3–4    | 6–10   |

**Isolation / small muscle (density_score ≤ 5):**

| Experience   | Sets   | Reps  |
|-------------|--------|--------|
| Beginner    | 3      | 10–15  |
| Intermediate| 3–4    | 10–15  |
| Advanced    | 3–4    | 8–12   |

Timed strength exercises (non-stretch, e.g. planks, dead hangs): beginner 3×20–30 s, intermediate 3–4×30–45 s, advanced 4–5×45–60 s (isometric/hold progressions).

Stretches (`is_stretch = true`, always timed): beginner 1–2×30–45 s, intermediate 1–2×45–60 s, advanced 2–3×45–90 s — low volume holds, longer with experience.

---

## 2. Strength Standards and Working-Weight Conversion

Published **1RM / bodyweight** standards (male, typical ranges) are used only as a reference; we then scale to **working weight** for our rep ranges.

- **Conversion**: For 8–12 reps, working weight ≈ **70–80% of 1RM**. So:  
  `working_weight_multiplier_bw ≈ 0.75 × (1RM_multiplier_BW)` for our bands.
- **Example**: If Bench 1RM standard for beginner = 0.5× BW, working ≈ 0.38× BW. We use 0.65× BW for beginners as a slightly higher starting suggestion (user can reduce if needed); intermediate/advanced align with common standards scaled to working load.

References: Strength standards (e.g. ExRx, strength calculators) report 1RM/BW by level; NSCA/ACSM guidelines (60–75% 1RM for hypertrophy).

---

## 3. Validation of Current Multipliers by Category

### 3.1 Compound Barbell (main lifts)

| Exercise        | Beginner | Intermediate | Advanced | Rationale |
|-----------------|----------|--------------|----------|-----------|
| Deadlift        | 1.0      | 1.5          | 2.0      | 1RM standards ~1/2/2.5× BW; working weight for 8–12/6–10/5–8. |
| Squat (BB)      | 0.85     | 1.5          | 1.75     | 1RM ~0.75/1.75/2.25× BW; front squat similar, slightly lower. |
| Front Squat     | 0.85     | 1.5          | 1.75     | Same as back squat band; typically 80–90% of back squat load. |
| Bench Press     | 0.65     | 1.25         | 1.5      | 1RM ~0.5/1.25/1.75× BW; working for prescribed reps. |
| Overhead Press  | 0.4      | 0.6          | 0.8      | OHP is lowest ratio of main lifts; standards ~0.35–0.5 novice, 0.65–0.8 intermediate, 0.9–1.1 advanced (1RM); we use working equivalents. |
| Bent Over Row   | 0.5      | 0.75         | 1.0      | Horizontal pull; typically 50–100% BW working load by level. |
| RDL             | 0.8      | 1.2          | 1.6      | Hamstring-dominant hinge; slightly lighter than deadlift. |
| Hip Thrust      | 0.65     | 1.0          | 1.5      | Glute-dominant; common loading progressions support these ratios. |

### 3.2 Compound Machine / Cable

| Exercise           | Beginner | Intermediate | Advanced | Rationale |
|--------------------|----------|--------------|----------|-----------|
| Leg Press          | 1.5      | 2.0          | 2.5      | Machine load often 1.5–2.5× BW (sled + angle); not directly comparable to squat 1RM. |
| Lat Pulldown       | 0.5      | 0.75         | 1.0      | Stack load as fraction of BW; vertical pull. |
| Seated Cable Row   | 0.5      | 0.75         | 1.0      | Horizontal pull; similar to lat pulldown loading. |

### 3.3 Isolation / Single-Limb or Accessory

| Exercise              | Beginner | Intermediate | Advanced | Rationale |
|-----------------------|----------|--------------|----------|-----------|
| Incline DB Press, DB Fly | 0.2  | 0.35         | 0.5      | Per-arm or fly load as fraction of BW (one limb). |
| Arnold Press, Lateral Raise | 0.08 | 0.12      | 0.18     | Small muscle mass; typical DB weights 5–20 lb for many users. |
| Bicep Curl, Hammer Curl | 0.1  | 0.15         | 0.2      | Per-arm; 10–20% BW is a reasonable range. |
| Tricep Pushdown, Skullcrusher, OH Tricep | 0.15 | 0.25 | 0.35 | Cable/bar as fraction of BW. |
| Leg Extension, Leg Curl | 0.3   | 0.5          | 0.7      | Single-joint leg; machine load progression. |
| Face Pull            | 0.1      | 0.15         | 0.2      | Light load for rear delt/upper back. |

### 3.4 Unilateral / Bodyweight-Dominant Leg

| Exercise                | Beginner | Intermediate | Advanced | Rationale |
|-------------------------|----------|--------------|----------|-----------|
| Bulgarian Split Squat, Walking Lunge, Pistol, Cossack | 0 | 0.15 | 0.3 | Start bodyweight; add load (e.g. dumbbells) as capacity increases. |
| Calf Raise              | 0        | 0.25         | 0.5      | Bodyweight then added load. |

### 3.5 Bodyweight-Only and Timed

- **Pull-up, Chin-up, Push-up, Dip, Pike Push-up, etc.**: Multiplier = 0. No external load; user enters 0 or adds weight (belt) manually.
- **Plank, Side Plank, L-Sit, Superman Hold**: Timed; multiplier = 0.
- **Farmer's Walk**: Timed; multiplier = 0. Load is often 0.5–1× BW per hand; currently user-defined; optional future: separate “carry load” suggestion.

### 3.6 Stretches and the Expanded Master Catalog

The master catalog (`supabase/seed/master_exercises_and_stretches_expanded_advanced.csv`, imported by migration `20260611120000`) now contains **388 exercises**: 340 strength (282 rep-based, 58 timed) and **48 stretches** (`is_stretch = true`, all timed).

- **Stretches**: Multiplier = 0; timed holds with the low-volume bands in §1.2. Excluded from the AI strength allow-list — only appended to generated days when the user explicitly requests stretches (`stretchCount` constraint).
- **Rule-seeded prescriptions**: Exercises imported without curated prescriptions get bands from the density-tier rules in §1.2 (migration `20260611120003`). Their `suggested_weight_multiplier_bw` stays at the column default **0** until curated, so the no-history suggestion is 0 (user enters the load) and history takes over from the first session.

---

## 4. Progression Logic (Formulas)

### 4.1 Weight Progression (Reps Mode)

- **When to increase weight**: User hits **top of rep band** (≥ 90% of `reps_max`, e.g. 11+ reps when band is 8–12) at **acceptable effort** (avg RPE ≤ 7, or no RPE recorded). Then suggest slightly higher weight and reset toward bottom of band.
- **Formula (targetSelection.ts)**:  
  `weight = lastWeight + max(lastWeight × 0.025, 2.5)`  
  So: at least **2.5 lbs** increase, or **2.5%** of last weight, whichever is larger (not rounded).
- **Formula (weightSuggestions.ts, no history)**: Uses prescription: `weight = bw × multiplier`, rounded to nearest **0.5 lb** (imperial) or **0.25 kg** (metric). With history and target reps hit, a fixed unit-aware increment:  
  imperial: `+5` if last weight ≥ 100 lb, else `+2.5`; metric: `+2.5` if ≥ 45 kg, else `+1.25` — same rounding.
- **History excludes warm-ups**: Only working sets (`set_type != 'warmup'`) drive progression and weight suggestions; warm-up sets also never register PRs (DB trigger early-returns on `set_type = 'warmup'`).

**Research**: 2–10% load increase when exceeding target reps is common (ACSM, NASM); 2.5% minimum and 1.25–5 lb/kg increments are within evidence-based ranges and are practical for small plates.

### 4.2 Rep Progression (Reps Mode)

- If not yet at top of band: suggest **same weight**, **+1 rep** toward `reps_max` (within band).
- Keeps volume progression without forcing load jumps every session.

### 4.3 Duration Progression (Timed Mode)

- **Formula**: `duration_sec = min(lastDuration + 5, duration_sec_max)`, clamped to band.
- **Rationale**: Small, sustainable increases (e.g. +5 s per session) for isometrics; avoid large jumps that increase injury risk or failure rate.

---

## 5. Guidelines for Adding Future Exercises

### 5.1 Deciding the Multiplier

1. **Identify movement type**: Compound barbell / machine / cable / isolation / unilateral / bodyweight / timed.
2. **Compare to similar exercises**: Use the tables in §3. Same movement pattern (e.g. hinge, push) → similar multiplier band. Example: a new “T-Bar Row” → similar to Bent Over Row (0.5 / 0.75 / 1.0).
3. **Use 1RM standards if available**: If the exercise has published 1RM/BW standards, use:  
   `suggested_weight_multiplier_bw ≈ 0.70–0.80 × (1RM_multiplier_BW)`  
   for the prescribed rep range (8–12 beginner, 6–10 intermediate, 5–8 advanced).
4. **Isolation / small muscle**: Use a small fraction of BW (e.g. 0.08–0.35) depending on limb and load type (DB vs cable vs machine).
5. **Bodyweight-only**: Multiplier = 0. If the movement can take added load (e.g. weighted pull-up), keep 0 and let the user add load manually, or add a separate “added load” suggestion later.
6. **Machine load**: Consider whether the machine is “heavier” than free-weight equivalent (e.g. leg press 1.5–2.5× BW); use existing machine examples in §3.

### 5.2 Rep and Set Bands

- **Default (hypertrophy)**: Use the density-tier bands in §1.2 — compound (density ≥ 8): 3×8–12 / 3–4×6–10 / 4–5×5–8; moderate (6–7): 3×8–12 / 3–4×8–12 / 3–4×6–10; isolation (≤ 5): 3×10–15 / 3–4×10–15 / 3–4×8–12. The rule-based seed migration applies these automatically to exercises without curated prescriptions.
- **Exception – calisthenics / core (e.g. hanging leg raise, calf raise)**: Can use slightly different rep bands if the movement is better suited to slightly higher reps; curate explicitly.
- **Timed strength**: Use existing timed bands (3×20–30 s / 3–4×30–45 s / 4–5×45–60 s) unless the movement has a strong reason to differ.
- **Stretches**: Use the stretch bands (1–2×30–45 s / 1–2×45–60 s / 2–3×45–90 s) and set `is_stretch = true`.

### 5.3 Experience Levels

- **Beginner**: 0–~1.5 years consistent training (or equivalent).
- **Intermediate**: ~1.5–3 years.
- **Advanced**: 3+ years.

Levels map to **prescription row** (experience + mode); multipliers and bands are per experience so suggestions scale appropriately.

### 5.4 Checklist for New Exercises

- [ ] Choose **mode**: `reps` or `timed`; set **is_stretch** for mobility/stretch entries (stretches are timed and excluded from AI strength selection).
- [ ] Set **sets_min**, **sets_max** (and **reps_min**/ **reps_max** or **duration_sec_min**/ **duration_sec_max**) — or rely on the density-tier rule seed for defaults.
- [ ] Set **suggested_weight_multiplier_bw** using §5.1 (0 for bodyweight/timed where no load is suggested; defaults to 0 if not curated).
- [ ] Add a row per **experience** (beginner, intermediate, advanced) if the exercise is used for hypertrophy.
- [ ] Document **rationale** (e.g. “Same as Bent Over Row; horizontal pull”) in migration or seed comment/source_notes if the table supports it.

---

## 6. Summary

- **Multipliers** = working weight as fraction of BW for the prescribed rep range (not 1RM). Rule-seeded prescriptions default to 0 until curated.
- **Rep/set bands** align with hypertrophy research (3–5 sets, 5–30 reps effective) and are tiered by density_score (compound 5–12 reps, isolation up to 15); stretches use low-volume timed holds.
- **Progression**: Weight = last + max(2.5% last, 2.5 lb); reps +1 toward top of band; timed +5 s, all clamped to prescription bands. Warm-up sets never drive progression or PRs.
- **Every value** is chosen so that suggested loads and progressions are realistic per exercise, muscle group, and experience level; new exercises should follow the same rationale and the guidelines in §5.
