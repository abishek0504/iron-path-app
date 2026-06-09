# watchOS companion

The watch app is a native SwiftUI mirror managed by [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets) so it survives `expo prebuild --clean`. React Native cannot run on watchOS.

## Layout

- `targets/watch/` — the watchOS app target (source of truth, outside `ios/`):
  - `expo-target.config.js` — target type, bundle id (`com.ironpath.app.watch`), deployment target, icon.
  - `IronPathWatchApp.swift` / `ContentView.swift` — SwiftUI mirror UI (current exercise, set X of Y, target, Complete Set, rest countdown, next-up).
  - `WatchWorkoutSession.swift` — watch-side `WCSession` delegate; receives `applicationContext` state, sends `completeSet` via `sendMessage` (reachable) or `transferUserInfo` (offline queue).
- `modules/watch-connectivity/` — iPhone-side local Expo Module wrapping `WCSession`:
  - `ios/WatchConnectivityModule.swift` — activates the session, pushes workout state, emits `onSetCompleted` events to RN.
  - `index.ts` — JS API (`updateWorkoutContext`, `clearWorkoutContext`, `addSetCompletedListener`); a no-op when the native module is absent (Expo Go, web, Android).
- `app/(stack)/workout/active.tsx` — pushes state on every phase/exercise change and handles watch completion events through the same `handleCompleteSet` path as the on-screen button. **The phone stays the canonical Supabase writer.**

## Build

1. Set the real `ios.appleTeamId` in `app.json` (currently a placeholder — requires Apple Developer enrollment).
2. `npx expo prebuild -p ios --clean` to generate the Xcode project with the watch target linked.
3. Build via Xcode (select the `IronPathWatch` scheme for watch-only runs) or EAS Build (codesigning for the extra target is handled by EAS).
4. Test `WCSession` on physical devices — simulator pairing is unreliable.
