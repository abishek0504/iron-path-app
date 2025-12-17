/**
 * User queries
 * Handles user profile and preferences
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import type { UserProfile } from '../../stores/userStore';

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
      .single();

    if (error) {
      if (__DEV__) {
        devError('user-query', error, { userId });
      }
      return null;
    }

    return data as UserProfile;
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
    const { error } = await supabase
      .from('v2_profiles')
      .update({
        ...updates,
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
    const { error } = await supabase.from('v2_profiles').insert({
      id: userId,
      ...profile,
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

