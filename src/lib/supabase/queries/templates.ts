/**
 * Template queries
 * Handles workout templates, days, and slots (planning layer)
 */

import { supabase } from '../client';
import { devLog, devError } from '../../utils/logger';

export interface Template {
  id: string;
  user_id: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateDay {
  id: string;
  template_id: string;
  day_name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateSlot {
  id: string;
  day_id: string;
  exercise_id: string | null;
  custom_exercise_id: string | null;
  experience: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateSummary extends Template {
  day_count?: number;
}

export interface FullTemplate {
  template: Template;
  days: Array<{
    day: TemplateDay;
    slots: TemplateSlot[];
  }>;
}

/**
 * Get all templates for a user (including system templates)
 */
export async function getUserTemplates(userId: string): Promise<TemplateSummary[]> {
  if (__DEV__) {
    devLog('template-query', { action: 'getUserTemplates', userId });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_templates')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (__DEV__) {
        devError('template-query', error, { userId });
      }
      return [];
    }

    // Get day counts for each template
    const templatesWithCounts = await Promise.all(
      (data || []).map(async (template) => {
        const { count } = await supabase
          .from('v2_template_days')
          .select('*', { count: 'exact', head: true })
          .eq('template_id', template.id);

        return {
          ...template,
          day_count: count || 0,
        };
      })
    );

    if (__DEV__) {
      devLog('template-query', {
        action: 'getUserTemplates_result',
        templateCount: templatesWithCounts.length,
      });
    }

    return templatesWithCounts;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { userId });
    }
    return [];
  }
}

/**
 * Get template with all days and slots
 */
export async function getTemplateWithDaysAndSlots(
  templateId: string
): Promise<FullTemplate | null> {
  if (__DEV__) {
    devLog('template-query', { action: 'getTemplateWithDaysAndSlots', templateId });
  }

  try {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('v2_workout_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      if (__DEV__) {
        devError('template-query', templateError || new Error('Template not found'), {
          templateId,
        });
      }
      return null;
    }

    // Get days
    const { data: days, error: daysError } = await supabase
      .from('v2_template_days')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true });

    if (daysError) {
      if (__DEV__) {
        devError('template-query', daysError, { templateId });
      }
      return null;
    }

    // Get slots for all days
    const dayIds = (days || []).map((d) => d.id);
    const { data: slots, error: slotsError } = await supabase
      .from('v2_template_slots')
      .select('*')
      .in('day_id', dayIds)
      .order('sort_order', { ascending: true });

    if (slotsError) {
      if (__DEV__) {
        devError('template-query', slotsError, { templateId });
      }
      return null;
    }

    // Group slots by day
    const slotsByDay = new Map<string, TemplateSlot[]>();
    for (const slot of slots || []) {
      const daySlots = slotsByDay.get(slot.day_id) || [];
      daySlots.push(slot);
      slotsByDay.set(slot.day_id, daySlots);
    }

    const daysWithSlots = (days || []).map((day) => ({
      day,
      slots: slotsByDay.get(day.id) || [],
    }));

    if (__DEV__) {
      devLog('template-query', {
        action: 'getTemplateWithDaysAndSlots_result',
        templateId,
        dayCount: daysWithSlots.length,
        slotCount: (slots || []).length,
      });
    }

    return {
      template,
      days: daysWithSlots,
    };
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { templateId });
    }
    return null;
  }
}

/**
 * Create a new template
 */
