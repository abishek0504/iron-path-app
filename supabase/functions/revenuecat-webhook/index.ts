/**
 * RevenueCat webhook → sync ironpath_pro entitlement to v2_profiles.
 *
 * Set REVENUECAT_WEBHOOK_SECRET in Supabase secrets; configure the same value
 * as the Authorization header in the RevenueCat dashboard.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENTITLEMENT_PRO = 'ironpath_pro';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[] | null;
}

interface RevenueCatPayload {
  event?: RevenueCatEvent;
}

function hasProEntitlement(event: RevenueCatEvent): boolean {
  const ids = event.entitlement_ids;
  if (!ids?.length) return false;
  return ids.includes(ENTITLEMENT_PRO);
}

function tierFromEventType(type: string, event: RevenueCatEvent): 'free' | 'pro' {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'SUBSCRIPTION_EXTENDED':
      return hasProEntitlement(event) ? 'pro' : 'free';
    case 'CANCELLATION':
      if (event.expiration_at_ms != null && event.expiration_at_ms > Date.now()) {
        return hasProEntitlement(event) ? 'pro' : 'free';
      }
      return 'free';
    case 'EXPIRATION':
    case 'BILLING_ISSUE':
      return 'free';
    default:
      return hasProEntitlement(event) ? 'pro' : 'free';
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function expirationFromEvent(event: RevenueCatEvent): string | null {
  if (event.expiration_at_ms == null) return null;
  return new Date(event.expiration_at_ms).toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!secret || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !timingSafeEqual(token, secret)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: RevenueCatPayload;
  try {
    payload = (await req.json()) as RevenueCatPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const event = payload.event;
  if (!event?.app_user_id || !event.type) {
    return jsonResponse({ error: 'Missing event fields' }, 400);
  }

  const userId = event.app_user_id;
  if (!UUID_RE.test(userId)) {
    return jsonResponse({ error: 'Invalid app_user_id' }, 400);
  }
  const tier = tierFromEventType(event.type, event);
  const expiresAt = tier === 'pro' ? expirationFromEvent(event) : null;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await serviceClient
    .from('v2_profiles')
    .update({
      subscription_tier: tier,
      subscription_expires_at: expiresAt,
      revenuecat_app_user_id: userId,
    })
    .eq('id', userId);

  if (error) {
    console.error('revenuecat-webhook update failed', error.message);
    return jsonResponse({ error: 'Failed to update profile' }, 500);
  }

  return jsonResponse({ ok: true, tier }, 200);
});
