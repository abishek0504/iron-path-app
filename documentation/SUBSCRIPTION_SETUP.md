# Subscription setup (RevenueCat + App Store)

IronPath Pro gates **AI workout generation** only. Purchases use RevenueCat (`react-native-purchases`) with a custom in-app paywall (not RevenueCat Paywalls UI).

## Products (App Store Connect)

1. Open [App Store Connect](https://appstoreconnect.apple.com) → your app → **Subscriptions**.
2. Create a subscription group (e.g. `IronPath Pro`).
3. Add two auto-renewable subscriptions:

| Product ID | Price | Introductory offer |
|------------|-------|--------------------|
| `ironpath_pro_monthly` | $9.99/mo | 7-day free trial |
| `ironpath_pro_annual` | $59.99/yr | 7-day free trial |

4. Complete subscription metadata (display name, description) and submit for review with a paywall screenshot.

Apple allows **one introductory offer per subscription group per Apple ID** — the user gets the trial on whichever plan they pick first.

## RevenueCat dashboard (step-by-step)

### 1. Create project

1. Sign up at [RevenueCat](https://www.revenuecat.com).
2. **New project** → name it (e.g. IronPath).
3. Add **iOS app** with bundle ID `com.alexpreo.ironpath` (must match `app.json` `expo.ios.bundleIdentifier`).

### 2. Link App Store Connect

1. In RevenueCat → **Project settings** → **Apps** → iOS app.
2. Under **App Store Connect**, add an **In-App Purchase Key** (.p8) or shared secret from App Store Connect.
3. Wait for products to sync (can take a few minutes after App Store Connect products are created).

### 3. Products & entitlement

1. **Product catalog** → confirm `ironpath_pro_monthly` and `ironpath_pro_annual` appear.
2. **Entitlements** → create **`ironpath_pro`**.
3. Attach both products to `ironpath_pro`.

### 4. Offerings (required for paywall)

1. **Offerings** → default offering (or create `default`).
2. Add packages:
   - **Monthly** → `ironpath_pro_monthly`
   - **Annual** → `ironpath_pro_annual`
3. Set as **Current offering**.

The app reads `offerings.current.monthly` / `.annual` in `useSubscription`.

### 5. Webhook → Supabase

1. Generate a random secret (e.g. `openssl rand -hex 32`).
2. Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**:
   - `REVENUECAT_WEBHOOK_SECRET` = your secret
3. Deploy the edge function (if not already):

```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

4. RevenueCat → **Integrations** → **Webhooks** → add:
   - **URL:** `https://wmraczqltegkqbststik.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization header:** `Bearer <same REVENUECAT_WEBHOOK_SECRET>`
5. Enable events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `UNCANCELLATION`, `PRODUCT_CHANGE`.

### 6. API keys

1. RevenueCat → **Project** → **API keys** → copy **iOS public** key (`appl_…`).
2. Add to local `.env` and EAS build env (see below).

## Environment variables

| Variable | Where | Notes |
|----------|--------|-------|
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | `.env`, EAS `production`/`preview` env | Public SDK key (`appl_…`) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | EAS (when Android ships) | Optional until Play Store |
| `REVENUECAT_WEBHOOK_SECRET` | Supabase Edge Function secrets | Same value as webhook Authorization bearer |

Copy `.env.example` → `.env` and fill in values. For EAS, add keys in [expo.dev](https://expo.dev) project secrets or `eas.json` `env` blocks.

## Database

Migration `20260612120000_add_subscription_fields_to_v2_profiles.sql` adds:

- `subscription_tier` (`free` \| `pro`)
- `subscription_expires_at`
- `revenuecat_app_user_id`

Clients cannot self-grant pro; `revenuecat-webhook` updates these fields with the service role. A trigger blocks authenticated users from editing subscription columns.

## AI access rules

| Tier | AI generation |
|------|----------------|
| Free | Blocked — paywall before API (`402 paywall_required`) |
| Pro / trial | Up to **40 generations per rolling 7 days** (server-enforced, not shown in UI) |

## Native rebuild

`react-native-purchases` requires a **dev client / EAS build** (not Expo Go for real purchases):

```bash
# Local dev client (device or simulator)
npm run ios:dev

# EAS development build
npm run eas:dev:ios

# Production / TestFlight
npx eas-cli build --profile production --platform ios
```

After changing env vars or native deps, rebuild and reinstall on the test device.

## Sandbox testing

**Prerequisite:** App Store Connect **Paid Apps** agreement must be **Active** (tax + banking complete — for Canada that includes GST/HST Form 506 with CRA Business Number + RT). Until then StoreKit often returns no products, RevenueCat packages stay empty, and the paywall **Start 7-day free trial** button stays disabled (UI still shows hardcoded fallback prices).

1. App Store Connect → **Users and Access** → **Sandbox** → create a Sandbox Apple ID.
2. On the test device: **Settings → App Store → Sandbox Account** (sign in with sandbox ID).
3. Install a dev or TestFlight build (not Expo Go) with `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` baked in.
4. Trigger paywall: cold start on tabs, **Generate with AI**, or Settings → Upgrade to Pro.
5. Confirm packages loaded (store prices, CTA enabled), then complete purchase with sandbox account.
6. Verify:
   - Settings shows **IronPath Pro** / **Active**
   - AI form opens after subscribe
   - RevenueCat dashboard shows active `ironpath_pro`
   - `v2_profiles.subscription_tier` = `pro` (via webhook; may lag a few seconds)

## Settings in app

- **Upgrade to Pro** / **IronPath Pro** — opens paywall or App Store subscription management
- **Restore subscription** — calls `Purchases.restorePurchases()`

## Troubleshooting

| Issue | Check |
|-------|--------|
| Trial CTA disabled / untappable | Packages null — Paid Apps **Active**? Current offering has Monthly + Annual? Native/TestFlight build (not Expo Go)? Key in that build? |
| Paywall shows but purchase fails | Sandbox account signed in; products approved in App Store Connect; offering set as current in RevenueCat |
| Purchase succeeds but AI still blocked | Webhook secret matches; function deployed with `--no-verify-jwt`; check Supabase function logs |
| `No offerings` / empty plans | RevenueCat offering packages linked to products; API key matches iOS app; ASC Paid Apps Active |
| Works in RC sandbox but profile still `free` | Webhook URL and Authorization header; `app_user_id` in RC matches Supabase auth user id |

## Code map

| File | Role |
|------|------|
| `src/lib/subscriptions/revenueCat.ts` | SDK configure, offerings, entitlement check |
| `src/hooks/useSubscription.ts` | `isPro`, purchase, restore |
| `src/components/paywall/PaywallModal.tsx` | Custom paywall UI |
| `src/components/paywall/PaywallProvider.tsx` | Global modal + triggers |
| `src/lib/subscriptions/paywallTriggers.ts` | Session caps, cooldowns |
| `supabase/functions/revenuecat-webhook/index.ts` | Sync entitlement → `v2_profiles` |
| `supabase/functions/generate-workout/index.ts` | Server-side `402` / weekly cap |
