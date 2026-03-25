# Plan: Plan Tab Data Flow & Flickering Fix

## Executive Summary

The Plan tab has multiple data sources, load triggers, and state updates that race with each other. This causes:
1. "Planned for Saturday" (or similar) containers popping up and disappearing
2. "Workout 1" with exercises appearing then disappearing
3. Buggy behavior when switching days quickly

**Root cause**: Overlapping load triggers, no request cancellation for stale day switches, and a single state variable (`sessionsTodayWithExercises`) that is overwritten by multiple async callers.

---

## 1. Data Flow Map

### 1.1 State Variables (Planner)

| State | Source | Used For |
|-------|--------|----------|
| `templateData` | `loadTemplate` → `getTemplateWithDaysAndSlotsCached` | Template + days + slots (planned exercises) |
| `sessionsTodayWithExercises` | `loadSessionsForDay` → `getSessionsForToday` + `v2_session_exercises` | Workout containers (Workout 1, Workout 2, …) |
| `exerciseNames` | `loadTemplate`, `loadSessionsForDay` | Exercise display names |
| `slotTargets` | `calculateTargetsForSlots`, `loadSessionsForDay` | Target sets/reps display |
| `selectedDayIndex` | User taps day button | Which day (Sun–Sat) is selected |
| `activeTemplateId` | `loadTemplate` | Which template is active |

### 1.2 UI Branch Logic

```
sessionsTodayWithExercises.length === 0
  → Show: "No workouts scheduled/planned for {day}" + "Add a workout to get started"
  → (If "Planned for X" was added: also show template slots for that day)

sessionsTodayWithExercises.length > 0
  → Show: Workout 1, Workout 2, … (each with session exercises)
```

**Flickering**: The UI flips between these two branches whenever `sessionsTodayWithExercises` changes. If multiple loads overwrite it (sometimes `[]`, sometimes `[{session, exercises}]`), the UI will flicker.

---

## 2. Load Triggers (Who Calls What)

### 2.1 loadTemplate

**Called from**: init useEffect, useFocusEffect (recovery), plannerNeedsRefetch, Add workout, Copy last week, Generate AI, handleSaveToRoutine, handleRemoveSlot, etc.

**Does**:
1. `ensureTemplateHasWeekDays` + `invalidateTemplate` + `getTemplateWithDaysAndSlotsCached`
2. `setTemplateData(fullTemplate)`
3. `loadTodaySessionExercises(userId)` (today only)
4. `loadSessionsForDay(userId, { templateExerciseKeys: today's slots })` — **always loads TODAY, not selected day**
5. Sets `loadTemplateDidTodayLoadRef = true`

**Issue**: Step 4 always uses `getTodayDayName()` for `templateExerciseKeys`. It does **not** pass `dayName`, so `loadSessionsForDay` defaults to today. If the user has "Monday" selected, `loadTemplate` still loads today's sessions and overwrites `sessionsTodayWithExercises` with today's data. The UI shows the selected day (Monday) but the data is for today.

### 2.2 loadSessionsForDay

**Called from**:
- `loadTemplate` (always today)
- `useFocusEffect` selectedDay block (selected day, when `!loadTemplateDidTodayLoadRef`)
- `useEffect([selectedDayIndex, selectedDay?.day.id])` (selected day)
- Add workout handler (after creating session)
- Delete workout handler (after removing session)

**Does**:
1. `getSessionsForToday(userId, startIso, endIsoExclusive)` — **direct DB, no cache**
2. If empty: `setSessionsTodayWithExercises([])`, trim exerciseNames/slotTargets
3. If not empty: fetch session_exercises, build `withExercises`, `setSessionsTodayWithExercises(withExercises)`
4. Fetches names/targets, updates `exerciseNames`/`slotTargets`

