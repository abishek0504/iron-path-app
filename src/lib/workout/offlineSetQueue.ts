import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import { devError, devLog } from '../utils/logger';
import type { SetType } from '../supabase/queries/workouts';

const STORAGE_KEY = 'ironpath.offline_set_queue.v1';

export interface QueuedSetWrite {
  setId: string;
  values: {
    reps?: number;
    weight?: number;
    duration_sec?: number;
    rpe?: number | null;
    rir?: number | null;
    set_type?: SetType;
    performed_at: string;
  };
}

function isNetworkError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('offline')
  );
}

async function readQueue(): Promise<QueuedSetWrite[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedSetWrite[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedSetWrite[]): Promise<void> {
  if (items.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function enqueueSetWrite(item: QueuedSetWrite): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter((entry) => entry.setId !== item.setId);
  next.push(item);
  await writeQueue(next);
}

export async function flushOfflineSetQueue(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedSetWrite[] = [];
  let flushed = 0;
  for (const item of queue) {
    const { error } = await supabase
      .from('v2_session_sets')
      .update(item.values)
      .eq('id', item.setId);
    if (error) {
      if (isNetworkError(error)) {
        remaining.push(item);
      } else if (__DEV__) {
        devError('offline-set-queue', error, { setId: item.setId });
      }
    } else {
      flushed += 1;
    }
  }
  await writeQueue(remaining);
  if (__DEV__) {
    devLog('offline-set-queue', { action: 'flush', flushed, remaining: remaining.length });
  }
  return flushed;
}

export { isNetworkError };
