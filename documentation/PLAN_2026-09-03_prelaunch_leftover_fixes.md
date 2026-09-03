# Plan: Five leftover prelaunch fixes (2026-09-03)

Isolated worktrees, then one commit per task on `V2-PrelaunchBugFixes`.

## Status

- [x] Adductors heatmap λ matches Edge Function (0.060) — `b1f948f`
- [x] AI 403 ownership errors are not labeled “Session expired” — `1893973`
- [x] Standalone Watch parses NSNumber integers like the phone-mirror path — `9532748`
- [x] Rest cap: unify `v2_session_sets.rest_sec` + add-exercise UI to 0–3600 — `ca22d9d`
- [x] Purge job deletes `avatars` storage objects before hard-delete — `281365e`
- [x] Five separate commits on `V2-PrelaunchBugFixes` (pushed)

## Constraints

- Do not edit `documentation/progress_log.txt` in the worktrees (parent updates after merge).
- Do not push from worktrees.
- Do not apply migrations to the live Supabase project.
- Touch only files owned by that task (avoids cherry-pick conflicts).

## Task ownership

| Task | Code | Docs |
|------|------|------|
| 1 Adductors | `src/lib/utils/muscleFreshness.ts`, `muscleFreshness.vitest.ts` | `documentation/ALGORITHMS.md` heatmap λ sentence only |
| 2 AI 403 copy | `src/lib/ai/generateWorkoutDay.ts`, `executeAiDayGeneration.ts`, `app/generate-ai.tsx` | Comments on the new union members only |
| 3 Watch NSNumber | `targets/watch/WatchStandaloneEngine.swift`, `WatchSupabaseClient.swift` | None unless a watch README already documents payload parsing |
| 4 Rest cap | `app/add-exercise-edit.tsx`, `SessionExerciseEditSheet.tsx` if it lacks a max, new migration widening `v2_session_sets.rest_sec` CHECK | `DATABASE_SCHEMA.md` `v2_session_sets.rest_sec` + migration list |
| 5 Avatar purge | New migration replacing `purge_soft_deleted_accounts()` | `DATABASE_SCHEMA.md` purge note, `SYSTEM_ARCHITECTURE.md` purge bullet, `DATA_FLOWS.md` Flow 7 |

## Notes

- Server λ for adductors is already `0.060` in `supabase/functions/update-muscle-freshness/index.ts`.
- `v2_session_sets.rest_sec` CHECK is 0–600 today; `v2_session_exercises` / `v2_template_slots` are 0–3600. Unify sets to 3600 rather than documenting a split.
- Avatar keys are `{user_id}-{timestamp}...` in bucket `avatars`. Delete those rows from `storage.objects` before `delete from auth.users`.
