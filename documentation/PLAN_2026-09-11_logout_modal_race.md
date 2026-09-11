# Plan: Settings logout RootErrorBoundary (2026-09-11)

Worktree: `iron-path-wtrees/logout` · Branch: `ux/fix-logout`

## Bug

Settings → Log Out hits `RootErrorBoundary` ("Something went wrong").

`SettingsMenu.handleLogout` calls `onClose()` then immediately `signOut` + `router.replace('/login')` while the RN Modal is still animating (~280ms). Tab `useSessionGuard` on `SIGNED_OUT` concurrently `router.replace('/get-started')` and mounts `AuthVideoBackground`. Dual navigation + Modal teardown crashes.

## TODOs

- [x] Research current logout, session guard, paywall `runAfterBottomSheetClosed` pattern
- [x] `SettingsMenu.handleLogout`: queue work with `runAfterBottomSheetClosed`, then `onClose`. After close: try/catch, `beginExplicitLogout`, `signOutAndClearLocalState`, toast, `router.replace('/get-started')`. Clear flag on error. Do not navigate before the sheet is fully closed.
- [x] `signOutAndClear.ts`: module-level `beginExplicitLogout()` / `consumeExplicitLogout()`; wrap `signOutAndClearLocalState` in try/catch
- [x] `app/(tabs)/_layout.tsx` `SIGNED_OUT`: still `setAuthenticated(false)` + `clearLocalAuthState()`; skip `router.replace` when `consumeExplicitLogout()` is true
- [x] Cheap dashboard `setProfile` guard after `getUserProfileCached` (store null / id mismatch). Planner has no `setProfile` — skip.
- [x] Delete-account: keep `/login`; close the sheet before navigating; `beginExplicitLogout` so the session guard does not dual-nav to `/get-started`
- [x] Docs: DATA_FLOWS, SYSTEM_ARCHITECTURE, progress_log, IMPLEMENTATION_STATUS
- [ ] Commit (no trailers, no push)
