# IronPath Privacy Policy

**Effective date:** June 9, 2026

IronPath ("the App", "we", "us") is a workout planning and tracking app for iPhone and Apple Watch. This policy explains what data we collect, why, and what control you have over it. Publish at: `https://tryironpath.com/privacy`.

## Data we collect

### Account data
- **Email address and password** — used solely to create and authenticate your account. Passwords are hashed and managed by our backend provider (Supabase); we never see them in plain text.
- **User ID** — a random identifier linking your data to your account.

### Fitness and profile data you provide
- Identity details: first and last name, date of birth, and (optionally) gender. Date of birth is used to confirm you meet the minimum age and to tailor training recommendations.
- Profile details: experience level, training goals, body weight, height, unit preference.
- Workout data: planned routines, exercises, sets, reps, weights, durations, RPE/RIR ratings, personal records, exercise notes, and workout schedules.

### Purchase data
If you subscribe to IronPath Pro, we store your subscription status, plan tier, and expiry date, along with an identifier linking your account to your RevenueCat subscriber record. Payment details are handled entirely by Apple; **we never receive your payment card or Apple ID credentials.**

### Apple Health (optional)
If you choose to connect Apple Health:
- **We read**: body weight, heart rate, and active energy burned. Body weight is used to import your existing weight history and keep IronPath in sync. Heart rate and active energy are used to attach workout intensity and calorie data to sessions you record in IronPath.
- **We write**: completed workouts, body weight entries you log in IronPath, and the active energy and heart rate associated with those workouts.
- Health data is processed on your device and stored in your IronPath account only where needed for app functionality (e.g. imported weight entries and per-session workout metrics). **Health data is never used for advertising or sold to third parties**, and is never shared with the AI service described below.
- You can revoke access anytime in iOS Settings → Privacy & Security → Health.

### Apple Watch (optional)
If you use the IronPath Apple Watch companion, workout state (such as the active session, exercise name, and set progress) may be sent between your iPhone and Watch over Apple's WatchConnectivity framework so you can log sets from your wrist. This data stays on your devices and is not sent to third parties.

### Diagnostics
- Crash reports and performance diagnostics are collected via Sentry to keep the App stable. These may include device model, OS version, and app state at the time of a crash. They are not used to track you across other apps.

## AI workout generation

When you use "Generate with AI", a summary of your training context (experience level, preferred training split, available days, recent workout performance such as sets, reps, weight and effort ratings, and muscle-group coverage) is sent to OpenAI's API to generate a workout plan. Your email, name, and Apple Health data are **not** sent. AI generation requires an IronPath Pro subscription and is rate-limited to 40 workout days per rolling 7-day period. Generations are logged in your account so you can review what was created.

## How we store data

Your data is stored with Supabase (PostgreSQL) with row-level security: only your authenticated account can read or write your rows. Data is encrypted in transit (TLS) and at rest.

## What we do NOT do

- We do not sell your data.
- We do not show ads or share data with advertisers.
- We do not track you across other companies' apps or websites.

## Data retention and account deletion

You can delete your account in the App (Settings → Danger zone → Delete account). Deletion is scheduled immediately and your data is permanently purged from our systems after a grace period of 30 days. During that window you can cancel the deletion by signing back in, or by contacting us. When configured, we also request deletion of your RevenueCat subscriber record. Workouts and health samples written to Apple Health remain in Apple Health unless you remove them there. Deleting your account does not cancel an active subscription — cancel it in your Apple ID Account Settings.

## Third-party services

| Service | Purpose | Data involved |
| --- | --- | --- |
| Supabase | Database, authentication, backend functions | Account, profile, workout data |
| RevenueCat | In-app subscription management (iOS) | Anonymous app user ID linked to your account; purchase and entitlement status |
| OpenAI API | AI workout generation (on request) | Training context summary only |
| Sentry | Crash and performance diagnostics | Device/app diagnostics |
| Apple HealthKit | Optional health sync | Body weight, heart rate, active energy (read); workouts, body weight, heart rate, active energy (write) |

## Children

IronPath is not directed at children under 13 (or the minimum age in your jurisdiction) and we do not knowingly collect data from them.

## Changes

We will update this policy as the App evolves and revise the effective date above. Material changes will be communicated in the App.

## Contact

Questions or requests (access, correction, deletion): **support@tryironpath.com**
