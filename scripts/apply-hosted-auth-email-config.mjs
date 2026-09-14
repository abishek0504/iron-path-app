#!/usr/bin/env node
/**
 * Pushes branded Auth email templates + Site URL + reset-page redirect URLs
 * to the hosted IronPath project.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-hosted-auth-email-config.mjs
 *
 * Token sources (first match wins):
 *   SUPABASE_ACCESS_TOKEN
 *   ~/.supabase/access-token
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_REF = 'wmraczqltegkqbststik';
const SITE_URL = 'https://tryironpath.com';
const AUTH_CONFIG_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const REQUIRED_REDIRECTS = [
  'https://tryironpath.com/reset-password',
  'https://www.tryironpath.com/reset-password',
  'https://tryironpath.com/**',
  'https://www.tryironpath.com/**',
  'ironpath://**',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'supabase/templates');

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), 'utf8').trim();
}

function resolveAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    return process.env.SUPABASE_ACCESS_TOKEN.trim();
  }
  const tokenPath = path.join(os.homedir(), '.supabase', 'access-token');
  if (fs.existsSync(tokenPath)) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    if (token) return token;
  }
  return null;
}

function splitAllowList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeAllowList(existing) {
  const merged = new Set(splitAllowList(existing));
  for (const url of REQUIRED_REDIRECTS) merged.add(url);
  return [...merged].join(',');
}

async function requestJson(method, token, body) {
  const response = await fetch(AUTH_CONFIG_URL, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const detail = json?.message || json?.error || text.slice(0, 500);
    throw new Error(`${method} ${AUTH_CONFIG_URL} failed (${response.status}): ${detail}`);
  }
  return json;
}

function dashboardFallback(reason) {
  console.error(reason);
  console.error(`
Hosted Auth was not updated. Paste recovery.html in:
https://supabase.com/dashboard/project/${PROJECT_REF}/auth/templates

Also set:
- Site URL: ${SITE_URL}
- Redirect URLs (add, do not replace):
  ${REQUIRED_REDIRECTS.join('\n  ')}

Create an access token at https://supabase.com/dashboard/account/tokens
then rerun:
  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-hosted-auth-email-config.mjs
`);
  process.exitCode = 1;
}

async function main() {
  const token = resolveAccessToken();
  if (!token) {
    dashboardFallback('No SUPABASE_ACCESS_TOKEN (and no ~/.supabase/access-token).');
    return;
  }

  const current = await requestJson('GET', token);
  const uriAllowList = mergeAllowList(current.uri_allow_list);
  const payload = {
    site_url: SITE_URL,
    uri_allow_list: uriAllowList,
    mailer_subjects_confirmation: 'Confirm your IronPath email',
    mailer_templates_confirmation_content: readTemplate('confirmation.html'),
    mailer_subjects_invite: 'You have been invited to IronPath',
    mailer_templates_invite_content: readTemplate('invite.html'),
    mailer_subjects_magic_link: 'Your IronPath sign-in link',
    mailer_templates_magic_link_content: readTemplate('magic_link.html'),
    mailer_subjects_email_change: 'Confirm your new IronPath email',
    mailer_templates_email_change_content: readTemplate('email_change.html'),
    mailer_subjects_recovery: 'Reset your IronPath password',
    mailer_templates_recovery_content: readTemplate('recovery.html'),
    mailer_subjects_reauthentication: '{{ .Token }} is your IronPath verification code',
    mailer_templates_reauthentication_content: readTemplate('reauthentication.html'),
    mailer_notifications_password_changed_enabled: true,
    mailer_subjects_password_changed_notification: 'Your IronPath password was changed',
    mailer_templates_password_changed_notification_content: readTemplate('password_changed.html'),
    mailer_notifications_email_changed_enabled: true,
    mailer_subjects_email_changed_notification: 'Your IronPath email was changed',
    mailer_templates_email_changed_notification_content: readTemplate('email_changed.html'),
    mailer_notifications_phone_changed_enabled: true,
    mailer_subjects_phone_changed_notification: 'Your IronPath phone number was changed',
    mailer_templates_phone_changed_notification_content: readTemplate('phone_changed.html'),
    mailer_notifications_identity_linked_enabled: true,
    mailer_subjects_identity_linked_notification: 'A sign-in method was linked to your IronPath account',
    mailer_templates_identity_linked_notification_content: readTemplate('identity_linked.html'),
    mailer_notifications_identity_unlinked_enabled: true,
    mailer_subjects_identity_unlinked_notification: 'A sign-in method was removed from your IronPath account',
    mailer_templates_identity_unlinked_notification_content: readTemplate('identity_unlinked.html'),
    mailer_notifications_mfa_factor_enrolled_enabled: true,
    mailer_subjects_mfa_factor_enrolled_notification: 'A verification method was added to your IronPath account',
    mailer_templates_mfa_factor_enrolled_notification_content: readTemplate('mfa_factor_enrolled.html'),
    mailer_notifications_mfa_factor_unenrolled_enabled: true,
    mailer_subjects_mfa_factor_unenrolled_notification: 'A verification method was removed from your IronPath account',
    mailer_templates_mfa_factor_unenrolled_notification_content: readTemplate('mfa_factor_unenrolled.html'),
  };

  const updated = await requestJson('PATCH', token, payload);
  const recovery = String(updated.mailer_templates_recovery_content ?? '');
  const hasTokenHash = recovery.includes('{{ .TokenHash }}');
  const hasResetPath = recovery.includes('/reset-password');
  console.log(
    JSON.stringify(
      {
        site_url: updated.site_url,
        uri_allow_list: updated.uri_allow_list,
        mailer_subjects_recovery: updated.mailer_subjects_recovery,
        recovery_uses_token_hash: hasTokenHash,
        recovery_points_at_reset_password: hasResetPath,
        password_changed_notifications: updated.mailer_notifications_password_changed_enabled,
      },
      null,
      2,
    ),
  );

  if (!hasTokenHash || !hasResetPath) {
    throw new Error('Hosted recovery template did not contain the token_hash reset-password link.');
  }
}

main().catch((error) => {
  dashboardFallback(error instanceof Error ? error.message : String(error));
});
