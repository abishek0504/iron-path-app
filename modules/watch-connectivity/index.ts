/**
 * JS API for the iPhone-side WCSession bridge (see ios/WatchConnectivityModule.swift).
 *
 * The native module only exists in dev-client / production iOS builds, so the
 * module is resolved optionally — every call is a safe no-op on web, Android,
 * and Expo Go.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';

export type WatchControlDevice = 'phone' | 'watch';

export interface WatchWorkoutContext {
  active: boolean;
  sessionId?: string;
  /** Which device owns progression. Mirror mode only when phone. */
  controlDevice?: WatchControlDevice;
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
  /** Previous performance label, e.g. "135 lbs × 8". */
  lastTimeText?: string;
  /** Session orientation, e.g. "Exercise 3 of 8". */
  progressText?: string;
  /** True during timed-set RPE step (watch shows quick picker). */
  timedSetRpe?: boolean;
  updatedAt?: number;
}

export interface WatchAuthPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  userId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface WatchSetCompletedEvent {
  type: 'completeSet';
  sessionId: string;
  setNumber: number;
  sentAt: number;
}

export interface WatchSkipRestEvent {
  type: 'skipRest';
  sessionId: string;
  sentAt: number;
}

export interface WatchExtendRestEvent {
  type: 'extendRest';
  sessionId: string;
  seconds: number;
  sentAt: number;
}

export interface WatchSubmitRpeEvent {
  type: 'submitRpe';
  sessionId: string;
  setNumber: number;
  rpe: number;
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
  onSkipRest(event: WatchSkipRestEvent): void;
  onExtendRest(event: WatchExtendRestEvent): void;
  onSubmitRpe(event: WatchSubmitRpeEvent): void;
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
  startWatchApp(sessionId: string): Promise<void>;
  syncAuthToWatch(payload: Record<string, unknown>): Promise<void>;
  clearAuthFromWatch(): Promise<void>;
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
  const payload = {
    ...context,
    updatedAt: Date.now() / 1000,
  };
  try {
    await native.updateWorkoutContext(payload);
    if (__DEV__) {
      const { devLog } = require('../../src/lib/utils/logger');
      devLog('watch-connectivity', {
        action: 'updateWorkoutContext',
        phase: context.phase ?? 'execution',
        active: context.active,
        restEndsAt: context.restEndsAt ?? null,
      });
    }
  } catch (error) {
    if (__DEV__) {
      const { devLog } = require('../../src/lib/utils/logger');
      devLog('watch-connectivity', {
        action: 'updateWorkoutContext_failed',
        phase: context.phase ?? 'execution',
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

/** Best-effort: open the watch app when a workout starts. */
export async function startWatchApp(sessionId: string): Promise<void> {
  if (!native) return;
  try {
    await native.startWatchApp(sessionId);
  } catch {
    // No paired watch or OS declined — safe to ignore.
  }
}

/** Share auth + Supabase config with the watch via App Group (standalone workouts). */
export async function syncAuthToWatch(payload: WatchAuthPayload): Promise<void> {
  if (!native?.syncAuthToWatch) return;
  try {
    await native.syncAuthToWatch({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt ?? 0,
      userId: payload.userId,
      supabaseUrl: payload.supabaseUrl,
      supabaseAnonKey: payload.supabaseAnonKey,
    });
  } catch {
    // Watch / App Group unavailable — phone workouts still work.
  }
}

/** Clear shared auth when the user signs out on phone. */
export async function clearAuthFromWatch(): Promise<void> {
  if (!native?.clearAuthFromWatch) return;
  try {
    await native.clearAuthFromWatch();
  } catch {
    // Safe to ignore.
  }
}

const WATCH_EVENT_MAX_AGE_MS = 5 * 60 * 1000;

function isFreshWatchEvent(sentAt: number): boolean {
  return Date.now() - sentAt * 1000 <= WATCH_EVENT_MAX_AGE_MS;
}

/** Subscribe to set-completion taps from the watch. Returns an unsubscribe fn. */
export function addWatchStateChangedListener(
  listener: (event: WatchStateChangedEvent) => void,
): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onWatchStateChanged', (raw: WatchStateChangedEvent) => {
    listener(raw);
  });
  return () => subscription.remove();
}

export function addSetCompletedListener(
  listener: (event: WatchSetCompletedEvent) => void,
): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onSetCompleted', (raw: WatchSetCompletedEvent) => {
    const normalized = normalizeWatchSetCompletedEvent(raw as unknown as Record<string, unknown>);
    if (normalized && isFreshWatchEvent(normalized.sentAt)) listener(normalized);
  });
  return () => subscription.remove();
}

