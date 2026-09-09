/**
 * Parse Strong / Hevy workout CSVs and import them as completed sessions.
 */

import { createUserCustomExercise } from '../supabase/queries/customExerciseMutations';
import { listMergedExercises, type MergedExercise } from '../supabase/queries/exercises';
import { createWorkoutSession } from '../supabase/queries/workouts';
import { supabase } from '../supabase/client';
import { convertLiftWeight } from '../utils/units';
import { WEEK_DAYS } from '../utils/date';
import { resolveUseImperial } from '../units/resolveImperial';
import { devError, devLog } from '../utils/logger';

export type CsvFormat = 'strong' | 'hevy' | 'unknown';

export type ParsedCsvSet = {
  date: Date;
  workoutName: string;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  weightIsImperial: boolean | null;
  reps: number | null;
  durationSec: number | null;
  setType: 'normal' | 'warmup' | 'drop' | 'failure';
};

export type ParsedCsvWorkout = {
  startedAt: Date;
  workoutName: string;
  dayName: (typeof WEEK_DAYS)[number];
  exercises: {
    name: string;
    sets: ParsedCsvSet[];
  }[];
};

export type ImportCsvResult = {
  format: CsvFormat;
  rowCount: number;
  sessionCount: number;
  setCount: number;
  unmatchedExercises: number;
};

const MAX_IMPORT_ROWS = 10000;
const MAX_IMPORT_SESSIONS = 500;
const MAX_REPS = 50;
const MIN_DURATION_SEC = 5;
const MAX_DURATION_SEC = 3600;

function parseCsvRows(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') {
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, ' ');
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function detectFormat(headers: string[]): CsvFormat {
  const hasHevy =
    headerIndex(headers, 'exercise title', 'exercise_title') >= 0 ||
    headerIndex(headers, 'weight kg', 'weight_kg') >= 0 ||
    headerIndex(headers, 'start time', 'start_time') >= 0;
  const hasStrong =
    headerIndex(headers, 'exercise name') >= 0 ||
    headerIndex(headers, 'set order') >= 0;
  if (hasHevy && !hasStrong) return 'hevy';
  if (hasStrong) return 'strong';
  if (hasHevy) return 'hevy';
  return 'unknown';
}

function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.trim().replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function mapSetType(raw: string | undefined): ParsedCsvSet['setType'] {
  const value = (raw ?? '').trim().toLowerCase();
  if (value.includes('warm')) return 'warmup';
  if (value.includes('drop')) return 'drop';
  if (value.includes('fail') || value === 'amrap') return 'failure';
  return 'normal';
}

function dayNameFor(date: Date): (typeof WEEK_DAYS)[number] {
  return WEEK_DAYS[date.getDay()];
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? '') : '';
}

