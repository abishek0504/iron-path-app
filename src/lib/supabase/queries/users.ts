/**
 * User queries
 * Handles user profile and preferences
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import type { UserProfile } from '../../../stores/userStore';

const PROFILE_UPDATE_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'height',
  'current_weight',
  'goal_weight',
  'experience_level',
  'equipment_access',
  'days_per_week',
  'workout_days',
  'preferred_training_style',
  'use_imperial',
  'avatar_url',
  'app_tour_completed_at',
] as const satisfies readonly (keyof UserProfile)[];

const PROFILE_CREATE_FIELDS = [...PROFILE_UPDATE_FIELDS] as const;

function pickProfileFields<T extends readonly (keyof UserProfile)[]>(
  source: Partial<UserProfile>,
  allowed: T,
): Partial<UserProfile> {
  const result: Partial<UserProfile> = {};
  for (const key of allowed) {
    if (key in source && source[key] !== undefined) {
      (result as Record<string, unknown>)[key] = source[key];
    }
  }
  return result;
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (__DEV__) {
    devLog('user-query', { action: 'getUserProfile', userId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('user-query', error, { userId });
      }
      return null;
    }

    return data as UserProfile | null;
  } catch (error) {
    if (__DEV__) {
      devError('user-query', error, { userId });
    }
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  if (__DEV__) {
    devLog('user-query', {
      action: 'updateUserProfile',
      userId,
      updateKeys: Object.keys(updates),
    });
  }

  try {
    const safeUpdates = pickProfileFields(updates, PROFILE_UPDATE_FIELDS);
    const { error } = await supabase
      .from('v2_profiles')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      if (__DEV__) {
        devError('user-query', error, { userId, updates });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('user-query', error, { userId, updates });
    }
    return false;
  }
}

/**
 * Create user profile (on signup)
 */
export async function createUserProfile(
  userId: string,
  profile: Partial<UserProfile>
): Promise<boolean> {
  if (__DEV__) {
    devLog('user-query', { action: 'createUserProfile', userId });
  }

  try {
    const safeProfile = pickProfileFields(profile, PROFILE_CREATE_FIELDS);
    const { error } = await supabase.from('v2_profiles').insert({
      id: userId,
      ...safeProfile,
    });

    if (error) {
      if (__DEV__) {
        devError('user-query', error, { userId, profile });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('user-query', error, { userId, profile });
    }
    return false;
  }
}

/**
 * Request account deletion via the delete-account Edge Function.
 * On success the user is signed out across devices and the row is marked with
 * deleted_at + scheduled_purge_at. The user can sign in again during the grace
 * period to restore via `restoreAccount`.
 */
export async function requestAccountDeletion(): Promise<
  | { success: true; scheduled_purge_at: string; grace_days: number }
  | { success: false; error: string }
> {
  if (__DEV__) {
    devLog('user-query', { action: 'requestAccountDeletion' });
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean;
      scheduled_purge_at?: string;
      grace_days?: number;
      error?: string;
    }>('delete-account', { body: {} });

    if (error || !data?.success || !data.scheduled_purge_at || data.grace_days == null) {
      const message = error?.message || data?.error || 'Failed to request account deletion';
      if (__DEV__) {
        devError('user-query', error || new Error(message), { action: 'requestAccountDeletion' });
      }
      return { success: false, error: message };
    }

    return {
      success: true,
      scheduled_purge_at: data.scheduled_purge_at,
      grace_days: data.grace_days,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to request account deletion';
    if (__DEV__) {
      devError('user-query', error, { action: 'requestAccountDeletion' });
    }
    return { success: false, error: message };
  }
}

/**
 * Restore an account that is in the soft-delete grace period.
 * Clears deleted_at + scheduled_purge_at on the caller's profile row.
 * RLS already restricts updates to the owner; the explicit eq('id', userId) is
 * a belt-and-braces ownership check.
 */
export async function restoreAccount(userId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('user-query', { action: 'restoreAccount', userId });
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user.id !== userId) {
      if (__DEV__) {
        devError('user-query', new Error('restoreAccount user mismatch'), { userId });
      }
      return false;
    }

    const { data, error } = await supabase
      .from('v2_profiles')
      .update({
        deleted_at: null,
        scheduled_purge_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        devError('user-query', error, { userId, action: 'restoreAccount' });
      }
      return false;
    }
    return !!data?.id;
  } catch (error) {
    if (__DEV__) {
      devError('user-query', error, { userId, action: 'restoreAccount' });
    }
    return false;
  }
}

