# Plan: iOS number-pad dismiss (2026-09-11)

iOS `decimal-pad` / `number-pad` / `numeric` has no Return key. React Native only injects a Next/Done accessory bar when `returnKeyType` is set. Several numeric fields were missing it, so users had to tap above the pad to dismiss.

Copy the batch-logging pattern in `app/(stack)/workout/active.tsx` (~2443–2514): `returnKeyType` next/done, `blurOnSubmit`, and `Keyboard.dismiss` on the last field. Use `next` + `onSubmitEditing` focus only where there is a natural adjacent chain.

Do **not** change bodyweight meaning, equipment selection, Complete Set layout, or paywall. Do not touch batch-logging fields that already have `returnKeyType`.

## TODOs

- [x] Add `src/lib/constants/numericKeyboard.ts` (`NUMERIC_DONE_PROPS` / `NUMERIC_NEXT_PROPS`, under 15 lines)
- [x] `app/onboarding.tsx` body weight: done + `Keyboard.dismiss` so pinned Next is reachable
- [x] `app/(stack)/workout/active.tsx` live weight → reps chain (not batch logging)
- [x] `app/add-exercise-edit.tsx` weight/reps/duration/rest chain
- [x] `src/components/ui/WeightEntrySheet.tsx`: done + BottomSheet `avoidKeyboard`
- [x] `app/log-past-workout.tsx` weight/reps/duration/RPE chain
- [x] `app/create-custom-exercise.tsx` min/max numeric pairs
- [x] `src/components/workout/SessionExerciseEditSheet.tsx` rest seconds only
- [x] Docs: `progress_log.txt` + `IMPLEMENTATION_STATUS.md` (skip `DATA_FLOWS.md` — no keyboard input behavior documented)
- [ ] Commit on `ux/fix-keyboard` (no push, no trailers)
