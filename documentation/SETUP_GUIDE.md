# Setup Guide

**Purpose**: Get the project running from scratch.

**Last Updated**: 2026-06-11

## Prerequisites

- **Node.js**: v22.21.1 or later
- **npm**: Package manager (comes with Node)
- **Expo CLI**: Installed globally via `npx expo`
- **Supabase Account**: For database and auth
- **Platform-specific tools**:
  - **iOS**: Xcode 16+ (Mac only)
  - **Android**: Android Studio + SDK
  - **Web**: Modern browser (Chrome, Firefox, Safari)

## Initial Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd iron-path-app
```

### 2. Install Dependencies
```bash
npm install
```

**Key Dependencies:**
- `expo`: ~54.0.25 - React Native framework (SDK 54, React Native 0.81.5)
- `expo-router`: ~6.0.15 - File-based routing
- `expo-dev-client`: ~6.0.21 - Custom dev client (native modules)
- `@supabase/supabase-js`: ^2.84.0 - Supabase client
- `zustand`: ^5.0.2 - State management
- `react-native-reanimated`: 4.1.5 - Animations
- `@kingstinct/react-native-healthkit`: ^13.1.4 - Apple Health (iOS dev builds only)

### 3. Configure Environment Variables

Create `.env` file in root:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: auth email redirect (falls back to the app's deep link if unset)
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=http://localhost:8081/auth/callback

# Optional: Sentry crash reporting (production builds; set via EAS env)
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

**Get Supabase credentials:**
1. Go to https://supabase.com/dashboard
2. Create new project (or use existing)
3. Go to Settings → API
4. Copy Project URL and anon/public key
5. Paste into `.env` file

**⚠️ Never commit `.env` file** - Add to `.gitignore`

### 4. Setup Supabase Database

**Option A: Using Supabase MCP (Recommended)**
- **Check the live database first**: Use MCP `list_tables` or `execute_sql` (e.g. `SELECT column_name FROM information_schema.columns WHERE table_name = 'your_table'`) to confirm the change doesn't already exist and fits the schema.
- **Apply migrations**: Use MCP `apply_migration` with `name` (string) and `query` (string = full SQL). Migrations are recorded in the project; local files in `supabase/migrations/` are the source of truth for the SQL.
- **Verify**: After applying, run `list_migrations` and/or `execute_sql` to confirm the new columns/objects exist.

**Option B: Using Supabase CLI**
```bash
# Install Supabase CLI
npm install supabase --save-dev

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Run migrations
npx supabase db push
```

**Option C: Manual (Dashboard)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy/paste **all** migration files from `supabase/migrations/` in filename (chronological) order, starting with:
   - `20240101000000_create_v2_tables.sql`
   - `20240101000001_create_v2_rls_policies.sql`
   - ...through the latest `20260611*` exercise-import migrations
3. Run each migration (there are 40+; the timestamp prefix defines the order)

### 5. Seed Required Data

**Critical: v2_muscles** (29 canonical muscles)
```sql
-- 28 seeded in migration 20250101000004_seed_v2_muscles.sql,
-- plus 'adductors' added in 20260611120002_add_adductors_muscle_key.sql.
-- Verify by checking:
SELECT COUNT(*) FROM v2_muscles;
-- Should return 29
```

**Exercises, prescriptions, and AI recommendations** are all seeded by migrations (no manual step needed):
- `20260122000002_seed_exercise_prescriptions.sql`, `20260128000000_seed_exercise_metadata.sql`, `20260128000001_seed_ai_recommended_exercises.sql`
- `20260611120000_import_master_exercises_from_csv.sql` (full master exercise + stretch catalog from `supabase/seed/master_exercises_and_stretches_expanded_advanced.csv`)
- `20260611120003_seed_prescriptions_for_new_exercises.sql`, `20260611120004_refresh_ai_recommended_exercises.sql`

**Without prescriptions**: App will run but planner will show "Missing targets" warnings.

### 6. Deploy Edge Functions

The app calls Supabase Edge Functions in `supabase/functions/`:
- `generate-workout` — AI workout generation (requires `OPENAI_API_KEY` secret; optional `OPENAI_MODEL`)
- `update-muscle-freshness` — recomputes muscle freshness/stress caches
- `delete-account` — account soft-delete flow

```bash
# Set secrets once
npx supabase secrets set OPENAI_API_KEY=sk-...

