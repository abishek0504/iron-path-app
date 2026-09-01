/**
 * Shared in-memory TTL cache with stale-while-revalidate.
 * Optional disk persistence is handled by callers via diskCache.
 */

export type CacheEntry<T> = {
  value: T;
  /** Fresh until this timestamp — served without network. */
  expiresAt: number;
  /** Stale-but-usable until this timestamp — served while a background refresh runs. */
  staleUntil: number;
};

export type TtlCacheOptions = {
  /** Fresh window (ms). Default 90s. */
  ttlMs?: number;
  /** Extra window after TTL where stale data is served while refreshing. Default 10 min. */
  staleMs?: number;
};

const DEFAULT_TTL_MS = 90 * 1000;
const DEFAULT_STALE_MS = 10 * 60 * 1000;

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function peekCache<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.staleUntil) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function isCacheFresh(key: string): boolean {
  const entry = store.get(key);
  return !!entry && entry.expiresAt > Date.now();
}

export function setCacheValue<T>(
  key: string,
  value: T,
  options?: TtlCacheOptions
): void {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const now = Date.now();
  store.set(key, {
    value,
    expiresAt: now + ttlMs,
    staleUntil: now + ttlMs + staleMs,
  });
}

export function deleteCacheKey(key: string): void {
  store.delete(key);
}

export function deleteCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Return cached value when fresh; when stale, return immediately and refresh in
 * background; on miss, await the fetcher.
 */
export function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: TtlCacheOptions
): Promise<T> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return Promise.resolve(entry.value);
  }

  const refresh = (): Promise<T> => {
    const existing = inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = fetcher()
      .then((value) => {
        setCacheValue(key, value, { ttlMs, staleMs });
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, promise);
    return promise;
  };

  if (entry && entry.staleUntil > now) {
    void refresh().catch(() => undefined);
    return Promise.resolve(entry.value);
  }

  return refresh();
}

/** Drop every in-memory TTL entry. Used on sign-out so the next account cannot reuse cache. */
export function clearAllMemoryCache(): void {
  store.clear();
  inflight.clear();
}
