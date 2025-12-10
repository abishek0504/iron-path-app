
````markdown
# PROJECT IRONPATH: MASTER TECHNICAL SPECIFICATION & CONTEXT

**Usage Instruction for AI/Cursor:**
*You are building an "Opinionated Athletic Engine," not a generic fitness tracker. Read this entire document before writing a single line of code. Do not implement standard "bodybuilding" features (isolation toggles, body-part splits) unless explicitly defined here. Trust the "Density Score" logic over traditional volume metrics.*

---

## 1. PRODUCT PHILOSOPHY & VISION

### **A. The "High-Density" Standard**
Most apps confuse "volume" with "value." They think 3 sets of Clamshells + 3 sets of Band Walks is equal to 3 sets of Pistol Squats. They are wrong.
* **Our Core Metric:** **Exercise Density**. This is defined as *[Muscles Recruitment + Neural Demand + Stability Requirement] per minute.*
* **The Gold Standard:** A workout consisting of 5-6 High-Density movements (e.g., Pistol Squats, Nordic Curls, Dips, Muscle-ups, Deadlifts) is superior to a 10-exercise workout filled with isolation movements.
* **The "Anti-Bloat" Rule:** We do not program isolation exercises (e.g., Curls, Extensions, Band Walks) to "fill time." If the user has 45 minutes, they spend it on high-ROI (Return on Investment) compounds.

### **B. Athleticism > Aesthetics**
We are building bodies that perform.
* **No "Rehab" Mode:** We do not prescribe physical therapy drills (e.g., "Internal Rotation with Band") to fix imbalances. That is out of our scope.
* **The "Natural Fix":** We fix imbalances by enforcing **Unilateral Compound Movements**.
    * *Example:* We don't fix a weak hip flexor with leg raises. We fix it by assigning **Pistol Squats** (which force the hip flexor to stabilize the movement).

### **C. Implicit vs. Explicit Training**
* **Standard Logic (Rejected):** "User needs to train Core. Add Planks."
* **IronPath Logic (Accepted):** "User is doing Heavy Front Squats. The Core is implicitly trained at 90% capacity. No Planks needed."
* **Why:** This prevents junk volume. We track "Implicit Hits" to ensure stabilizers (Cuff, Grip, Core) are trained without wasting workout time on them.

---

## 2. USER INTERFACE STRATEGY (THE "OPINIONATED COACH")

### **A. Removal of User Configuration**
We have removed all "Style" toggles (e.g., Strength, Calisthenics, Cardio) and "Tier" toggles (Tier 1/2/3).
* **Justification:** A user choosing "Comprehensive" often unknowingly opts into junk volume. We are the experts; we decide the best mix.
* **The Input:** The user provides only **Time Budget** and **Equipment**.
* **The Output:** The system generates the single best "Cream of the Crop" workout for that context.

### **B. The "Solution" Interface**
* **Inputs:**
    1.  **Time Slider:** (e.g., 30m, 45m, 60m).
    2.  **Equipment Profile:** (Derived from User Settings).
* **Output:** A flat list of exercises. No complexity.

---

## 3. DATABASE SCHEMA & DATA LOGIC

The AI cannot make "High-Density" decisions with standard data. We require strict metadata tags.

### **A. Exercise Object (`Exercise_DB`)**
This schema is the brain of the operation.

