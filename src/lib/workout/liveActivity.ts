/**
 * Rest-timer Live Activity JS API.
 * No-ops on non-iOS and when the native module is not present (Expo Go / web).
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type LiveActivityNative = {
  startRestLiveActivity: (endsAtEpoch: number) => Promise<void>;
  updateRestLiveActivity: (endsAtEpoch: number) => Promise<void>;
  endRestLiveActivity: () => Promise<void>;
};

const native =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<LiveActivityNative>('LiveActivity')
    : null;

export async function startRestLiveActivity(endsAtEpoch: number): Promise<void> {
  if (!native?.startRestLiveActivity) return;
  try {
    await native.startRestLiveActivity(endsAtEpoch);
  } catch {
    // ActivityKit unavailable, permission denied, or Expo Go — safe no-op.
  }
}

export async function updateRestLiveActivity(endsAtEpoch: number): Promise<void> {
  if (!native?.updateRestLiveActivity) return;
  try {
    await native.updateRestLiveActivity(endsAtEpoch);
  } catch {
    // Safe no-op.
  }
}

export async function endRestLiveActivity(): Promise<void> {
  if (!native?.endRestLiveActivity) return;
  try {
    await native.endRestLiveActivity();
  } catch {
    // Safe no-op.
  }
}
