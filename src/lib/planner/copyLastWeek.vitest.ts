import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase/queries/workouts', () => ({
  copyPrescribedSessionContent: vi.fn(),
  createCopiedWorkoutSession: vi.fn(),
  getSessionsForToday: vi.fn(),
}));

import { shiftIsoBoundsDays } from './copyLastWeek';
import { MS_PER_DAY_MS } from '../utils/date';

describe('shiftIsoBoundsDays', () => {
  it('subtracts seven days from both bounds', () => {
    const current = {
      startIso: '2026-09-07T07:00:00.000Z',
      endIsoExclusive: '2026-09-08T07:00:00.000Z',
    };
    const lastWeek = shiftIsoBoundsDays(current, -7);
    expect(new Date(lastWeek.startIso).getTime()).toBe(
      new Date(current.startIso).getTime() - 7 * MS_PER_DAY_MS,
    );
    expect(new Date(lastWeek.endIsoExclusive).getTime()).toBe(
      new Date(current.endIsoExclusive).getTime() - 7 * MS_PER_DAY_MS,
    );
  });
});
