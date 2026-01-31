/**
 * Weight log queries
 * Handles inserting and fetching weight history
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export type WeightLog = {
  id: string;
  user_id: string;
  weight: number;
  recorded_at: string;
};

/**
 * Insert a weight log and update profile.current_weight
 */
export async function insertWeightLog(
  userId: string,
  weight: number,
  profileUpdates: { current_weight: number }
): Promise<{ success: boolean; log?: WeightLog }> {
  if (__DEV__) {
    devLog('weight-query', { action: 'insertWeightLog', userId, weight });
  }

  try {
    const { data: logData, error: insertError } = await supabase
      .from('v2_weight_logs')
      .insert({
        user_id: userId,
        weight,
      })
      .select('id, user_id, weight, recorded_at')
      .single();

    if (insertError) {
      if (__DEV__) devError('weight-query', insertError);
      return { success: false };
    }

    const { error: updateError } = await supabase
      .from('v2_profiles')
      .update({
        current_weight: profileUpdates.current_weight,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      if (__DEV__) devError('weight-query', updateError);
      return { success: false };
    }

    return {
      success: true,
      log: logData as WeightLog,
    };
  } catch (error) {
    if (__DEV__) devError('weight-query', error);
    return { success: false };
  }
}

/**
 * Get weight history for a user, ordered by recorded_at desc
 */
export async function getWeightHistory(
  userId: string,
  limit = 90
): Promise<WeightLog[]> {
  if (__DEV__) {
    devLog('weight-query', { action: 'getWeightHistory', userId, limit });
  }

  try {
    const { data, error } = await supabase
      .from('v2_weight_logs')
      .select('id, user_id, weight, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (__DEV__) devError('weight-query', error);
      return [];
    }

    const logs = (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      weight: Number(row.weight),
      recorded_at: row.recorded_at,
    }));

    return logs;
  } catch (error) {
    if (__DEV__) devError('weight-query', error);
    return [];
  }
}
