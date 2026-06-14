/**
 * Auth token storage: SecureStore on native (chunked for large sessions),
 * localStorage on web.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 2000;
const CHUNK_COUNT_SUFFIX = '_chunk_count';

async function secureGetItem(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
  if (countStr == null) {
    return SecureStore.getItemAsync(key);
  }

  const count = Number.parseInt(countStr, 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function secureSetItem(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`).catch(() => undefined);
    for (let i = 0; i < 32; i++) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => undefined);
    }
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const count = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`, String(count));
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(
      `${key}_chunk_${i}`,
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

async function secureRemoveItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`);
  if (countStr != null) {
    const count = Number.parseInt(countStr, 10);
    if (Number.isFinite(count) && count > 0) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => undefined);
      }
    }
    await SecureStore.deleteItemAsync(`${key}${CHUNK_COUNT_SUFFIX}`).catch(() => undefined);
  }
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

const webStorage = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined') {
      return Promise.resolve(window.localStorage.getItem(key));
    }
    return Promise.resolve(null);
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

export const authStorage =
  Platform.OS === 'web'
    ? webStorage
    : {
        getItem: secureGetItem,
        setItem: secureSetItem,
        removeItem: secureRemoveItem,
      };
