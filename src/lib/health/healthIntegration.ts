/**
 * Apple Health (HealthKit) integration via @kingstinct/react-native-healthkit.
 *
 * The native module only exists in dev-client / production iOS builds, so it is
 * loaded lazily; every entry point degrades to a no-op on web, Android, Expo Go,
 * or when the user has not granted access. Writes are idempotent: HK UUIDs are
 * persisted (`hk_workout_uuid` / `hk_sample_uuid`) and rows that already carry a
 * UUID are never re-exported.
 */

import { Platform } from 'react-native';
import type { WorkoutActivityType } from '@kingstinct/react-native-healthkit';
import { supabase } from '../supabase/client';
import { devLog, devError } from '../utils/logger';

export type HealthPermissionState = 'unavailable' | 'not_determined' | 'denied' | 'authorized';

export interface HealthAuthResult {
  state: HealthPermissionState;
  /** Human-readable reason when not authorized. */
  message?: string;
}

const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass' as const;
const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier' as const;

const READ_TYPES = [BODY_MASS] as const;

const WRITE_TYPES = [WORKOUT_TYPE, BODY_MASS] as const;

/** HKWorkoutActivityTypeTraditionalStrengthTraining */
const ACTIVITY_TRADITIONAL_STRENGTH_TRAINING = 50 as WorkoutActivityType;

/** AuthorizationStatus.sharingAuthorized in HealthKit. */
const SHARING_AUTHORIZED = 2;
/** AuthorizationStatus.notDetermined in HealthKit. */
const NOT_DETERMINED = 0;

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

let cachedModule: HealthKitModule | null | undefined;

/**
 * Lazily resolve the native module. Returns null when not on iOS or when the
 * native binary is missing (Expo Go / web build).
 */
function getHealthKit(): HealthKitModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@kingstinct/react-native-healthkit') as HealthKitModule;
    cachedModule = mod.isHealthDataAvailable() ? mod : null;
  } catch (error) {
    if (__DEV__) {
      devLog('health-sync', { action: 'module:unavailable', error: String(error) });
    }
    cachedModule = null;
  }
  return cachedModule;
}

/** True when the user already granted write access for the given type. */
function canShare(hk: HealthKitModule, type: (typeof WRITE_TYPES)[number]): boolean {
  try {
    return hk.authorizationStatusFor(type) === SHARING_AUTHORIZED;
  } catch {
    return false;
  }
}

/**
 * Record the last successful sync per category in the v2_health_sync ledger.
 * Best-effort: ledger failures never block the actual Health write.
 */
async function updateSyncLedger(userId: string, type: 'workouts' | 'body_mass' | 'import') {
  try {
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase
      .from('v2_health_sync')
      .select('types')
      .eq('user_id', userId)
      .maybeSingle();
    const types = { ...((existing?.types as Record<string, string>) ?? {}), [type]: nowIso };
    await supabase
      .from('v2_health_sync')
      .upsert({ user_id: userId, last_synced_at: nowIso, types, updated_at: nowIso });
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'ledger', type });
  }
}

const DISMISSED_BODY_MASS_KEY = 'dismissed_body_mass_uuids';
const MAX_DISMISSED_BODY_MASS_UUIDS = 500;

function parseDismissedBodyMassUuids(types: unknown): string[] {
  if (!types || typeof types !== 'object') return [];
  const raw = (types as Record<string, unknown>)[DISMISSED_BODY_MASS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/**
 * Remember a HealthKit body-mass sample the user removed from IronPath so import
 * does not recreate it on the next dashboard sync.
 */
export async function recordDismissedBodyMassHkUuid(
  userId: string,
  hkSampleUuid: string,
): Promise<void> {
  if (!hkSampleUuid) return;

  try {
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase
      .from('v2_health_sync')
      .select('types, last_synced_at')
      .eq('user_id', userId)
      .maybeSingle();

    const types = { ...((existing?.types as Record<string, unknown>) ?? {}) };
    const prev = parseDismissedBodyMassUuids(types);
    if (prev.includes(hkSampleUuid)) return;

    types[DISMISSED_BODY_MASS_KEY] = [hkSampleUuid, ...prev].slice(0, MAX_DISMISSED_BODY_MASS_UUIDS);

    await supabase.from('v2_health_sync').upsert({
      user_id: userId,
      types,
      updated_at: nowIso,
      last_synced_at: existing?.last_synced_at ?? nowIso,
    });

    if (__DEV__) {
      devLog('health-sync', {
        action: 'recordDismissedBodyMassHkUuid',
        userId,
        dismissedCount: (types[DISMISSED_BODY_MASS_KEY] as string[]).length,
      });
    }
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'recordDismissedBodyMassHkUuid', userId });
  }
}

/**
 * Non-prompting connection check for UI state. HealthKit only exposes sharing
 * (write) status — read grants are invisible by design — so write access to
 * either synced type counts as connected.
 */
export function isAppleHealthConnected(): boolean {
  const hk = getHealthKit();
  if (!hk) return false;
  return canShare(hk, WORKOUT_TYPE) || canShare(hk, BODY_MASS);
}