export function parseStrongHevyCsv(text: string): {
  format: CsvFormat;
  workouts: ParsedCsvWorkout[];
  rowCount: number;
} {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return { format: 'unknown', workouts: [], rowCount: 0 };
  }

  const headers = rows[0];
  const format = detectFormat(headers);
  const body = rows.slice(1, MAX_IMPORT_ROWS + 1);

  const dateIdx =
    format === 'hevy'
      ? headerIndex(headers, 'start time', 'start_time')
      : headerIndex(headers, 'date');
  const workoutIdx =
    format === 'hevy'
      ? headerIndex(headers, 'title', 'workout name')
      : headerIndex(headers, 'workout name');
  const exerciseIdx =
    format === 'hevy'
      ? headerIndex(headers, 'exercise title', 'exercise_title')
      : headerIndex(headers, 'exercise name');
  const setIdx =
    format === 'hevy'
      ? headerIndex(headers, 'set index', 'set_index')
      : headerIndex(headers, 'set order');
  const weightIdx =
    format === 'hevy'
      ? headerIndex(headers, 'weight kg', 'weight_kg')
      : headerIndex(headers, 'weight');
  const unitIdx = headerIndex(headers, 'weight unit', 'weight_unit');
  const repsIdx = headerIndex(headers, 'reps');
  const durationIdx =
    format === 'hevy'
      ? headerIndex(headers, 'duration seconds', 'duration_seconds', 'seconds')
      : headerIndex(headers, 'seconds', 'duration');
  const typeIdx = headerIndex(headers, 'set type', 'set_type');

  const sets: ParsedCsvSet[] = [];
  for (const row of body) {
    const date = parseDate(cell(row, dateIdx));
    const exerciseName = cell(row, exerciseIdx).trim();
    if (!date || !exerciseName) continue;

    const repsRaw = parseNumber(cell(row, repsIdx));
    const durationRaw = parseNumber(cell(row, durationIdx));
    const reps =
      repsRaw != null && repsRaw >= 1 ? Math.min(MAX_REPS, Math.round(repsRaw)) : null;
    const durationSec =
      durationRaw != null && durationRaw >= MIN_DURATION_SEC
        ? Math.min(MAX_DURATION_SEC, Math.round(durationRaw))
        : null;
    if (reps == null && durationSec == null) continue;

    const setNumberRaw = parseNumber(cell(row, setIdx));
    const weight = parseNumber(cell(row, weightIdx));
    const unit = cell(row, unitIdx).trim().toLowerCase();
    let weightIsImperial: boolean | null = null;
    if (format === 'hevy') {
      weightIsImperial = false;
    } else if (unit === 'kg') {
      weightIsImperial = false;
    } else if (unit === 'lbs' || unit === 'lb') {
      weightIsImperial = true;
    }

    sets.push({
      date,
      workoutName: cell(row, workoutIdx).trim() || 'Imported workout',
      exerciseName,
      setNumber: setNumberRaw != null && setNumberRaw > 0 ? Math.round(setNumberRaw) : sets.length + 1,
      weight: weight != null && weight >= 0 ? weight : null,
      weightIsImperial,
      reps,
      durationSec: reps != null ? null : durationSec,
      setType: mapSetType(cell(row, typeIdx)),
    });
  }

  const grouped = new Map<string, ParsedCsvSet[]>();
  for (const set of sets) {
    const key = `${set.date.toISOString().slice(0, 16)}::${set.workoutName}`;
    const list = grouped.get(key) ?? [];
    list.push(set);
    grouped.set(key, list);
  }

  const workouts: ParsedCsvWorkout[] = [];
  for (const group of grouped.values()) {
    const first = group[0];
    const exercises: ParsedCsvWorkout['exercises'] = [];
    const byExercise = new Map<string, ParsedCsvSet[]>();
    for (const set of group) {
      const list = byExercise.get(set.exerciseName) ?? [];
      list.push(set);
      byExercise.set(set.exerciseName, list);
    }
    for (const [name, exerciseSets] of byExercise) {
      exercises.push({ name, sets: exerciseSets });
    }
    workouts.push({
      startedAt: first.date,
      workoutName: first.workoutName,
      dayName: dayNameFor(first.date),
      exercises,
    });
    if (workouts.length >= MAX_IMPORT_SESSIONS) break;
  }

  if (__DEV__) {
    devLog('csv-import', {
      action: 'parsed',
      format,
      rowCount: body.length,
      setCount: sets.length,
      workoutCount: workouts.length,
    });
  }

  return { format, workouts, rowCount: body.length };
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchExercise(
  name: string,
  catalog: MergedExercise[],
): MergedExercise | null {
  const needle = normalizeExerciseName(name);
  const exact = catalog.filter((item) => normalizeExerciseName(item.name) === needle);
  if (exact.length === 0) return null;
  return exact.find((item) => item.source === 'master') ?? exact[0];
}

async function ensureCustomExercise(
  userId: string,
  name: string,
  setCount: number,
  cache: Map<string, string>,
): Promise<string | null> {
  const key = normalizeExerciseName(name);
  const cached = cache.get(key);
  if (cached) return cached;

  const created = await createUserCustomExercise(userId, {
    name,
    density_score: 5,
    primary_muscles: [],
    implicit_hits: {},
    is_unilateral: false,
    setup_buffer_sec: 30,
    avg_time_per_set_sec: 60,
    is_timed: false,
    mode: 'reps',
    sets_min: Math.max(1, setCount),
    sets_max: Math.max(1, setCount),
    reps_min: 1,
    reps_max: 15,
  });
  if (!created) return null;
  cache.set(key, created.id);
  return created.id;
}

