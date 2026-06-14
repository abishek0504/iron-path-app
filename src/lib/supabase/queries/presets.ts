/**
 * Workout preset queries
 * Save, list, rename, delete, and apply user workout presets
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';
import { selectExerciseTargets } from '../../engine/targetSelection';
import {
  createTemplateSlot,
  deleteTemplateSlot,
} from './templates';
import {
  createWorkoutSession,
  prefillSessionSets,
  type WorkoutSession,
} from './workouts';

export const PRESET_NAME_MAX_LENGTH = 60;

export interface WorkoutPreset {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  slot_count?: number;
}

export interface WorkoutPresetSlot {
  id: string;
  preset_id: string;
  exercise_id: string | null;
  custom_exercise_id: string | null;
  sort_order: number;
  superset_group: number | null;
  rest_sec: number | null;
  notes: string | null;
}

export type PresetSlotInput = Pick<
  WorkoutPresetSlot,
  'exercise_id' | 'custom_exercise_id' | 'sort_order' | 'superset_group' | 'rest_sec' | 'notes'
>;

function normalizePresetName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > PRESET_NAME_MAX_LENGTH) return null;
  return trimmed;
}

async function buildTargetsMapForSlots(
  userId: string,
  slots: PresetSlotInput[],
  experience: string
): Promise<Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>> {
  const targetsMap = new Map<
    string,
    { sets: number; reps?: number; duration_sec?: number; weight?: number }
  >();

  for (const slot of slots) {
    const key = slot.exercise_id || slot.custom_exercise_id;
    if (!key || targetsMap.has(key)) continue;

    const target = await selectExerciseTargets(
      {
        exerciseId: slot.exercise_id || undefined,
        customExerciseId: slot.custom_exercise_id || undefined,
      },
      userId,
      { experience },
      0
    );
    if (target) {
      targetsMap.set(key, {
        sets: target.sets,
        reps: target.reps,
        duration_sec: target.duration_sec,
        weight: target.weight,
      });
    }
  }

  return targetsMap;
}

export async function listWorkoutPresets(userId: string): Promise<WorkoutPreset[]> {
  if (__DEV__) {
    devLog('preset-query', { action: 'listWorkoutPresets', userId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_presets')
      .select('id, user_id, name, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (__DEV__) devError('preset-query', error, { userId });
      return [];
    }

    const presets = data || [];
    if (presets.length === 0) return [];

    const presetIds = presets.map((p) => p.id);
    const { data: slotRows, error: slotError } = await supabase
      .from('v2_workout_preset_slots')
      .select('preset_id')
      .in('preset_id', presetIds);

    if (slotError && __DEV__) {
      devError('preset-query', slotError, { userId, presetIds });
    }

    const countByPreset = new Map<string, number>();
    for (const row of slotRows || []) {
      countByPreset.set(row.preset_id, (countByPreset.get(row.preset_id) ?? 0) + 1);
    }

    const result = presets.map((p) => ({
      ...p,
      slot_count: countByPreset.get(p.id) ?? 0,
    }));

    if (__DEV__) {
      devLog('preset-query', {
        action: 'listWorkoutPresets_result',
        userId,
        presetCount: result.length,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { userId });
    return [];
  }
}

export async function getWorkoutPresetSlots(presetId: string): Promise<PresetSlotInput[]> {
  if (__DEV__) {
    devLog('preset-query', { action: 'getWorkoutPresetSlots', presetId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_preset_slots')
      .select(
        'exercise_id, custom_exercise_id, sort_order, superset_group, rest_sec, notes'
      )
      .eq('preset_id', presetId)
      .order('sort_order', { ascending: true });

    if (error) {
      if (__DEV__) devError('preset-query', error, { presetId });
      return [];
    }

    if (__DEV__) {
      devLog('preset-query', {
        action: 'getWorkoutPresetSlots_result',
        presetId,
        slotCount: data?.length ?? 0,
      });
    }

    return data || [];
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { presetId });
    return [];
  }
}

export async function createWorkoutPresetFromSession(
  userId: string,
  sessionId: string,
  name: string
): Promise<WorkoutPreset | null> {
  const normalizedName = normalizePresetName(name);
  if (!normalizedName) {
    if (__DEV__) {
      devLog('preset-query', { action: 'createWorkoutPresetFromSession_invalidName', sessionId });
    }
    return null;
  }

  if (__DEV__) {
    devLog('preset-query', {
      action: 'createWorkoutPresetFromSession',
      userId,
      sessionId,
      name: normalizedName,
    });
  }

  try {
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from('v2_session_exercises')
      .select('exercise_id, custom_exercise_id, sort_order, superset_group, rest_sec')
      .eq('session_id', sessionId)
      .order('sort_order', { ascending: true });

    if (exercisesError) {
      if (__DEV__) devError('preset-query', exercisesError, { sessionId });
      return null;
    }

    if (!sessionExercises || sessionExercises.length === 0) {
      if (__DEV__) {
        devLog('preset-query', { action: 'createWorkoutPresetFromSession_empty', sessionId });
      }
      return null;
    }

    const { data: preset, error: presetError } = await supabase
      .from('v2_workout_presets')
      .insert({ user_id: userId, name: normalizedName })
      .select()
      .single();

    if (presetError || !preset) {
      if (__DEV__) devError('preset-query', presetError || new Error('No preset returned'), { sessionId });
      return null;
    }

    const slotRows = sessionExercises.map((se) => ({
      preset_id: preset.id,
      exercise_id: se.exercise_id,
      custom_exercise_id: se.custom_exercise_id,
      sort_order: se.sort_order,
      superset_group: se.superset_group ?? null,
      rest_sec: se.rest_sec ?? null,
      notes: null,
    }));

    const { error: slotsError } = await supabase.from('v2_workout_preset_slots').insert(slotRows);

    if (slotsError) {
      if (__DEV__) devError('preset-query', slotsError, { presetId: preset.id });
      await supabase.from('v2_workout_presets').delete().eq('id', preset.id);
      return null;
    }

    if (__DEV__) {
      devLog('preset-query', {
        action: 'createWorkoutPresetFromSession_result',
        presetId: preset.id,
        slotCount: slotRows.length,
      });
    }

    return { ...preset, slot_count: slotRows.length };
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { userId, sessionId });
    return null;
  }
}

export async function renameWorkoutPreset(presetId: string, name: string): Promise<boolean> {
  const normalizedName = normalizePresetName(name);
  if (!normalizedName) return false;

  if (__DEV__) {
    devLog('preset-query', { action: 'renameWorkoutPreset', presetId, name: normalizedName });
  }

  try {
    const { error } = await supabase
      .from('v2_workout_presets')
      .update({ name: normalizedName, updated_at: new Date().toISOString() })
      .eq('id', presetId);

    if (error) {
      if (__DEV__) devError('preset-query', error, { presetId });
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { presetId });
    return false;
  }
}

export async function deleteWorkoutPreset(presetId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('preset-query', { action: 'deleteWorkoutPreset', presetId });
  }

  try {
    const { error } = await supabase.from('v2_workout_presets').delete().eq('id', presetId);

    if (error) {
      if (__DEV__) devError('preset-query', error, { presetId });
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { presetId });
    return false;
  }
}

export async function replaceDayTemplateSlotsFromPreset(
  dayId: string,
  slots: PresetSlotInput[]
): Promise<boolean> {
  if (__DEV__) {
    devLog('preset-query', {
      action: 'replaceDayTemplateSlotsFromPreset',
      dayId,
      slotCount: slots.length,
    });
  }

  try {
    const { data: existingSlots, error: fetchError } = await supabase
      .from('v2_template_slots')
      .select('id')
      .eq('day_id', dayId);

    if (fetchError) {
      if (__DEV__) devError('preset-query', fetchError, { dayId });
      return false;
    }

    for (const slot of existingSlots || []) {
      const deleted = await deleteTemplateSlot(slot.id);
      if (!deleted) return false;
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const created = await createTemplateSlot(dayId, {
        exerciseId: slot.exercise_id || undefined,
        customExerciseId: slot.custom_exercise_id || undefined,
        sortOrder: i + 1,
        notes: slot.notes || null,
      });
      if (!created) return false;

      if (slot.superset_group != null || slot.rest_sec != null) {
        const { error: updateError } = await supabase
          .from('v2_template_slots')
          .update({
            superset_group: slot.superset_group ?? null,
            rest_sec: slot.rest_sec ?? null,
          })
          .eq('id', created.id);
        if (updateError && __DEV__) {
          devError('preset-query', updateError, { dayId, slotId: created.id });
        }
      }
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { dayId });
    return false;
  }
}

export async function appendDayTemplateSlotsFromPreset(
  dayId: string,
  slots: PresetSlotInput[]
): Promise<boolean> {
  if (__DEV__) {
    devLog('preset-query', {
      action: 'appendDayTemplateSlotsFromPreset',
      dayId,
      slotCount: slots.length,
    });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('v2_template_slots')
      .select('sort_order')
      .eq('day_id', dayId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      if (__DEV__) devError('preset-query', fetchError, { dayId });
      return false;
    }

    let nextSort = (existing?.sort_order ?? 0) + 1;

    for (const slot of slots) {
      const created = await createTemplateSlot(dayId, {
        exerciseId: slot.exercise_id || undefined,
        customExerciseId: slot.custom_exercise_id || undefined,
        sortOrder: nextSort,
        notes: slot.notes || null,
      });
      if (!created) return false;

      if (slot.superset_group != null || slot.rest_sec != null) {
        const { error: updateError } = await supabase
          .from('v2_template_slots')
          .update({
            superset_group: slot.superset_group ?? null,
            rest_sec: slot.rest_sec ?? null,
          })
          .eq('id', created.id);
        if (updateError && __DEV__) {
          devError('preset-query', updateError, { dayId, slotId: created.id });
        }
      }

      nextSort += 1;
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { dayId });
    return false;
  }
}

async function insertSessionExercisesFromSlots(
  sessionId: string,
  slots: PresetSlotInput[],
  startSortOrder: number
): Promise<Array<{ id: string; exercise_id?: string; custom_exercise_id?: string }>> {
  const inserted: Array<{ id: string; exercise_id?: string; custom_exercise_id?: string }> = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const { data, error } = await supabase
      .from('v2_session_exercises')
      .insert({
        session_id: sessionId,
        exercise_id: slot.exercise_id,
        custom_exercise_id: slot.custom_exercise_id,
        sort_order: startSortOrder + i,
        superset_group: slot.superset_group ?? null,
        rest_sec: slot.rest_sec ?? null,
      })
      .select('id, exercise_id, custom_exercise_id')
      .single();

    if (error || !data) {
      if (__DEV__) {
        devError('preset-query', error || new Error('Failed to insert session exercise'), {
          sessionId,
          slotIndex: i,
        });
      }
      return inserted;
    }

    inserted.push(data);
  }

  return inserted;
}

export async function replaceSessionExercisesFromPreset(
  sessionId: string,
  slots: PresetSlotInput[],
  userId: string,
  experience: string = 'beginner'
): Promise<boolean> {
  if (__DEV__) {
    devLog('preset-query', {
      action: 'replaceSessionExercisesFromPreset',
      sessionId,
      slotCount: slots.length,
    });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('v2_session_exercises')
      .select('id')
      .eq('session_id', sessionId);

    if (fetchError) {
      if (__DEV__) devError('preset-query', fetchError, { sessionId });
      return false;
    }

    if (existing && existing.length > 0) {
      const { error: deleteError } = await supabase
        .from('v2_session_exercises')
        .delete()
        .in(
          'id',
          existing.map((e) => e.id)
        );

      if (deleteError) {
        if (__DEV__) devError('preset-query', deleteError, { sessionId });
        return false;
      }
    }

    const inserted = await insertSessionExercisesFromSlots(sessionId, slots, 1);
    if (inserted.length !== slots.length) return false;

    const targetsMap = await buildTargetsMapForSlots(userId, slots, experience);
    if (targetsMap.size > 0) {
      await prefillSessionSets(sessionId, inserted, targetsMap);
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { sessionId });
    return false;
  }
}

export async function appendSessionExercisesFromPreset(
  sessionId: string,
  slots: PresetSlotInput[],
  userId: string,
  experience: string = 'beginner'
): Promise<boolean> {
  if (__DEV__) {
    devLog('preset-query', {
      action: 'appendSessionExercisesFromPreset',
      sessionId,
      slotCount: slots.length,
    });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('v2_session_exercises')
      .select('sort_order')
      .eq('session_id', sessionId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      if (__DEV__) devError('preset-query', fetchError, { sessionId });
      return false;
    }

    const startSort = (existing?.sort_order ?? 0) + 1;
    const inserted = await insertSessionExercisesFromSlots(sessionId, slots, startSort);
    if (inserted.length !== slots.length) return false;

    const targetsMap = await buildTargetsMapForSlots(userId, slots, experience);
    if (targetsMap.size > 0) {
      await prefillSessionSets(sessionId, inserted, targetsMap);
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { sessionId });
    return false;
  }
}

export async function createSessionFromPreset(
  userId: string,
  templateId: string,
  dayName: string,
  slots: PresetSlotInput[],
  startedAt?: string,
  experience: string = 'beginner'
): Promise<WorkoutSession | null> {
  if (__DEV__) {
    devLog('preset-query', {
      action: 'createSessionFromPreset',
      userId,
      templateId,
      dayName,
      slotCount: slots.length,
    });
  }

  try {
    const session = await createWorkoutSession(userId, templateId, dayName, startedAt);
    if (!session) return null;

    const inserted = await insertSessionExercisesFromSlots(session.id, slots, 1);
    if (inserted.length !== slots.length) {
      await supabase.from('v2_workout_sessions').delete().eq('id', session.id);
      return null;
    }

    const targetsMap = await buildTargetsMapForSlots(userId, slots, experience);
    if (targetsMap.size > 0) {
      await prefillSessionSets(session.id, inserted, targetsMap);
    }

    return session;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { userId, dayName });
    return null;
  }
}

export type PresetLoadMode = 'replace' | 'append' | 'newWorkout';

export async function applyWorkoutPresetToDay(input: {
  userId: string;
  templateId: string;
  dayId: string;
  dayName: string;
  presetId: string;
  mode: PresetLoadMode;
  targetSessionId?: string;
  sessionCountOnDay: number;
  startedAt?: string;
  experience?: string;
}): Promise<boolean> {
  const {
    userId,
    templateId,
    dayId,
    dayName,
    presetId,
    mode,
    targetSessionId,
    sessionCountOnDay,
    startedAt,
    experience = 'beginner',
  } = input;

  const slots = await getWorkoutPresetSlots(presetId);
  if (slots.length === 0) return false;

  if (__DEV__) {
    devLog('preset-query', {
      action: 'applyWorkoutPresetToDay',
      presetId,
      mode,
      dayName,
      slotCount: slots.length,
      sessionCountOnDay,
      targetSessionId,
    });
  }

  try {
    if (mode === 'newWorkout') {
      const session = await createSessionFromPreset(
        userId,
        templateId,
        dayName,
        slots,
        startedAt,
        experience
      );
      return !!session;
    }

    if (!targetSessionId) return false;

    const sessionOk =
      mode === 'replace'
        ? await replaceSessionExercisesFromPreset(targetSessionId, slots, userId, experience)
        : await appendSessionExercisesFromPreset(targetSessionId, slots, userId, experience);

    if (!sessionOk) return false;

    if (mode === 'replace' && sessionCountOnDay === 1) {
      return replaceDayTemplateSlotsFromPreset(dayId, slots);
    }

    if (mode === 'append') {
      return appendDayTemplateSlotsFromPreset(dayId, slots);
    }

    return true;
  } catch (error) {
    if (__DEV__) devError('preset-query', error, { presetId, mode, dayName });
    return false;
  }
}
