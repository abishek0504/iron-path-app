/**
 * Single source of truth for “sessions for a plan day”:
 * fetch by local day bounds, auto-materialize from template slots when empty.
 * Used by Plan and Workout tabs so both show the same session data.
 */

import { invalidateSessionsInRangeForUser } from '../cache/sessionsCache';
import {
  getSessionsForToday,
  materializeWorkoutFromTemplateSlots,
  type WorkoutSession,
} from '../supabase/queries/workouts';
import type { TemplateSlot } from '../supabase/queries/templates';
import {
  getDateBoundsForDayName,
  getLocalDayBoundsIso,
  WEEK_DAYS,
} from '../utils/date';
import { devLog } from '../utils/logger';

/** Module-level guard so Plan + Workout do not double-materialize the same day. */
const materializeInFlight = new Set<string>();

export function getTodayDayName(now: Date = new Date()): string {
  return WEEK_DAYS[now.getDay()];
}

export function planDayNamesMatch(a: string, b: string): boolean {
  return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

export function findPlanDay<T extends { day: { day_name?: string } }>(
  days: T[],
  dayName: string,
): T | undefined {
  return days.find((d) => planDayNamesMatch(d.day.day_name ?? '', dayName));
}

export function resolvePlanDayBounds(
  dayName: string,
  now: Date = new Date(),
): { startIso: string; endIsoExclusive: string } {
  if (planDayNamesMatch(dayName, getTodayDayName(now))) {
    return getLocalDayBoundsIso(now);
  }
  return getDateBoundsForDayName(dayName);
}

export type EnsureSessionsForPlanDayInput = {
  userId: string;
  dayName: string;
  templateId?: string;
  slots?: TemplateSlot[];
  skipMaterialize?: boolean;
  experience?: string;
  /** Injected clock for tests; defaults to now. */
  now?: Date;
};

export type EnsureSessionsForPlanDayResult = {
  sessions: WorkoutSession[];
  startIso: string;
  endIsoExclusive: string;
  materialized: boolean;
};

export async function ensureSessionsForPlanDay(
  input: EnsureSessionsForPlanDayInput,
): Promise<EnsureSessionsForPlanDayResult> {
  const {
    userId,
    dayName,
    templateId,
    slots = [],
    skipMaterialize = false,
    experience = 'beginner',
    now = new Date(),
  } = input;

  const { startIso, endIsoExclusive } = resolvePlanDayBounds(dayName, now);
  let sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
  let materialized = false;

  const canMaterialize =
    sessions.length === 0 &&
    !skipMaterialize &&
    !!templateId &&
    slots.length > 0;

  if (canMaterialize && templateId) {
    const materializeKey = `${userId}:${dayName}:${startIso}`;
    if (!materializeInFlight.has(materializeKey)) {
      materializeInFlight.add(materializeKey);
      try {
        const isToday = planDayNamesMatch(dayName, getTodayDayName(now));
        const startedAt = isToday ? undefined : startIso;
        await materializeWorkoutFromTemplateSlots({
          userId,
          templateId,
          dayName,
          slots,
          startedAt,
          experience,
          origin: 'auto',
        });
        materialized = true;
        invalidateSessionsInRangeForUser(userId);
        sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
      } finally {
        materializeInFlight.delete(materializeKey);
      }
    } else {
      // Another caller is materializing; re-fetch once they may have finished.
      sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
    }
  }

  if (__DEV__) {
    devLog('ensureSessionsForPlanDay', {
      action: 'ensure',
      dayName,
      startIso,
      endIsoExclusive,
      startLocal: new Date(startIso).toString(),
      endLocalExclusive: new Date(endIsoExclusive).toString(),
      slotCount: slots.length,
      sessionCount: sessions.length,
      materialized,
      skipMaterialize,
    });
  }

  return { sessions, startIso, endIsoExclusive, materialized };
}

/** Test-only: clear in-flight keys between vitest cases. */
export function __resetMaterializeInFlightForTests(): void {
  materializeInFlight.clear();
}
