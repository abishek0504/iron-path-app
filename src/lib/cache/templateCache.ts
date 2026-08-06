/**
 * TTL + SWR cache for template list and full template (days + slots).
 * Persists hot entries to disk for cold-start hydration.
 * Call invalidateTemplates / invalidateTemplate after mutations.
 */

import {
  getUserTemplates,
  getTemplateWithDaysAndSlots,
  type TemplateSummary,
  type FullTemplate,
} from '../supabase/queries/templates';
import { deleteCacheKey, getOrSetCached, peekCache, setCacheValue } from './ttlCache';
import { readDiskCache, removeDiskCache, writeDiskCache } from './diskCache';

const TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
const STALE_MS = 30 * 60 * 1000; // 30 minutes stale-while-revalidate

function templatesKey(userId: string) {
  return `templates:${userId}`;
}

function templateKey(templateId: string) {
  return `template:${templateId}`;
}

async function getOrSetWithDisk<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const fresh = peekCache<T>(key);
  if (fresh !== undefined) {
    return getOrSetCached(key, fetcher, { ttlMs: TTL_MS, staleMs: STALE_MS });
  }

  const fromDisk = await readDiskCache<T>(key);
  if (fromDisk !== undefined) {
    // Treat disk as stale: paint immediately, refresh in background.
    setCacheValue(key, fromDisk, { ttlMs: 0, staleMs: STALE_MS });
  }

  return getOrSetCached(key, async () => {
    const value = await fetcher();
    void writeDiskCache(key, value);
    return value;
  }, { ttlMs: TTL_MS, staleMs: STALE_MS });
}

export function getUserTemplatesCached(userId: string): Promise<TemplateSummary[]> {
  return getOrSetWithDisk(templatesKey(userId), () => getUserTemplates(userId));
}

export function getTemplateWithDaysAndSlotsCached(
  templateId: string
): Promise<FullTemplate | null> {
  return getOrSetWithDisk(templateKey(templateId), () => getTemplateWithDaysAndSlots(templateId));
}

export function peekUserTemplatesCached(userId: string): TemplateSummary[] | undefined {
  return peekCache(templatesKey(userId));
}

export function peekTemplateCached(templateId: string): FullTemplate | null | undefined {
  return peekCache(templateKey(templateId));
}

export function invalidateTemplates(userId: string): void {
  const key = templatesKey(userId);
  deleteCacheKey(key);
  void removeDiskCache(key);
}

export function invalidateTemplate(templateId: string): void {
  const key = templateKey(templateId);
  deleteCacheKey(key);
  void removeDiskCache(key);
}
