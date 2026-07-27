/**
 * Mirror Supabase auth into the Watch App Group so standalone watch workouts
 * can call Supabase without the phone process.
 */

import type { Session } from '@supabase/supabase-js';
import { clearAuthFromWatch, syncAuthToWatch } from '../../../modules/watch-connectivity';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export async function syncSessionAuthToWatch(session: Session | null): Promise<void> {
  if (!session?.access_token || !session.refresh_token || !session.user?.id) {
    await clearAuthFromWatch();
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey) return;

  await syncAuthToWatch({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    userId: session.user.id,
    supabaseUrl,
    supabaseAnonKey,
  });

  if (__DEV__) {
    const { devLog } = require('../utils/logger');
    devLog('watch-auth', {
      action: 'syncSessionAuthToWatch',
      userId: session.user.id,
      expiresAt: session.expires_at ?? null,
    });
  }
}
