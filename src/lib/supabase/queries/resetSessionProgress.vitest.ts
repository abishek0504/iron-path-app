import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryOp = 'select' | 'insert' | 'update' | 'delete';

type RecordedQuery = {
  table: string;
  op: QueryOp | null;
  payload: unknown;
  filters: { type: string; column: string; value: unknown }[];
};

const recordedQueries: RecordedQuery[] = [];
const queryResults = new Map<string, { data: unknown; error: unknown }>();

function resultKey(table: string, op: QueryOp | null): string {
  return `${table}:${op ?? 'select'}`;
}

function setQueryResult(
  table: string,
  op: QueryOp,
  result: { data?: unknown; error?: unknown }
): void {
  queryResults.set(resultKey(table, op), {
    data: result.data ?? null,
    error: result.error ?? null,
  });
}

function findQueries(table: string, op: QueryOp): RecordedQuery[] {
  return recordedQueries.filter((q) => q.table === table && q.op === op);
}

/** Minimal chainable stand-in for the supabase query builder used by the helper. */
function createQueryBuilder(table: string) {
  const entry: RecordedQuery = { table, op: null, payload: null, filters: [] };
  let recorded = false;

  const setOp = (op: QueryOp, payload?: unknown) => {
    if (entry.op === null) {
      entry.op = op;
      entry.payload = payload ?? null;
    }
    return chain;
  };

  const addFilter = (type: string, column: string, value: unknown) => {
    entry.filters.push({ type, column, value });
    return chain;
  };

  const finish = () => {
    if (!recorded) {
      recorded = true;
      recordedQueries.push(entry);
    }
    return queryResults.get(resultKey(table, entry.op)) ?? { data: null, error: null };
  };

  const chain = {
    select: (columns?: string) => setOp('select', columns),
    insert: (rows: unknown) => setOp('insert', rows),
    update: (patch: unknown) => setOp('update', patch),
    delete: () => setOp('delete'),
    eq: (column: string, value: unknown) => addFilter('eq', column, value),
    in: (column: string, value: unknown) => addFilter('in', column, value),
    gte: (column: string, value: unknown) => addFilter('gte', column, value),
    lt: (column: string, value: unknown) => addFilter('lt', column, value),
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve(finish()),
    single: () => Promise.resolve(finish()),
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(finish()).then(onFulfilled, onRejected),
  } as Record<string, unknown> & {
    select: (columns?: string) => typeof chain;
  };

  return chain;
}

vi.mock('../client', () => ({
  supabase: {
    from: (table: string) => createQueryBuilder(table),
  },
}));

vi.mock('./workouts', () => ({
  createWorkoutSession: vi.fn(),
  prefillSessionSets: vi.fn().mockResolvedValue(true),
  getSessionWithSets: vi.fn(),
}));

vi.mock('../../engine/targetSelection', () => ({
  selectExerciseTargets: vi.fn(),
}));

vi.mock('./templates', () => ({
  getTemplateSlotsForDay: vi.fn(),
}));

vi.mock('./exercises', () => ({
  listMergedExercises: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  devLog: vi.fn(),
  devError: vi.fn(),
}));

import { selectExerciseTargets } from '../../engine/targetSelection';
import { prefillSessionSets } from './workouts';
import { resetSessionProgress } from './workouts_helpers';

const selectTargetsMock = vi.mocked(selectExerciseTargets);
const prefillMock = vi.mocked(prefillSessionSets);

const USER_ID = 'user-1';
const SESSION_ID = 'session-1';
const CONTEXT = { experience: 'beginner' };

function todayIso(hour = 9): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function target(overrides: Partial<{ sets: number; reps: number; weight: number }> = {}) {
  return {
    sets: 3,
    reps: 10,
    weight: 50,
    duration_sec: undefined,
    mode: 'reps',
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof selectExerciseTargets>>;
}

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  vi.clearAllMocks();
  recordedQueries.length = 0;
  queryResults.clear();
  prefillMock.mockResolvedValue(true);
});

