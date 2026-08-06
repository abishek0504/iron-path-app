/**
 * AsyncStorage-backed disk cache for hot startup data.
 * Used as a cold-start hydrate layer under the in-memory TTL caches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@iron_path_disk_cache:';

type DiskEnvelope<T> = {
  value: T;
  savedAt: number;
};

export async function readDiskCache<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as DiskEnvelope<T>;
    return parsed?.value;
  } catch {
    return undefined;
  }
}

export async function writeDiskCache<T>(key: string, value: T): Promise<void> {
  try {
    const envelope: DiskEnvelope<T> = { value, savedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Best-effort; memory cache still works without disk.
  }
}

export async function removeDiskCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export async function removeDiskCachePrefix(prefix: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const match = keys.filter((k) => k.startsWith(PREFIX + prefix));
    if (match.length > 0) {
      await AsyncStorage.multiRemove(match);
    }
  } catch {
    // ignore
  }
}
