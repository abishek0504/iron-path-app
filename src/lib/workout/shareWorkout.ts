import { Platform } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { devError, devLog } from '../utils/logger';

export interface ShareWorkoutStats {
  title: string;
  durationMin: number;
  volume: number;
  unitsLabel: string;
  setCount: number;
  topLifts: { name: string; detail: string }[];
}

export async function shareWorkoutCardImage(
  viewRef: RefObject<View | null>,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const ViewShot = require('react-native-view-shot') as typeof import('react-native-view-shot');
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');
    const uri = await ViewShot.captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    const available = await Sharing.isAvailableAsync();
    if (!available) return false;
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Share workout',
    });
    if (__DEV__) {
      devLog('workout-share', { action: 'shared_card' });
    }
    return true;
  } catch (error) {
    if (__DEV__) {
      devError('workout-share', error, { action: 'shareWorkoutCardImage' });
    }
    return false;
  }
}