/**
 * Requests read/write access for the types IronPath syncs. Triggers the system
 * permission sheet on first call; afterwards reflects the stored decision.
 */
export async function requestAppleHealthAccess(): Promise<HealthAuthResult> {
  if (Platform.OS !== 'ios') {
    return { state: 'unavailable', message: 'Apple Health is available on iPhone only.' };
  }

  const hk = getHealthKit();
  if (!hk) {
    return {
      state: 'unavailable',
      message:
        'HealthKit requires a native development or production build with the HealthKit entitlement. See DEVELOPMENT_BUILD.md.',
    };
  }

  try {
    await hk.requestAuthorization({ toShare: [...WRITE_TYPES], toRead: [...READ_TYPES] });

    // HealthKit only exposes sharing (write) status; read grants are invisible
    // by design. Treat write access to either type as connected.
    const workoutStatus = hk.authorizationStatusFor(WORKOUT_TYPE);
    const bodyMassStatus = hk.authorizationStatusFor(BODY_MASS);

    if (workoutStatus === SHARING_AUTHORIZED || bodyMassStatus === SHARING_AUTHORIZED) {
      return { state: 'authorized' };
    }
    if (workoutStatus === NOT_DETERMINED && bodyMassStatus === NOT_DETERMINED) {
      return { state: 'not_determined', message: 'Health access has not been decided yet.' };
    }
    return {
      state: 'denied',
      message: 'Health access was declined. You can enable it in Settings → Privacy → Health.',
    };
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'requestAuthorization' });
    return { state: 'denied', message: 'Health permission request failed.' };
  }
}

/**
 * After a session is marked completed in IronPath, mirror it to Apple Health as
 * an HKWorkout (traditional strength training) and persist the HK UUID for
 * deduplication. Never throws; silently skips when access is missing.
 */
export async function writeCompletedWorkoutToHealth(sessionId: string): Promise<void> {
  const hk = getHealthKit();
  if (!hk || !canShare(hk, WORKOUT_TYPE)) return;

  try {
    const { data: session, error } = await supabase
      .from('v2_workout_sessions')
      .select('id, user_id, started_at, completed_at, hk_workout_uuid')
      .eq('id', sessionId)
      .maybeSingle();
    if (error || !session || session.hk_workout_uuid) return;

    const start = new Date(session.started_at);
    const end = session.completed_at ? new Date(session.completed_at) : new Date();
    if (!(start.getTime() < end.getTime())) return;

    const workout = await hk.saveWorkoutSample(
      ACTIVITY_TRADITIONAL_STRENGTH_TRAINING,
      [],
      start,
      end,
    );
    if (!workout?.uuid) return;

    await supabase
      .from('v2_workout_sessions')
      .update({ hk_workout_uuid: workout.uuid })
      .eq('id', sessionId)
      .is('hk_workout_uuid', null);

    await updateSyncLedger(session.user_id, 'workouts');

    if (__DEV__) {
      devLog('health-sync', { action: 'writeWorkout:saved', sessionId, hkUuid: workout.uuid });
    }
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'writeWorkout', sessionId });
  }
}

/**
 * After a weight row is persisted, mirror body mass to HealthKit when permitted.
 * HealthKit quantities use kilograms (`weightKg`) regardless of IronPath UI units.
 */
export async function writeBodyMassToHealth(input: {
  logId: string;
  weightKg: number;
  recordedAtIso: string;
}): Promise<void> {
  const hk = getHealthKit();
  if (!hk || !canShare(hk, BODY_MASS)) return;

  try {
    const { data: log, error } = await supabase
      .from('v2_weight_logs')
      .select('id, user_id, hk_sample_uuid')
      .eq('id', input.logId)
      .maybeSingle();
    if (error || !log || log.hk_sample_uuid) return;

    const recordedAt = new Date(input.recordedAtIso);
    const sample = await hk.saveQuantitySample(
      BODY_MASS,
      'kg',
      input.weightKg,
      recordedAt,
      recordedAt,
    );
    if (!sample?.uuid) return;

    await supabase
      .from('v2_weight_logs')
      .update({ hk_sample_uuid: sample.uuid })
      .eq('id', input.logId)
      .is('hk_sample_uuid', null);

    await updateSyncLedger(log.user_id, 'body_mass');

    if (__DEV__) {
      devLog('health-sync', { action: 'writeBodyMass:saved', logId: input.logId, hkUuid: sample.uuid });
    }
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'writeBodyMass', logId: input.logId });
  }
}

/** How far back to look for external body-mass samples on sync/import. */
const SYNC_LOOKBACK_DAYS = 365;
const SYNC_SAMPLE_LIMIT = 200;
const KG_TO_LB = 2.20462262;
const LB_TO_KG = 0.45359237;

/**
 * Pull body-mass samples from Apple Health into v2_weight_logs.
 * Samples already linked via hk_sample_uuid are skipped.
 */