**Stale guard**: `if (requestedDayName !== selectedDayNameRef.current) return` before updating state. So if the user switched days while the request was in flight, we discard the result. **But** `selectedDayNameRef` is set in the caller *before* the async call. If the user switches from Monday → Tuesday, we'd have:
- Request A (Monday) in flight, selectedDayNameRef = "Monday"
- User taps Tuesday → selectedDayNameRef = "Tuesday", Request B (Tuesday) starts
- Request A completes: requestedDayName "Monday" !== selectedDayNameRef "Tuesday" → discard ✓
- Request B completes: requestedDayName "Tuesday" === selectedDayNameRef "Tuesday" → apply ✓

So the stale guard works **if** selectedDayNameRef is updated before the new request. The `useEffect` for selectedDayIndex sets it. But `loadTemplate` does **not** set selectedDayNameRef before calling loadSessionsForDay — it always loads today. So when loadTemplate runs, it doesn't update selectedDayNameRef. If the user had Monday selected, we'd load today's sessions. The guard would check requestedDayName (today) vs selectedDayNameRef (Monday). They'd differ, so we'd discard. Good! But then we'd never update state. So we'd be stuck with whatever we had before. If we had Monday's sessions, we'd keep them. If we had nothing, we'd keep nothing. So we wouldn't show today's sessions when today is selected and loadTemplate runs... Actually we'd discard, so we wouldn't update. So we'd keep the old state. That might be wrong — if we're refetching the template we probably want to refresh sessions too. The issue is loadTemplate loads today's sessions regardless of selected day. So we need loadTemplate to load the *selected* day's sessions.

### 2.3 useFocusEffect

**Runs when**: Tab gains focus, or when deps change: `plannerNeedsRefetch`, `activeTemplateId`, `templateData`, `isLoadingTemplate`, `todayTemplateKeys`, `selectedDay?.day.day_name`, etc.

**Does**:
1. If `plannerNeedsRefetch`: loadTemplate(activeTemplateId) or recovery
2. If `mayRecover` (no template or no days): loadTemplate
3. Else if `selectedDay` and `!loadTemplateDidTodayLoadRef`: loadSessionsForDay for selected day
4. Cleanup: reset `recoveryAttemptedThisFocusRef`, `loadTemplateDidTodayLoadRef`

**Issue**: `templateData` is in deps. When `loadTemplate` completes and calls `setTemplateData`, the effect re-runs. That can trigger another load path. Previously we added a refetch throttle to avoid a loop; the current code may not have it (branch-dependent).

### 2.4 useEffect([selectedDayIndex, selectedDay?.day.id])

**Runs when**: User switches days (selectedDayIndex changes) or selectedDay identity changes.

**Does**: `loadSessionsForDay(userId, { dayName: selectedDay.day.day_name, templateExerciseKeys: selectedDayTemplateKeys })`

**Issue**: When the user switches days quickly (Mon → Tue → Wed), we fire three loadSessionsForDay calls. They complete in arbitrary order. Request for Mon might complete last and overwrite Wed's data. The stale guard helps: we set selectedDayNameRef when we *start* the load. So when we switch to Tue, we set selectedDayNameRef = "Tuesday" and fire request. When we switch to Wed, we set selectedDayNameRef = "Wednesday" and fire request. So when Mon's request completes, requestedDayName "Monday" !== selectedDayNameRef "Wednesday" → discard. Good. But the order of execution: we run the effect, set selectedDayNameRef = "Wednesday", call loadSessionsForDay (async). The effect runs synchronously. So we'd have selectedDayNameRef = "Wednesday" and one in-flight request for Wednesday. Good. But what if the effect runs, we set selectedDayNameRef = "Tuesday", we call loadSessionsForDay. Before that promise resolves, the user taps Wednesday. The effect runs again. We set selectedDayNameRef = "Wednesday", we call loadSessionsForDay again. So we have two in-flight: Tuesday and Wednesday. Tuesday completes first: requestedDayName "Tuesday" !== selectedDayNameRef "Wednesday" → discard. Wednesday completes: requestedDayName "Wednesday" === selectedDayNameRef "Wednesday" → apply. Good. So the guard works. But there's a subtlety: we set selectedDayNameRef at the *start* of the effect, before the async call. So when we fire the Wednesday request, selectedDayNameRef is already "Wednesday". Good.