export async function createTemplate(
  userId: string,
  name?: string
): Promise<Template | null> {
  if (__DEV__) {
    devLog('template-query', { action: 'createTemplate', userId, name });
  }

  try {
    const { data, error } = await supabase
      .from('v2_workout_templates')
      .insert({
        user_id: userId,
        name: name || 'Weekly Plan',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (__DEV__) {
        devError('template-query', error, { userId, name });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { userId, name });
    }
    return null;
  }
}

/**
 * Upsert a template day (insert or update if exists)
 */
export async function upsertTemplateDay(
  templateId: string,
  dayName: string,
  sortOrder: number
): Promise<TemplateDay | null> {
  if (__DEV__) {
    devLog('template-query', {
      action: 'upsertTemplateDay',
      templateId,
      dayName,
      sortOrder,
    });
  }

  try {
    // Check if day exists
    const { data: existing } = await supabase
      .from('v2_template_days')
      .select('id')
      .eq('template_id', templateId)
      .eq('day_name', dayName)
      .maybeSingle();

    if (existing) {
      // Update existing day
      const { data, error } = await supabase
        .from('v2_template_days')
        .update({
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        if (__DEV__) {
          devError('template-query', error, { templateId, dayName, sortOrder });
        }
        return null;
      }

      return data;
    } else {
      // Insert new day
      const { data, error } = await supabase
        .from('v2_template_days')
        .insert({
          template_id: templateId,
          day_name: dayName,
          sort_order: sortOrder,
        })
        .select()
        .single();

      if (error) {
        if (__DEV__) {
          devError('template-query', error, { templateId, dayName, sortOrder });
        }
        return null;
      }

      return data;
    }
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { templateId, dayName, sortOrder });
    }
    return null;
  }
}

/**
 * Create a template slot
 * Accepts either exerciseId OR customExerciseId (exactly one required)
 */
export async function createTemplateSlot(
  dayId: string,
  input: {
    exerciseId?: string;
    customExerciseId?: string;
    experience?: string | null;
    notes?: string | null;
    sortOrder: number;
  }
): Promise<TemplateSlot | null> {
  if (__DEV__) {
    devLog('template-query', {
      action: 'createTemplateSlot',
      dayId,
      exerciseId: input.exerciseId,
      customExerciseId: input.customExerciseId,
      sortOrder: input.sortOrder,
    });
  }

  // Validate exactly one of exerciseId or customExerciseId is provided
  const hasExerciseId = !!input.exerciseId;
  const hasCustomExerciseId = !!input.customExerciseId;
  
  if (hasExerciseId === hasCustomExerciseId) {
    if (__DEV__) {
      devError('template-query', new Error('Exactly one of exerciseId or customExerciseId must be provided'), { dayId, input });
    }
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('v2_template_slots')
      .insert({
        day_id: dayId,
        exercise_id: input.exerciseId || null,
        custom_exercise_id: input.customExerciseId || null,
        experience: input.experience || null,
        notes: input.notes || null,
        sort_order: input.sortOrder,
      })
      .select()
      .single();

    if (error) {
      if (__DEV__) {
        devError('template-query', error, { dayId, input });
      }
      return null;
    }

    return data;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { dayId, input });
    }
    return null;
  }
}

/**
 * Update a template slot
 */
