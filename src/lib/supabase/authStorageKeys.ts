/** iOS Keychain service id — required on iOS 26 to avoid SecureStore NSExceptions. */
export const AUTH_KEYCHAIN_SERVICE = 'com.alexpreo.ironpath';

export const CHUNK_SIZE = 2000;
export const CHUNK_COUNT_SUFFIX = '_chunk_count';

export function parseChunkCount(countStr: string | null): number | null {
  if (countStr == null) return null;
  const count = Number.parseInt(countStr, 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  return count;
}

export function chunkIndexKeys(key: string, count: number): string[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => `${key}_chunk_${i}`);
}

/** Chunk keys that exist from a previous write but are unused after shrinking. */
export function extraChunkKeysToDelete(
  key: string,
  previousCount: number | null,
  nextCount: number,
): string[] {
  if (previousCount == null || previousCount <= nextCount) return [];
  const extra: string[] = [];
  for (let i = nextCount; i < previousCount; i++) {
    extra.push(`${key}_chunk_${i}`);
  }
  return extra;
}

export function nextChunkCount(valueLength: number): number {
  if (valueLength <= CHUNK_SIZE) return 0;
  return Math.ceil(valueLength / CHUNK_SIZE);
}
