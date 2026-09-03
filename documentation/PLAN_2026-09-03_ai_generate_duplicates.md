# Plan: AI generate duplicates + day-focus misses

Date: 2026-09-03
Status: in progress

## Research

User reproduced: defaults + Day focus = Push → Hip Thrust 3×8 appeared 7 times.

Live template slots (test user `2d44b33e-8ea7-469f-a2eb-8f0567ee21dd`, template `4cfc1e8a-2727-445c-84b5-4c8757ea5350`) already contained the same 2-exercise pair written 7 times on multiple days. Latest Push job itself returned 3 unique push lifts (`slots_created: 3`) and appended them. Two bugs:

1. `commit_ai_generation` appended slots. Rest-day path already cleared. Generate must replace the day's unperformed plan.
2. Day focus was prompt-only. Catalog was top-N by priority (includes Hip Thrust). `finalizeAiSessions` deduped by `exercise_id` but did not reject hinge/glute on Push.

## TODOs

- [x] Shared day-focus matcher (`src/lib/ai/dayFocus.ts` + Edge Function copy)
- [x] Client fallback clears day only when `committed !== true`
- [x] `commit_ai_generation` clears day before insert; skip duplicate `exercise_id`
- [x] Apply helper + commit rewrite on live Supabase
- [x] Unit tests for focus matching (recursion fix for `hamstrings` / `glutes`)
- [x] Empty leftover sessions deleted after replace (SQL + client)
- [x] Rest-day path uses `clearPlanDayForGeneration`
- [x] Deploy `generate-workout` v31 (`verify_jwt: true`). MCP cannot upload the 76KB three-file source; live v31 is an esbuild minify of `index.ts` + `jobs.ts` + `dayFocus.ts` (`tmp-generate-workout-min.js` pattern: `npx esbuild ... --bundle --format=esm --minify --external:jsr:@supabase/supabase-js@2`). Repo source stays readable.
- [x] Update ALGORITHMS / DATA_FLOWS / IMPLEMENTATION_STATUS / DATABASE_SCHEMA / progress_log
- [x] Live option matrix (22 cases) + planner UI on Thursday Push with `test123@gmail.com`

## Product rules

- One exercise identity per day (no Hip Thrust ×7).
- Push = push pattern / chest / anterior+lateral delts / triceps. Not hinge/glutes.
- Generate replaces that day's unperformed plan, not appends.

## Test matrix (browser)

| Option | Cases |
|---|---|
| Sessions | 0 (rest), 1, 2 |
| Exercises / session | Auto, 4, 8 |
| Intensity | light, standard, hard |
| Day focus | Let AI decide, Push, Pull, Legs, Upper, Lower (if shown) |
| Emphasize / Avoid | Chest, Back, Glutes at least |
| Stretches | 0, 2 |

Pass: unique lifts, focus-appropriate, no Hip Thrust on Push, replace (not grow) slot count.