describe('resetSessionProgress', () => {
  it('keeps today-only exercises and re-prefills their sets', async () => {
    setQueryResult('v2_workout_sessions', 'select', {
      data: { id: SESSION_ID, started_at: todayIso() },
    });
    setQueryResult('v2_session_exercises', 'select', {
      data: [
        { id: 'se-1', exercise_id: 'ex-1', custom_exercise_id: null },
        { id: 'se-2', exercise_id: null, custom_exercise_id: 'custom-1' },
      ],
    });
    setQueryResult('v2_session_sets', 'delete', { data: [{ id: 'set-1' }, { id: 'set-2' }] });
    selectTargetsMock.mockResolvedValue(target());

    const result = await resetSessionProgress(USER_ID, SESSION_ID, CONTEXT);

    expect(result.error).toBeNull();
    expect(result.exerciseCount).toBe(2);
    expect(result.deletedSetCount).toBe(2);
    expect(result.prefilledExerciseCount).toBe(2);

    // Session exercises are never deleted, so today-only extras survive the reset.
    expect(findQueries('v2_session_exercises', 'delete')).toHaveLength(0);
    expect(findQueries('v2_workout_sessions', 'delete')).toHaveLength(0);

    expect(findQueries('v2_session_sets', 'delete')).toHaveLength(1);
    expect(findQueries('v2_session_sets', 'delete')[0].filters).toContainEqual({
      type: 'in',
      column: 'session_exercise_id',
      value: ['se-1', 'se-2'],
    });

    expect(prefillMock).toHaveBeenCalledTimes(1);
    const [prefillSessionId, prefillExercises, targetsMap] = prefillMock.mock.calls[0];
    expect(prefillSessionId).toBe(SESSION_ID);
    expect(prefillExercises.map((e) => e.id)).toEqual(['se-1', 'se-2']);
    expect(Array.from(targetsMap.keys())).toEqual(['ex-1', 'custom-1']);
  });

  it('reactivates the session and clears completion and watch ownership', async () => {
    setQueryResult('v2_workout_sessions', 'select', {
      data: { id: SESSION_ID, started_at: todayIso() },
    });
    setQueryResult('v2_session_exercises', 'select', {
      data: [{ id: 'se-1', exercise_id: 'ex-1', custom_exercise_id: null }],
    });
    setQueryResult('v2_session_sets', 'delete', { data: [] });
    selectTargetsMock.mockResolvedValue(target());

    await resetSessionProgress(USER_ID, SESSION_ID, CONTEXT);

    const updates = findQueries('v2_workout_sessions', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({
      status: 'active',
      completed_at: null,
      control_device: 'phone',
    });
    expect((updates[0].payload as { started_at?: string }).started_at).toBeTruthy();
    expect(findQueries('v2_session_health_metrics', 'delete')).toHaveLength(1);
  });

  it('preserves started_at for a session from an earlier day', async () => {
    setQueryResult('v2_workout_sessions', 'select', {
      data: { id: SESSION_ID, started_at: '2020-01-02T10:00:00.000Z' },
    });
    setQueryResult('v2_session_exercises', 'select', { data: [] });
    selectTargetsMock.mockResolvedValue(target());

    await resetSessionProgress(USER_ID, SESSION_ID, CONTEXT);

    const updates = findQueries('v2_workout_sessions', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).not.toHaveProperty('started_at');
  });

  it('requests targets once per distinct exercise', async () => {
    setQueryResult('v2_workout_sessions', 'select', {
      data: { id: SESSION_ID, started_at: todayIso() },
    });
    setQueryResult('v2_session_exercises', 'select', {
      data: [
        { id: 'se-1', exercise_id: 'ex-1', custom_exercise_id: null },
        { id: 'se-2', exercise_id: 'ex-1', custom_exercise_id: null },
      ],
    });
    setQueryResult('v2_session_sets', 'delete', { data: [] });
    selectTargetsMock.mockResolvedValue(target());

    const result = await resetSessionProgress(USER_ID, SESSION_ID, CONTEXT);

    expect(selectTargetsMock).toHaveBeenCalledTimes(1);
    expect(result.prefilledExerciseCount).toBe(2);
  });

  it('aborts without touching the session row when set deletion fails', async () => {
    setQueryResult('v2_workout_sessions', 'select', {
      data: { id: SESSION_ID, started_at: todayIso() },
    });
    setQueryResult('v2_session_exercises', 'select', {
      data: [{ id: 'se-1', exercise_id: 'ex-1', custom_exercise_id: null }],
    });
    setQueryResult('v2_session_sets', 'delete', { error: new Error('delete failed') });

    const result = await resetSessionProgress(USER_ID, SESSION_ID, CONTEXT);

    expect(result.error).toBeInstanceOf(Error);
    expect(prefillMock).not.toHaveBeenCalled();
    expect(findQueries('v2_workout_sessions', 'update')).toHaveLength(0);
  });

  it('returns an error when the session does not belong to the user', async () => {
    setQueryResult('v2_workout_sessions', 'select', { data: null });

    const result = await resetSessionProgress(USER_ID, SESSION_ID, CONTEXT);

    expect(result.error).toBeInstanceOf(Error);
    expect(findQueries('v2_session_sets', 'delete')).toHaveLength(0);
    expect(findQueries('v2_workout_sessions', 'update')).toHaveLength(0);
  });
});
