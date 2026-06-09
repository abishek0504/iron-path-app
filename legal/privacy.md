# IronPath Privacy Policy

**Effective date:** June 9, 2026

IronPath ("the App", "we", "us") is a workout planning and tracking app for iPhone and Apple Watch. This policy explains what data we collect, why, and what control you have over it. Publish at: `https://ironpath.app/privacy`.

## Data we collect

### Account data
- **Email address and password** — used solely to create and authenticate your account. Passwords are hashed and managed by our backend provider (Supabase); we never see them in plain text.
- **User ID** — a random identifier linking your data to your account.

### Fitness and profile data you provide
- Profile details: experience level, training goals, body weight, height, unit preference.
- Workout data: planned routines, exercises, sets, reps, weights, durations, RPE/RIR ratings, personal records, exercise notes, and workout schedules.

### Apple Health (optional)
If you choose to connect Apple Health:
- **We write**: completed workouts and body weight entries you log in IronPath.
- **We read**: body weight, height, heart rate, resting heart rate, and active energy — used only to personalize your dashboard and workout suggestions.
- Health data is processed on your device and stored in your IronPath account only where needed for app functionality (e.g. imported weight entries). **Health data is never used for advertising or sold to third parties**, and is never shared with the AI service described below.
- You can revoke access anytime in iOS Settings → Privacy & Security → Health.

### Diagnostics
- Crash reports and performance diagnostics are collected via Sentry to keep the App stable. These may include device model, OS version, and app state at the time of a crash. They are not used to track you across other apps.

## AI workout generation

When you use "Generate with AI", a summary of your training context (experience level, training goals, available days, recent workout structure, and muscle-group coverage) is sent to Google's Gemini API to generate a workout plan. Your email, name, and Apple Health data are **not** sent. Generations are rate-limited per day and logged in your account so you can review what was created.

## How we store data

Your data is stored with Supabase (PostgreSQL) with row-level security: only your authenticated account can read or write your rows. Data is encrypted in transit (TLS) and at rest.

## What we do NOT do

- We do not sell your data.
- We do not show ads or share data with advertisers.
- We do not track you across other companies' apps or websites.

## Data retention and account deletion

You can delete your account in the App (Settings → Account → Delete account). Deletion is scheduled immediately and your data is permanently purged from our systems after a short grace period (30 days), during which you can contact us to cancel the deletion. Workouts written to Apple Health remain in Apple Health unless you remove them there.

## Third-party services

| Service | Purpose | Data involved |
| --- | --- | --- |
| Supabase | Database, authentication, backend functions | Account, profile, workout data |
| Google Gemini API | AI workout generation (on request) | Training context summary only |
| Sentry | Crash and performance diagnostics | Device/app diagnostics |
| Apple HealthKit | Optional health sync | Workouts, body weight, heart metrics |

## Children

IronPath is not directed at children under 13 (or the minimum age in your jurisdiction) and we do not knowingly collect data from them.

## Changes

We will update this policy as the App evolves and revise the effective date above. Material changes will be communicated in the App.

## Contact

Questions or requests (access, correction, deletion): **support@ironpath.app**
