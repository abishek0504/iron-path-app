import { describe, expect, it } from 'vitest';
import {
  buildCoachWeekDays,
  buildCoachWeekSplit,
  orderWorkoutDays,
  protectedCoachDayNames,
  sessionCoachDayNames,
  shouldAutoPlanCoachWeek,
  shouldReplaceCoachLeftovers,
  shouldSkipMaterializeForCoach,
  type CoachWeekDayInput,
} from './coachWeek';

function wednesday(): Date {
  return new Date(2026, 8, 9, 12, 0, 0); // Wednesday Sep 9, 2026 local
}

function thursday(): Date {
  return new Date(2026, 8, 10, 12, 0, 0); // Thursday Sep 10, 2026 local
}

function days(
  names: string[],
  protectedDays: string[] = [],
  sessionDays: string[] = protectedDays,
  slottedDays: string[] = sessionDays,
): CoachWeekDayInput[] {
  return names.map((dayName, dayIndex) => ({
    dayId: `id-${dayName}`,
    dayName,
    dayIndex,
    hasProtectedSession: protectedDays.includes(dayName),
    hasSession: sessionDays.includes(dayName),
    hasSlots: slottedDays.includes(dayName),
  }));
}

const WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

describe('orderWorkoutDays', () => {
  it('sorts Sun–Sat and drops unknown names', () => {
    expect(orderWorkoutDays(['Friday', 'Monday', 'Funday', 'Monday'])).toEqual([
      'Monday',
      'Friday',
    ]);
  });
});

