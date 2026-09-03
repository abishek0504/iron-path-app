/**
 * AI day generation pipeline — extracted from planner runGenerateWithAI.
 * Fetches fresh template + day sessions, calls the Edge Function, creates slots and session exercises.
 */

import { supabase } from '../supabase/client';
import { devLog, devError } from '../utils/logger';
import { getDateBoundsForDayName } from '../utils/date';
import { createTemplateSlot } from '../supabase/queries/templates';
import { getMergedExercise } from '../supabase/queries/exercises';
import { selectExerciseTargets } from '../engine/targetSelection';
import {
  createWorkoutSession,
  getSessionsForToday,
  prefillSessionSets,
  type WorkoutSession,
} from '../supabase/queries/workouts';
import {
  getTemplateWithDaysAndSlotsCached,
  invalidateTemplate,
} from '../cache/templateCache';
import { invalidateSessionsInRangeForUser } from '../cache/sessionsCache';
import { useUIStore } from '../../stores/uiStore';
import type { UserProfile } from '../../stores/userStore';
import {
  generateAiDay,
  type DayConstraints,
  DEFAULT_DAY_CONSTRAINTS,
} from './generateWorkoutDay';
import { addAiGenerationBreadcrumb } from '../monitoring/aiGenerationBreadcrumb';

export type AiGenerationResult =
  | { ok: true; dayName: string; slotsCreated: number; outcome: 'generated' }
  | { ok: true; dayName: string; slotsCreated: 0; outcome: 'rest_day' }
  | {
      ok: false;
      code:
        | 'paywall_required'
        | 'quota_exceeded'
        | 'auth_error'
        | 'forbidden'
        | 'ai_unavailable'
        | 'no_slots'
        | 'unknown';
      message?: string;
    };

export interface ExecuteAiDayGenerationInput {
  userId: string;
  templateId: string;
  dayId: string;
  dayName: string;
  dayIndex: number;
  idempotencyKey: string;
  sessionStartIso: string;
  sessionEndIsoExclusive: string;
  sessionsPerDay: number;
  constraints?: DayConstraints;
  profile: UserProfile | null;
}

async function fetchSessionsForDay(
  userId: string,
  dayName: string,
): Promise<WorkoutSession[]> {
  const { startIso, endIsoExclusive } = getDateBoundsForDayName(dayName);
  return getSessionsForToday(userId, startIso, endIsoExclusive);
}

