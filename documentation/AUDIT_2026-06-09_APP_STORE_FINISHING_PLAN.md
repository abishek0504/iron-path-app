# App Store Finishing Plan — Full Audit (2026-06-09)

Double-check audit of all work marked completed in the "App Store Finishing Plan". Six parallel code audits (one per phase) plus independent verification against the live Supabase project, hosted URLs, and local test/typecheck/lint suites.

> **Status update 2026-06-11**: items resolved since this audit are annotated inline with "Done/Fixed/Superseded 2026-06-11"; re-verified open items are marked "still open". Unannotated items were not re-checked.

---

## 1. Verdict at a glance

| Phase | Verdict | Summary |
|---|---|---|
| 1 — Workout flow parity | 🟡 5 verified / 3 partial | Set types missing from add-exercise-edit; multi-select missing from add-exercise.tsx; warmup PR race |
| 2 — AI verify + polish | 🟡 Done with caveats | Gemini "live verify" never actually re-verified; minor UX/messaging bugs |
| 3 — Phone HealthKit | 🟢 Done | Approach deviation (kingstinct lib, app.json privacy manifest); fully wired |
| 4 — Watch companion | 🟢 Done in source | Operational items remain (team ID, device testing); 2 hardening gaps |
| 5 — Compliance & ops | 🟡 Code done | Legal URLs 404 live; Sentry/Apple placeholders; dashboard toggle missed |
| 6 — Cleanup, tests, docs | 🟡 Safe but incomplete | 3 dead imports; stale SYSTEM_ARCHITECTURE; 2 planned test areas missing |

### Independent live-infrastructure verification

| Check | Result |
|---|---|
| Migrations applied to live DB | ✅ All 4 new migrations applied (45 total): `workout_flow_set_types_supersets_rest`, `pr_trigger_exclude_warmups`, `purge_soft_deleted_accounts_cron`, `security_advisor_remediation` |
| New columns in live DB | ✅ `set_type`, `superset_group`, `rest_sec`, `hk_workout_uuid`, `hk_sample_uuid`, `deleted_at`/`scheduled_purge_at` all present |
| pg_cron purge job | ✅ `purge-soft-deleted-accounts`, schedule `0 3 * * *`, active |
| Function hardening | ✅ `search_path = public, pg_temp` pinned on all 6 public functions; anon/authenticated EXECUTE revoked on `handle_new_user`, `trigger_upsert_exercise_pr`, `purge_soft_deleted_accounts` |
| Edge functions | ✅ 3 ACTIVE: `generate-workout` v5, `delete-account` v5, `update-muscle-freshness` v7 |
| `v2_ai_generations` | ⚠️ Exactly 1 `gemini` row, dated **2026-05-10** — no generation since |
| Security advisors | ⚠️ `auth_leaked_password_protection` still disabled; remaining lint-0027 warnings are authenticated-GraphQL visibility (expected, RLS-protected) |
| Performance advisors | INFO only: 1 unindexed FK (`v2_ai_generations.template_id`), ~30 "unused index" notices (low traffic — expected) |
| `https://tryironpath.com/privacy` / `/terms` | ❌ Both return "Page not found" |
| `npx tsc --noEmit` | ✅ Clean |
| `npx vitest run` | ✅ 3 files, 19 tests pass |
| `npx eslint .` | ⚠️ 3 errors (all `jsr:` Deno imports in edge functions — resolver limitation), 100 warnings |

---

## 2. Findings that contradict "completed" status