describe('buildCoachWeekDays', () => {
  it('skips rest days and keeps past selected weekdays', () => {
    const result = buildCoachWeekDays({
      now: thursday(),
      mode: 'auto',
      replaceLeftovers: true,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      templateDays: days(WEEK),
    });

    expect(result.map((d) => d.dayName)).toEqual(['Monday', 'Wednesday', 'Friday']);
    expect(result[0]?.dayFocus).toBe('Push');
    expect(result[1]?.dayFocus).toBe('Pull');
    expect(result[2]?.dayFocus).toBe('Legs');
    expect(result[0]?.trainingDayIndex).toBe(0);
    expect(result[1]?.trainingDayIndex).toBe(1);
    expect(result[2]?.trainingDayIndex).toBe(2);
  });

  it('honors a Friday Push pin without re-indexing earlier days', () => {
    const result = buildCoachWeekDays({
      now: thursday(),
      mode: 'auto',
      replaceLeftovers: true,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      dayFocusMap: { Friday: 'Push' },
      templateDays: days(WEEK),
    });

    expect(result.find((d) => d.dayName === 'Friday')?.dayFocus).toBe('Push');
    expect(result.find((d) => d.dayName === 'Monday')?.dayFocus).toBe('Push');
    expect(result.find((d) => d.dayName === 'Wednesday')?.dayFocus).toBe('Pull');
  });

  it('auto replaces leftover unstarted sessions so the coach can progress the week', () => {
    const result = buildCoachWeekDays({
      now: wednesday(),
      mode: 'auto',
      replaceLeftovers: true,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      templateDays: days(WEEK, [], ['Wednesday', 'Friday']),
    });

    expect(result.map((d) => d.dayName)).toEqual(['Monday', 'Wednesday', 'Friday']);
  });

  it('skips remaining days that already have completed or performed work', () => {
    const result = buildCoachWeekDays({
      now: thursday(),
      mode: 'auto',
      replaceLeftovers: true,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      templateDays: days(WEEK, ['Wednesday'], ['Wednesday', 'Friday']),
    });

    expect(result.map((d) => d.dayName)).toEqual(['Monday', 'Friday']);
  });

  it('after the week is planned, only fills selected days that are still empty', () => {
    const result = buildCoachWeekDays({
      now: thursday(),
      mode: 'auto',
      replaceLeftovers: false,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      templateDays: days(WEEK, [], ['Wednesday'], ['Wednesday']),
    });

    expect(result.map((d) => d.dayName)).toEqual(['Monday', 'Friday']);
  });

  it('heals a selected day that has leftover sessions but no slots', () => {
    const result = buildCoachWeekDays({
      now: thursday(),
      mode: 'auto',
      replaceLeftovers: false,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      templateDays: days(WEEK, [], ['Wednesday'], []),
    });

    expect(result.map((d) => d.dayName)).toEqual(['Monday', 'Wednesday', 'Friday']);
  });

  it('regenerate also leaves protected days alone', () => {
    const result = buildCoachWeekDays({
      now: thursday(),
      mode: 'regenerate',
      replaceLeftovers: true,
      workoutDays: ['Monday', 'Wednesday', 'Friday'],
      splitValue: 'push_pull_legs',
      templateDays: days(WEEK, ['Wednesday']),
    });

    expect(result.map((d) => d.dayName)).toEqual(['Monday', 'Friday']);
  });

  it('leaves focus null when the split is not_sure', () => {
    const result = buildCoachWeekDays({
      now: wednesday(),
      mode: 'regenerate',
      replaceLeftovers: true,
      workoutDays: ['Friday'],
      splitValue: 'not_sure',
      templateDays: days(WEEK),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.dayFocus).toBeNull();
  });
});

describe('buildCoachWeekSplit', () => {
  it('includes the full selected week and a Friday Push pin', () => {
    const split = buildCoachWeekSplit(
      ['Monday', 'Wednesday', 'Friday'],
      'push_pull_legs',
      { Friday: 'Push' },
    );
    expect(split.map((day) => [day.dayName, day.dayFocus, day.trainingDayIndex])).toEqual([
      ['Monday', 'Push', 0],
      ['Wednesday', 'Pull', 1],
      ['Friday', 'Push', 2],
    ]);
    expect(split[2]?.trainingDayPosition).toBe('training day 3 of 3 this week');
  });
});

describe('protectedCoachDayNames', () => {
  it('protects completed days and days with performed sets', () => {
    const names = protectedCoachDayNames(
      [
        { id: 's1', day_name: 'Wednesday', status: 'completed' },
        { id: 's2', day_name: 'Friday', status: 'active' },
        { id: 's3', day_name: 'Saturday', status: 'active' },
      ],
      new Set(['s2']),
    );
    expect([...names].sort()).toEqual(['Friday', 'Wednesday']);
  });
});

describe('sessionCoachDayNames', () => {
  it('collects weekdays that already have a session', () => {
    expect(
      [...sessionCoachDayNames([
        { day_name: 'Friday' },
        { day_name: 'Friday' },
        { day_name: null },
      ])],
    ).toEqual(['Friday']);
  });
});

describe('shouldReplaceCoachLeftovers', () => {
  it('replaces leftovers on regenerate or before the week is planned', () => {
    expect(
      shouldReplaceCoachLeftovers({
        mode: 'auto',
        plannedWeekStart: null,
        weekSundayKey: '2026-09-06',
      }),
    ).toBe(true);
    expect(
      shouldReplaceCoachLeftovers({
        mode: 'auto',
        plannedWeekStart: '2026-09-06',
        weekSundayKey: '2026-09-06',
      }),
    ).toBe(false);
    expect(
      shouldReplaceCoachLeftovers({
        mode: 'regenerate',
        plannedWeekStart: '2026-09-06',
        weekSundayKey: '2026-09-06',
      }),
    ).toBe(true);
  });
});

describe('shouldSkipMaterializeForCoach', () => {
  it('blocks stale rematerialize until the coach has planned this week', () => {
    expect(
      shouldSkipMaterializeForCoach({
        coachEnabled: true,
        plannedWeekStart: null,
        weekSundayKey: '2026-09-06',
      }),
    ).toBe(true);
    expect(
      shouldSkipMaterializeForCoach({
        coachEnabled: true,
        plannedWeekStart: '2026-09-06',
        weekSundayKey: '2026-09-06',
      }),
    ).toBe(false);
    expect(
      shouldSkipMaterializeForCoach({
        coachEnabled: false,
        plannedWeekStart: null,
        weekSundayKey: '2026-09-06',
      }),
    ).toBe(false);
  });
});

describe('shouldAutoPlanCoachWeek', () => {
  it('runs when coach is on and remaining days need a plan', () => {
    expect(
      shouldAutoPlanCoachWeek({
        coachEnabled: true,
        daysToGenerate: 2,
      }),
    ).toBe(true);

    expect(
      shouldAutoPlanCoachWeek({
        coachEnabled: true,
        daysToGenerate: 0,
      }),
    ).toBe(false);

    expect(
      shouldAutoPlanCoachWeek({
        coachEnabled: false,
        daysToGenerate: 2,
      }),
    ).toBe(false);
  });
});
