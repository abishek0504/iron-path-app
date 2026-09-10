import { describe, expect, it } from 'vitest';
import {
  shouldClearWeeklyPlanOnWorkoutDelete,
  shouldSeedAddWorkoutFromTemplateSlots,
} from './planDayWorkout';

describe('shouldClearWeeklyPlanOnWorkoutDelete', () => {
  it('clears the weekly plan when the deleted session is the last on that day', () => {
    expect(shouldClearWeeklyPlanOnWorkoutDelete(0)).toBe(true);
  });

  it('keeps the weekly plan when other sessions remain', () => {
    expect(shouldClearWeeklyPlanOnWorkoutDelete(1)).toBe(false);
    expect(shouldClearWeeklyPlanOnWorkoutDelete(2)).toBe(false);
  });
});

describe('shouldSeedAddWorkoutFromTemplateSlots', () => {
  it('seeds from leftover slots when the day is empty and not suppressed', () => {
    expect(
      shouldSeedAddWorkoutFromTemplateSlots({
        sessionCount: 0,
        slotCount: 3,
        isMaterializeSuppressed: false,
      }),
    ).toBe(true);
  });

  it('does not seed when materialize is suppressed after a delete', () => {
    expect(
      shouldSeedAddWorkoutFromTemplateSlots({
        sessionCount: 0,
        slotCount: 3,
        isMaterializeSuppressed: true,
      }),
    ).toBe(false);
  });

  it('does not seed when a session already exists', () => {
    expect(
      shouldSeedAddWorkoutFromTemplateSlots({
        sessionCount: 1,
        slotCount: 3,
        isMaterializeSuppressed: false,
      }),
    ).toBe(false);
  });

  it('does not seed on a rest day with no slots', () => {
    expect(
      shouldSeedAddWorkoutFromTemplateSlots({
        sessionCount: 0,
        slotCount: 0,
        isMaterializeSuppressed: false,
      }),
    ).toBe(false);
  });
});
