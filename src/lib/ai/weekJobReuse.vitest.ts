import { describe, expect, it } from 'vitest';
import { shouldReuseWeekJobSessions, weekSessionsMatchExerciseCount } from './weekJobReuse';

const fourExerciseWeek = [
  {
    sessions: [
      [{ exercise_id: 'a' }, { exercise_id: 'b' }, { exercise_id: 'c' }, { exercise_id: 'd' }],
    ],
  },
];

const sixExerciseWeek = [
  {
    sessions: [[
      { exercise_id: 'a' },
      { exercise_id: 'b' },
      { exercise_id: 'c' },
      { exercise_id: 'd' },
      { exercise_id: 'e' },
      { exercise_id: 'f' },
    ]],
  },
];

describe('weekSessionsMatchExerciseCount', () => {
  it('rejects a cached 4-exercise week when 6 were requested', () => {
    expect(weekSessionsMatchExerciseCount(fourExerciseWeek, 6)).toBe(false);
    expect(weekSessionsMatchExerciseCount(sixExerciseWeek, 6)).toBe(true);
  });
});

describe('shouldReuseWeekJobSessions', () => {
  it('reuses only generated sessions that already match the requested count', () => {
    expect(
      shouldReuseWeekJobSessions({
        status: 'generated',
        sessions: fourExerciseWeek,
        exercisesPerSession: 6,
      }),
    ).toBe(false);
    expect(
      shouldReuseWeekJobSessions({
        status: 'generated',
        sessions: sixExerciseWeek,
        exercisesPerSession: 6,
      }),
    ).toBe(true);
    expect(
      shouldReuseWeekJobSessions({
        status: 'pending',
        sessions: sixExerciseWeek,
        exercisesPerSession: 6,
      }),
    ).toBe(false);
  });
});
