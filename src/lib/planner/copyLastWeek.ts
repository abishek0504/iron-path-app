/**
 * Clone last calendar week's sessions onto empty days in the current week.
 */

import {
  copyPrescribedSessionContent,
  createCopiedWorkoutSession,
  getSessionsForToday,
} from '../supabase/queries/workouts';
import { getDateBoundsForDayName, MS_PER_DAY_MS, WEEK_DAYS } from '../utils/date';
import { devError, devLog } from '../utils/logger';

export type CopyLastWeekResult = {
  daysCopied: number;
  daysSkipped: number;
  sessionsCopied: number;
};

export function shiftIsoBoundsDays(
  bounds: { startIso: string; endIsoExclusive: string },
  days: number,
): { startIso: string; endIsoExclusive: string } {
  const shiftMs = days * MS_PER_DAY_MS;
  return {
    startIso: new Date(new Date(bounds.startIso).getTime() + shiftMs).toISOString(),
    endIsoExclusive: new Date(new Date(bounds.endIsoExclusive).getTime() + shiftMs).toISOString(),
  };
}

function isCopyableSession(status: string | undefined): boolean {
  return status !== 'abandoned';
}

export async function copyLastWeek(
  userId: string,
  templateId?: string,
): Promise<CopyLastWeekResult> {
  const result: CopyLastWeekResult = {
    daysCopied: 0,
    daysSkipped: 0,
    sessionsCopied: 0,
  };

  if (__DEV__) {
    devLog('copy-last-week', { action: 'start', userId, templateId: templateId ?? null });
  }

  for (const dayName of WEEK_DAYS) {
    const currentBounds = getDateBoundsForDayName(dayName);
    const lastWeekBounds = shiftIsoBoundsDays(currentBounds, -7);

    const currentSessions = (await getSessionsForToday(
      userId,
      currentBounds.startIso,
      currentBounds.endIsoExclusive,
    )).filter((session) => isCopyableSession(session.status));

    if (currentSessions.length > 0) {
      result.daysSkipped += 1;
      if (__DEV__) {
        devLog('copy-last-week', {
          action: 'skip_day_has_sessions',
          dayName,
          currentCount: currentSessions.length,
          currentStart: currentBounds.startIso,
          lastWeekStart: lastWeekBounds.startIso,
        });
      }
      continue;
    }

    const lastWeekSessions = (await getSessionsForToday(
      userId,
      lastWeekBounds.startIso,
      lastWeekBounds.endIsoExclusive,
    )).filter((session) => isCopyableSession(session.status));

    if (lastWeekSessions.length === 0) {
      if (__DEV__) {
        devLog('copy-last-week', {
          action: 'skip_day_no_source',
          dayName,
          lastWeekStart: lastWeekBounds.startIso,
        });
      }
      continue;
    }

    let copiedThisDay = 0;
    for (let index = 0; index < lastWeekSessions.length; index += 1) {
      const source = lastWeekSessions[index];
      const startedAt = new Date(
        new Date(currentBounds.startIso).getTime() + index * 1000,
      ).toISOString();

      const created = await createCopiedWorkoutSession(
        userId,
        source.template_id ?? templateId,
        dayName,
        startedAt,
      );
      if (!created) {
        if (__DEV__) {
          devError('copy-last-week', new Error('createCopiedWorkoutSession failed'), {
            dayName,
            sourceSessionId: source.id,
          });
        }
        continue;
      }

      const copied = await copyPrescribedSessionContent(source.id, created.id);
      if (!copied) {
        if (__DEV__) {
          devLog('copy-last-week', {
            action: 'source_had_no_prescribed_sets',
            dayName,
            sourceSessionId: source.id,
            destSessionId: created.id,
          });
        }
      }
      copiedThisDay += 1;
      result.sessionsCopied += 1;
    }

    if (copiedThisDay > 0) {
      result.daysCopied += 1;
    }

    if (__DEV__) {
      devLog('copy-last-week', {
        action: 'day_done',
        dayName,
        copiedThisDay,
        lastWeekCount: lastWeekSessions.length,
      });
    }
  }

  if (__DEV__) {
    devLog('copy-last-week', { action: 'done', ...result });
  }

  return result;
}
