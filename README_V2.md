# IronPath V2

Complete rebuild of IronPath app with proper architecture, reusable components, global state management, and industry-standard patterns.

## Architecture

See [V2_ARCHITECTURE.md](./V2_ARCHITECTURE.md) for complete system contract, schema, formulas, and rules.

## Key Features

- **Strict Data Layering**: Canonical reference → Prescriptions → User customization → Planning → Performed truth
- **No Modal-in-Modal**: Global bottom sheets (Zustand) for quick actions, routes for complex flows
- **Prescription-Based Targets**: Never invent generic defaults (3x10, 60s); all targets come from curated prescriptions
- **Merged Exercise View**: Global defaults ⊕ user overrides, used everywhere
- **Dev Logging**: Structured logging for auto-diagnosis
- **RLS & Immutability**: Client read-only for master data, user-owned for customization

## Onboarding (Post-Auth)
- Runs after login/sign-up if required profile fields are missing.
- Required fields: `full_name`, `age`, `current_weight`, `use_imperial`, `experience_level`, `days_per_week`, `equipment_access` (multi-select).
- Saves to `v2_profiles`, updates `userStore`.
- Auto-creates a user template if none exists and ensures all 7 weekdays, then routes to Plan tab.

## Profile Tab
- Location: `app/(tabs)/dashboard.tsx` (read-only dashboard).
- Widgets: weekly completion vs `days_per_week`, streak, top PRs (from performed sets), recent sessions, connect health placeholder.
- Link to Edit Profile for changes; data loads via Supabase queries with dev logs (`profile-dashboard`).
- Edit modal returns to the originating tab/stack via `router.back()` with a `/(tabs)` fallback when no history exists.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

3. Run migrations:
```bash
# Apply migrations to Supabase
# Use Supabase CLI or dashboard to apply files in supabase/migrations/
```

4. Generate TypeScript types:
```bash
# Use Supabase CLI to generate types
npx supabase gen types typescript --project-id your_project_id > src/types/supabase.ts
```

5. Start the app:
```bash
npm start
```

## Project Structure

```
├── app/                    # Expo Router screens
│   └── _layout.tsx         # Root layout with global UI
├── src/
│   ├── components/         # UI components
│   │   ├── ui/            # Global UI (Toast, BottomSheet, ModalManager)
│   │   ├── exercise/      # Exercise-related components
│   │   ├── settings/      # Settings components
│   │   └── workout/       # Workout components
│   ├── hooks/             # React hooks
│   ├── lib/
│   │   ├── engine/        # Business logic (target selection, etc.)
│   │   ├── supabase/      # Supabase client and queries
│   │   └── utils/         # Utilities (logger, validation, theme)
│   └── stores/            # Zustand stores
├── supabase/
│   └── migrations/        # Database migrations
└── V2_ARCHITECTURE.md     # Complete system contract
```

## State Management

- **Zustand Stores**:
  - `uiStore`: Bottom sheets, dialogs, toasts
  - `userStore`: Profile + preferences cache
  - `exerciseStore`: Exercise search + selection
  - `workoutStore`: Active workout/session state

## Database Schema

All V2 tables are prefixed with `v2_`:
- `v2_muscles`: Canonical muscle keys
- `v2_exercises`: Master exercise list (immutable from client)
- `v2_exercise_prescriptions`: Curated programming targets
- `v2_ai_recommended_exercises`: AI allow-list
- `v2_user_exercise_overrides`: User-specific overrides
- `v2_user_custom_exercises`: User-created exercises
- `v2_workout_templates`, `v2_template_days`, `v2_template_slots`: Planning
- `v2_workout_sessions`, `v2_session_exercises`, `v2_session_sets`: Performed truth
- `v2_muscle_freshness`, `v2_daily_muscle_stress`: Derived caches

## Development

- All dev logs use `devLog(module, payload)` wrapped in `__DEV__` checks
- Log aggregates, not per-item data
- Use `useToast()` hook for user feedback
- Use `useExercisePicker()` hook for exercise selection
- Use `useModal()` hook for opening bottom sheets

## Type Generation

TypeScript types must be generated from the database schema to prevent drift:

```bash
npx supabase gen types typescript --project-id your_project_id > src/types/supabase.ts
```

Run this after any schema changes and commit the updated types file.