export async function importStrongHevyCsv(
  userId: string,
  csvText: string,
  useImperial?: boolean | null,
): Promise<ImportCsvResult> {
  const parsed = parseStrongHevyCsv(csvText);
  const storeImperial = resolveUseImperial(useImperial);
  const result: ImportCsvResult = {
    format: parsed.format,
    rowCount: parsed.rowCount,
    sessionCount: 0,
    setCount: 0,
    unmatchedExercises: 0,
  };

  if (parsed.format === 'unknown' || parsed.workouts.length === 0) {
    if (__DEV__) {
      devLog('csv-import', { action: 'empty_or_unknown', format: parsed.format, rowCount: parsed.rowCount });
    }
    return result;
  }

  const catalog = await listMergedExercises(userId);
  const customCache = new Map<string, string>();

  if (__DEV__) {
    devLog('csv-import', {
      action: 'import_start',
      userId,
      format: parsed.format,
      workoutCount: parsed.workouts.length,
      catalogCount: catalog.length,
      storeImperial,
    });
  }

  for (const workout of parsed.workouts) {
    const startedAt = workout.startedAt.toISOString();
    const session = await createWorkoutSession(
      userId,
      undefined,
      workout.dayName,
      startedAt,
      'manual',
    );
    if (!session) {
      if (__DEV__) {
        devError('csv-import', new Error('createWorkoutSession failed'), {
          workoutName: workout.workoutName,
          startedAt,
        });
      }
      continue;
    }

    let sortOrder = 1;
    let insertedSets = 0;
    for (const exercise of workout.exercises) {
      const matched = matchExercise(exercise.name, catalog);
      let exerciseId: string | null = null;
      let customExerciseId: string | null = null;
      if (matched) {
        if (matched.source === 'custom') {
          customExerciseId = matched.id;
        } else {
          exerciseId = matched.id;
        }
      } else {
        customExerciseId = await ensureCustomExercise(
          userId,
          exercise.name,
          exercise.sets.length,
          customCache,
        );
        if (customExerciseId) {
          result.unmatchedExercises += 1;
        }
      }

      if (!exerciseId && !customExerciseId) {
        if (__DEV__) {
          devError('csv-import', new Error('exercise match/create failed'), {
            name: exercise.name,
          });
        }
        continue;
      }

      const { data: sessionExercise, error: seError } = await supabase
        .from('v2_session_exercises')
        .insert({
          session_id: session.id,
          exercise_id: exerciseId,
          custom_exercise_id: customExerciseId,
          sort_order: sortOrder,
        })
        .select('id')
        .single();
      if (seError || !sessionExercise) {
        if (__DEV__) {
          devError('csv-import', seError ?? new Error('session exercise insert failed'), {
            sessionId: session.id,
            name: exercise.name,
          });
        }
        continue;
      }
      sortOrder += 1;

      const setRows = exercise.sets.map((set, index) => {
        const fromImperial = set.weightIsImperial ?? storeImperial;
        const weight =
          set.weight == null
            ? null
            : convertLiftWeight(set.weight, { fromImperial, toImperial: storeImperial });
        return {
          session_exercise_id: sessionExercise.id,
          set_number: set.setNumber > 0 ? set.setNumber : index + 1,
          reps: set.reps,
          weight,
          duration_sec: set.durationSec,
          set_type: set.setType,
          performed_at: startedAt,
        };
      });

      const { error: setsError } = await supabase.from('v2_session_sets').insert(setRows);
      if (setsError) {
        if (__DEV__) {
          devError('csv-import', setsError, { sessionId: session.id, name: exercise.name });
        }
        continue;
      }
      insertedSets += setRows.length;
    }

    const completedAt = new Date(workout.startedAt.getTime() + 60 * 60 * 1000).toISOString();
    const { error: completeError } = await supabase
      .from('v2_workout_sessions')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', session.id)
      .eq('user_id', userId);
    if (completeError && __DEV__) {
      devError('csv-import', completeError, { action: 'complete_session', sessionId: session.id });
    }

    result.sessionCount += 1;
    result.setCount += insertedSets;
  }

  if (__DEV__) {
    devLog('csv-import', { action: 'import_done', ...result });
  }

  return result;
}
