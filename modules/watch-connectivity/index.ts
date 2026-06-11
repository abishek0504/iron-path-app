/**
 * JS API for the iPhone-side WCSession bridge (see ios/WatchConnectivityModule.swift).
 *
 * The native module only exists in dev-client / production iOS builds, so the
 * module is resolved optionally — every call is a safe no-op on web, Android,
 * and Expo Go.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';

export interface WatchWorkoutContext {
  active: boolean;
  sessionId?: string;
  exerciseName?: string;
  setNumber?: number;
  totalSets?: number;
  targetText?: string;
  /** Current set's type; the watch shows a "Warmup" label for warmup sets. */
  setType?: 'normal' | 'warmup' | 'drop' | 'failure';
  phase?: 'execution' | 'rest' | 'logging' | 'complete';
  /** Epoch seconds when the rest timer ends (only during rest phase). */
  restEndsAt?: number;
  nextUp?: string;
  supersetLabel?: string;
  updatedAt?: number;
}

export interface WatchSetCompletedEvent {
  type: 'completeSet';
  sessionId: string;
  setNumber: number;
  sentAt: number;
}

export interface WatchStateChangedEvent {
  paired: boolean;
  installed: boolean;
  reachable: boolean;
}

type WatchConnectivityEvents = {
  onSetCompleted(event: WatchSetCompletedEvent): void;
  onWatchStateChanged(event: WatchStateChangedEvent): void;
};

declare class WatchConnectivityNativeModule extends NativeModule<WatchConnectivityEvents> {
  isSupported(): boolean;
  getWatchState(): Promise<{
    supported: boolean;
    paired: boolean;
    installed: boolean;
    reachable: boolean;
  }>;
  updateWorkoutContext(context: Record<string, unknown>): Promise<void>;
  clearWorkoutContext(): Promise<void>;
}

const native =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<WatchConnectivityNativeModule>('WatchConnectivity')
    : null;

export function isWatchSupported(): boolean {
  return native?.isSupported() ?? false;
}

export async function getWatchState() {
  if (!native) {
    return { supported: false, paired: false, installed: false, reachable: false };
  }
  return native.getWatchState();
}

/** Mirror the current workout state to the watch. Latest state wins. */
export async function updateWorkoutContext(context: WatchWorkoutContext): Promise<void> {
  if (!native) return;
  try {
    await native.updateWorkoutContext({
      ...context,
      updatedAt: Date.now() / 1000,
    });
  } catch {
    // updateApplicationContext throws when nothing is paired — safe to ignore.
  }
}

/** Tell the watch no workout is active (e.g. after completion/abandon). */
export async function clearWorkoutContext(): Promise<void> {
  if (!native) return;
  try {
    await native.clearWorkoutContext();
  } catch {
    // No paired watch — nothing to clear.
  }
}

/** Subscribe to set-completion taps from the watch. Returns an unsubscribe fn. */
export function addSetCompletedListener(
  listener: (event: WatchSetCompletedEvent) => void,
): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onSetCompleted', listener);
  return () => subscription.remove();
}
