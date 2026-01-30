/**
 * Short-TTL in-memory cache for template list and full template (days + slots).
 * Reduces refetches when switching between Workout and Planner tabs.
 * Call invalidateTemplates / invalidateTemplate after mutations.
 */

import {
  getUserTemplates,
  getTemplateWithDaysAndSlots,
  type TemplateSummary,
  type FullTemplate,
} from '../supabase/queries/templates';

const TTL_MS = 90 * 1000; // 90 seconds

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

function getOrSet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return Promise.resolve(entry.value);
  }
  return fetcher().then((value) => {
    cache.set(key, { value, expiresAt: now + TTL_MS });
    return value;
  });
}

export function getUserTemplatesCached(userId: string): Promise<TemplateSummary[]> {
  return getOrSet(`templates:${userId}`, () => getUserTemplates(userId));
}

export function getTemplateWithDaysAndSlotsCached(
  templateId: string
): Promise<FullTemplate | null> {
  return getOrSet(`template:${templateId}`, () => getTemplateWithDaysAndSlots(templateId));
}

export function invalidateTemplates(userId: string): void {
  cache.delete(`templates:${userId}`);
}

export function invalidateTemplate(templateId: string): void {
  cache.delete(`template:${templateId}`);
}
