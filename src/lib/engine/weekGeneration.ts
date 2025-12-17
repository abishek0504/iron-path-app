/**
 * Week generation engine
 * Handles AI-based workout week generation
 */

import { supabase } from '../supabase/client';
import { devLog, devError } from '../utils/logger';
import type { FullTemplate } from '../supabase/queries/templates';
import type { UserProfile } from '../../stores/userStore';

/**
 * Generate exercise IDs for a week template
 * TODO: Implement full AI logic using v2_ai_recommended_exercises
 * For now, returns exercise IDs from AI allow-list
 */
export async function generateWeekForTemplate(
  template: FullTemplate,
  userId: string,
  profile: UserProfile | null
): Promise<string[]> {
  if (__DEV__) {
    devLog('week-generation', {
      action: 'generateWeekForTemplate',
      templateId: template.template.id,
      dayCount: template.days.length,
    });
  }

  try {
    // Fetch AI recommended exercises
    const { data: aiExercises, error } = await supabase
      .from('v2_ai_recommended_exercises')
      .select('exercise_id, priority_order')
      .eq('is_active', true)
      .order('priority_order', { ascending: true })
      .limit(20); // Limit to reasonable number

    if (error) {
      if (__DEV__) {
        devError('week-generation', error, { userId });
      }
      return [];
    }

    if (!aiExercises || aiExercises.length === 0) {
      if (__DEV__) {
        devLog('week-generation', { action: 'no_ai_exercises', userId });
      }
      return [];
    }

    // Return exercise IDs
    return aiExercises.map((ex) => ex.exercise_id);
  } catch (error) {
    if (__DEV__) {
      devError('week-generation', error, { userId, templateId: template.template.id });
    }
    return [];
  }
}

