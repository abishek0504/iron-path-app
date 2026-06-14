/**
 * Edge Function: Delete Account (soft-delete)
 *
 * Marks the authenticated user's account for deletion with a grace period.
 * Per Apple App Store Guideline 5.1.1(v), every account-creating app must
 * provide an in-app way to request account deletion.
 *
 * Flow:
 *  1. Authenticate caller via Authorization: Bearer <user-jwt>.
 *  2. Set v2_profiles.deleted_at = now() and scheduled_purge_at = now() + grace.
 *  3. Revoke all of the user's refresh tokens via admin API (forces sign-out
 *     across devices). The client should also call supabase.auth.signOut().
 *
 * The actual hard-delete (auth.users + cascade of v2_* rows) is handled by a
 * separate scheduled purge job that runs on rows where
 *   scheduled_purge_at <= now()
 *
 * Restore: handled client-side by updating v2_profiles directly (RLS allows
 * the owner to clear deleted_at + scheduled_purge_at on their own row).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GRACE_PERIOD_DAYS = 30;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    const authHeader = req.headers.get('authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!bearer) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    // Verify the bearer is a real user JWT (never trust body user_id here).
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }
    const userId = userData.user.id;

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: fetchErr } = await serviceClient
      .from('v2_profiles')
      .select('deleted_at, scheduled_purge_at')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) {
      return jsonResponse({ error: 'Failed to mark account for deletion' }, 500);
    }

    if (existing?.deleted_at && existing.scheduled_purge_at) {
      return jsonResponse(
        {
          success: true,
          scheduled_purge_at: existing.scheduled_purge_at,
          grace_days: GRACE_PERIOD_DAYS,
        },
        200,
      );
    }

    const now = new Date();
    const purgeAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const { error: updateErr } = await serviceClient
      .from('v2_profiles')
      .update({
        deleted_at: now.toISOString(),
        scheduled_purge_at: purgeAt.toISOString(),
      })
      .eq('id', userId);

    if (updateErr) {
      return jsonResponse({ error: 'Failed to mark account for deletion' }, 500);
    }

    // Revoke all refresh tokens so the user is signed out on all devices.
    // signOut on the admin client revokes for the JWT's user.
    try {
      await serviceClient.auth.admin.signOut(bearer);
    } catch {
      // Non-fatal — the row is already marked, client also calls signOut().
    }

    // Optional GDPR subscriber purge when RevenueCat secret API key is configured.
    const rcSecret = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (rcSecret) {
      try {
        await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${rcSecret}` },
        });
      } catch {
        // Non-fatal — account is still marked for deletion.
      }
    }

    return jsonResponse(
      {
        success: true,
        scheduled_purge_at: purgeAt.toISOString(),
        grace_days: GRACE_PERIOD_DAYS,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in delete-account:', message);
    return jsonResponse({ error: 'Account deletion failed' }, 500);
  }
});