# Deploy all functions
npx supabase functions deploy generate-workout
npx supabase functions deploy update-muscle-freshness
npx supabase functions deploy delete-account
```

### 7. Generate TypeScript Types

```bash
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.gen.ts
```

**Current Status**: Generated types live in `src/types/supabase.gen.ts` and are re-exported (with app-friendly aliases) via `src/types/supabase.ts`. Regenerate after every schema change.

## Running the App

### Development Builds

**Start Development Server:**
```bash
npm start            # standard Expo server (web / Expo Go)
npm run start:dev    # dev-client server (for custom dev builds)
```

**Web:**
```bash
npm run web
```
Opens http://localhost:8081 in browser.

**Dev logs on web (terminal instead of browser console):** In a second terminal run `node scripts/dev-log-server.js`. In __DEV__ on web, `devLog`/`devError` POST to http://localhost:3333/log so logs appear in that Node terminal.

**iOS Simulator (Mac only):**
```bash
npm run ios            # expo run:ios (compiles the native dev build)
npm run ios:simulator  # boots the 'iPhone 17 Pro Max' simulator
```

**Android Emulator:**
```bash
npm run android        # expo run:android
```

**Physical Device (dev build, not Expo Go):**
The app uses native modules (HealthKit, Reanimated 4/worklets, body highlighter), so it requires a custom dev client rather than Expo Go:
```bash
npx expo run:ios --device                            # development build on device
npx expo run:ios --device --configuration Release    # release build on device
```
Run `npm run prebuild:ios` first if native config changed (see `DEVELOPMENT_BUILD.md`).

**Note:** The Dashboard muscle heatmap (Muscle status) shows the full body view on a development build or simulator. In Expo Go, a list fallback (muscle groups + freshness %) is shown so the data is visible; the body silhouette uses native modules and is only rendered in dev builds.

### Production Builds

EAS Build profiles are defined in `eas.json` (`development`, `preview`, `production`, `development-simulator`).

**Build for iOS:**
```bash
npm run eas:dev:ios                              # development profile
npx eas-cli@latest build --profile production --platform ios
```

**Build for Android:**
```bash
npm run eas:dev:android                          # development profile
npx eas-cli@latest build --profile production --platform android
```

**Build for Web:**
```bash
npx expo export --platform web
# Output in dist/
```

## Project Structure Tour

```
iron-path-app/
├── app/                    # Expo Router routes (file-based)
│   ├── _layout.tsx        # Root layout: Stack + global UI
│   ├── index.tsx          # Bootstrap/auth check
│   ├── (tabs)/            # Tab navigation
│   │   ├── _layout.tsx    # Tabs config + custom tab bar
│   │   ├── index.tsx      # Workout tab
│   │   ├── planner.tsx    # Plan tab
│   │   ├── progress.tsx   # Progress tab
│   │   └── dashboard.tsx  # Dashboard tab
│   ├── (stack)/           # Stack screens (modals)
│   └── auth/              # Auth flows
│
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Global reusable UI
│   │   ├── exercise/     # Exercise domain
│   │   ├── settings/     # Settings domain
│   │   ├── workout/      # Workout domain
│   │   └── progress/     # Progress domain
│   ├── hooks/            # Custom hooks
│   ├── lib/
│   │   ├── engine/       # Business logic (algorithms)
│   │   ├── supabase/
│   │   │   ├── client.ts       # Supabase client
│   │   │   └── queries/        # Query functions
│   │   └── utils/        # Utilities (logger, theme, validation)
│   ├── stores/           # Zustand stores
│   └── types/            # TypeScript types
│
├── supabase/
│   ├── migrations/       # Database migrations
│   ├── functions/        # Edge Functions (generate-workout, update-muscle-freshness,
│   │                     #   delete-account, revenuecat-webhook)
│   ├── seed/             # Seed source data (master exercise/stretch CSV)
│   └── exports/          # Database exports (schema, data)
│
├── scripts/              # Dev/ops scripts (dev-log-server, exercise import SQL generation)
│
├── documentation/        # Project documentation
│   ├── 00_INDEX.md      # Documentation index
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── ALGORITHMS.md
│   ├── DATA_FLOWS.md
│   ├── SETUP_GUIDE.md (this file)
│   └── IMPLEMENTATION_STATUS.md
│
├── .env                  # Environment variables (DO NOT COMMIT)
├── .gitignore           # Git ignore rules
├── app.json             # Expo config
├── eas.json             # EAS Build profiles
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript config
```

## Common Development Tasks

### Add New Dependency
```bash
npm install package-name
# Restart dev server after installing
```

### Clear Cache (If Issues)
```bash
# Clear Metro bundler cache
npx expo start --clear

# Or manually
rm -rf node_modules/.cache
```

### Reset Database
```bash
# Re-run all migrations
# (Use Supabase CLI or dashboard)

