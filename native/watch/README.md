# watchOS app (mirror + standalone)

The watch app is a native SwiftUI target managed by [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets) so it survives `expo prebuild --clean`. React Native cannot run on watchOS.

## Ownership model

Each `v2_workout_sessions` row has `control_device` (`phone` | `watch`). Only that device advances sets / rest / finish for the session. At most one `status='active'` session per user.

| Mode | Who starts | Who writes Supabase | Other device |
|------|------------|---------------------|--------------|
| Phone-only | iPhone | iPhone | Watch idle |
| Phone + mirror | iPhone | iPhone | Watch mirrors via WCSession (remote control) |
| Watch-standalone | Watch | Watch (direct REST + outbox) | Phone shows spectator / locked controls |

## Layout

- `targets/watch/` — watchOS app source of truth:
  - `ContentView.swift` — idle start, execution (Complete + optional Adjust), rest, RPE grid
  - `WatchWorkoutSession.swift` — WCSession mirror + routes actions to standalone engine
  - `WatchStandaloneEngine.swift` — local phase machine, snapshot, outbox flush
  - `WatchSupabaseClient.swift` — REST client using App Group auth
  - `WatchSharedAuth.swift` / `WatchSessionStore.swift` — credentials + durable snapshot/outbox
  - `WatchWorkoutFlow.swift` — rest / next-step logic (ported from phone `workoutFlow.ts`)
  - `WatchHealthWorkoutManager.swift` — live HR + HK workout UUID
- `modules/watch-connectivity/` — iPhone WCSession bridge + `syncAuthToWatch` / App Group writer
- Phone: [`active.tsx`](../../app/(stack)/workout/active.tsx) pushes mirror context only when `control_device=phone`

## Watch logging UX

- Default: one-tap **Complete** confirms planned targets (no editors).
- Optional **Adjust**: Digital Crown + `−`/`+`, one value at a time (no TextFields / sliders).
- RPE: 2×2 button grid.
- No batch log-all-sets UI on Watch.

## Sync (standalone)

1. Local snapshot updates immediately on every tap.
2. Mutations enqueue to a durable outbox.
3. Watch flushes to Supabase when it has network (does **not** require the iPhone app).
4. Phone UI reads Supabase for history / spectator state.

Auth tokens + Supabase URL/anon key are mirrored from iPhone login into App Group `group.com.alexpreo.ironpath.shared`.

## Build

1. Ensure `ios.appleTeamId` and App Group entitlement on phone + watch (`group.com.alexpreo.ironpath.shared`).
2. `npx expo prebuild -p ios --clean` to link the watch target.
3. Build via Xcode (`IronPathWatch` scheme) or EAS Build.
4. Test on physical devices — simulator pairing / WCSession is unreliable.
5. Sign in on iPhone once so watch auth is synced before starting a watch-only workout.
