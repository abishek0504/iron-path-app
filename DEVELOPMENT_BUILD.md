# Development build notes (IronPath)

## Native workflows

- Run `npx expo prebuild --platform ios` (or `npm run prebuild:ios`) whenever you add a config plugin or change `ios.*` in `app.json`.
- Open `ios/*.xcworkspace` in Xcode for signing, HealthKit entitlements, and **watchOS** targets (watch is not managed by Expo — see `native/watch/README.md`).

## Apple Health (bidirectional)

1. Add a HealthKit-capable native module (for example `react-native-health`) with an Expo config plugin, or maintain a small custom plugin that sets the HealthKit capability on the iPhone target and merges usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`), also mirrored in `app.json` for prebuild.
2. Columns `hk_workout_uuid` on `v2_workout_sessions`, `hk_sample_uuid` on `v2_weight_logs`, and ledger table `v2_health_sync` are created by migration `20260510000000_health_hk_links_session_validation.sql`.
3. Use `requestAppleHealthAccess` in `src/lib/health/healthIntegration.ts` as the RN entry; replace the stub once the native SDK is wired.

## Sentry / dSYMs

- Set `EXPO_PUBLIC_SENTRY_DSN` via EAS env for production builds. `initSentry()` in `src/lib/monitoring/initSentry.ts` runs from the root layout when a DSN is present.
- Follow EAS + Sentry docs to upload debug symbols for iOS.

## EAS CLI without global install

- Use `npm run eas:dev:ios`, which invokes `eas-cli` through `npx`.