1. **Gemini was not re-verified live.** The `ai-verify-polish` todo is marked completed, but `v2_ai_generations` contains exactly one `source='gemini'` row dated 2026-05-10 — nothing since. The plan required a fresh dev-build generation to confirm the key hasn't expired. — **Superseded 2026-06-10**: backend migrated Gemini → OpenAI (`generate-workout` rewritten, deployed v14; migration `20260610000000_ai_generations_openai_source`); ≥1 `source='openai'` row in live `v2_ai_generations` confirms a real generation.
2. **Legal URLs are live-404.** `https://tryironpath.com/privacy` and `https://tryironpath.com/terms` both return "Page not found". Content in `legal/privacy.md` / `legal/terms.md` is complete (Supabase, Gemini, HealthKit, Sentry, account deletion), and `LegalLinks` renders on signup, settings, and help — so the app currently links users to 404s. Hard App Store blocker. — **Still open 2026-06-11** (both URLs re-verified 404).
3. **Leaked-password protection is still disabled** (confirmed via live security advisors). The remediation migration's own comment defers it to the dashboard; it was never toggled. One-click fix: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). — **Still open 2026-06-11** (re-verified via security advisors).
4. **Set types missing from `app/add-exercise-edit.tsx`** — zero `set_type` UI or inserts; every set added via that screen defaults to `normal`. The plan named this file explicitly. — **Done 2026-06-11**: `set_type` is now part of the screen's set model with a warm-up toggle and persisted inserts.
5. **`app/add-exercise.tsx` has no multi-select** — only the active-workout add flow got `multiSelect`; the full-page screen still adds one exercise at a time. — **Still open 2026-06-11**.
6. **`update-muscle-freshness` edge function does not exclude warmups** — client-side stress queries filter `.neq('set_type','warmup')`, but the deployed freshness function counts all sets (index.ts lines 182–265), so warm-ups still inflate muscle stress. — **Done 2026-06-11**: function now filters `.neq('set_type','warmup')` (index.ts:187) and is deployed (v13).

---

## 3. Bugs found in new code

| # | Bug | Severity | Location |
|---|---|---|---|
| 1 | **Warmup PR race**: "Complete Set" calls `markSetComplete` without `set_type` → PR trigger fires as `normal` and may upsert a PR; re-tagging as warmup in logging never revokes it — **Fixed 2026-06-11**: `active.tsx` now preserves `set_type` when completing via tap/watch | High | `app/(stack)/workout/active.tsx:594-604` + PR trigger |
| 2 | Watch `completeSet` listener ignores `sessionId`/`setNumber` — a stale `transferUserInfo` replay could complete the wrong set (still present 2026-06-11) | Medium | `app/(stack)/workout/active.tsx:220-223` |
| 3 | `as? Int` casts on WCSession plist values (`NSNumber`) can fail → watch shows "Set 0 of 0" (still present 2026-06-11) | Medium | `targets/watch/WatchWorkoutSession.swift:60-61` |
| 4 | 403 (template not owned) surfaces as "Session expired — please log in again" | Low | `src/lib/ai/generateWorkoutDay.ts:166-173` + `planner.tsx:1245` |
| 5 | AI-returned empty/`rest` result doesn't clear slots (only the user-entered `0` path does) | Low | `planner.tsx:1258-1266` |
| 6 | Route mismatch: "Continue anyway" → `/workout/active`, "Smart adjust" → `/(stack)/workout/active` (still present 2026-06-11) | Low | `planner.tsx:2349` vs `:2482` |
| 7 | Multi-add batch insert hardcodes `custom_exercise_id: null` — custom exercises can't be batch-added (still present 2026-06-11) | Low | `active.tsx:801-805` |
| 8 | Quota copy at 0 remaining says "local engine will be used" but the call hard-stops with an error toast | Low | `planner.tsx:2128` vs `:1236-1241` |
| 9 | `getExerciseHistory` includes warmups — affects "Last / PR" on add-exercise screen — **Fixed 2026-06-11**: query now filters `.neq('set_type','warmup')` | Low | `workouts.ts:1509-1535` |
| 10 | Auth detection depends on `error.context.status`; if supabase-js doesn't expose `context`, auth errors silently fall back to local generation | Low | `generateWorkoutDay.ts:94-107` |
| 11 | Duplicate `setRebalanceResult(null)` calls (still present 2026-06-11) | Trivial | `planner.tsx:2493`, `:2495` |

---

## 4. Phase 1 — Workout flow (Hevy-level parity)

**Score: 5 VERIFIED · 3 PARTIAL · 0 fully NOT DONE**

| # | Item | Status |
|---|---|---|
| 1 | Schema + PR trigger migrations | VERIFIED |
| 2 | Per-exercise rest timer | VERIFIED |
| 3 | Previous performance inline | VERIFIED |
| 4 | Set types + warmup exclusions | PARTIAL → **Done 2026-06-11** (add-exercise-edit `set_type` UI; freshness fn warmup filter deployed v13; PR race fixed) |
| 5 | Supersets | VERIFIED |
| 6 | Replace + reorder | PARTIAL |
| 7 | Multi-select exercise add | PARTIAL |
| 8 | Future-day session bug fix | VERIFIED |

### Detail