# Or reset via dashboard:
# Database → Settings → Reset Database
# Then re-run migrations + seed data
```

### Update TypeScript Types
```bash
# After schema changes
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.gen.ts
```

### Check Linting / Types
```bash
npm run lint          # TypeScript check (tsc --noEmit)
npm run lint:eslint   # ESLint (expo lint)
```

### Run Tests
```bash
npm test              # vitest run
```

### Exercise Catalog Tooling (scripts/)
```bash
# Regenerate the exercise import migration + muscle-key manifest from the master CSV
node scripts/generate-exercise-import-sql.mjs
```

## Development Workflow

### Daily Workflow
1. Pull latest changes: `git pull`
2. Install dependencies (if package.json changed): `npm install`
3. Start dev server: `npm start`
4. Choose platform (web/ios/android)
5. Make changes
6. Hot reload automatically updates
7. Commit changes: `git commit`

### Adding New Feature
1. Check `documentation/IMPLEMENTATION_STATUS.md` - what exists?
2. Review `documentation/DATA_FLOWS.md` - understand patterns
3. Create feature (component/route/query)
4. Test on target platform
5. Update `IMPLEMENTATION_STATUS.md`
6. Commit

### Database Changes
1. Create new migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Write SQL (follow existing patterns)
3. Test locally
4. Apply to production (when ready)
5. Update `documentation/DATABASE_SCHEMA.md` if architecture changes
6. Generate new TypeScript types

## Troubleshooting

### Environment Variables Not Working
**Symptom**: Supabase client shows "Missing URL or key"  
**Fix**:
1. Verify `.env` file exists and has correct values
2. Restart dev server completely (Ctrl+C, then `npm start`)
3. For web: hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Metro Bundler Issues
**Symptom**: "Unable to resolve module" or cache issues  
**Fix**:
```bash
# Clear cache and restart
npx expo start --clear
```

### Supabase RLS Errors
**Symptom**: Queries return empty even though data exists  
**Fix**:
1. Check RLS policies in Supabase dashboard
2. Verify `auth.uid()` matches user_id
3. Test query with service_role key (temporarily, for debugging)
4. Check `documentation/DATABASE_SCHEMA.md` for RLS policy details

### TypeScript Errors
**Symptom**: Red squiggly lines, type errors  
**Fix**:
1. Run `npx tsc --noEmit` to see all errors
2. Check if types need regeneration (`supabase gen types`)
3. Verify imports are correct
4. Check `tsconfig.json` settings

### iOS Build Fails
**Symptom**: Build errors on iOS  
**Fix**:
1. Update CocoaPods: `cd ios && pod install && cd ..`
2. Clean build: Xcode → Product → Clean Build Folder
3. Check Xcode version (need 16+)

### Android Build Fails
**Symptom**: Build errors on Android  
**Fix**:
1. Check Android SDK installed correctly
2. Clean Gradle: `cd android && ./gradlew clean && cd ..`
3. Check Java version (need JDK 11+)

### Hot Reload Not Working
**Symptom**: Changes don't show up  
**Fix**:
1. Save file again
2. Press 'r' in terminal to manually reload
3. Restart dev server
4. Check file is in watched directories (not in `node_modules/`)

### Can't Connect to Dev Server on Physical Device
**Symptom**: "Unable to connect" in the dev client  
**Fix**:
1. Ensure device and computer on same network
2. Check firewall isn't blocking port 8081
3. Try tunnel mode: `npm start -- --tunnel`

## Platform-Specific Notes

### iOS
- Requires Mac for development
- Xcode 13+ required
- Simulator runs faster than Android emulator
- Physical device requires Apple Developer account ($99/year for app store)

### Android
- Works on Mac/Windows/Linux
- Android Studio + SDK required
- Emulator is resource-heavy (allocate 4GB+ RAM)
- Physical device works without paid account

### Web
- Fastest for development (instant reload)
- Some React Native features don't work on web
- Good for testing UI/layout quickly
- Production web builds need hosting (Vercel, Netlify, etc.)

## Next Steps

After setup:
1. ✅ App runs successfully
2. ✅ Can create account and login
3. ✅ Database migrations applied (exercises + prescriptions seeded by migrations)
4. ✅ 29 muscles seeded
5. ✅ Edge functions deployed (with `OPENAI_API_KEY` secret)

**Recommended:**
1. Test onboarding flow
2. Test planner and AI week generation
3. Review `documentation/IMPLEMENTATION_STATUS.md` to see what's complete

## Additional Resources

- **Expo Docs**: https://docs.expo.dev/
- **Expo Router**: https://docs.expo.dev/router/introduction/
- **Supabase Docs**: https://supabase.com/docs
- **React Native**: https://reactnative.dev/
- **Zustand**: https://github.com/pmndrs/zustand
- **TypeScript**: https://www.typescriptlang.org/docs/

## Getting Help

1. Check documentation in `documentation/` folder
2. Review existing code for patterns
3. Check dev logs in console (`__DEV__` wrapped logs)
4. Review Supabase logs for database issues
5. Search Expo/React Native docs
