/**
 * Auth token storage: SecureStore on native (chunked for large sessions),
 * localStorage on web.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  AUTH_KEYCHAIN_SERVICE,
  CHUNK_COUNT_SUFFIX,
  CHUNK_SIZE,
  chunkIndexKeys,
  extraChunkKeysToDelete,
  nextChunkCount,
  parseChunkCount,
} from './authStorageKeys';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: AUTH_KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
}

function setItem(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

function deleteItem(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS).catch(() => undefined);
}

async function deleteKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await Promise.all(keys.map((key) => deleteItem(key)));
}

async function secureGetItem(key: string): Promise<string | null> {
  const count = parseChunkCount(await getItem(`${key}${CHUNK_COUNT_SUFFIX}`));
  if (count == null) {
    return getItem(key);
  }

  const parts: string[] = [];
  for (const chunkKey of chunkIndexKeys(key, count)) {
    const part = await getItem(chunkKey);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function secureSetItem(key: string, value: string): Promise<void> {
  const countKey = `${key}${CHUNK_COUNT_SUFFIX}`;
  const previousCount = parseChunkCount(await getItem(countKey));
  const chunkCount = nextChunkCount(value.length);

  if (chunkCount === 0) {
    await deleteKeys([
      ...chunkIndexKeys(key, previousCount ?? 0),
      ...(previousCount != null ? [countKey] : []),
    ]);
    await setItem(key, value);
    return;
  }

  await setItem(countKey, String(chunkCount));
  for (let i = 0; i < chunkCount; i++) {
    await setItem(
      `${key}_chunk_${i}`,
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  await deleteKeys([key, ...extraChunkKeysToDelete(key, previousCount, chunkCount)]);
}

async function secureRemoveItem(key: string): Promise<void> {
  const countKey = `${key}${CHUNK_COUNT_SUFFIX}`;
  const previousCount = parseChunkCount(await getItem(countKey));
  await deleteKeys([
    ...chunkIndexKeys(key, previousCount ?? 0),
    ...(previousCount != null ? [countKey] : []),
    key,
  ]);
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