- **Schema (VERIFIED)** — `20260609000000_workout_flow_set_types_supersets_rest.sql`: `v2_session_sets.set_type` text NOT NULL DEFAULT 'normal' CHECK (normal|warmup|drop|failure); `superset_group` + `rest_sec` (CHECK 0–3600) on `v2_session_exercises` and `v2_template_slots`. `20260609000001_pr_trigger_exclude_warmups.sql`: early return on `NEW.set_type = 'warmup'`, full trigger rewrite with pinned `search_path`. Types regenerated in `src/types/supabase.gen.ts` (note: `set_type` typed as `string`, not the app's `SetType` union).
- **Rest timer (VERIFIED)** — no hardcoded `durationSec={90}`. `resolveRestSec()` in `src/lib/engine/workoutFlow.ts:23-28` resolves exercise → set → 90s default; used in `active.tsx` (RestTimer at 1322/1332, watch context at 271/281). Edit control in `SessionExerciseEditSheet.tsx:286-299` persists to `v2_session_exercises.rest_sec`. Auto-starts on set completion via `findNextStep` → rest phase. Unit-tested.
- **Previous performance (VERIFIED)** — `getPreviousExercisePerformance()` (`workouts.ts:1410-1478`, warmups excluded). Rendered in execution phase ("Last time: …", `active.tsx:1244-1260`) and logging phase ("Previous: …" per row, `:1384-1397`). Note: inline context, not a full Hevy-style set table.
- **Set types (PARTIAL)** — active.tsx: read-only badge in execution (1226-1232), tappable cycling chips in logging (1359-1381), persisted in `handleSaveAndContinue`. `SessionExerciseEditSheet.tsx`: per-set chips + persist (307-329). **`add-exercise-edit.tsx`: NOT DONE** (zero matches) — *Done 2026-06-11: `set_type` model + warm-up toggle + persisted inserts added*. Client warmup exclusions verified in `workouts.ts` (YTD volume :682, prev performance :1443, muscle stress :1692). **Edge function `update-muscle-freshness`: NOT DONE** (no warmup filter) — *Done 2026-06-11: warmup filter added and deployed (v13)*. Set type is only editable in the logging phase, after first completion → PR race (bug #1) — *Fixed 2026-06-11 (set_type preserved on completion)*.
- **Supersets (VERIFIED)** — `findNextStep()` alternates within `superset_group`, rest only on round wrap. Active: badge UI (1197-1207), toggle via overflow menu (966-1009, 1594-1609), `setSessionSupersetGroup` (`workouts_helpers.ts:370`). Planner: `handleToggleSlotSuperset` (914-958), "Superset A/B" chips (1683-1715), link/unlink button (1723-1727). Session materialization copies `superset_group` + `rest_sec` from slots (`(tabs)/index.tsx:736-737`). Unit-tested (5 superset cases).
- **Replace + reorder (PARTIAL)** — replace-in-place verified with completed-sets guard (`active.tsx:947-949`); `swapExercise` deletes old sets and re-prefils. `reorderSlots`/`updateNotes` are real implementations in both `workouts_helpers.ts` (263-312) and `templates.ts` (807-826) — no longer stubs. Gap: active-workout reorder is an **arrow-button modal** (1012-1048, 1650-1669), not drag (planner has drag). Minor: session reorder uses 1-based `sort_order`, template/creation use 0-based.
- **Multi-select (PARTIAL)** — `ExercisePicker` multiSelect + confirm footer verified; active-workout add flow uses it with batch insert + `prefillSessionSets` (770-828). **`add-exercise.tsx`: NOT DONE** — single-exercise flow, no picker/multiSelect/batch.
- **Future-day bug fix (VERIFIED)** — `add-exercise-edit.tsx:385-415`: `isEditingToday` gate; future days no longer call `getOrCreateActiveSessionForToday`.
- Other notes: rest validation mismatch — UI caps rest at 600s (`REST_MAX`), DB allows 3600s.

---

## 5. Phase 2 — AI generation + Smart Adjust

| # | Item | Status |
|---|---|---|
| 1 | `remainingToday` + modal display | VERIFIED (hidden until first gen; misleading copy at 0) |
| 2 | Loading overlay | VERIFIED |
| 3 | Auth errors surfaced | VERIFIED (403 mislabeled; context-dependent detection) |
| 4 | Rest-day slot clearing | VERIFIED for user `0` input; PARTIAL for AI-returned empty/`rest` |
| 5 | Smart Adjust wiring | VERIFIED (planner load, not Workout tab) |
| 6 | Edge function audit/quota | VERIFIED (rolling 24h window; messaging bug) |
| 7 | `workoutFlow.ts` + tests + usage | VERIFIED — not dead code |

### Detail

- **Quota display** — `GenerateAiDayResult` carries `remainingToday` (`generateWorkoutDay.ts:20-31`); shown in the sessions-per-day modal (`planner.tsx:2124-2129`) and success toast (1396-1401). Hidden until the first AI call; at 0 the copy claims local fallback but `quota_exceeded` hard-stops.
- **Loading overlay** — full-screen `Modal` + `ActivityIndicator` (`planner.tsx:2166-2177`), `isGenerating` set/cleared in try/finally.
- **Auth errors** — 401/403 → `{ source: 'auth_error' }` with no local fallback (`generateWorkoutDay.ts:166-173`); toast in planner (1244-1246). Caveats: detection relies on `error.context.status`; 403 "template not owned" shows "Session expired".
- **Rest day** — user-entered `0` deletes slots and unperformed session exercises (`planner.tsx:1181-1225`, early return before AI call). The `source === 'rest'` and empty-sessions branches do not clear slots (currently unreachable/edge paths).
- **Smart Adjust** — triggers once per planner mount after template load when today has slots and no session started (`planner.tsx:186-219`); `needsRebalance` at :201 → `SmartAdjustPrompt` (2239-2497). Dismiss / Continue-anyway / Smart-adjust flows all implemented; Smart-adjust prepends catch-up exercises via `getRebalanceExercises`. Not wired on the Workout tab (deviation from DATA_FLOWS design; matches IMPLEMENTATION_STATUS). No orphaned imports.
- **Edge function** — writes `v2_ai_generations` with `source` ('gemini'|'fallback'|'error'); `DAILY_QUOTA = 10` over a rolling 24h window with 429 + `remainingToday`. 401/403/400/429 responses skip the audit ledger. Server counts quota even when LLM fails and client falls back locally (intentional).
- **`workoutFlow.ts`** — `resolveRestSec`, `getSupersetMembers`, `findNextStep`; 14 unit tests; imported and used throughout `active.tsx`.

---

## 6. Phase 3 — Phone HealthKit + privacy manifest

| # | Item | Status |
|---|---|---|
| 1 | HealthKit lib + entitlement | VERIFIED (`@kingstinct/react-native-healthkit`, not planned `react-native-health`) |
| 2 | `expo-build-properties` + PrivacyInfo wiring | PARTIAL — manifest via `app.json` instead; root plist out of sync |
| 3 | `healthIntegration.ts` implementation + wiring | VERIFIED |
| 4 | Live connect flow + dashboard card | VERIFIED |
| 5 | Migration ↔ client schema match | VERIFIED |
| 6 | Platform guards (Android/Expo Go) | VERIFIED — graceful degrade, no crash |

### Detail

- **Library** — `@kingstinct/react-native-healthkit` (`package.json:27`) + `react-native-nitro-modules`; config plugin in `app.json:109-116` with usage strings and `background: false`; `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` in `app.json:29-30`. Entitlement injected at prebuild by the plugin (no committed `ios/` to verify).
- **Privacy manifest** — wired via `expo.ios.privacyManifests` in `app.json:32-85` (email, user ID, fitness, other content, **crash data**; UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1; `NSPrivacyTracking: false`). `expo-build-properties` was never added (plan deviation). Root `PrivacyInfo.xcprivacy` is documentation-only per its own header and **omits the CrashData entry** that `app.json` declares — out of sync.
- **Implementation** — `requestAppleHealthAccess` (104-140), `writeCompletedWorkoutToHealth` (147-185), `writeBodyMassToHealth` (191-231), HK UUID persistence (171-175, 217-221), `updateSyncLedger` → `v2_health_sync` (83-98), `importHealthSamplesForDashboard` (244-298).
- **Wiring** — session completion: `active.tsx:749` → `completeWorkoutSession()` → HK write (`workouts.ts:448-484`); weight: `WeightTrackerCard.tsx:179-181` and `onboarding.tsx:274-278` → `insertWeightLog` → HK write (`weight.ts:61-67`); connect: `health-connect.tsx:33-36`; settings entry `SettingsMenu.tsx:124-126`.
- **UI** — `health-connect.tsx` live (routed at `_layout.tsx:93-96`); dashboard "Apple Health" card with Connect button (`dashboard.tsx:401-415`); zero "coming soon" matches repo-wide.
- **Guards** — `Platform.OS !== 'ios'` early returns, lazy require + try/catch, `isHealthDataAvailable()` check, public APIs never throw, explicit Expo Go message. Android gets `state: 'unavailable'`.
- Minor: import path doesn't gate on read authorization (silent catch); `DEVELOPMENT_BUILD.md:12` still says "replace the stub" — stale.

---

## 7. Phase 4 — Apple Watch companion

| # | Item | Status |
|---|---|---|
| 1 | `@bacons/apple-targets` + target config | VERIFIED (team-ID placeholders) |
| 2 | Watch SwiftUI + WCSession + offline queue | VERIFIED (`Info.plist` PARTIAL in source) |
| 3 | iPhone Expo module + TS fallback | VERIFIED |
| 4 | RN integration + payload alignment | VERIFIED (event validation PARTIAL) |
| 5 | EAS/app.json + README | PARTIAL |

### Detail

- **Config** — `@bacons/apple-targets@^4.0.7` (`package.json:26`), plugin in `app.json:117`; `targets/watch/expo-target.config.js`: `type: 'watch'`, bundle suffix → `com.ironpath.app.watch`, deploymentTarget 9.4.
- **Watch app** — `WatchWorkoutSession.swift`: WCSession activation (27-33), `didReceiveApplicationContext` + activation-time context apply (37-51), state parsing (55-74), `completeCurrentSet()` with `sendMessage` → `transferUserInfo` fallback (89-112). `ContentView.swift`: idle/execution/rest/logging/complete phases — exercise name, set X of Y, target, Complete Set, `TimelineView` rest countdown from `restEndsAt`, next-up, superset label. `Info.plist` only contains `WKApplication` in source; companion bundle ID expected at prebuild.
- **Phone module** — `WatchConnectivityModule.swift` (Expo Modules API): `updateWorkoutContext` → `updateApplicationContext`, `clearWorkoutContext`, events `onSetCompleted`/`onWatchStateChanged`; full delegate set; `handleIncoming` filters `type == "completeSet"`. Podspec iOS 15.1+, `expo-module.config.json` apple-only. `index.ts`: `requireOptionalNativeModule` + iOS gate; no-ops in Expo Go/Android; listener returns a no-op unsubscribe when native module missing. `onWatchStateChanged` has no exported TS listener (observability only).
- **RN integration** — all in `active.tsx`: completion listener (212-228) routes through `handleCompleteSetRef` → `handleCompleteSet` → `markSetComplete` (phone stays canonical); state pushed on every phase/exercise change (231-299) including rest `restEndsAt`; `clearWorkoutContext` on unmount. Payload keys match across TS ↔ phone Swift ↔ watch Swift.
- **Gaps/risks** — listener ignores event `sessionId`/`setNumber` (stale replay risk, bug #2); `as? Int` NSNumber coercion (bug #3); `appleTeamId` placeholders in `app.json:25` and `eas.json:52` (blocks signing); no watch-specific EAS block (likely fine — plugin handles at prebuild); `DEVELOPMENT_BUILD.md:6` ("watch is not managed by Expo") contradicts `native/watch/README.md:3`; physical-device WCSession testing still required. `[weak self]` used correctly; no retain cycles found.

---

## 8. Phase 5 — Compliance & ops

| # | Item | Status | Remaining blocker |
|---|---|---|---|
| 1 | Legal pages | PARTIAL | Host `legal/*.md` at tryironpath.com (**confirmed 404 live**; still 404 re-verified 2026-06-11) |
| 2 | Account purge job | VERIFIED (applied + cron active, confirmed live) | Consider avatar storage cleanup |
| 3 | Security remediation | VERIFIED (applied, confirmed live) | Enable leaked-password protection (dashboard — still disabled 2026-06-11) |
| 4 | EAS production env | PARTIAL | Real Sentry DSN; consider EAS secrets; Apple IDs (`app.json` `appleTeamId` now set 2026-06-11; `eas.json` submit `ascAppId`/`appleTeamId` still placeholders) |
| 5 | Sentry | PARTIAL | DSN, org, `SENTRY_AUTH_TOKEN`; optional `enabled: !__DEV__` |
| 6 | Privacy manifest | PARTIAL | Sync root file with `app.json`; ASC questionnaire alignment |
| 7 | CI | PARTIAL | Add `npm run lint:eslint` if desired |

### Detail

- **Legal** — content complete in `legal/privacy.md` / `legal/terms.md` (Supabase, Gemini, HealthKit, Sentry, 30-day deletion). URLs in `src/lib/utils/legal.ts:15-16`; `LegalLinks` rendered on signup (`signup.tsx:354`), settings (`SettingsMenu.tsx:197-198`), help (`help-support.tsx:175-176`). **Both URLs 404 as of this audit.**
- **Purge job** — `purge_soft_deleted_accounts()`: SECURITY DEFINER, pinned search_path, batch cap 50, deletes `auth.users` (cascades to all `v2_*` via ON DELETE CASCADE), revoked from public/anon/authenticated; cron `0 3 * * *` confirmed active in live DB. Consistent with `delete-account` edge function (30-day grace), UI copy, and restore flow (`login.tsx:98-99`, `users.ts:164-177`). Gap: avatars in storage have no FK — orphaned after purge.
- **Advisor remediation** — `20260609000003`: search_path pinned on `adjust_bw_exercises`/`adjust_plan_data` (others already pinned); anon+public EXECUTE revoked on `handle_new_user`/`trigger_upsert_exercise_pr`; broad avatars listing policies dropped (owner-scoped remain; public bucket URLs unchanged); `revoke all ... from anon` across `v2_*` + default privileges. All confirmed in live DB. Leaked-password protection explicitly deferred to dashboard — **still off**.
- **EAS env** — production/preview profiles carry `EXPO_PUBLIC_SUPABASE_URL` + anon key (hardcoded JWT in git — public by design, EAS secrets preferred) and `EXPO_PUBLIC_SENTRY_DSN: REPLACE_WITH_SENTRY_DSN`. Submit profile `ascAppId`/`appleTeamId` placeholders (expected — Apple enrollment is the one legitimately pending plan todo). No service-role/Gemini/Sentry tokens committed.
- **Sentry** — `@sentry/react-native` installed; expo plugin in `app.json:118-124` with `organization: REPLACE_WITH_SENTRY_ORG`; `initSentry.ts` no-ops on web/missing DSN, `tracesSampleRate: __DEV__ ? 0 : 0.15`, strips email from breadcrumbs; called from `_layout.tsx:24`. Gaps: no real DSN/org, `SENTRY_AUTH_TOKEN` EAS secret needed for dSYM upload, no `enabled: !__DEV__`.
- **CI** — `.github/workflows/ci.yml`: Node 22, `npm ci`, `npm run lint` (= `tsc --noEmit`), `npm test` (vitest). ESLint not run in CI (`lint:eslint` script exists). Current ESLint errors: 3 × `jsr:` import resolution in Deno edge functions.

---

## 9. Phase 6 — Cleanup, tests, docs

| # | Item | Status |
|---|---|---|
| 1 | Orphan deletion (code/routes) | VERIFIED — zero dangling imports or route refs |
| 1b | Orphan deletion (docs) | PARTIAL — stale refs in SYSTEM_ARCHITECTURE, ALGORITHMS, progress_log |
| 2 | Dead imports in `planner.tsx` | PARTIAL — 3 remain |
| 3 | Documentation refresh | PARTIAL |
| 4 | Vitest setup + plan coverage | PARTIAL — infra OK; 2 planned areas untested |
| 5 | New-file orphan scan | VERIFIED — all new modules imported/routed |
| 6 | Supabase types for new columns | VERIFIED |

### Detail

- **Deleted files clean** — `ActiveSetCard.tsx`, `ExerciseTimer.tsx`, `EditScopePrompt.tsx`, `CustomExerciseForm.tsx`, `app/exercise-detail.tsx`, `app/planner-day.tsx` gone; zero code imports or navigation references. Doc-only leftovers: `SYSTEM_ARCHITECTURE.md:176` (ActiveSetCard), `ALGORITHMS.md:373`.
- **Dead imports in `planner.tsx`** — `FlatList` (line 14), `upsertTemplateDay` (33), `syncTemplateSlotToSessionsForDay` (67). All other imports used.
- **Docs** — `IMPLEMENTATION_STATUS.md` largely current (dated 2026-06-09); stale bits: "Select Scope" testing-checklist step (line 370), historical swipe-to-complete description (330). `SYSTEM_ARCHITECTURE.md` mixed: new sections for workout state machine/Health/watch are accurate, but it still claims `ActiveSetCard.tsx` exists, describes the old swipe UI (183-196), says heatmap uses Skia (202-220; actual: `react-native-body-highlighter`), keeps a fixed RLS "TODO" (168-172), and "TODO: Add automated tests" (624). Sentry and legal pages undocumented there. `DEVELOPMENT_BUILD.md` contradicts the watch README and still calls HealthKit a stub.
- **Tests** — `vitest.config.ts` (node env, `src/**/*.vitest.ts`), `test` script, CI wired. 3 files / 19 tests, all passing: `workoutFlow.vitest.ts` (rest resolution, superset members, next-step navigation — **covers superset rest logic per plan**), `date.vitest.ts`, `muscleFreshness.vitest.ts`. **Missing vs plan:** set-type PR exclusion (SQL trigger logic untested) and rebalance trigger (`needsRebalance` has no test).
- **New modules wired** — `workoutFlow.ts`, `haptics.ts`, `notifications.ts`, `ThemeContext.tsx`, `workout-reminders.tsx`, `auth/change-password.tsx`, `health-connect.tsx` all imported/routed.
- **Types** — `supabase.ts` is a re-export barrel over `supabase.gen.ts`; new columns (`set_type`, `superset_group`, `rest_sec`, `hk_workout_uuid`, `hk_sample_uuid`) present.

---

## 10. Confirmed solid (no action needed)

- Schema migrations + live DB state match the plan exactly
- Per-exercise rest timer chain (`resolveRestSec` → `RestTimer`), no hardcoded 90s
- Inline previous performance in execution + logging phases
- Superset alternation/shared rest with passing unit tests
- Future-day add-exercise bug fix
- Replace-in-place with completed-set guard; `reorderSlots`/`updateNotes` real implementations
- AI loading overlay, quota display, auth-error surfacing
- Watch round-trip (context push, completeSet, offline `transferUserInfo` queue) with consistent payload keys and graceful Expo Go/Android fallbacks
- Soft-delete ↔ purge ↔ UI copy consistent at 30 days; purge cron live
- Advisor remediation correctly applied and verified against the live database
- Orphan deletion left zero dangling imports/routes
- Typecheck clean, all 19 tests green

---

## 11. Recommended priority order before TestFlight

1. **Publish `legal/*.md` to tryironpath.com** — app already links to 404s (App Store blocker) — *still open 2026-06-11 (re-verified 404)*
2. **Run one real Gemini generation from a dev build** — truly close `ai-verify-polish` — *Superseded 2026-06-10: backend migrated to OpenAI (migration 20260610000000, `generate-workout` v14); live `source='openai'` generation row confirmed*
3. **Fix the warmup PR race** — pass `set_type` at completion, or revoke/recompute PR on retag — *Done 2026-06-11 (`active.tsx` preserves `set_type` on tap/watch completion)*
4. **Enable leaked-password protection** — Supabase dashboard, 1 minute — *still open 2026-06-11 (re-verified via security advisors)*
5. **Add warmup exclusion to `update-muscle-freshness`** and redeploy — *Done 2026-06-11 (`.neq('set_type','warmup')`, deployed v13)*
6. **Harden watch events** — validate `sessionId`/`setNumber`; use `NSNumber`-safe parsing — *still open 2026-06-11*
7. **Sync `PrivacyInfo.xcprivacy` with `app.json`** (CrashData entry); sweep stale docs (`SYSTEM_ARCHITECTURE.md`, `DEVELOPMENT_BUILD.md`); drop the 3 dead `planner.tsx` imports — *partial 2026-06-11: PrivacyInfo CrashData still missing; dead imports still present; status docs (IMPLEMENTATION_STATUS/00_INDEX) refreshed*
8. **Fill Sentry DSN/org + Apple IDs** once enrollment completes (the one plan todo legitimately still pending) — *partial 2026-06-11: `app.json` `appleTeamId` set; Sentry DSN/org and `eas.json` submit IDs still placeholders*
9. Optional hardening: set-type UI in `add-exercise-edit.tsx` (*Done 2026-06-11*), multi-select in `add-exercise.tsx`, custom exercises in batch add, tests for `needsRebalance` + warmup PR exclusion, ESLint in CI, avatar cleanup on purge — *rest still open*
