/**
 * Prefetch hot tab data after auth so Workout/Plan/Dashboard paint from cache.
 */

import { getUserTemplatesCached, getTemplateWithDaysAndSlotsCached } from './templateCache';
import { listMergedExercisesCached } from './exerciseCache';
import { getSessionsForTodayCached } from './sessionsCache';
import { getYearToDateStatsCached, getStreakCached, getCachedTopPRsCached, getRecentSessionsCached } from './dashboardStatsCache';
import { getLocalDayBoundsIso } from '../utils/date';
import { devLog } from '../utils/logger';

/**
 * Fire-and-forget warm of the data the main tabs need.
 * Safe to call multiple times; TTL caches dedupe.
 */
export function warmStartupCaches(userId: string): void {
  void (async () => {
    try {
      const templates = await getUserTemplatesCached(userId);
      const template = templates[0];
      if (template?.id) {
        await getTemplateWithDaysAndSlotsCached(template.id);
      }

      const { startIso, endIsoExclusive } = getLocalDayBoundsIso(new Date());
      await Promise.all([
        listMergedExercisesCached(userId),
        getSessionsForTodayCached(userId, startIso, endIsoExclusive),
        getYearToDateStatsCached(userId),
        getStreakCached(userId),
        getCachedTopPRsCached(userId, 3),
        getRecentSessionsCached(userId, 3),
      ]);

      if (__DEV__) {
        devLog('warm-startup', {
          action: 'warmStartupCaches:done',
          userId,
          templateCount: templates.length,
          hasTemplate: !!template?.id,
        });
      }
    } catch (error) {
      if (__DEV__) {
        devLog('warm-startup', { action: 'warmStartupCaches:error', error: String(error) });
      }
    }
  })();
}
