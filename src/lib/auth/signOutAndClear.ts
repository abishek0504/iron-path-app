/**
 * Central sign-out: revoke the session and wipe local user state so the next
 * login cannot briefly run as the previous account.
 */

import { supabase } from '../supabase/client';
import { useUserStore } from '../../stores/userStore';
import { invalidateProfileCache } from '../cache/dashboardStatsCache';
import { clearAllMemoryCache } from '../cache/ttlCache';
import { clearAllDiskCache } from '../cache/diskCache';
import { clearPendingAiGeneration } from '../ai/aiGenerationRecovery';
import { syncSessionAuthToWatch } from '../watch/syncWatchAuth';
import { logOutRevenueCat } from '../subscriptions/revenueCat';
import { devLog } from '../utils/logger';

/** Wipe profile, caches, pending AI work, watch auth, and RevenueCat. Session may already be gone. */
export async function clearLocalAuthState(): Promise<void> {
  const userId = useUserStore.getState().profile?.id;
  if (__DEV__) {
    devLog('auth', { action: 'clearLocalAuthState', userId: userId ?? null });
  }
  await logOutRevenueCat().catch(() => undefined);
  if (userId) {
    invalidateProfileCache(userId);
  }
  clearAllMemoryCache();
  await clearAllDiskCache();
  useUserStore.getState().clearProfile();
  await clearPendingAiGeneration();
  await syncSessionAuthToWatch(null);
}

/** Sign out remotely, then clear local state. Does not clear local state if sign-out fails. */
export async function signOutAndClearLocalState(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error };
  }
  await clearLocalAuthState();
  return { error: null };
}