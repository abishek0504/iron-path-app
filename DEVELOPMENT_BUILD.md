# Development build notes (IronPath)

## Native workflows

- Run `npx expo prebuild --platform ios` (or `npm run prebuild:ios`) whenever you add a config plugin or change `ios.*` in `app.json`.
- Open `ios/*.xcworkspace` in Xcode for signing, HealthKit entitlements, and **watchOS** targets (watch is not managed by Expo — see `native/watch/README.md`).

## Running on device

- The app requires a custom dev client (Expo Go cannot load the native modules): start the server with `npm run start:dev`.
- Development build on a connected device: `npx expo run:ios --device`.
- Release build on a connected device (current device-testing workflow): `npx expo run:ios --device --configuration Release`.

## Apple Health (bidirectional)

1. HealthKit is integrated via `@kingstinct/react-native-healthkit`; its Expo config plugin in `app.json` sets the HealthKit capability and usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`), which are also mirrored in `ios.infoPlist` for prebuild.
2. Columns `hk_workout_uuid` on `v2_workout_sessions`, `hk_sample_uuid` on `v2_weight_logs`, and ledger table `v2_health_sync` are created by migration `20260510000000_health_hk_links_session_validation.sql`.
3. `requestAppleHealthAccess` in `src/lib/health/healthIntegration.ts` is the RN entry; the module lazily loads the native binary and degrades to a no-op on web, Android, and Expo Go.

## Sentry / dSYMs

- Set `EXPO_PUBLIC_SENTRY_DSN` via EAS env for production builds. `initSentry()` in `src/lib/monitoring/initSentry.ts` runs from the root layout when a DSN is present.
- Follow EAS + Sentry docs to upload debug symbols for iOS.

## EAS CLI without global install

- Use `npm run eas:dev:ios`, which invokes `eas-cli` through `npx`.
