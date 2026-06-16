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
  phase?: 'execution' | 'rest' | 'logging' | 'complete' | 'setRpe';
  /** Epoch seconds when the rest timer ends (only during rest phase). */
  restEndsAt?: number;
  /** Epoch seconds when the timed exercise countdown ends (execution phase). */
  exerciseEndsAt?: number;
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

export interface WatchHeartRateEvent {
  type: 'heartRate';
  sessionId: string;
  bpm: number;
  timestamp: number;
}

export interface WatchWorkoutEndedEvent {
  type: 'workoutEnded';
  sessionId: string;
  hkWorkoutUuid: string;
}

type WatchConnectivityEvents = {
  onSetCompleted(event: WatchSetCompletedEvent): void;
  onWatchStateChanged(event: WatchStateChangedEvent): void;
  onHeartRate(event: WatchHeartRateEvent): void;
  onWorkoutEnded(event: WatchWorkoutEndedEvent): void;
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
  const subscription = native.addListener('onSetCompleted', (raw: WatchSetCompletedEvent) => {
    const normalized = normalizeWatchSetCompletedEvent(raw as unknown as Record<string, unknown>);
    if (normalized) listener(normalized);
  });
  return () => subscription.remove();
}

export function addHeartRateListener(
  listener: (event: WatchHeartRateEvent) => void,
): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onHeartRate', (raw: WatchHeartRateEvent) => {
    const normalized = normalizeWatchHeartRateEvent(raw as unknown as Record<string, unknown>);
    if (normalized) listener(normalized);
  });
  return () => subscription.remove();
}

export function addWorkoutEndedListener(
  listener: (event: WatchWorkoutEndedEvent) => void,
): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onWorkoutEnded', (raw: WatchWorkoutEndedEvent) => {
    const normalized = normalizeWatchWorkoutEndedEvent(raw as unknown as Record<string, unknown>);
    if (normalized) listener(normalized);
  });
  return () => subscription.remove();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeWatchSetCompletedEvent(
  raw: Record<string, unknown>,
): WatchSetCompletedEvent | null {
  if (raw.type !== 'completeSet') return null;

  const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
  if (!sessionId || !UUID_RE.test(sessionId)) return null;

  const setNumber = Number(raw.setNumber);
  if (!Number.isFinite(setNumber) || setNumber < 1 || !Number.isInteger(setNumber)) {
    return null;
  }

  const sentAtRaw = raw.sentAt;
  const sentAt =
    typeof sentAtRaw === 'number' && Number.isFinite(sentAtRaw) && sentAtRaw > 0
      ? sentAtRaw
      : Date.now() / 1000;

  return {
    type: 'completeSet',
    sessionId,
    setNumber,
    sentAt,
  };
}

function normalizeWatchHeartRateEvent(
  raw: Record<string, unknown>,
): WatchHeartRateEvent | null {
  if (raw.type !== 'heartRate') return null;
  const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
  if (!sessionId || !UUID_RE.test(sessionId)) return null;
  const bpm = Number(raw.bpm);
  if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 250) return null;
  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : Date.now() / 1000;
  return { type: 'heartRate', sessionId, bpm: Math.round(bpm), timestamp };
}

function normalizeWatchWorkoutEndedEvent(
  raw: Record<string, unknown>,
): WatchWorkoutEndedEvent | null {
  if (raw.type !== 'workoutEnded') return null;
  const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
  const hkWorkoutUuid = typeof raw.hkWorkoutUuid === 'string' ? raw.hkWorkoutUuid.trim() : '';
  if (!sessionId || !UUID_RE.test(sessionId)) return null;
  if (!hkWorkoutUuid || !UUID_RE.test(hkWorkoutUuid)) return null;
  return { type: 'workoutEnded', sessionId, hkWorkoutUuid };
}