async function importBodyMassFromHealth(userId: string): Promise<number> {
  const hk = getHealthKit();
  if (!hk) return 0;

  try {
    const since = new Date(Date.now() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const samples = await hk.queryQuantitySamples(BODY_MASS, {
      filter: { date: { startDate: since } },
      unit: 'kg',
      limit: SYNC_SAMPLE_LIMIT,
    });
    if (!samples || samples.length === 0) return 0;

    const [{ data: existingRows }, { data: syncRow }] = await Promise.all([
      supabase
        .from('v2_weight_logs')
        .select('hk_sample_uuid')
        .eq('user_id', userId)
        .not('hk_sample_uuid', 'is', null),
      supabase.from('v2_health_sync').select('types').eq('user_id', userId).maybeSingle(),
    ]);
    const knownUuids = new Set((existingRows ?? []).map((r) => r.hk_sample_uuid as string));
    const dismissedUuids = new Set(parseDismissedBodyMassUuids(syncRow?.types));

    const newSamples = samples.filter(
      (s) => s.uuid && !knownUuids.has(s.uuid) && !dismissedUuids.has(s.uuid),
    );
    if (newSamples.length === 0) return 0;

    const { data: profile } = await supabase
      .from('v2_profiles')
      .select('use_imperial')
      .eq('id', userId)
      .maybeSingle();
    const useImperial = profile?.use_imperial === true;

    const rows = newSamples.map((s) => ({
      user_id: userId,
      weight: useImperial ? Math.round(s.quantity * KG_TO_LB * 10) / 10 : s.quantity,
      recorded_at: new Date(s.startDate).toISOString(),
      hk_sample_uuid: s.uuid,
    }));
    const { error } = await supabase.from('v2_weight_logs').insert(rows);
    if (error) {
      if (__DEV__) devError('health-sync', error, { action: 'importBodyMass:insert' });
      return 0;
    }

    await updateSyncLedger(userId, 'import');

    if (__DEV__) {
      devLog('health-sync', {
        action: 'importBodyMass:done',
        totalSamples: samples.length,
        imported: rows.length,
      });
    }

    return rows.length;
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'importBodyMass' });
    return 0;
  }
}

/**
 * Export IronPath weight logs that are not yet linked to HealthKit samples.
 */
async function exportUnlinkedBodyMassToHealth(userId: string): Promise<number> {
  const hk = getHealthKit();
  if (!hk || !canShare(hk, BODY_MASS)) return 0;

  try {
    const { data: logs, error } = await supabase
      .from('v2_weight_logs')
      .select('id, weight, recorded_at')
      .eq('user_id', userId)
      .is('hk_sample_uuid', null);
    if (error || !logs || logs.length === 0) return 0;

    const { data: profile } = await supabase
      .from('v2_profiles')
      .select('use_imperial')
      .eq('id', userId)
      .maybeSingle();
    const useImperial = profile?.use_imperial === true;

    let exported = 0;
    const logIds = logs.map((l) => l.id as string);
    for (const log of logs) {
      const weightKg = useImperial ? log.weight * LB_TO_KG : log.weight;
      await writeBodyMassToHealth({
        logId: log.id as string,
        weightKg,
        recordedAtIso: log.recorded_at as string,
      });
    }

    const { data: linkedRows } = await supabase
      .from('v2_weight_logs')
      .select('id')
      .in('id', logIds)
      .not('hk_sample_uuid', 'is', null);
    exported = linkedRows?.length ?? 0;

    if (exported > 0) {
      await updateSyncLedger(userId, 'body_mass');
    }

    if (__DEV__) {
      devLog('health-sync', { action: 'exportBodyMass:done', exported, candidates: logs.length });
    }

    return exported;
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'exportBodyMass' });
    return 0;
  }
}

/** Update profile.current_weight when the newest log differs. */
async function syncProfileWeightFromLogs(userId: string): Promise<void> {
  try {
    const { data: newest } = await supabase
      .from('v2_weight_logs')
      .select('weight')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!newest) return;

    const { data: profile } = await supabase
      .from('v2_profiles')
      .select('current_weight')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.current_weight === newest.weight) return;

    await supabase
      .from('v2_profiles')
      .update({ current_weight: newest.weight, updated_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (error) {
    if (__DEV__) devError('health-sync', error, { action: 'syncProfileWeight' });
  }
}

/**
 * Bidirectional body-mass sync: import new Health samples and export unlinked IronPath logs.
 */
export async function syncBodyMassWithHealth(
  userId: string,
): Promise<{ imported: number; exported: number }> {
  const hk = getHealthKit();
  if (!hk || !isAppleHealthConnected()) {
    return { imported: 0, exported: 0 };
  }

  const imported = await importBodyMassFromHealth(userId);
  const exported = await exportUnlinkedBodyMassToHealth(userId);
  await syncProfileWeightFromLogs(userId);

  if (__DEV__) {
    devLog('health-sync', { action: 'syncBodyMassWithHealth:done', imported, exported });
  }

  return { imported, exported };
}

/**
 * Pull recent external body-mass samples from Apple Health into v2_weight_logs.
 */
export async function importHealthSamplesForDashboard(userId: string): Promise<void> {
  await importBodyMassFromHealth(userId);
}