---

## 3. Cache Layer

### 3.1 Template Cache (`templateCache.ts`)

- **Keys**: `templates:${userId}`, `template:${templateId}`
- **TTL**: 90 seconds
- **Invalidation**: `invalidateTemplate(templateId)`, `invalidateTemplates(userId)` — called after mutations
- **Used by**: `getTemplateWithDaysAndSlotsCached`, `getUserTemplatesCached`
- **loadTemplate** always calls `invalidateTemplate` before fetch, so it bypasses cache for that call

### 3.2 Sessions

- **getSessionsForToday**: No cache. Hits Supabase directly every time.
- **getSessionsInRangeCached**: Used by Progress tab, not Plan tab.

So the Plan tab has no session cache. Every loadSessionsForDay hits the DB. That's fine for correctness but means we can't "reuse" stale session data — we always fetch fresh. The flicker comes from state overwrites, not cache.

### 3.3 Exercise Cache (`exerciseCache.ts`)

- `listMergedExercisesCached`, etc. — used for names. TTL-based.

---

## 4. Root Causes of Flickering

### 4.1 Multiple callers overwriting `sessionsTodayWithExercises`

| Caller | When | What it sets |
|--------|------|--------------|
| loadTemplate | After template fetch | Today's sessions (or discard if day mismatch) |
| useFocusEffect selectedDay block | On focus, when !loadTemplateDidTodayLoadRef | Selected day's sessions |
| useEffect(selectedDayIndex) | On day switch | Selected day's sessions |

If loadTemplate and the selectedDay block both run on focus, we get two loadSessionsForDay calls. They can complete in any order. One might return [], one might return sessions. The last to complete wins. If the empty one completes last, we show "No workouts" (and any "Planned for X" UI). If the sessions one completes last, we show Workout 1, etc. Rapid alternation = flicker.

### 4.2 loadTemplate always loads today

When loadTemplate runs (e.g. after Generate AI, or refetch), it loads today's sessions. If the user has Saturday selected, we overwrite `sessionsTodayWithExercises` with today's data. The UI shows Saturday (selectedDay) but the data is for today. So we'd show today's workouts under Saturday's header — wrong. Or we'd discard (if selectedDayNameRef is Saturday and we requested today) and keep old state. Either way, confusing.

### 4.3 "Planned for X" containers (if present)

If we added a "Planned for {day}" section when `sessionsTodayWithExercises.length === 0`, it shows template slots. So:
- When we have sessions: show Workout 1, Workout 2
- When we have no sessions: show "Planned for Saturday" with template slots

If loadSessionsForDay sometimes returns [] and sometimes returns sessions (due to races), we flip between these views. The "Planned for" block popping up and disappearing is exactly this.

### 4.4 Fast day switching

When switching Mon → Tue → Wed quickly:
- Three loadSessionsForDay calls in flight
- The stale guard discards stale results
- But we might have a brief moment where we show the wrong day's data if a stale result gets through, or we clear state before the new load completes

---

## 5. Fix Plan (Implemented 2026-03-12)

### 5.1 Single source of truth for "which day's sessions"

**Problem**: loadTemplate loads today; useEffect loads selected day. They can conflict.

**Fix**: loadTemplate should load sessions for `selectedDayNameRef.current` (the currently selected day), not always today. Pass `dayName: selectedDayNameRef.current` to loadSessionsForDay.

### 5.2 Reduce duplicate loadSessionsForDay on focus

**Problem**: useFocusEffect and loadTemplate both can trigger loadSessionsForDay on focus.

