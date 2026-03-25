# Plan: Planner Generation & Performance Fix

## Problems Identified

### 1. **slotTargets key mismatch (causes "Loading" / stuck)**
- `calculateTargetsForSlots` stores targets with `slot.id` as key: `targetsMap.set(slot.id, target)`
- Template slot render looks up by `exercise_id || custom_exercise_id`: `slotTargets.get(key)`
- Result: Template slots never find targets → "Loading targets..." forever
- Session exercises use exerciseId (from loadSessionsForDay) → works for sessions
- **Fix**: Use `exercise_id || custom_exercise_id` as key in calculateTargetsForSlots

### 2. **Performance: redundant calls**
- `calculateTargetsForSlots` runs for ALL 7 days × all slots
- Same exercise in multiple days/slots → duplicate `selectExerciseTargets` and `getMergedExercise` calls
- Logs show b09615de, 5cc388c8 called many times
- **Fix**: Deduplicate by exerciseId before calling selectExerciseTargets

### 3. **Performance: scope too broad**
- calculateTargetsForSlots runs for entire template (all days)
- loadTemplate triggers this on every load
- **Fix**: Only calculate targets for the selected day's slots (or merge with existing, don't overwrite)

### 4. **Generate with AI: wrong scope**
- Generates for whole week → laggy, hard to control
- sessionsPerDay is one number for all days
- User wants: 0 Wed (rest), 1 Fri, 2 Sat — not possible
- **Fix**: Generate for selected day only. Sessions input = for that day (0 = rest day, add nothing)

### 5. **Workout containers vs generation**
- Generate adds template slots, syncs to existing sessions
- Sessions are created by "Add Workout" — not by Generate
- sessionsPerDay in Generate = how to distribute exercises (muscle separation), not container count
- **Fix**: For one-day generation: sessionsPerDay 0 = clear day / rest. 1–6 = exercises distributed across that many "sessions" (for muscle separation). Optionally: when sessionsPerDay > 1 and no sessions exist, create that many sessions? Or keep simple: just add template slots, user Add Workout to create containers.

### 6. **Stuck exercises / can't delete**
- Template slots (no sessions) have no Edit/Delete per slot
- User can't remove broken slots
- **Fix**: Add remove-slot for template view (when no sessions)

## Implementation Order

1. ✅ Fix slotTargets key (slot.id → exerciseId) — unblocks Loading
2. ✅ Deduplicate + scope calculateTargetsForSlots to selected day
3. ✅ Generate for selected day only; sessions 0–6 for that day (0=rest)
4. ✅ Add remove-slot for template slots (no-sessions view)
5. ✅ Update weekGeneration: generateDayForTemplate, dayIndexOnly option
