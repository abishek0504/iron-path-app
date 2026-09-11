# Plan: Dashboard PR overflow + modal sheet grabber

Date: 2026-09-11
Branch: `ux/fix-prs`
Worktree: `iron-path-wtrees/prs`

## Research

- Dashboard Top PRs and Recent sessions share `listRow` / `listPrimary` / `listSecondary` in `app/(tabs)/dashboard.tsx`. Names have no `flexShrink` or `numberOfLines`, so long labels overflow the card.
- `/prs` is `presentation: 'modal'` with `gestureEnabled: true` and `headerShown` false (default stack). `ScreenHeader` shows X only — no iOS grabber.
- `BottomSheet` already has the visual: 44×4pt pill, `borderRadius` 2, `colors.cardBorder`.
- Sheet-like close-X modals: `app/prs.tsx` (ScreenHeader), `app/edit-profile.tsx` and `app/help-support.tsx` (custom headers). Back-chevron screens stay grabber-free.

## TODOs

- [x] Truncate dashboard list rows: `listPrimary` flex/shrink + `numberOfLines={1}` + margin; `listSecondary` no shrink; optional card `overflow: 'hidden'`
- [x] Add `showGrabber` to `ScreenHeader`; match BottomSheet drag handle
- [x] Enable grabber on `/prs`; add matching handle above edit-profile and help-support headers
- [x] Optional: make Top PRs header row tappable to `/prs`
- [x] Docs: `progress_log.txt`, `IMPLEMENTATION_STATUS.md`, Navigation section in `SYSTEM_ARCHITECTURE.md`
- [x] Commit on `ux/fix-prs` only
