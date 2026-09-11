# Plan: Bodyweight added-load contract (2026-09-11)

## Contract

`v2_session_sets.weight` is **added load**, not total system weight and not `v2_profiles.current_weight`.

| Value | Meaning |
|-------|---------|
| `0` | Bodyweight / no extra load |
| `null` | Unset or timed |
| `> 0` | Extra load (belt / vest / DBs) |

Do **not** add `is_bodyweight`. Do **not** autofill profile lbs into pull-ups.

## TODOs

- [x] Helper `src/lib/workout/addedLoad.ts` + `BodyweightLoadToggle`
- [x] Preserve `0` on prefill / session-edit save (`|| null` → `?? null`)
- [x] Resume: completed BW sets (weight `0`) stay complete
- [x] Overload: skip +2.5 lb when `lastWeight` is `0`
- [x] Watch target: null-check so `0` can show as Bodyweight
- [x] Logging UX: BW chip; hide warmups / no BW toast
- [x] AI prompts: never copy `current_weight`; calisthenics stay null/0
- [x] Docs + vitest + commit