export async function updateTemplateSlot(
  slotId: string,
  updates: Partial<{
    exercise_id: string | null;
    custom_exercise_id: string | null;
    experience: string | null;
    notes: string | null;
    sort_order: number;
  }>
): Promise<boolean> {
  if (__DEV__) {
    devLog('template-query', {
      action: 'updateTemplateSlot',
      slotId,
      updateKeys: Object.keys(updates),
    });
  }

  // If updating exercise references, ensure exactly one is provided
  if ('exercise_id' in updates || 'custom_exercise_id' in updates) {
    // Get current slot to check existing values
    const { data: currentSlot } = await supabase
      .from('v2_template_slots')
      .select('exercise_id, custom_exercise_id')
      .eq('id', slotId)
      .single();

    if (currentSlot) {
      const newExerciseId = 'exercise_id' in updates ? updates.exercise_id : currentSlot.exercise_id;
      const newCustomExerciseId = 'custom_exercise_id' in updates ? updates.custom_exercise_id : currentSlot.custom_exercise_id;
      
      const hasExerciseId = !!newExerciseId;
      const hasCustomExerciseId = !!newCustomExerciseId;
      
      if (hasExerciseId === hasCustomExerciseId) {
        if (__DEV__) {
          devError('template-query', new Error('Exactly one of exercise_id or custom_exercise_id must be non-null'), { slotId, updates });
        }
      return false;
    }
  }
}

/**
 * Apply structure edit to template
 * Used for "From next week onward" scope
 * Only updates structure (exercise_id, custom_exercise_id, notes, sort_order)
 * Never writes weight/reps/duration
 */
export async function applyStructureEditToTemplate(
  templateId: string,
  edit: {
    type: 'addSlot' | 'removeSlot' | 'swapExercise' | 'reorderSlots' | 'updateNotes';
    // Add slot
    dayId?: string;
    exerciseId?: string;
    customExerciseId?: string;
    sortOrder?: number;
    notes?: string;
    // Remove slot
    slotId?: string;
    // Swap exercise
    targetSlotId?: string;
    newExerciseId?: string;
    newCustomExerciseId?: string;
    // Update notes
    newNotes?: string;
  }
): Promise<boolean> {
  if (__DEV__) {
    devLog('template-query', { action: 'applyStructureEditToTemplate', templateId, editType: edit.type });
  }

  try {
    if (edit.type === 'addSlot') {
      if (!edit.dayId || (!edit.exerciseId && !edit.customExerciseId)) {
        if (__DEV__) {
          devError('template-query', new Error('dayId and exerciseId/customExerciseId required for addSlot'), {
            templateId,
            edit,
          });
        }
        return false;
      }

      // Get current max sort_order for the day
      const { data: existing } = await supabase
        .from('v2_template_slots')
        .select('sort_order')
        .eq('day_id', edit.dayId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sortOrder = edit.sortOrder ?? ((existing?.sort_order ?? 0) + 1);

      const result = await createTemplateSlot(edit.dayId, {
        exerciseId: edit.exerciseId,
        customExerciseId: edit.customExerciseId,
        notes: edit.notes || null,
        sortOrder,
      });

      return !!result;
    } else if (edit.type === 'removeSlot') {
      if (!edit.slotId) {
        if (__DEV__) {
          devError('template-query', new Error('slotId required for removeSlot'), { templateId, edit });
        }
        return false;
      }

      return await deleteTemplateSlot(edit.slotId);
    } else if (edit.type === 'swapExercise') {
      if (!edit.targetSlotId || (!edit.newExerciseId && !edit.newCustomExerciseId)) {
        if (__DEV__) {
          devError('template-query', new Error('targetSlotId and newExerciseId/newCustomExerciseId required for swapExercise'), {
            templateId,
            edit,
          });
        }
        return false;
      }

      return await updateTemplateSlot(edit.targetSlotId, {
        exercise_id: edit.newExerciseId || null,
        custom_exercise_id: edit.newCustomExerciseId || null,
      });
    } else if (edit.type === 'updateNotes') {
      if (!edit.targetSlotId) {
        if (__DEV__) {
          devError('template-query', new Error('targetSlotId required for updateNotes'), { templateId, edit });
        }
        return false;
      }

      return await updateTemplateSlot(edit.targetSlotId, {
        notes: edit.newNotes || null,
      });
    }

    // TODO: Implement reorderSlots
    if (__DEV__) {
      devLog('template-query', { action: 'applyStructureEditToTemplate', note: `${edit.type} not yet implemented` });
    }

    return false;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { templateId, edit });
    }
    return false;
  }
}

  try {
    const { error } = await supabase
      .from('v2_template_slots')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', slotId);

    if (error) {
      if (__DEV__) {
        devError('template-query', error, { slotId, updates });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { slotId, updates });
    }
    return false;
  }
}

/**
 * Delete a template slot
 */
export async function deleteTemplateSlot(slotId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('template-query', { action: 'deleteTemplateSlot', slotId });
  }

  try {
    const { error } = await supabase.from('v2_template_slots').delete().eq('id', slotId);

    if (error) {
      if (__DEV__) {
        devError('template-query', error, { slotId });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { slotId });
    }
    return false;
  }
}

/**
 * Delete a template day (cascades to slots)
 */
export async function deleteTemplateDay(dayId: string): Promise<boolean> {
  if (__DEV__) {
    devLog('template-query', { action: 'deleteTemplateDay', dayId });
  }

  try {
    const { error } = await supabase.from('v2_template_days').delete().eq('id', dayId);

    if (error) {
      if (__DEV__) {
        devError('template-query', error, { dayId });
      }
      return false;
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      devError('template-query', error, { dayId });
    }
    return false;
  }
}

