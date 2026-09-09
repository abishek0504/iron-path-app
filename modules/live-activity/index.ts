/**
 * Native Live Activity bindings. Prefer src/lib/workout/liveActivity.ts
 * from app code — that wrapper no-ops when this module is missing.
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
  await native.startRestLiveActivity(endsAtEpoch);
}

export async function updateRestLiveActivity(endsAtEpoch: number): Promise<void> {
  if (!native?.updateRestLiveActivity) return;
  await native.updateRestLiveActivity(endsAtEpoch);
}

export async function endRestLiveActivity(): Promise<void> {
  if (!native?.endRestLiveActivity) return;
  await native.endRestLiveActivity();
}