```json
{
  "id": "pistol_squat_001",
  "name": "Pistol Squat",
  "type": "COMPOUND",
  
  // THE "CREAM OF THE CROP" FILTER
  // Scale 1-10. The Generator strictly filters for Density >= 8.
  // 10 = Deadlift, Squat, Pistol Squat, Muscle-up, Heavy Row.
  // 1 = Calf Raise, Band Walk, Shrug.
  // COLD START GUARDRAIL: If density_score is missing, INFER it:
  // Compound + Free Weight = 9. Machine/Isolation = 4.
  "density_score": 9.5, 

  // TARGETS (For Freshness Decay)
  "primary_muscles": ["Quads", "Glutes"],

  // THE "IMPLICIT HIT" MAP (CRITICAL)
  // This allows us to track stabilizers without programming isolation.
  // Interpretation: "This exercise hits these muscles hard enough that we treat them as 'Trained'."
  "implicit_hits": {
    "hip_flexors": 0.9,  // 90% Activation -> No Leg Raises needed.
    "glute_medius": 0.8, // 80% Activation -> No Band Walks needed.
    "core": 0.7,
    "ankle_stabilizers": 0.6
  },

  // DURATION MATH
  "is_unilateral": true, // If TRUE, the algorithm doubles the estimated time cost.
  "avg_time_per_set_sec": 120, // Includes Rest + Execution
  "setup_buffer_sec": 45
}
````

### **B. User State (`Muscle_State`)**

We use a simple decay model to drive variety.

```json
{
  "user_id": "u_001",
  "muscle_freshness": {
    // 0 = Fried, 100 = Fresh.
    // Logic: Decays on Log. Regenerates +25% every 24h.
    "Hamstrings": 100,
    "Quads": 40, // Fried from yesterday
    "Chest": 100
  }
}
```

-----

## 4\. THE GENERATION ALGORITHM (THE "FRESHNESS LOOP")

**Objective:** Fill the `Time_Budget` with the highest density exercises for the freshest muscles.

### **Step 1: The Freshness Sort**

  * **Logic:** Query `Muscle_State`. Sort muscles by `freshness` (Descending).
  * **Why:** We naturally rotate focus (Legs -\> Push -\> Pull) without rigid "Split" logic.
  * **Result:** The top 3 fresh muscle groups become the **Priority Targets**.

### **Step 2: The Density Filter (With Cold-Start Guard)**

  * **Logic:** For each Priority Target, select exercises where `density_score >= 8`.
  * **Guardrail:** If `density_score` is NULL, infer:
      * Is it Compound? Is it Barbell/Dumbbell/Bodyweight? -\> Treat as **High Density**.
      * Is it Isolation/Machine? -\> Treat as **Low Density** (Exclude).
  * **Result:** We get "Nordic Curls" (9.5) before "Leg Curl Machine" (4.0).

### **Step 3: The Unilateral Mandate**

  * **Logic:** Scan the selected workout list. Is at least one exercise `is_unilateral: true`?
  * **Action:** If `False`, find the lowest-ranked Bilateral exercise and swap it for its Unilateral equivalent.
      * *Swap:* Barbell Squat (Bilateral) $\rightarrow$ Bulgarian Split Squat (Unilateral).
  * **Justification:** This guarantees we address left/right imbalances in every single session without user intervention.

### **Step 4: The Time Ceiling (Fill then Compress)**

  * **Goal:** Reach `Time_Budget` exactly.
  * **Action A (Fill):** Add Sets/Volume to the Tier 1 Compounds selected.
      * *Constraint:* Do NOT add "filler" exercises (Tier 2/3) just to fill time. If the user wants 60 mins, give them 5 sets of heavy work, not 3 sets + calf raises.
  * **Action B (Compress):** If `Total_Duration > Time_Budget`, reduce sets on the last exercise or convert to Supersets. Never delete the Primary Compound.

-----

## 5\. HANDLING INJURY & MISSED WORKOUTS (STATE MACHINE)

**We do not write explicit logic for "Missed Workouts" or "Injuries." The State Machine handles it naturally.**

### **A. The "Missed Workout" Scenario**

  * **Event:** User misses "Pull Day."
  * **System Action:** No log is created. `Back_Freshness` remains at 100%. `Leg_Freshness` regenerates to 100%.
  * **Result:** The very next time the User hits "Start," the Sorting Algorithm (Step 1) sees Back is still Priority \#1. It schedules the missed workout automatically. **No "Reschedule" button needed.**

### **B. The "Injury/Pain" Scenario**

  * **Event:** User has a tweaked lower back. They skip "Deadlifts" in the app (Log 0 sets).
  * **System Action:** `Lower_Back` receives 0 fatigue volume. It remains "Fresh."
  * **Result:** The AI suggests it again next time.
      * *Justification:* If the user is injured, they will self-regulate. We do not need a complex "Injury Mode" that permanently bans exercises. If they skip it 3 times in a row, the `freshness` logic will eventually rotate other muscles ahead of it simply due to lack of activity.

### **C. Progressive Overload**

  * **Logic:** Weights are calculated based on the *last logged set* for that specific Exercise ID.
  * **Result:** If a user deloads due to injury, the system learns the new "Low Weight" and progresses from there. It adapts to reality, not a theoretical max.

-----

**END OF CONTEXT**

```
```