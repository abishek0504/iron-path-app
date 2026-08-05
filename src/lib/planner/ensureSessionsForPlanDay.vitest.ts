import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateSlot } from '../supabase/queries/templates';
import type { WorkoutSession } from '../supabase/queries/workouts';

vi.mock('../cache/sessionsCache', () => ({
  invalidateSessionsInRangeForUser: vi.fn(),
}));

vi.mock('../supabase/queries/workouts', () => ({
  getSessionsForToday: vi.fn(),
  materializeWorkoutFromTemplateSlots: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  devLog: vi.fn(),
  devError: vi.fn(),
}));

import { invalidateSessionsInRangeForUser } from '../cache/sessionsCache';
import {
  getSessionsForToday,
  materializeWorkoutFromTemplateSlots,
} from '../supabase/queries/workouts';
import {
  __resetMaterializeInFlightForTests,
  ensureSessionsForPlanDay,
  findPlanDay,
  planDayNamesMatch,
} from './ensureSessionsForPlanDay';

const getSessionsMock = vi.mocked(getSessionsForToday);
const materializeMock = vi.mocked(materializeWorkoutFromTemplateSlots);
const invalidateMock = vi.mocked(invalidateSessionsInRangeForUser);

function session(partial: Partial<WorkoutSession> & { id: string }): WorkoutSession {
  return {
    user_id: 'user-1',
    template_id: 'tmpl-1',
    day_name: 'Monday',
    status: 'active',
    started_at: '2026-08-03T12:00:00.000Z',
    completed_at: null,
    ...partial,
  } as WorkoutSession;
}

const slot = {
  id: 'slot-1',
  day_id: 'day-1',
  exercise_id: 'ex-1',
  custom_exercise_id: null,
  experience: null,
  notes: null,
  sort_order: 0,
  created_at: '',
  updated_at: '',
} as TemplateSlot;

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  vi.clearAllMocks();
  __resetMaterializeInFlightForTests();
});

describe('planDayNamesMatch / findPlanDay', () => {
  it('matches day names case-insensitively', () => {
    expect(planDayNamesMatch('Monday', 'monday')).toBe(true);
    expect(planDayNamesMatch('Monday', 'Tuesday')).toBe(false);
  });

  it('finds a plan day ignoring case', () => {
    const days = [
      { day: { day_name: 'monday' }, slots: [slot] },
      { day: { day_name: 'Tuesday' }, slots: [] },
    ];
    expect(findPlanDay(days, 'Monday')?.day.day_name).toBe('monday');
    expect(findPlanDay(days, 'WEDNESDAY')).toBeUndefined();
  });
});

describe('ensureSessionsForPlanDay', () => {
  // Fixed Monday local-ish: use a Date whose getDay() is Monday (1).
  const monday = new Date('2026-08-03T15:00:00.000Z');

  it('materializes when empty and slots exist', async () => {
    const created = session({ id: 's1', day_name: 'Monday' });
    getSessionsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([created]);
    materializeMock.mockResolvedValueOnce(created);

    const result = await ensureSessionsForPlanDay({
      userId: 'user-1',
      dayName: 'Monday',
      templateId: 'tmpl-1',
      slots: [slot],
      now: monday,
    });

    expect(materializeMock).toHaveBeenCalledTimes(1);
    expect(materializeMock.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      templateId: 'tmpl-1',
      dayName: 'Monday',
      origin: 'auto',
    });
    expect(invalidateMock).toHaveBeenCalledWith('user-1');
    expect(result.sessions).toEqual([created]);
    expect(result.materialized).toBe(true);
  });

  it('does not materialize when sessions already exist', async () => {
    const existing = session({ id: 's1' });
    getSessionsMock.mockResolvedValueOnce([existing]);

    const result = await ensureSessionsForPlanDay({
      userId: 'user-1',
      dayName: 'Monday',
      templateId: 'tmpl-1',
      slots: [slot],
      now: monday,
    });

    expect(materializeMock).not.toHaveBeenCalled();
    expect(result.sessions).toEqual([existing]);
    expect(result.materialized).toBe(false);
  });

  it('skips materialize when skipMaterialize is true', async () => {
    getSessionsMock.mockResolvedValueOnce([]);

    const result = await ensureSessionsForPlanDay({
      userId: 'user-1',
      dayName: 'Monday',
      templateId: 'tmpl-1',
      slots: [slot],
      skipMaterialize: true,
      now: monday,
    });

    expect(materializeMock).not.toHaveBeenCalled();
    expect(result.sessions).toEqual([]);
    expect(result.materialized).toBe(false);
  });

  it('does not materialize when slots are empty', async () => {
    getSessionsMock.mockResolvedValueOnce([]);

    const result = await ensureSessionsForPlanDay({
      userId: 'user-1',
      dayName: 'Monday',
      templateId: 'tmpl-1',
      slots: [],
      now: monday,
    });

    expect(materializeMock).not.toHaveBeenCalled();
    expect(result.sessions).toEqual([]);
  });
});
