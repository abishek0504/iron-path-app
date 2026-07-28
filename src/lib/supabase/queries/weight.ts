/**
 * Weight log queries
 * Handles inserting and fetching weight history
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import {
  writeBodyMassToHealth,
  recordDismissedBodyMassHkUuid,
} from '../../health/healthIntegration';

/** Convert stored display weight from lb to kg for HealthKit. */
const LB_TO_KG = 0.45359237;

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
  profileUpdates: { current_weight: number },
  healthDisplayUnit?: 'imperial' | 'metric',
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

    if (logData && healthDisplayUnit) {
      const weightKg = healthDisplayUnit === 'imperial' ? weight * LB_TO_KG : weight;
      void writeBodyMassToHealth({
        logId: logData.id as string,
        weightKg,
        recordedAtIso: logData.recorded_at as string,
      });
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

/** Max rows returned for the full weight history screen. */
export const WEIGHT_HISTORY_MAX = 500;

/**
 * Get full weight history for a user, ordered by recorded_at desc
 */
export async function getWeightHistoryAll(userId: string): Promise<WeightLog[]> {
  return getWeightHistory(userId, WEIGHT_HISTORY_MAX);
}

/**
 * Delete a weight log and sync profile.current_weight to the latest remaining entry.
 */
export async function deleteWeightLog(
  userId: string,
  logId: string,
): Promise<{ success: boolean; currentWeight: number | null }> {
  if (__DEV__) {
    devLog('weight-query', { action: 'deleteWeightLog', userId, logId });
  }

  try {
    const { data: existingRow, error: fetchError } = await supabase
      .from('v2_weight_logs')
      .select('id, hk_sample_uuid')
      .eq('id', logId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      if (__DEV__) devError('weight-query', fetchError, { logId, userId });
      return { success: false, currentWeight: null };
    }

    if (!existingRow) {
      if (__DEV__) {
        devLog('weight-query', { action: 'deleteWeightLog:notFound', logId, userId });
      }
      return { success: false, currentWeight: null };
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from('v2_weight_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', userId)
      .select('id');

    if (deleteError || !deletedRows?.length) {
      if (__DEV__) {
        devError('weight-query', deleteError || new Error('No rows deleted'), { logId, userId });
      }
      return { success: false, currentWeight: null };
    }

    if (existingRow.hk_sample_uuid) {
      await recordDismissedBodyMassHkUuid(userId, existingRow.hk_sample_uuid);
    }

    const { data: latestRow, error: latestError } = await supabase
      .from('v2_weight_logs')
      .select('weight')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      if (__DEV__) devError('weight-query', latestError);
      return { success: false, currentWeight: null };
    }

    const currentWeight =
      latestRow?.weight != null ? Number(latestRow.weight) : null;

    const { error: updateError } = await supabase
      .from('v2_profiles')
      .update({
        current_weight: currentWeight,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      if (__DEV__) devError('weight-query', updateError);
      return { success: false, currentWeight: null };
    }

    if (__DEV__) {
      devLog('weight-query', {
        action: 'deleteWeightLog:done',
        userId,
        logId,
        currentWeight,
      });
    }

    return { success: true, currentWeight };
  } catch (error) {
    if (__DEV__) devError('weight-query', error);
    return { success: false, currentWeight: null };
  }
}

export type ConvertUserStoredWeightsResult = {
  converted: boolean;
  reason?: string;
  from_imperial?: boolean;
  to_imperial?: boolean;
  factor?: number;
  profile_rows?: number;
  weight_log_rows?: number;
  session_set_rows?: number;
  pr_rows?: number;
  override_rows?: number;
  daily_stats_rows?: number;
  health_metrics_rows?: number;
};

/**
 * Convert all stored display-unit weights for the signed-in user.
 * Does not flip `use_imperial` — caller updates that after success.
 */
export async function convertUserStoredWeights(
  toImperial: boolean
): Promise<{ success: boolean; result?: ConvertUserStoredWeightsResult }> {
  if (__DEV__) {
    devLog('weight-query', {
      action: 'convertUserStoredWeights',
      toImperial,
      toUnit: toImperial ? 'imperial' : 'metric',
    });
  }

  try {
    const { data, error } = await supabase.rpc('convert_user_stored_weights', {
      p_to_imperial: toImperial,
    });

    if (error) {
      if (__DEV__) devError('weight-query', error, { action: 'convertUserStoredWeights' });
      return { success: false };
    }

    const result = data as ConvertUserStoredWeightsResult;
    if (__DEV__) {
      devLog('weight-query', {
        action: 'convertUserStoredWeights:done',
        converted: result?.converted,
        fromImperial: result?.from_imperial,
        toImperial: result?.to_imperial,
        sessionSetRows: result?.session_set_rows,
        weightLogRows: result?.weight_log_rows,
        prRows: result?.pr_rows,
        dailyStatsRows: result?.daily_stats_rows,
      });
    }

    return { success: true, result };
  } catch (error) {
    if (__DEV__) devError('weight-query', error, { action: 'convertUserStoredWeights' });
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