**Fix**: When loadTemplate runs, it should be the *only* one loading sessions for that focus. Set `loadTemplateDidTodayLoadRef = true` when we *start* loadTemplate (or when we're about to call it for refetch), so the useFocusEffect selectedDay block skips. Ensure loadTemplate loads for the selected day (see 5.1).

### 5.3 Remove or simplify "Planned for X" (if present)

**Problem**: User says these containers "shouldn't be there" and they pop up/disappear.

**Options**:
- **A) Remove entirely**: When no sessions, show only "No workouts planned for {day}" and "Add a workout to get started". No template slots list.
- **B) Keep but never show when sessions exist**: Ensure we never flip to the empty state when we actually have sessions. The flicker is from races; fixing 5.1 and 5.2 should reduce it. If we still want to show planned exercises when there are no sessions, keep it but ensure no race overwrites with empty when we have sessions.
- **C) Separate view**: Have a distinct "Plan" vs "Workouts" toggle so the user explicitly chooses. More complex.

**Recommendation**: A for now — remove "Planned for X" to eliminate that source of flicker. Re-add later if needed, after races are fixed.

### 5.4 Request cancellation / ignore stale for day switch

**Problem**: When switching days quickly, we fire multiple requests. The stale guard helps, but we could add an explicit "request id" or "generation" counter: each new load increments a counter; when a request completes, it checks if its generation matches the current one. If not, discard.

**Fix**: Add `loadSessionsGenerationRef`. When starting loadSessionsForDay for day X, increment it and capture `gen = loadSessionsGenerationRef.current`. When the request completes, if `gen !== loadSessionsGenerationRef.current`, discard. When switching days, we'd increment again, so the old request would see a different gen and discard.

### 5.5 Throttle / debounce refetch on focus

**Problem**: useFocusEffect depends on templateData. When loadTemplate sets templateData, effect re-runs and may trigger another load.

**Fix**: Throttle the refetch branch: only refetch when `now - lastPlanRefetchRef >= 3000`. Prevents loop.

### 5.6 Ensure loadTemplate uses selected day for sessions

**Fix**: Before calling loadSessionsForDay inside loadTemplate, set `selectedDayNameRef.current` from the current selection. Use `fullTemplate.days[selectedDayIndex]` or a ref that tracks selected day. Pass `dayName: selectedDayNameRef.current` to loadSessionsForDay. (Need to be careful: loadTemplate doesn't have selectedDayIndex in closure. Use a ref `selectedDayIndexRef` that's updated when selectedDayIndex changes.)

---

## 6. Implementation Order

1. **Add selectedDayIndexRef** (or selectedDayNameRef is enough) — ensure it's updated whenever selectedDayIndex changes.
2. **loadTemplate loads for selected day** — pass `dayName: selectedDayNameRef.current` to loadSessionsForDay. Read selectedDayNameRef; it's set by the useEffect when selectedDayIndex changes. But loadTemplate runs from init/recovery before the user has switched days. On first load, selectedDayIndex is set to today by loadTemplate. So selectedDayNameRef might not be set yet. We need to set it in loadTemplate when we set selectedDayIndex: `selectedDayNameRef.current = fullTemplate.days[selectedDayIndex]?.day.day_name ?? getTodayDayName()`.
3. **Remove "Planned for X" section** (if present in codebase) — simplifies UI and removes one source of flicker.
4. **Throttle refetch** — add lastPlanRefetchRef, skip refetch if within 3s.
5. **Avoid duplicate loadSessionsForDay on focus** — when loadTemplate will run (refetch or recovery), set loadTemplateDidTodayLoadRef = true so selectedDay block skips.
6. **Add generation counter for loadSessionsForDay** — optional, for extra safety when switching days quickly.

---

## 7. Files to Modify

- `app/(tabs)/planner.tsx` — all logic changes
- `documentation/DATA_FLOWS.md` — update Plan tab flow section if needed
- `documentation/progress_log.txt` — log the fix

---

## 8. Out of Scope (For Later)

- Session-level cache for getSessionsForToday (could reduce DB hits when switching back to a recently viewed day)
- Optimistic updates for Add workout / Delete workout
