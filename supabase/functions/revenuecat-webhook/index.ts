/**
 * RevenueCat webhook → sync the Ironpath Pro entitlement to v2_profiles.
 *
 * Set REVENUECAT_WEBHOOK_SECRET in Supabase secrets; configure the same value
 * as the Authorization header in the RevenueCat dashboard.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENTITLEMENT_PRO = 'Ironpath Pro';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RevenueCatEvent {
  id?: string;
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

function expirationFromEvent(event: RevenueCatEvent): string | null {
  if (event.expiration_at_ms == null) return null;
  return new Date(event.expiration_at_ms).toISOString();
}

function rawTierFromEvent(type: string, event: RevenueCatEvent): 'free' | 'pro' {
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
      return 'free';
    case 'BILLING_ISSUE':
      return hasProEntitlement(event) ? 'pro' : 'free';
    default:
      return hasProEntitlement(event) ? 'pro' : 'free';
  }
}

function resolveSubscription(
  type: string,
  event: RevenueCatEvent,
): { tier: 'free' | 'pro'; expiresAt: string | null } {
  const rawTier = rawTierFromEvent(type, event);
  const expiresAt = expirationFromEvent(event);
  if (rawTier !== 'pro') {
    return { tier: 'free', expiresAt: null };
  }
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    return { tier: 'free', expiresAt: null };
  }
  return { tier: 'pro', expiresAt };
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

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.id) {
    const { data: existingEvent, error: existingEventError } = await serviceClient
      .from('revenuecat_webhook_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (existingEventError) {
      console.error('revenuecat-webhook event lookup failed', existingEventError.message);
      return jsonResponse({ error: 'Failed to record event' }, 500);
    }
    if (existingEvent) {
      return jsonResponse({ ok: true, duplicate: true }, 200);
    }
  }

  const { tier, expiresAt } = resolveSubscription(event.type, event);

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

  if (event.id) {
    const { error: eventInsertError } = await serviceClient
      .from('revenuecat_webhook_events')
      .insert({ event_id: event.id, event_type: event.type });
    if (eventInsertError && eventInsertError.code !== '23505') {
      console.error('revenuecat-webhook event insert failed', eventInsertError.message);
      return jsonResponse({ error: 'Failed to record event' }, 500);
    }
  }

  return jsonResponse({ ok: true, tier }, 200);
});
