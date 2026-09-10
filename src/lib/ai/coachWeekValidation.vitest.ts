import { describe, expect, it } from 'vitest';
import { finalizeCoachWeekPlan } from './coachWeekValidation';

const hipThrust = {
  id: 'hip',
  name: 'Hip Thrust',
  movement_pattern: 'hinge',
  primary_muscles: ['glutes'],
};

const bench = {
  id: 'bench',
  name: 'Bench Press (Barbell)',
  movement_pattern: 'push',
  primary_muscles: ['chest'],
};

const ohp = {
  id: 'ohp',
  name: 'Overhead Press',
  movement_pattern: 'push',
  primary_muscles: ['anterior deltoids'],
};

describe('finalizeCoachWeekPlan', () => {
  it('drops a wrong-focus lift and keeps a valid Push day', () => {
    const result = finalizeCoachWeekPlan([
      {
        dayName: 'Wednesday',
        dayFocus: 'Push',
        exercises: [hipThrust, bench, ohp],
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.days[0]?.exercises.map((ex) => ex.id)).toEqual(['bench', 'ohp']);
    }
  });

  it('rejects a day that is only off-focus after sanitizing', () => {
    const result = finalizeCoachWeekPlan([
      {
        dayName: 'Wednesday',
        dayFocus: 'Push',
        exercises: [hipThrust],
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('too_few_exercises');
    }
  });
});
