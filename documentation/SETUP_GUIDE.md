# Setup Guide

**Purpose**: Get the project running from scratch.

## Prerequisites

- **Node.js**: v22.21.1 or later
- **npm**: Package manager (comes with Node)
- **Expo CLI**: Installed globally via `npx expo`
- **Supabase Account**: For database and auth
- **Platform-specific tools**:
  - **iOS**: Xcode 13+ (Mac only)
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
- `expo`: ~53.0.0 - React Native framework
- `expo-router`: ~4.0.0 - File-based routing
- `@supabase/supabase-js`: ^2.48.1 - Supabase client
- `zustand`: ^5.0.2 - State management
- `react-native-reanimated`: ^3.16.5 - Animations

### 3. Configure Environment Variables

Create `.env` file in root:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=http://localhost:8081/auth/callback
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
```bash
# Assuming MCP is configured
# Apply migrations via MCP tools
```

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
2. Copy/paste migration files in order:
   - `supabase/migrations/20240101000000_create_v2_tables.sql`
   - `supabase/migrations/20240101000001_create_v2_rls_policies.sql`
   - `supabase/migrations/20250101000000_patch_c1_template_slots_custom_exercise_id.sql`
   - `supabase/migrations/20250101000001_patch_c2_session_exercises_custom_exercise_id.sql`
   - `supabase/migrations/20250101000002_patch_d_custom_exercise_targets.sql`
   - `supabase/migrations/20250101000003_patch_h_remove_goal.sql`
   - `supabase/migrations/20250101000004_seed_v2_muscles.sql`
   - `supabase/migrations/20250101000005_split_full_name.sql`
3. Run each migration

### 5. Seed Required Data

**Critical: v2_muscles** (28 canonical muscles)
```sql
-- Already included in migration 20250101000004_seed_v2_muscles.sql
-- Verify by checking:
SELECT COUNT(*) FROM v2_muscles;
-- Should return 28
```

**Optional: Sample exercises and prescriptions**
```sql
-- Add sample exercises to v2_exercises
-- Add prescriptions to v2_exercise_prescriptions
-- Add AI recommendations to v2_ai_recommended_exercises
-- (Create your own or wait for seed data scripts)
```

**Without prescriptions**: App will run but planner will show "Missing targets" warnings.

### 6. Generate TypeScript Types (Optional but Recommended)

```bash
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

**Current Status**: Project uses hand-typed interfaces. Generated types help prevent drift.

## Running the App

### Development Builds

**Start Development Server:**
```bash
npm start
```

This opens Expo DevTools in browser. Choose platform:

**Web:**
```bash
npm run web
```
Opens http://localhost:8081 in browser

**iOS Simulator (Mac only):**
```bash
npm run ios
# Or from Expo DevTools: Press 'i'
```

**Android Emulator:**
```bash
npm run android
# Or from Expo DevTools: Press 'a'
```

**Physical Device:**
1. Install Expo Go app from App Store/Play Store
2. Scan QR code from terminal/browser
3. App loads on device

### Production Builds

**Build for iOS:**
```bash
npx expo build:ios
# Or use EAS Build:
npx eas build --platform ios
```

**Build for Android:**
```bash
npx expo build:android
# Or use EAS Build:
npx eas build --platform android
```

**Build for Web:**
```bash
npx expo export:web
# Output in web-build/
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
│   └── exports/          # Database exports (schema, data)
│
├── documentation/        # Project documentation
│   ├── 00_INDEX.md      # Documentation index
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── ALGORITHMS.md
│   ├── DATA_FLOWS.md
│   ├── SETUP_GUIDE.md (this file)
│   ├── IMPLEMENTATION_STATUS.md
│   └── archive/         # Old documentation
│
├── .env                  # Environment variables (DO NOT COMMIT)
├── .gitignore           # Git ignore rules
├── app.json             # Expo config
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
npx supabase gen types typescript --project-id your-project-id > src/types/supabase.ts
```

### Check Linting (When Configured)
```bash
# Not configured yet - TODO
npm run lint
```

### Run Type Check
```bash
# Verify TypeScript types
npx tsc --noEmit
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
3. Check Xcode version (need 13+)

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
**Symptom**: "Unable to connect" on Expo Go  
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
3. ✅ Database migrations applied
4. ✅ 28 muscles seeded

**Recommended:**
1. Add sample exercises to `v2_exercises`
2. Add prescriptions to `v2_exercise_prescriptions`
3. Test onboarding flow
4. Test planner (will show "Missing targets" until prescriptions added)
5. Review `documentation/IMPLEMENTATION_STATUS.md` to see what's complete

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
