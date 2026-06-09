/**
 * Create/update/delete user custom exercises.
 * Each mutation invalidates the merged-exercise cache so listMergedExercisesCached stays correct.
 * Use these from any UI that mutates v2_user_custom_exercises.
 */

import { supabase } from '../client';
import { invalidateMergedExercisesForUser } from '../../cache/exerciseCache';
import { devLog, devError } from '../../utils/logger';

/** Payload for inserting a new custom exercise. Required fields match v2_user_custom_exercises. */
export interface CreateUserCustomExercisePayload {
  name: string;
  description?: string;
  density_score: number;
  primary_muscles: string[];
  secondary_muscles?: string[];
  implicit_hits: Record<string, number>;
  is_unilateral: boolean;
  setup_buffer_sec: number;
  avg_time_per_set_sec: number;
  is_timed: boolean;
  equipment_needed?: string[];
  movement_pattern?: string;
  tempo_category?: string;
  mode: 'reps' | 'timed';
  sets_min: number;
  sets_max: number;
  reps_min?: number;
  reps_max?: number;
  duration_sec_min?: number;
  duration_sec_max?: number;
}

/** Payload for updating an existing custom exercise. All fields optional. */
export type UpdateUserCustomExercisePayload = Partial<CreateUserCustomExercisePayload>;

export async function createUserCustomExercise(
  userId: string,
  payload: CreateUserCustomExercisePayload
): Promise<{ id: string } | null> {
  if (__DEV__) {
    devLog('custom-exercise-mutation', { action: 'createUserCustomExercise', userId });
  }
  const row = {
    user_id: userId,
    name: payload.name,
    description: payload.description ?? null,
    density_score: payload.density_score,
    primary_muscles: payload.primary_muscles,
    secondary_muscles: payload.secondary_muscles ?? null,
    implicit_hits: payload.implicit_hits,
    is_unilateral: payload.is_unilateral,
    setup_buffer_sec: payload.setup_buffer_sec,
    avg_time_per_set_sec: payload.avg_time_per_set_sec,
    is_timed: payload.is_timed,
    equipment_needed: payload.equipment_needed ?? null,
    movement_pattern: payload.movement_pattern ?? null,
    tempo_category: payload.tempo_category ?? null,
    mode: payload.mode,
    sets_min: payload.sets_min,
    sets_max: payload.sets_max,
    reps_min: payload.reps_min ?? null,
    reps_max: payload.reps_max ?? null,
    duration_sec_min: payload.duration_sec_min ?? null,
    duration_sec_max: payload.duration_sec_max ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('v2_user_custom_exercises')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    if (__DEV__) devError('custom-exercise-mutation', error, { userId });
    return null;
  }
  invalidateMergedExercisesForUser(userId);
  return data ? { id: data.id } : null;
}

const UPDATEABLE_KEYS = [
  'name', 'description', 'density_score', 'primary_muscles', 'secondary_muscles',
  'implicit_hits', 'is_unilateral', 'setup_buffer_sec', 'avg_time_per_set_sec',
  'is_timed', 'equipment_needed', 'movement_pattern', 'tempo_category',
  'mode', 'sets_min', 'sets_max', 'reps_min', 'reps_max', 'duration_sec_min', 'duration_sec_max',
] as const;

export async function updateUserCustomExercise(
  userId: string,
  customExerciseId: string,
  payload: UpdateUserCustomExercisePayload
): Promise<boolean> {
  if (__DEV__) {
    devLog('custom-exercise-mutation', { action: 'updateUserCustomExercise', userId, customExerciseId });
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of UPDATEABLE_KEYS) {
    const value = payload[key];
    if (value !== undefined) updates[key] = value;
  }
  const { error } = await supabase
    .from('v2_user_custom_exercises')
    .update(updates)
    .eq('id', customExerciseId)
    .eq('user_id', userId);
  if (error) {
    if (__DEV__) devError('custom-exercise-mutation', error, { userId, customExerciseId });
    return false;
  }
  invalidateMergedExercisesForUser(userId);
  return true;
}

export async function deleteUserCustomExercise(
  userId: string,
  customExerciseId: string
): Promise<boolean> {
  if (__DEV__) {
    devLog('custom-exercise-mutation', { action: 'deleteUserCustomExercise', userId, customExerciseId });
  }
  const { error } = await supabase
    .from('v2_user_custom_exercises')
    .delete()
    .eq('id', customExerciseId)
    .eq('user_id', userId);
  if (error) {
    if (__DEV__) devError('custom-exercise-mutation', error, { userId, customExerciseId });
    return false;
  }
  invalidateMergedExercisesForUser(userId);
  return true;
}
