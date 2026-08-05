# VibeSec Security Audit — IronPath (2026-06-14)

Full-stack security audit guided by the global [VibeSec skill](https://github.com/) checklist. Six parallel code workstreams, live Supabase MCP verification, in-repo remediation, migration applied to production, and edge function redeploys.

**Prior audit:** [AUDIT_2026-06-09_APP_STORE_FINISHING_PLAN.md](AUDIT_2026-06-09_APP_STORE_FINISHING_PLAN.md) (feature/compliance focus). This document is the dedicated security posture report and supersedes security-relevant open items from June 9 where noted.

> **Addendum 2026-06-14:** The exercise image batch pipeline was removed per product decision. Deleted from repo: `generate-exercise-image` edge function, `scripts/run-exercise-image-batch.mjs`, `scripts/generate-exercise-images*.mjs`, `scripts/output/exercise-image-manifest.json`. Deleted from Supabase: `generate-exercise-image` edge function. Bundled assets (`assets/exercises/`, `src/lib/exerciseImages.ts`) remain for in-app display. Findings SEC-EF-01, SEC-EF-03, SEC-EF-04 and related manual steps are **obsolete** (mitigated by removal).

---

## 1. Executive summary

| Metric | Count |
|--------|-------|
| Critical findings | 2 |
| High | 8 |
| Medium | 14 |
| Low | 12 |
| Informational | 6 |
| **Fixed in this audit** | **22** |
| **Manual / deferred** | **8** |

**Overall posture:** IronPath’s security model is sound for a Supabase-native mobile app — RLS on all 22 `v2_*` tables, no legacy v1 tables in production, edge functions enforce JWT or shared secrets, and subscription fields are now protected on both INSERT and UPDATE. The OpenAI image proxy (`generate-exercise-image`) was removed entirely after this audit. Remaining items are mostly mobile-platform tradeoffs (JWT in AsyncStorage), dashboard toggles, dependency upgrades, and privacy-policy alignment.

**Live re-verification highlights (2026-06-14):**
- Migration `vibesec_security_hardening` applied successfully
- `v2_profiles_protect_subscription` trigger now `BEFORE INSERT OR UPDATE`
- New `trg_v2_profiles_protect_deletion` trigger active
- SECURITY DEFINER EXECUTE warnings for `v2_profiles_protect_subscription_fields` **resolved**
- Legal URLs `https://tryironpath.com/privacy` and `/terms` return **HTTP 200** (fixed since June 9)
- Edge functions deployed: `delete-account`, `update-muscle-freshness`, `revenuecat-webhook`, `generate-workout` (`generate-exercise-image` removed post-audit)
- No legacy `public.profiles` / v1 tables in live DB
- `trigger_update_muscle_freshness` **not present** in live DB (client invokes edge function instead)

---

## 2. Methodology

| Phase | Method |
|-------|--------|
| **1A** Access control / IDOR | Explore subagent — auth flows, queries, account lifecycle, subscription escalation |
| **1B** Client-side | Explore subagent — secrets, XSS, redirects, JWT storage |
| **1C** Edge functions | Explore subagent — all 5 functions + batch script |
| **1D** Database / storage | Explore subagent — migrations, RLS, SECURITY DEFINER, storage |
| **1E** Mobile | Explore subagent — Watch, HealthKit, RevenueCat, Sentry, privacy claims |
| **1F** Dependencies | `npm audit`, secret pattern scan |
| **2** Live verification | Supabase MCP: `get_advisors`, `execute_sql`, `list_edge_functions`, `list_storage_buckets`, `list_migrations` |
| **3** Remediation | Code + migration `20260614080000_vibesec_security_hardening.sql` + edge deploys |
| **4** Re-verification | Post-fix advisors + trigger SQL + URL checks |

**VibeSec categories covered:** Access control, secret exposure, XSS/output encoding, CSRF, JWT storage, open redirect, API security, mass assignment, account lifecycle, file upload (avatars), SQL injection (ORM/RLS), password security, SSRF (pg_net note), security headers (web gap).

**Out of scope:** Penetration testing, iOS binary analysis, third-party infra beyond integration boundaries, automated RLS integration test suite.

---

## 3. Findings register

Status: **Fixed** | **Manual** | **Deferred** | **Accepted** | **N/A (mitigated)**

### Critical

| ID | Severity | Category | Location | Finding | Status |
|----|----------|----------|----------|---------|--------|
| SEC-DB-01 | Critical | Privilege escalation | `v2_profiles` INSERT | Authenticated users could self-grant `subscription_tier: 'pro'` on profile INSERT; UPDATE-only trigger | **Fixed** — migration extends trigger to INSERT |
| SEC-EF-01 | Critical | Access control | `generate-exercise-image` | No auth; anon key could burn OpenAI credits | **Removed** — function deleted from repo and Supabase |

### High

| ID | Severity | Category | Location | Finding | Status |
|----|----------|----------|----------|---------|--------|
| SEC-AC-01 | High | Privilege escalation | `users.ts` + DB | Subscription self-grant on INSERT (duplicate of SEC-DB-01) | **Fixed** |
| SEC-AC-02 | High | Account lifecycle | `users.ts` | Client could set `deleted_at` without token revocation | **Fixed** — deletion trigger + edge function path only |
| SEC-AC-03 | High | Account lifecycle | `users.ts` | Client could extend `scheduled_purge_at` grace window | **Fixed** — deletion trigger |
| SEC-AC-04 | High | Account lifecycle | `index.tsx`, `(tabs)/_layout.tsx` | Soft-deleted user bypassed restore gate on cold start | **Fixed** — `isAccountPendingDeletion()` gate |
| SEC-AC-05 | High | Mass assignment | `users.ts` | Unrestricted profile field spread | **Fixed** — field whitelist |
| SEC-EF-04 | High | Access control | `run-exercise-image-batch.mjs` | Batch script used public anon key | **Removed** — script deleted |
| SEC-EF-10 | High | Authorization | `update-muscle-freshness` | No `status = completed` check | **Fixed** — returns 409 if not completed |
| SEC-MB-01 | High | Input validation | `active.tsx` watch listener | Stale watch events could complete wrong set | **Fixed** — sessionId/setNumber/TTL validation |

### Medium

| ID | Severity | Category | Location | Finding | Status |
|----|----------|----------|----------|---------|--------|
| SEC-CL-01 | Medium | JWT storage | `client.ts` | Tokens in AsyncStorage/localStorage | **Fixed** — `expo-secure-store` with chunked adapter on native |
| SEC-CL-02 | Medium | Secret exposure | `client.ts` | Auth params in URL on web | **Fixed** — `history.replaceState` after code exchange |
| SEC-CL-03 | Medium | Secret exposure | `eas.json` | Live anon key committed | **Accepted** — anon keys are public; EAS Secrets recommended |
| SEC-CL-04 | Medium | XSS / headers | Web build | No CSP on Expo web | **Deferred** — hosting-layer CSP |
| SEC-EF-03 | Medium | Error leakage | `generate-exercise-image` | OpenAI error body returned | **Removed** |
| SEC-EF-05 | Medium | Error leakage | `generate-workout` | `fallbackReason` leaks upstream errors | **Fixed** — public codes only (`generation_unavailable`, `validation_failed`) |
| SEC-EF-07 | Medium | Error leakage | `delete-account` | Raw exception in 500 | **Fixed** |
| SEC-EF-12 | Medium | Error leakage | `update-muscle-freshness` | DB errors in response | **Fixed** |
| SEC-EF-14 | Medium | Privileged path | DB trigger + edge fn | Service role in DB settings for pg_net | **N/A** — trigger not deployed live; client path uses user JWT |
| SEC-DB-05 | Medium | Storage / IDOR | Avatar policies | Folder-based policies may not match flat object keys | **Fixed** — flat-key `LIKE auth.uid() \|\| '-%'` policies |
| SEC-DB-07 | Medium | Mass assignment | `v2_user_exercise_prs` | Clients can write PR rows directly | **Fixed** — SELECT-only policy; trigger writes |
| SEC-DB-10 | Medium | Data exposure | `avatars` bucket | Public bucket; UUID-prefixed filenames | **Accepted** — avatars are profile photos |
| SEC-MB-03 | Medium | Privacy / least privilege | `healthIntegration.ts` | Requests HR/height/energy but only reads body mass | **Fixed** — `READ_TYPES` trimmed to body mass only |
| SEC-MB-05 | Medium | PII | `initSentry.ts` | Limited breadcrumb scrubbing | **Fixed** — `beforeSend`, `sendDefaultPii: false`, dev disabled |
| SEC-MB-06 | Medium | Compliance | `legal/privacy.md` | RevenueCat not listed as third party | **Fixed** — policy + Watch disclosure updated |
| SEC-MB-07 | Medium | Identity | `revenueCat.ts` | Re-configure on user switch vs `logIn` | **Fixed** — configure once, `logIn` on user change |

### Low

| ID | Severity | Category | Location | Finding | Status |
|----|----------|----------|----------|---------|--------|
| SEC-AC-06 | Low | IDOR (defense-in-depth) | `workouts.ts` | Session mutations rely on RLS only | **Fixed** — explicit `user_id` / ownership checks |
| SEC-AC-07 | Low | Password policy | `auth/callback.tsx` | 6-char minimum on recovery | **Fixed** — 8 chars |
| SEC-AC-08 | Low | Client auth guard | `app/auth/*` | No redirect when unauthenticated | **Fixed** — `change-password` / `change-email` redirect to login |
| SEC-AC-09 | Low | Account lifecycle | `restoreAccount` | Success without row check | **Fixed** — session match + `.select('id')` |
| SEC-CL-05–09 | Low | XSS / dev | Various | Error messages, support ingest, dev log server | **Fixed** — `mapAuthError`, support max length, deep-link param validation, dev server `127.0.0.1` |
| SEC-EF-08–09 | Low | Rate limit / idempotency | `delete-account` | No throttle; repeated delete resets grace | **Fixed** — idempotent if already deleted |
| SEC-EF-11 | Low | Input validation | `update-muscle-freshness` | No UUID format check | **Fixed** |
| SEC-EF-15 | Low | HTTP method | `update-muscle-freshness` | No POST-only guard | **Fixed** |
| SEC-EF-16–18 | Low | Webhook | `revenuecat-webhook` | Timing compare, UUID validation, early cancellation | **Fixed** |
| SEC-DB-12 | Low | DoS | `v2_support` | No message length limit | **Fixed** — CHECK 1–5000 chars |
| SEC-DB-14 | Low | Password security | Supabase Auth | Leaked password protection disabled | **Out of scope** |
| SEC-MB-08–12 | Low | Mobile / privacy | Watch, Sentry, RevenueCat purge | Disclosure and lifecycle gaps | **Partial** — Watch + RC purge fixed; Sentry org placeholder remains **Manual** |

### Informational

| ID | Finding | Status |
|----|---------|--------|
| SEC-AC-10–15 | System template RLS, purge cron, UUID usage, edge ownership checks | **Mitigated** (pre-existing) |
| SEC-CL-10–13 | CSRF low risk with bearer tokens; no open redirect; `.env.example` safe | **Pass** |
| SEC-DB-15 | Stale `schema.sql` export | **Fixed** — warning header added |
| SEC-DEP-01 | `npm audit`: 24 vulns (1 critical, 3 high in transitive deps) | **Deferred** — Expo 56 upgrade path |
| GraphQL lint-0027 | Authenticated GraphQL schema visibility on RLS tables | **Accepted** — RLS enforces row access; app uses PostgREST not GraphQL |

---

## 4. Fixes applied

### Database migration — `20260614080000_vibesec_security_hardening.sql`

Applied to live project via Supabase MCP (`apply_migration`).

| Change | Purpose |
|--------|---------|
| `v2_profiles_protect_subscription_fields` → `BEFORE INSERT OR UPDATE` | Block pro self-grant on signup/profile create |
| `REVOKE EXECUTE` on subscription + deletion trigger functions | Close SECURITY DEFINER RPC exposure (resolved advisor lint-0028/0029) |
| New `v2_profiles_protect_deletion_fields` trigger | Only service role sets deletion markers; owner may restore (clear both) |
| Conditional harden `trigger_update_muscle_freshness` | search_path + EXECUTE revoke if function exists (not live today) |
| `v2_support_message_length_check` | Limit message to 5000 chars |

### Application code

| File | Fix |
|------|-----|
| `src/lib/supabase/queries/users.ts` | Whitelist profile create/update fields; safer `restoreAccount` |
| `src/lib/auth/accountLifecycle.ts` | **New** — `isAccountPendingDeletion()` helper |
| `app/index.tsx` | Redirect soft-deleted sessions to `/login` |
| `app/(tabs)/_layout.tsx` | Tab guard checks pending deletion; signs out |
| `app/(stack)/workout/active.tsx` | Watch `sessionId` / `setNumber` / TTL validation |
| `app/auth/callback.tsx` | Password minimum 8 characters |
| `src/lib/monitoring/initSentry.ts` | PII scrubbing, `sendDefaultPii: false`, disabled in `__DEV__` |
| `scripts/dev-log-server.js` | Bind `127.0.0.1` only |
| `supabase/exports/schema.sql` | Stale-export warning header |

**Removed post-audit:** `generate-exercise-image` edge function, `scripts/run-exercise-image-batch.mjs`, `scripts/generate-exercise-images*.mjs`, `scripts/output/exercise-image-manifest.json`, `IMAGE_BATCH_SECRET` from `.env.example`.

### Deferred fixes follow-up — `20260614120000_deferred_security_fixes.sql`

Applied to live project via Supabase MCP (`apply_migration`).

| Change | Purpose |
|--------|---------|
| Avatar storage policies use flat `{user_id}-%` key match | Owner upload/update/delete works with actual object keys |
| `v2_user_exercise_prs` SELECT-only for `authenticated` | Block direct client PR writes; trigger maintains cache |

### Application code (deferred fixes)

| File | Fix |
|------|-----|
| `src/lib/supabase/authStorage.ts` | **New** — SecureStore adapter with chunking for large sessions |
| `src/lib/supabase/client.ts` | Native auth tokens in SecureStore |
| `src/lib/auth/authErrors.ts` | **New** — safe auth error messages |
| `app/login.tsx`, `app/signup.tsx`, `app/auth/*.tsx` | `mapAuthError`; auth guards on change-password/email |
| `app/auth/callback.tsx` | Strip URL params after exchange on web |
| `app/help-support.tsx` | Client-side 5000-char message cap |
| `app/add-exercise-edit.tsx` | Deep-link param length + day name validation |
| `app/health-connect.tsx`, `app.json` | HealthKit copy aligned to body-mass-only read |
| `src/lib/health/healthIntegration.ts` | `READ_TYPES` = body mass only |
| `src/lib/subscriptions/revenueCat.ts` | `configure` once + `logIn` per user |
| `src/lib/supabase/queries/workouts.ts` | Explicit session ownership on mutations |
| `legal/privacy.md` | RevenueCat, Apple Watch, HealthKit scope, RC purge on delete |

### Edge functions (deferred fixes, deployed)

| Function | Changes |
|----------|---------|
| `generate-workout` | `fallbackReason` returns public codes only |
| `delete-account` | Optional RevenueCat subscriber DELETE when `REVENUECAT_SECRET_API_KEY` set |

### Edge functions (deployed)

| Function | Changes | `verify_jwt` |
|----------|---------|--------------|
| `delete-account` | Idempotent soft-delete; generic 500 | `true` |
| `update-muscle-freshness` | POST-only; UUID validation; completed-session check; generic errors | `true` |
| `revenuecat-webhook` | Timing-safe secret compare; UUID `app_user_id`; cancellation respects expiry | `false` (shared secret) |
| `generate-workout` | Unchanged during audit | `true` |

---

## 5. Database security appendix

### RLS coverage (live SQL 2026-06-14)

All **22** `v2_*` tables have `rowsecurity = true`. No non-`v2_*` application tables exist in `public`.

### SECURITY DEFINER functions (live)

| Function | `search_path` pinned | EXECUTE revoked |
|----------|---------------------|-----------------|
| `handle_new_user` | Yes | Yes |
| `purge_soft_deleted_accounts` | Yes | Yes |
| `trigger_upsert_exercise_pr` | Yes | Yes |
| `v2_profiles_protect_subscription_fields` | Yes | **Yes (fixed this audit)** |
| `v2_profiles_protect_deletion_fields` | Yes | **Yes (new)** |
| `trigger_update_muscle_freshness` | — | Not deployed in live DB |

### Storage — `avatars` bucket

| Property | Value |
|----------|-------|
| Public | `true` |
| File size limit | 10 MB |
| Policies (live) | Owner INSERT/UPDATE/DELETE only (`authenticated`) |
| Broad cross-user policies | Removed in `20260609000003` (confirmed) |

### Edge function auth matrix

| Function | Auth mechanism | Ownership / business checks |
|----------|----------------|---------------------------|
| `generate-workout` | User JWT | Template ownership, pro tier, weekly quota |
| `delete-account` | User JWT | User ID from token only; service role for markers |
| `update-muscle-freshness` | User JWT or service role (trigger path) | Session ownership + `status = completed` |
| `revenuecat-webhook` | `REVENUECAT_WEBHOOK_SECRET` bearer | UUID `app_user_id`; tier from event + expiry |

### Anon access

`anon` revoked on all `v2_*` tables (`20260609000003`). App requires authentication for data access.

---

## 6. Manual remediation guide

| Item | Steps | Verification |
|------|-------|--------------|
| **Leaked password protection** | **Out of scope** — do not enable / do not track (dashboard toggle unavailable) | n/a |
| **`IMAGE_BATCH_SECRET`** | N/A — batch pipeline removed | — |
| **EAS secrets (optional)** | Move `EXPO_PUBLIC_SUPABASE_*` from `eas.json` to `eas secret:create` | Keys not in git |
| **Avatar policy alignment** | If uploads use flat `{uuid}-{ts}.blob` keys, update storage policy to `filename LIKE auth.uid()::text \|\| '-%'` | Owner can upload/update/delete own avatar only |
| **Privacy policy** | Add RevenueCat to `legal/privacy.md`; align HealthKit `READ_TYPES` with actual reads | App Store privacy questionnaire matches code |
| **Dependency upgrades** | Evaluate Expo 56 / `npm audit fix` for `@xmldom/xmldom`, `@expo/plist` transitive highs | `npm audit` shows 0 high/critical |
| **SecureStore (optional)** | Migrate Supabase auth storage to `expo-secure-store` on native | Tokens not in plaintext AsyncStorage |
| **Web CSP (optional)** | Add CSP headers on web hosting for `tryironpath.com` | Security headers scan passes |

---

## 7. Re-verification results (post-fix)

| Check | Result |
|-------|--------|
| Migration `vibesec_security_hardening` | ✅ Applied |
| Triggers `trg_v2_profiles_protect_subscription`, `trg_v2_profiles_protect_deletion` | ✅ Active on `v2_profiles` |
| Security advisor: `anon_security_definer_function_executable` for subscription trigger | ✅ **Resolved** (was WARN pre-fix) |
| Security advisor: `auth_leaked_password_protection` | ⛔ Out of scope (cannot enable) |
| Security advisor: GraphQL lint-0027 (22 tables) | ⚠️ Expected — RLS-protected; informational |
| Legacy v1 tables | ✅ None in live `public` schema |
| `https://tryironpath.com/privacy` | ✅ HTTP 200 (was 404 on 2026-06-09) |
| `https://tryironpath.com/terms` | ✅ HTTP 200 (was 404 on 2026-06-09) |
| Edge functions deployed | ✅ 4 active (`generate-workout`, `delete-account`, `update-muscle-freshness`, `revenuecat-webhook`); `generate-exercise-image` removed |
| `npm audit` | ⚠️ 24 vulnerabilities — deferred (Expo toolchain) |

---

## 8. Relationship to June 9 audit

| June 9 item | This audit |
|-------------|------------|
| Legal URLs 404 | **Resolved** — live 200 as of 2026-06-14 |
| Leaked password protection | **Out of scope** — dashboard toggle unavailable; do not treat as open work |
| `generate-exercise-image` unauthenticated | **Removed** — function and batch scripts deleted |
| Watch stale `transferUserInfo` | **Fixed** — session/set validation |
| Security advisor remediation | **Extended** — subscription INSERT, deletion fields, EXECUTE revokes |
| `update-muscle-freshness` warmups | Already fixed pre-audit (v14+); this audit adds completed-session gate |

---

## 9. Dependency & supply chain (SEC-DEP)

`npm audit` (2026-06-14): **24 vulnerabilities** (1 critical, 3 high, 20 moderate).

Notable transitive issues:
- `@xmldom/xmldom` < 0.8.13 (XML injection / DoS) via `@bacons/xcode` → `@bacons/apple-targets`
- `@expo/plist` via same chain
- `expo` toolchain moderate issues — fix path is **Expo 56** (semver major)

**No committed service role keys, OpenAI keys, or `.env` files** found in repository scan. `SUPABASE_SERVICE_ROLE_KEY` appears only in edge function server code.

---

## 10. Recommended follow-ups (priority order)

1. ~~Enable leaked password protection in Supabase Dashboard~~ — **cancelled / out of scope** (cannot enable)
2. Add web CSP at hosting layer (`tryironpath.com`)
3. Plan Expo 56 upgrade for dependency CVEs (`SEC-DEP-01`)
4. Set real Sentry org in `app.json` and `EXPO_PUBLIC_SENTRY_DSN` in EAS
5. Set `REVENUECAT_SECRET_API_KEY` in Supabase Edge Function secrets for GDPR subscriber purge on delete
6. Add RLS integration tests for subscription INSERT and deletion-field triggers

---

*Audit performed 2026-06-14. Report generated as part of the VibeSec Full Security Audit Plan.*