export async function executeAiDayGeneration(
  input: ExecuteAiDayGenerationInput,
): Promise<AiGenerationResult> {
  const {
    userId,
    templateId,
    dayId,
    dayName,
    dayIndex,
    idempotencyKey,
    sessionStartIso,
    sessionEndIsoExclusive,
    sessionsPerDay,
    constraints = DEFAULT_DAY_CONSTRAINTS,
    profile,
  } = input;

  if (__DEV__) {
    devLog('planner-ai', {
      action: 'executeAiDayGeneration',
      templateId,
      dayId,
      dayName,
      dayIndex,
      sessionsPerDay,
      constraints,
    });
  }

  try {
    const templateData = await getTemplateWithDaysAndSlotsCached(templateId);
    if (!templateData) {
      return { ok: false, code: 'unknown', message: 'Template not found' };
    }

    const day = templateData.days.find((d) => d.day.id === dayId);
    if (!day) {
      return { ok: false, code: 'unknown', message: 'Day not found' };
    }

    const aiResult = await generateAiDay({
      template: templateData,
      userId,
      profile,
      dayIndex,
      dayId,
      idempotencyKey,
      sessionStartIso,
      sessionEndIsoExclusive,
      sessionsPerDay,
      constraints,
    });

    if (aiResult.source === 'paywall_required') {
      return { ok: false, code: 'paywall_required' };
    }

    if (aiResult.source === 'quota_exceeded') {
      return { ok: false, code: 'quota_exceeded' };
    }

    if (aiResult.source === 'auth_error') {
      return { ok: false, code: 'auth_error' };
    }

    if (aiResult.source === 'forbidden') {
      return { ok: false, code: 'forbidden' };
    }

    if (aiResult.source === 'ai_unavailable') {
      return {
        ok: false,
        code: 'ai_unavailable',
        message: aiResult.reason ?? '',
      };
    }

    if (aiResult.source === 'rest') {
      return { ok: true, dayName, slotsCreated: 0, outcome: 'rest_day' };
    }

    if (aiResult.source === 'openai' && aiResult.committed === true) {
      const slotsCreated = aiResult.slotsCreated ?? 0;
      if (slotsCreated === 0) {
        return { ok: false, code: 'no_slots' };
      }

      invalidateTemplate(templateId);
      invalidateSessionsInRangeForUser(userId);
      useUIStore.getState().setPlannerNeedsRefetch(true);

      void addAiGenerationBreadcrumb({
        action: 'execute_committed',
        slotsCreated,
        committed: true,
      });

      if (__DEV__) {
        devLog('planner-ai', {
          action: 'executeAiDayGeneration_committed',
          templateId,
          dayName,
          slotsCreated,
        });
      }

      return { ok: true, dayName, slotsCreated, outcome: 'generated' };
    }

    const sessionGroups = aiResult.sessions;
    if (sessionGroups.length === 0 || sessionGroups.every((g) => g.length === 0)) {
      return { ok: false, code: 'no_slots' };
    }

    const existingSessions = await fetchSessionsForDay(userId, dayName);
    let slotsCreated = 0;
    let sortOrder = day.slots.length;
    const exp = profile?.experience_level || 'beginner';

    for (let sIdx = 0; sIdx < sessionGroups.length; sIdx++) {
      const group = sessionGroups[sIdx];
      if (!group || group.length === 0) continue;

      let targetSessionId: string | null = null;
      if (sIdx < existingSessions.length) {
        targetSessionId = existingSessions[sIdx].id;
      } else {
        const { startIso } = getDateBoundsForDayName(dayName);
        const newSession = await createWorkoutSession(
          userId,
          templateId,
          dayName,
          startIso,
        );
        if (newSession) {
          targetSessionId = newSession.id;
        }
      }

      const sessionExercises: { id: string; exercise_id?: string }[] = [];
      const targetsMap = new Map<
        string,
        { sets: number; reps?: number; duration_sec?: number; weight?: number }
      >();

      for (const aiPlan of group) {
        const exerciseId = aiPlan.exercise_id;
        sortOrder += 1;

        const newSlot = await createTemplateSlot(day.day.id, {
          exerciseId,
          experience: null,
          notes: null,
          sortOrder,
        });

        if (newSlot) {
          slotsCreated++;

          const mergedExercise = await getMergedExercise({ exerciseId }, userId);

          if (targetSessionId) {
            const { data: se, error: seErr } = await supabase
              .from('v2_session_exercises')
              .insert({
                session_id: targetSessionId,
                exercise_id: exerciseId,
                custom_exercise_id: null,
                sort_order: sortOrder,
              })
              .select()
              .single();

            if (!seErr && se) {
              sessionExercises.push(se);

              const isStretch = mergedExercise?.is_stretch === true;
              if (isStretch) {
                if (aiPlan.sets != null && aiPlan.duration_sec != null) {
                  targetsMap.set(exerciseId, {
                    sets: aiPlan.sets,
                    duration_sec: aiPlan.duration_sec,
                  });
                } else {
                  const target = await selectExerciseTargets(
                    { exerciseId },
                    userId,
                    { experience: exp },
                    0,
                    mergedExercise ?? undefined,
                  );
                  if (target) {
                    targetsMap.set(exerciseId, {
                      sets: target.sets,
                      duration_sec: target.duration_sec,
                    });
                  }
                }
              } else {
                const hasAiTargets =
                  aiPlan.sets != null &&
                  (aiPlan.reps != null || aiPlan.duration_sec != null);
                if (hasAiTargets) {
                  targetsMap.set(exerciseId, {
                    sets: aiPlan.sets!,
                    reps: aiPlan.reps ?? undefined,
                    duration_sec: aiPlan.duration_sec ?? undefined,
                    weight: aiPlan.weight ?? undefined,
                  });
                } else {
                  const target = await selectExerciseTargets(
                    { exerciseId },
                    userId,
                    { experience: exp },
                    0,
                    mergedExercise ?? undefined,
                  );
                  if (target) {
                    targetsMap.set(exerciseId, {
                      sets: target.sets,
                      reps: target.reps,
                      duration_sec: target.duration_sec,
                      weight: target.weight,
                    });
                  }
                }
              }
            } else if (__DEV__) {
              devError(
                'planner-ai',
                seErr || new Error('Failed to create session exercise'),
                { sessionId: targetSessionId, exerciseId },
              );
            }
          }
        } else if (__DEV__) {
          devError('planner-ai', new Error('createTemplateSlot returned null'), {
            dayId: day.day.id,
            exerciseId,
            sortOrder,
          });
        }
      }

      if (targetSessionId && sessionExercises.length > 0 && targetsMap.size > 0) {
        await prefillSessionSets(targetSessionId, sessionExercises, targetsMap);
      }
    }

    if (slotsCreated === 0) {
      if (__DEV__) {
        devLog('planner-ai', {
          action: 'executeAiDayGeneration_noSlotsCreated',
          templateId,
          dayName,
        });
      }
      return { ok: false, code: 'no_slots' };
    }

    invalidateTemplate(templateId);
    invalidateSessionsInRangeForUser(userId);
    useUIStore.getState().setPlannerNeedsRefetch(true);

    if (__DEV__) {
      devLog('planner-ai', {
        action: 'executeAiDayGeneration_result',
        templateId,
        dayName,
        slotsCreated,
        source: aiResult.source,
      });
    }

    return { ok: true, dayName, slotsCreated, outcome: 'generated' };
  } catch (error) {
    if (__DEV__) {
      devError('planner-ai', error, {
        action: 'executeAiDayGeneration',
        templateId,
      });
    }
    return { ok: false, code: 'unknown' };
  }
}
