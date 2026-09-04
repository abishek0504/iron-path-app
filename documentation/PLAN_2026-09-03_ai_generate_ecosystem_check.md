# Plan: Verify AI generate still honors fatigue, weight, PRs, progress, manual edits

Date: 2026-09-03
Status: done

## What generate is supposed to take into account

1. Muscle freshness (48h) in the LLM prompt
2. Per-exercise history (60d, warmups excluded) for progressive overload / weight
3. Profile weight + units via `resolve_ai_exercise_targets`
4. Performed sets / PRs must survive replace (only unperformed plan rows are cleared)
5. Completed sessions stay completed; freshness/PR triggers are independent
6. After generate, planner add / edit / reorder / delete still work on the new slots

## TODOs

- [x] Confirm generate-workout still fetches freshness + history and still calls resolve_ai_exercise_targets on commit
- [x] Live SQL: Thursday generated sets have weights/reps; PRs and freshness rows intact
- [x] Confirm clear_plan_day never deletes performed sets or completed sessions
- [x] Run related unit tests (dayFocus, generateWorkoutDay, muscleFreshness, workoutFlow)
- [x] Confirm planner manual-edit paths still wired after rest-day refactor
- [x] Fill null LLM weight from prescription × bodyweight (`20260903150000` + client fallback)

## Evidence (test user `2d44b33e-8ea7-469f-a2eb-8f0567ee21dd`)

| Check | Result |
|---|---|
| Freshness fetch | Still in `generate-workout` Promise.all, 48h filter. 28 rows stored; 0 in last 48h. |
| History fetch | Completed, non-warmup, 60d. This user: 0 sets in window (last completed 2026-01-31). |
| Thursday job `d438c1a5-…` | LLM `weight: null` on all 5 lifts; reps/sets present. |
| Weight after fix | Bench 156.5, Incline 44, OHP 75; LLM 185 kept. |
| PRs | 1 row: Calf Raise 31.5 × 10 (`pr_type=weight`). |
| Progress | 1 completed session, 7 performed sets still present. |
| Manual edits | `applyStructureEditToSession` / `applyStructureEditToTemplate` / `reorderTemplateSlots` / Add Exercise still in `planner.tsx`. |