export function addSkipRestListener(listener: (event: WatchSkipRestEvent) => void): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onSkipRest', (raw: WatchSkipRestEvent) => {
    const normalized = normalizeWatchSkipRestEvent(raw as unknown as Record<string, unknown>);
    if (normalized && isFreshWatchEvent(normalized.sentAt)) listener(normalized);
  });
  return () => subscription.remove();
}

export function addExtendRestListener(listener: (event: WatchExtendRestEvent) => void): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onExtendRest', (raw: WatchExtendRestEvent) => {
    const normalized = normalizeWatchExtendRestEvent(raw as unknown as Record<string, unknown>);
    if (normalized && isFreshWatchEvent(normalized.sentAt)) listener(normalized);
  });
  return () => subscription.remove();
}

export function addSubmitRpeListener(listener: (event: WatchSubmitRpeEvent) => void): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onSubmitRpe', (raw: WatchSubmitRpeEvent) => {
    const normalized = normalizeWatchSubmitRpeEvent(raw as unknown as Record<string, unknown>);
    if (normalized && isFreshWatchEvent(normalized.sentAt)) listener(normalized);
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

function parseSessionId(raw: Record<string, unknown>): string | null {
  const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
  if (!sessionId || !UUID_RE.test(sessionId)) return null;
  return sessionId;
}

function parseSentAt(raw: Record<string, unknown>): number {
  const sentAtRaw = raw.sentAt;
  return typeof sentAtRaw === 'number' && Number.isFinite(sentAtRaw) && sentAtRaw > 0
    ? sentAtRaw
    : Date.now() / 1000;
}

function normalizeWatchSetCompletedEvent(
  raw: Record<string, unknown>,
): WatchSetCompletedEvent | null {
  if (raw.type !== 'completeSet') return null;

  const sessionId = parseSessionId(raw);
  if (!sessionId) return null;

  const setNumber = Number(raw.setNumber);
  if (!Number.isFinite(setNumber) || setNumber < 1 || !Number.isInteger(setNumber)) {
    return null;
  }

  return {
    type: 'completeSet',
    sessionId,
    setNumber,
    sentAt: parseSentAt(raw),
  };
}

function normalizeWatchSkipRestEvent(raw: Record<string, unknown>): WatchSkipRestEvent | null {
  if (raw.type !== 'skipRest') return null;
  const sessionId = parseSessionId(raw);
  if (!sessionId) return null;
  return { type: 'skipRest', sessionId, sentAt: parseSentAt(raw) };
}

function normalizeWatchExtendRestEvent(raw: Record<string, unknown>): WatchExtendRestEvent | null {
  if (raw.type !== 'extendRest') return null;
  const sessionId = parseSessionId(raw);
  if (!sessionId) return null;
  const seconds = Number(raw.seconds);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 300 || !Number.isInteger(seconds)) {
    return null;
  }
  return { type: 'extendRest', sessionId, seconds, sentAt: parseSentAt(raw) };
}

function normalizeWatchSubmitRpeEvent(raw: Record<string, unknown>): WatchSubmitRpeEvent | null {
  if (raw.type !== 'submitRpe') return null;
  const sessionId = parseSessionId(raw);
  if (!sessionId) return null;
  const setNumber = Number(raw.setNumber);
  if (!Number.isFinite(setNumber) || setNumber < 1 || !Number.isInteger(setNumber)) {
    return null;
  }
  const rpe = Number(raw.rpe);
  if (!Number.isFinite(rpe) || rpe < 6 || rpe > 10 || !Number.isInteger(rpe)) {
    return null;
  }
  return { type: 'submitRpe', sessionId, setNumber, rpe, sentAt: parseSentAt(raw) };
}

function normalizeWatchHeartRateEvent(
  raw: Record<string, unknown>,
): WatchHeartRateEvent | null {
  if (raw.type !== 'heartRate') return null;
  const sessionId = parseSessionId(raw);
  if (!sessionId) return null;
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
  const sessionId = parseSessionId(raw);
  const hkWorkoutUuid = typeof raw.hkWorkoutUuid === 'string' ? raw.hkWorkoutUuid.trim() : '';
  if (!sessionId) return null;
  if (!hkWorkoutUuid || !UUID_RE.test(hkWorkoutUuid)) return null;
  return { type: 'workoutEnded', sessionId, hkWorkoutUuid };
}
