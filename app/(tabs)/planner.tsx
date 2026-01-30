/**
 * Plan tab
 * Weekly workout planner with template management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { colors, spacing, layout, typography, borderRadius } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { useToast } from '../../src/hooks/useToast';
import { useDateContext } from '../../src/hooks/useDateContext';
import { useUserStore } from '../../src/stores/userStore';
import { useUIStore } from '../../src/stores/uiStore';
import { supabase } from '../../src/lib/supabase/client';
import {
  createTemplate,
  upsertTemplateDay,
  ensureTemplateHasWeekDays,
  type FullTemplate,
  type TemplateSlot,
  type TemplateDay,
} from '../../src/lib/supabase/queries/templates';
import {
  getUserTemplatesCached,
  getTemplateWithDaysAndSlotsCached,
  invalidateTemplates,
  invalidateTemplate,
} from '../../src/lib/cache/templateCache';
import { getMergedExercise } from '../../src/lib/supabase/queries/exercises';
import { listMergedExercisesCached } from '../../src/lib/cache/exerciseCache';
import {
  selectExerciseTargets,
  type ExerciseTarget,
  type TargetSelectionContext,
} from '../../src/lib/engine/targetSelection';
import { createWorkoutSession, prefillSessionSets, getLast7DaysSessionStructure } from '../../src/lib/supabase/queries/workouts';
import { getOrCreateActiveSessionForToday, applyStructureEditToSession } from '../../src/lib/supabase/queries/workouts_helpers';
import { devLog, devError } from '../../src/lib/utils/logger';
import { SmartAdjustPrompt } from '../../src/components/ui/SmartAdjustPrompt';
import { SessionExerciseEditSheet } from '../../src/components/workout/SessionExerciseEditSheet';
import { applyStructureEditToTemplate, applySessionStructureToTemplate } from '../../src/lib/supabase/queries/templates';
import { needsRebalance, type RebalanceResult } from '../../src/lib/engine/rebalance';
import { generateWeekForTemplate } from '../../src/lib/engine/weekGeneration';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Get today's day name using Date.getDay() (0=Sunday, 6=Saturday)
 */
function getTodayDayName(): string {
  const dayIndex = new Date().getDay();
  return WEEK_DAYS[dayIndex];
}

export default function PlannerTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile } = useUserStore();
  const plannerNeedsRefetch = useUIStore((s) => s.plannerNeedsRefetch);
  const setPlannerNeedsRefetch = useUIStore((s) => s.setPlannerNeedsRefetch);

  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<FullTemplate | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());
  const [slotTargets, setSlotTargets] = useState<Map<string, ExerciseTarget>>(new Map());
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [showSmartAdjustPrompt, setShowSmartAdjustPrompt] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState<RebalanceResult | null>(null);
  const [todaySessionExercises, setTodaySessionExercises] = useState<Array<{
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
    sort_order: number;
  }>>([]);
  const [showSessionEditSheet, setShowSessionEditSheet] = useState(false);
  const [editingSessionExercise, setEditingSessionExercise] = useState<{
    id: string;
    name: string;
    mode: 'reps' | 'timed';
  } | null>(null);

  const loadTemplateInFlightRef = useRef(false);
  const loadTodaySessionInFlightRef = useRef(false);
  const recoveryAttemptedThisFocusRef = useRef(false);
  const lastRecoveryAttemptRef = useRef(0);
  const RECOVERY_THROTTLE_MS = 5000;

  // Get current user
  const getCurrentUserId = useCallback(async (): Promise<string | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      if (__DEV__) {
        devError('planner', error, { action: 'getCurrentUserId' });
      }
      return null;
    }
  }, []);

  // Calculate targets for all slots
  const calculateTargetsForSlots = useCallback(
    async (fullTemplate: FullTemplate, userId: string) => {
      if (__DEV__) {
        devLog('planner', {
          action: 'calculateTargetsForSlots',
          templateId: fullTemplate.template.id,
        });
      }

      setIsLoadingTargets(true);
      try {
        // Get effective context from profile
        const effectiveExperience = profile?.experience_level || 'beginner';
        const context: TargetSelectionContext = {
          experience: effectiveExperience,
        };

        const targetsMap = new Map<string, ExerciseTarget>();
        let slotsWithPrescriptions = 0;
        let slotsWithoutPrescriptions = 0;

        // Calculate targets for each slot
        const slotDetails: Array<{ slotId: string; exerciseId?: string; customExerciseId?: string; hasTarget: boolean }> = [];
        for (const day of fullTemplate.days) {
          for (const slot of day.slots) {
            if (!slot.exercise_id && !slot.custom_exercise_id) continue;

            // Use slot overrides if available, else use profile defaults
            const slotExperience = slot.experience || effectiveExperience;
            const slotContext: TargetSelectionContext = {
              experience: slotExperience,
            };

            const target = await selectExerciseTargets(
              {
                exerciseId: slot.exercise_id || undefined,
                customExerciseId: slot.custom_exercise_id || undefined,
              },
              userId,
              slotContext,
              0 // historyCount = 0 for now (can be enhanced later)
            );

            if (target) {
              targetsMap.set(slot.id, target);
              slotsWithPrescriptions++;
              slotDetails.push({
                slotId: slot.id,
                exerciseId: slot.exercise_id,
                customExerciseId: slot.custom_exercise_id,
                hasTarget: true,
              });
            } else {
              slotsWithoutPrescriptions++;
              slotDetails.push({
                slotId: slot.id,
                exerciseId: slot.exercise_id,
                customExerciseId: slot.custom_exercise_id,
                hasTarget: false,
              });
              if (__DEV__) {
                devError('planner', new Error('No prescription found for exercise'), {
                  exerciseId: slot.exercise_id,
                  customExerciseId: slot.custom_exercise_id,
                  slotId: slot.id,
                });
              }
            }
          }
        }

        setSlotTargets(targetsMap);

        if (__DEV__) {
          devLog('planner', {
            action: 'calculateTargetsForSlots_result',
            slotsWithPrescriptions,
            slotsWithoutPrescriptions,
            totalSlots: slotsWithPrescriptions + slotsWithoutPrescriptions,
            slotDetails,
          });
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'calculateTargetsForSlots' });
        }
      } finally {
        setIsLoadingTargets(false);
      }
    },
    [profile]
  );

  // Load today's session exercises. Uses functional state updates so callback stays stable and doesn't retrigger focus/day effects.
  const loadTodaySessionExercises = useCallback(
    async (userId: string) => {
      if (loadTodaySessionInFlightRef.current) return;
      loadTodaySessionInFlightRef.current = true;
      if (__DEV__) {
        devLog('planner', { action: 'loadTodaySessionExercises', userId });
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: session } = await supabase
          .from('v2_workout_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .gte('started_at', `${today}T00:00:00Z`)
          .lt('started_at', `${today}T23:59:59Z`)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          const { data: sessionExercises } = await supabase
            .from('v2_session_exercises')
            .select('id, exercise_id, custom_exercise_id, sort_order')
            .eq('session_id', session.id)
            .order('sort_order', { ascending: true });

          setTodaySessionExercises(sessionExercises || []);

          if (sessionExercises && sessionExercises.length > 0) {
            const effectiveExperience = profile?.experience_level || 'beginner';
            const namesToAdd = new Map<string, string>();
            const targetsToAdd = new Map<string, ExerciseTarget>();

            for (const se of sessionExercises) {
              const exerciseId = se.exercise_id || se.custom_exercise_id;
              if (!exerciseId) continue;

              const exercise = await getMergedExercise(
                se.exercise_id ? { exerciseId: se.exercise_id } : { customExerciseId: se.custom_exercise_id! },
                userId
              );
              if (exercise) {
                namesToAdd.set(exerciseId, exercise.name);
              }

              const target = await selectExerciseTargets(
                {
                  exerciseId: se.exercise_id || undefined,
                  customExerciseId: se.custom_exercise_id || undefined,
                },
                userId,
                { experience: effectiveExperience },
                0
              );
              if (target) {
                targetsToAdd.set(exerciseId, target);
              }
            }

            setExerciseNames((prev) => {
              const next = new Map(prev);
              namesToAdd.forEach((v, k) => next.set(k, v));
              return next;
            });
            setSlotTargets((prev) => {
              const next = new Map(prev);
              targetsToAdd.forEach((v, k) => next.set(k, v));
              return next;
            });
          }
        } else {
          setTodaySessionExercises([]);
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'loadTodaySessionExercises' });
        }
      } finally {
        loadTodaySessionInFlightRef.current = false;
      }
    },
    [profile]
  );

  // Load template data
  const loadTemplate = useCallback(
    async (templateId: string) => {
      if (loadTemplateInFlightRef.current) return;
      loadTemplateInFlightRef.current = true;
      if (__DEV__) {
        devLog('planner', { action: 'loadTemplate', templateId });
      }

      setIsLoadingTemplate(true);
      try {
        // Ensure all 7 weekdays exist (invalidates cache so next fetch is fresh)
        await ensureTemplateHasWeekDays(templateId);
        invalidateTemplate(templateId);

        const fullTemplate = await getTemplateWithDaysAndSlotsCached(templateId);
        if (fullTemplate) {
          setTemplateData(fullTemplate);
          setActiveTemplateId(templateId);

          // Default selection to today's weekday (only on first load)
          if (!hasInitializedSelection) {
            const todayDayName = getTodayDayName();
            const todayIndex = fullTemplate.days.findIndex((d) => d.day.day_name === todayDayName);
            if (todayIndex >= 0) {
              setSelectedDayIndex(todayIndex);
            }
            setHasInitializedSelection(true);
          }

          // Fetch exercise names for all slots
          const userId = await getCurrentUserId();
          if (userId) {
            const exerciseIds = new Set<string>();
            fullTemplate.days.forEach((day) => {
              day.slots.forEach((slot) => {
                if (slot.exercise_id) {
                  exerciseIds.add(slot.exercise_id);
                } else if (slot.custom_exercise_id) {
                  exerciseIds.add(slot.custom_exercise_id);
                }
              });
            });

            if (exerciseIds.size > 0) {
              if (__DEV__) {
                devLog('planner', {
                  action: 'loadTemplate_fetchNames',
                  exerciseIds: Array.from(exerciseIds),
                  count: exerciseIds.size,
                });
              }
              const exercises = await listMergedExercisesCached(userId, Array.from(exerciseIds));
              const nameMap = new Map<string, string>();
              exercises.forEach((ex) => {
                nameMap.set(ex.id, ex.name);
              });
              if (__DEV__) {
                devLog('planner', {
                  action: 'loadTemplate_namesLoaded',
                  namesCount: nameMap.size,
                  names: Array.from(nameMap.entries()).map(([id, name]) => ({ id, name })),
                });
              }
              setExerciseNames(nameMap);

              // Calculate targets for all slots
              await calculateTargetsForSlots(fullTemplate, userId);
            } else {
              if (__DEV__) devLog('planner', { action: 'loadTemplate_noExerciseIds' });
            }

            // Load today's session exercises (don't fail template load if this errors)
            try {
              await loadTodaySessionExercises(userId);
            } catch (sessionErr) {
              if (__DEV__) devError('planner', sessionErr, { action: 'loadTodaySessionExercises_inLoadTemplate' });
            }
          }
        } else {
          toast.error('Failed to load template');
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { templateId });
        }
        toast.error('Failed to load template');
      } finally {
        setIsLoadingTemplate(false);
        loadTemplateInFlightRef.current = false;
      }
    },
    [toast, getCurrentUserId, calculateTargetsForSlots, hasInitializedSelection, loadTodaySessionExercises]
  );

  // Initialize: load or create template
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const userId = await getCurrentUserId();
      if (!userId) {
        if (__DEV__) devLog('planner', { action: 'init_skipped', missing: ['userId'] });
        if (isMounted) {
          setIsLoadingTemplate(false);
          toast.error('Please log in to use the planner');
        }
        return;
      }

      try {
        // Get user templates
        const templates = await getUserTemplatesCached(userId);

        if (templates.length === 0) {
          // Create default template
          if (__DEV__) {
            devLog('planner', { action: 'createDefaultTemplate', userId });
          }

          const newTemplate = await createTemplate(userId);
          if (newTemplate) invalidateTemplates(userId);
          if (!newTemplate) {
            if (isMounted) {
              toast.error('Failed to create template');
              setIsLoadingTemplate(false);
            }
            return;
          }

          // Ensure all 7 weekdays exist (Sunday-Saturday)
          await ensureTemplateHasWeekDays(newTemplate.id);

          if (isMounted) {
            await loadTemplate(newTemplate.id);
          }
        } else {
          // Load first active template
          if (isMounted) {
            await loadTemplate(templates[0].id);
          }
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'initialize' });
        }
        if (isMounted) {
          toast.error('Failed to initialize planner');
          setIsLoadingTemplate(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Get selected day and date context (Today vs Future) — declared before useFocusEffect so it can be used there
  const selectedDay = templateData?.days[selectedDayIndex] || null;

  // Refetch when needed: flag set (e.g. after add/remove in add-exercise-edit), or templateData lost (e.g. back from workout). Throttle recovery to avoid infinite retry when load fails.
  useFocusEffect(
    useCallback(() => {
      if (plannerNeedsRefetch) {
        setPlannerNeedsRefetch(false);
        if (activeTemplateId) {
          loadTemplate(activeTemplateId);
        } else {
          // Refetch requested but we don't have activeTemplateId (e.g. tab remounted after add/remove) — run recovery to load first template
          const now = Date.now();
          if (now - lastRecoveryAttemptRef.current >= RECOVERY_THROTTLE_MS) {
            lastRecoveryAttemptRef.current = now;
            setIsLoadingTemplate(true);
            getCurrentUserId().then((userId) => {
              if (!userId) {
                setIsLoadingTemplate(false);
                return;
              }
              getUserTemplatesCached(userId).then((templates) => {
                if (templates.length > 0) loadTemplate(templates[0].id);
                else setIsLoadingTemplate(false);
              }).catch(() => setIsLoadingTemplate(false));
            });
          }
        }
        return;
      }

      // Recover when templateData is null — only once per focus and throttled
      const now = Date.now();
      const mayRecover =
        !templateData &&
        !isLoadingTemplate &&
        !loadTemplateInFlightRef.current &&
        !recoveryAttemptedThisFocusRef.current &&
        now - lastRecoveryAttemptRef.current >= RECOVERY_THROTTLE_MS;

      if (mayRecover) {
        recoveryAttemptedThisFocusRef.current = true;
        lastRecoveryAttemptRef.current = now;
        setIsLoadingTemplate(true);
        getCurrentUserId().then((userId) => {
          if (!userId) {
            setIsLoadingTemplate(false);
            return;
          }
          getUserTemplatesCached(userId).then((templates) => {
            if (templates.length > 0) loadTemplate(templates[0].id);
            else setIsLoadingTemplate(false);
          }).catch(() => setIsLoadingTemplate(false));
        });
      } else if (selectedDay?.day.day_name === getTodayDayName()) {
        getCurrentUserId().then((id) => {
          if (id) loadTodaySessionExercises(id);
        });
      }

      return () => {
        recoveryAttemptedThisFocusRef.current = false;
      };
    }, [plannerNeedsRefetch, activeTemplateId, loadTemplate, setPlannerNeedsRefetch, selectedDay?.day.day_name, loadTodaySessionExercises, getCurrentUserId, templateData, isLoadingTemplate])
  );
  const dateContext = useDateContext(selectedDay?.day.day_name);

  // When switching to today tab: show cached Today Only list immediately, refresh in background.
  // Do not clear todaySessionExercises when switching away — keeps cache so returning to today has no lag (like Routine).
  useEffect(() => {
    if (selectedDay && selectedDay.day.day_name === getTodayDayName()) {
      const userId = getCurrentUserId();
      userId.then((id) => {
        if (id) loadTodaySessionExercises(id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayIndex]); // Only reload when day index changes, not on function recreation

  // Save "Today Only" exercise to template (promote to routine)
  const handleSaveToRoutine = useCallback(
    async (dayId: string, exerciseId: string | undefined, customExerciseId: string | undefined) => {
      const missing: string[] = [];
      if (!activeTemplateId) missing.push('activeTemplateId');
      if (!exerciseId && !customExerciseId) missing.push('exerciseId or customExerciseId');
      if (missing.length > 0) {
        if (__DEV__) devLog('planner', { action: 'saveToRoutine_skipped', missing });
        toast.error('Cannot save to routine');
        return;
      }
      setIsSaving(true);
      try {
        invalidateTemplate(activeTemplateId);
        const dayData = templateData?.days.find((d) => d.day.id === dayId);
        const sortOrder = (dayData?.slots.length ?? 0) + 1;
        const success = await applyStructureEditToTemplate(activeTemplateId, {
          type: 'addSlot',
          dayId,
          exerciseId: exerciseId || undefined,
          customExerciseId: customExerciseId || undefined,
          sortOrder,
        });
        if (success) {
          await loadTemplate(activeTemplateId);
          const userId = await getCurrentUserId();
          if (userId) loadTodaySessionExercises(userId);
          toast.success('Added to routine for this day');
        } else {
          toast.error('Failed to add to routine');
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'handleSaveToRoutine', dayId });
        }
        toast.error('Failed to add to routine');
      } finally {
        setIsSaving(false);
      }
    },
    [activeTemplateId, templateData, loadTemplate, loadTodaySessionExercises, getCurrentUserId, toast]
  );

  // Handle removing slot (template structure only)
  const handleRemoveSlot = useCallback(
    async (slotId: string) => {
      if (__DEV__) {
        devLog('planner', { action: 'handleRemoveSlot', slotId });
      }

      if (!activeTemplateId) {
        if (__DEV__) devLog('planner', { action: 'removeSlot_skipped', missing: ['activeTemplateId'] });
        toast.error('No active template');
        return;
      }

      setIsSaving(true);
      try {
        const success = await applyStructureEditToTemplate(activeTemplateId, {
          type: 'removeSlot',
          slotId,
        });

        if (success) {
          invalidateTemplate(activeTemplateId);
          await loadTemplate(activeTemplateId);
          toast.success('Exercise removed from plan');
        } else {
          toast.error('Failed to remove exercise');
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'handleRemoveSlot_apply', slotId });
        }
        toast.error('Failed to remove exercise');
      } finally {
        setIsSaving(false);
      }
    },
    [activeTemplateId, loadTemplate, toast]
  );

  // Render empty state
  if (isLoadingTemplate) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Plan" tabId="plan" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading planner...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!templateData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Plan" tabId="plan" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No template found</Text>
          <Text style={styles.emptySubtitle}>
            Please try refreshing or contact support
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Plan" tabId="plan" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: layout.tabBarHeight + insets.bottom + spacing.lg },
        ]}
      >
        {/* Day selector - always show all 7 days in fixed order */}
        <View style={styles.daySelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {WEEK_DAYS.map((weekday, index) => {
              // Find corresponding template_day record (should always exist after ensureTemplateHasWeekDays)
              const dayData = templateData.days.find((d) => d.day.day_name === weekday);
              const isSelected = selectedDay?.day.day_name === weekday;

              return (
                <TouchableOpacity
                  key={dayData?.day.id || weekday}
                  style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                  onPress={() => {
                    // Find index of this day in templateData.days array
                    const dayIndex = templateData.days.findIndex((d) => d.day.day_name === weekday);
                    if (dayIndex >= 0) {
                      setSelectedDayIndex(dayIndex);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      isSelected && styles.dayButtonTextSelected,
                    ]}
                  >
                    {weekday}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected day content */}
        {selectedDay ? (
          <View style={styles.dayContent}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{selectedDay.day.day_name}</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  if (!activeTemplateId || !selectedDay) return;
                  router.push({
                    pathname: '/add-exercise',
                    params: {
                      dayId: selectedDay.day.id,
                      templateId: activeTemplateId,
                      dayName: selectedDay.day.day_name,
                    },
                  });
                }}
                disabled={isSaving}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Exercise</Text>
              </TouchableOpacity>
            </View>

            {/* Slots list */}
            {selectedDay.slots.length === 0 && todaySessionExercises.length === 0 ? (
              <View style={styles.emptySlotsContainer}>
                <Text style={styles.emptySlotsText}>
                  No exercises scheduled for this day
                </Text>
                <Text style={styles.emptySlotsSubtext}>
                  Tap "Add Exercise" to get started
                </Text>
              </View>
            ) : (
              <View style={styles.slotsList}>
                {/* Show only "Today Only" session exercises (not in template) to avoid duplicate cards */}
                {dateContext.isToday && (() => {
                  const templateSlotKeys = new Set(
                    selectedDay.slots.map((s) => s.exercise_id || s.custom_exercise_id).filter(Boolean)
                  );
                  const todayOnlySessionExercises = todaySessionExercises.filter((se) => {
                    const key = se.exercise_id || se.custom_exercise_id;
                    return key && !templateSlotKeys.has(key);
                  });
                  return todayOnlySessionExercises.map((sessionExercise) => {
                    const exerciseId = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
                    const exerciseName = exerciseId ? exerciseNames.get(exerciseId) || 'Loading...' : 'Unknown';
                    const target = exerciseId ? slotTargets.get(exerciseId) : null;
                    const targetText = target
                      ? target.mode === 'reps'
                        ? `${target.sets} sets × ${target.reps} reps`
                        : `${target.sets} sets × ${Math.floor((target.duration_sec || 0) / 60)} min`
                      : 'Loading targets...';
                    const isTodayOnly = exerciseId ? !templateSlotKeys.has(exerciseId) : true;

                    return (
                      <View key={`session-${sessionExercise.id}`} style={styles.slotCard}>
                        <View style={styles.slotContent}>
                          <Text style={styles.slotExerciseName}>{exerciseName}</Text>
                          <View style={styles.todayBadgeRow}>
                            {isTodayOnly && (
                              <View style={styles.todayBadge}>
                                <Text style={styles.todayBadgeText}>Today Only</Text>
                              </View>
                            )}
                            <Text style={styles.slotTargets}>
                              {targetText}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.sessionCardActions}>
                          {isTodayOnly && (
                            <TouchableOpacity
                              style={[styles.deleteButton, styles.saveToRoutineButton]}
                              onPress={() =>
                                handleSaveToRoutine(
                                  selectedDay.day.id,
                                  sessionExercise.exercise_id || undefined,
                                  sessionExercise.custom_exercise_id || undefined
                                )
                              }
                              disabled={isSaving}
                            >
                              <Text style={styles.saveToRoutineButtonText}>Save to Routine</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.deleteButton, styles.editButton]}
                            onPress={() => {
                              setEditingSessionExercise({
                                id: sessionExercise.id,
                                name: exerciseName,
                                mode: target?.mode || 'reps',
                              });
                              setShowSessionEditSheet(true);
                            }}
                            disabled={isSaving}
                          >
                            <Text style={[styles.deleteButtonText, styles.editButtonText]}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  });
                })()}

                {/* Show template slots */}
                {selectedDay.slots.map((slot) => {
                  const exerciseName = slot.exercise_id
                    ? exerciseNames.get(slot.exercise_id) || 'Loading...'
                    : 'Empty slot';
                  const target = slotTargets.get(slot.id);
                  const hasPrescription = !!target;
                  const targetText = target
                    ? target.mode === 'reps'
                      ? `${target.sets} sets × ${target.reps} reps`
                      : `${target.sets} sets × ${Math.floor((target.duration_sec || 0) / 60)} min`
                    : 'Set in workout';

                  return (
                    <View key={slot.id} style={styles.slotCard}>
                      <View style={styles.slotContent}>
                        <Text style={styles.slotExerciseName}>{exerciseName}</Text>
                        <Text
                          style={[
                            styles.slotTargets,
                            !hasPrescription && styles.slotTargetsMissing,
                          ]}
                        >
                          {targetText}
                        </Text>
                      </View>
                      {(slot.exercise_id || slot.custom_exercise_id) && (
                        <TouchableOpacity
                          style={[styles.deleteButton, styles.editButton]}
                          onPress={() => {
                            router.push({
                              pathname: '/add-exercise-edit',
                              params: {
                                dayId: selectedDay.day.id,
                                templateId: activeTemplateId ?? '',
                                dayName: selectedDay.day.day_name,
                                exerciseId: slot.exercise_id || '',
                                customExerciseId: slot.custom_exercise_id || '',
                                exerciseName: exerciseName,
                                isTimed: target?.mode === 'timed' ? '1' : '0',
                                editSlotId: slot.id,
                              },
                            });
                          }}
                          disabled={isSaving}
                        >
                          <Text style={[styles.deleteButtonText, styles.editButtonText]}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Copy last week button */}
            <TouchableOpacity
              style={[styles.copyLastWeekButton, isSaving && styles.copyLastWeekButtonDisabled]}
              onPress={async () => {
                if (!activeTemplateId) {
                  if (__DEV__) devLog('planner', { action: 'copyLastWeek_skipped', missing: ['activeTemplateId'] });
                  toast.error('No active template');
                  return;
                }

                setIsSaving(true);
                try {
                  const userId = await getCurrentUserId();
                  if (!userId) {
                    if (__DEV__) devLog('planner', { action: 'copyLastWeek_skipped', missing: ['userId'] });
                    toast.error('User not found');
                    return;
                  }

                  // Get last 7 days structure
                  const structure = await getLast7DaysSessionStructure(userId);
                  if (structure.length === 0) {
                    toast.error('No completed sessions found in last 7 days');
                    return;
                  }

                  // Apply structure to template
                  const success = await applySessionStructureToTemplate(
                    userId,
                    activeTemplateId,
                    structure
                  );

                  if (success) {
                    invalidateTemplate(activeTemplateId);
                    await loadTemplate(activeTemplateId);
                    toast.success('Copied last week\'s structure to template');
                  } else {
                    toast.error('Failed to copy structure');
                  }
                } catch (error) {
                  if (__DEV__) {
                    devError('planner', error, { action: 'copyLastWeek' });
                  }
                  toast.error('Failed to copy structure');
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
            >
              <Text style={styles.copyLastWeekButtonText}>Copy last week</Text>
            </TouchableOpacity>

            {/* Generate with AI button */}
            <TouchableOpacity
              style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
              onPress={async () => {
                const missing: string[] = [];
                if (!templateData) missing.push('templateData');
                if (!activeTemplateId) missing.push('activeTemplateId');
                if (missing.length > 0) {
                  if (__DEV__) devLog('planner', { action: 'generateWeek_skipped', missing });
                  toast.error('No template loaded');
                  return;
                }

                if (__DEV__) {
                  devLog('planner-ai', {
                    action: 'generateWeek',
                    templateId: activeTemplateId,
                    dayCount: templateData.days.length,
                  });
                }

                setIsGenerating(true);
                try {
                  const userId = await getCurrentUserId();
                  if (!userId) {
                    if (__DEV__) devLog('planner', { action: 'generateWeek_skipped', missing: ['userId'] });
                    toast.error('Please log in');
                    return;
                  }

                  // Get AI recommended exercises
                  const exerciseIds = await generateWeekForTemplate(templateData, userId, profile);
                  if (exerciseIds.length === 0) {
                    toast.error('No exercises available for AI generation');
                    return;
                  }

                  // Distribute exercises across days (simple round-robin)
                  const slotsBefore = templateData.days.reduce(
                    (sum, day) => sum + day.slots.length,
                    0
                  );

                  let exerciseIndex = 0;
                  for (const day of templateData.days) {
                    // Add 2-3 exercises per day
                    const exercisesPerDay = 2 + (exerciseIndex % 2); // Alternate 2 and 3
                    for (let i = 0; i < exercisesPerDay && exerciseIndex < exerciseIds.length; i++) {
                      const exerciseId = exerciseIds[exerciseIndex];
                      const sortOrder = day.slots.length + i + 1;

                      const newSlot = await createTemplateSlot(day.day.id, {
                        exerciseId,
                        experience: null,
                        notes: null,
                        sortOrder,
                      });

                      if (newSlot) {
                        // Fetch exercise name
                        const mergedExercise = await getMergedExercise({ exerciseId }, userId);
                        if (mergedExercise) {
                          setExerciseNames((prev) => {
                            const next = new Map(prev);
                            next.set(exerciseId, mergedExercise.name);
                            return next;
                          });
                        }

                        // Update local state
                        setTemplateData((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            days: prev.days.map((d) =>
                              d.day.id === day.day.id
                                ? { ...d, slots: [...d.slots, newSlot] }
                                : d
                            ),
                          };
                        });
                      }

                      exerciseIndex++;
                    }
                  }

                  invalidateTemplate(activeTemplateId);

                  // Recalculate targets
                  if (templateData) {
                    await calculateTargetsForSlots(templateData, userId);
                  }

                  const slotsAfter = templateData.days.reduce(
                    (sum, day) => sum + day.slots.length,
                    0
                  );

                  if (__DEV__) {
                    devLog('planner-ai', {
                      action: 'generateWeek_result',
                      templateId: activeTemplateId,
                      slotCountBefore: slotsBefore,
                      slotCountAfter: slotsAfter,
                      exercisesAdded: slotsAfter - slotsBefore,
                    });
                  }

                  toast.success('Week generated with AI');
                } catch (error) {
                  if (__DEV__) {
                    devError('planner-ai', error, {
                      action: 'generateWeek',
                      templateId: activeTemplateId,
                    });
                  }
                  toast.error('Failed to generate week');
                } finally {
                  setIsGenerating(false);
                }
              }}
              disabled={isGenerating}
            >
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Generating...' : 'Generate with AI'}
              </Text>
            </TouchableOpacity>

          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No days configured</Text>
            <Text style={styles.emptySubtitle}>
              Please add training days to your template
            </Text>
          </View>
        )}
      </ScrollView>

      {editingSessionExercise && (
        <SessionExerciseEditSheet
          visible={showSessionEditSheet}
          onClose={() => {
            setShowSessionEditSheet(false);
            setEditingSessionExercise(null);
          }}
          onSave={async () => {
            toast.success('Defaults saved');
            const userId = await getCurrentUserId();
            if (userId) {
              await loadTodaySessionExercises(userId);
            }
          }}
          onDelete={async () => {
            if (!editingSessionExercise) return;

            if (__DEV__) {
              devLog('planner', { 
                action: 'removeSessionExercise', 
                sessionExerciseId: editingSessionExercise.id 
              });
            }

            setIsSaving(true);
            try {
              const { error } = await supabase
                .from('v2_session_exercises')
                .delete()
                .eq('id', editingSessionExercise.id);

              if (error) {
                toast.error('Failed to remove exercise');
                if (__DEV__) {
                  devError('planner', error, { sessionExerciseId: editingSessionExercise.id });
                }
              } else {
                toast.success('Exercise removed from today\'s session');
                const userId = await getCurrentUserId();
                if (userId) {
                  await loadTodaySessionExercises(userId);
                }
              }
            } catch (error) {
              toast.error('Failed to remove exercise');
              if (__DEV__) {
                devError('planner', error, { action: 'removeSessionExercise' });
              }
            } finally {
              setIsSaving(false);
            }
          }}
          sessionExerciseId={editingSessionExercise.id}
          exerciseName={editingSessionExercise.name}
          mode={editingSessionExercise.mode}
          useImperial={profile?.use_imperial ?? true}
        />
      )}


      <SmartAdjustPrompt
        visible={showSmartAdjustPrompt}
        reasons={rebalanceResult?.reasons || []}
        onContinue={async () => {
          setShowSmartAdjustPrompt(false);
          setRebalanceResult(null);
          // Continue with workout creation
          const missingContinue: string[] = [];
          if (!activeTemplateId) missingContinue.push('activeTemplateId');
          if (!selectedDay) missingContinue.push('selectedDay');
          if (missingContinue.length > 0) {
            if (__DEV__) devLog('planner', { action: 'SmartAdjust_continue_skipped', missing: missingContinue });
            toast.error('No template or day selected');
            return;
          }

          setIsSaving(true);
          try {
            const userId = await getCurrentUserId();
            if (!userId) {
              if (__DEV__) devLog('planner', { action: 'SmartAdjust_continue_skipped', missing: ['userId'] });
              toast.error('Please log in');
              return;
            }

            const session = await createWorkoutSession(
              userId,
              activeTemplateId,
              selectedDay.day.day_name
            );

            if (!session) {
              toast.error('Failed to start workout');
              return;
            }

            // Create session exercises and prefill sets using prescription/history-based targets
            const sessionExercises: Array<{ id: string; exercise_id?: string; custom_exercise_id?: string }> = [];
            const targetsMap = new Map<string, {
              sets: number;
              reps?: number;
              duration_sec?: number;
              weight?: number;
            }>();

            for (const slot of selectedDay.slots) {
              const exerciseId = slot.exercise_id || slot.custom_exercise_id;
              if (!exerciseId) continue;

              const { data: sessionExercise, error: exerciseError } = await supabase
                .from('v2_session_exercises')
                .insert({
                  session_id: session.id,
                  exercise_id: slot.exercise_id || null,
                  custom_exercise_id: slot.custom_exercise_id || null,
                  sort_order: slot.sort_order,
                })
                .select()
                .single();

              if (exerciseError || !sessionExercise) {
                if (__DEV__) {
                  devError('planner', exerciseError || new Error('Failed to create session exercise'), {
                    sessionId: session.id,
                    slotId: slot.id,
                  });
                }
                continue;
              }

              sessionExercises.push(sessionExercise);

              // Always use prescription/history-based targets
              const effectiveExperience = profile?.experience_level || 'beginner';
              const context: TargetSelectionContext = {
                experience: slot.experience || effectiveExperience,
              };

              const target = await selectExerciseTargets(
                {
                  exerciseId: slot.exercise_id || undefined,
                  customExerciseId: slot.custom_exercise_id || undefined,
                },
                userId,
                context,
                0
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

            if (sessionExercises.length > 0 && targetsMap.size > 0) {
              await prefillSessionSets(session.id, sessionExercises, targetsMap);
            }

            toast.success('Workout started');
            router.push('/workout/active');
          } catch (error) {
            if (__DEV__) {
              devError('planner', error, { action: 'startWorkout_continue' });
            }
            toast.error('Failed to start workout');
          } finally {
            setIsSaving(false);
          }
        }}
        onSmartAdjust={async () => {
          setShowSmartAdjustPrompt(false);
          setIsSaving(true);

          try {
            const userId = await getCurrentUserId();
            if (!userId || !activeTemplateId || !selectedDay) {
              const missing: string[] = [];
              if (!userId) missing.push('userId');
              if (!activeTemplateId) missing.push('activeTemplateId');
              if (!selectedDay) missing.push('selectedDay');
              if (__DEV__) devLog('planner', { action: 'SmartAdjust_skipped', missing });
              toast.error('Missing required data');
              return;
            }

            // Get rebalance exercises
            const { getRebalanceExercises } = await import('../../src/lib/engine/rebalance');
            const rebalanceExerciseIds = await getRebalanceExercises(
              rebalanceResult?.missedMuscles || [],
              userId
            );

            if (rebalanceExerciseIds.length === 0) {
              toast.error('No suitable catch-up exercises found');
              return;
            }

            // Create the workout session
            const session = await createWorkoutSession(
              userId,
              activeTemplateId,
              selectedDay.day.day_name
            );

            if (!session) {
              toast.error('Failed to create workout session');
              return;
            }

            // Get existing exercises from the template day
            const selectedExerciseRefs = selectedDay.slots.map((slot) => ({
              exerciseId: slot.exercise_id || undefined,
              customExerciseId: slot.custom_exercise_id || undefined,
              notes: slot.notes || undefined,
            }));

            // Add rebalance exercises at the START (sort_order = -1, -2, -3)
            const rebalanceExerciseRefs = rebalanceExerciseIds.map((id, index) => ({
              exerciseId: id,
              customExerciseId: undefined,
              notes: '🎯 Catch-up exercise (Smart Adjust)',
              sortOrder: -(index + 1), // -1, -2, -3 to appear first
            }));

            // Combine: rebalance exercises first, then original exercises
            const allExerciseRefs = [
              ...rebalanceExerciseRefs.map(ref => ({
                exerciseId: ref.exerciseId,
                customExerciseId: ref.customExerciseId,
                notes: ref.notes,
              })),
              ...selectedExerciseRefs,
            ];

            // Create session exercises
            const sessionExercisePromises = allExerciseRefs.map((ref, index) => {
              const isRebalance = index < rebalanceExerciseIds.length;
              return supabase
                .from('v2_session_exercises')
                .insert({
                  session_id: session.id,
                  exercise_id: ref.exerciseId || null,
                  custom_exercise_id: ref.customExerciseId || null,
                  sort_order: isRebalance ? -(rebalanceExerciseIds.length - index) : index,
                })
                .select()
                .single();
            });

            const sessionExerciseResults = await Promise.all(sessionExercisePromises);
            const sessionExercises = sessionExerciseResults
              .filter((r) => !r.error && r.data)
              .map((r) => r.data!);

            if (sessionExercises.length === 0) {
              toast.error('Failed to create session exercises');
              return;
            }

            // Prefill sets for all exercises (including rebalance exercises)
            const { selectExerciseTargets } = await import('../../src/lib/engine/targetSelection');
            const targets = new Map<string, any>();

            for (const se of sessionExercises) {
              const ref = {
                exerciseId: se.exercise_id || undefined,
                customExerciseId: se.custom_exercise_id || undefined,
              };
              const exerciseKey = ref.exerciseId || ref.customExerciseId;
              if (!exerciseKey) continue;

              const target = await selectExerciseTargets(ref, userId, {
                experience: profile?.experience_level || 'beginner',
              });

              if (target) {
                targets.set(exerciseKey, target);
              }
            }

            const prefillSuccess = await prefillSessionSets(session.id, sessionExercises, targets);
            if (!prefillSuccess) {
              if (__DEV__) {
                devLog('planner', {
                  action: 'prefillSessionSets',
                  success: false,
                  message: 'Prefill failed but continuing',
                });
              }
            }

            toast.success(`Added ${rebalanceExerciseIds.length} catch-up exercise${rebalanceExerciseIds.length > 1 ? 's' : ''}`);
            router.push('/(stack)/workout/active');
          } catch (error) {
            if (__DEV__) {
              devError('planner', error, {
                action: 'smartAdjust',
                missedMuscles: rebalanceResult?.missedMuscles || [],
              });
            }
            toast.error('Failed to apply smart adjust');
          } finally {
            setIsSaving(false);
            setRebalanceResult(null);
          }
          setRebalanceResult(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  daySelector: {
    marginBottom: spacing.sm,
  },
  dayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  dayButtonTextSelected: {
    color: colors.background,
    fontWeight: typography.weights.semibold,
  },
  dayContent: {
    gap: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  copyLastWeekButton: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  copyLastWeekButtonDisabled: {
    opacity: 0.5,
  },
  copyLastWeekButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  emptySlotsContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptySlotsText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySlotsSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  slotsList: {
    gap: spacing.sm,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
  },
  slotContent: {
    flex: 1,
    gap: spacing.xs,
  },
  todayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  todayBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  deleteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorBg,
  },
  deleteButtonText: {
    color: colors.errorText,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  sessionCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveToRoutineButton: {
    backgroundColor: colors.primary + '20',
  },
  saveToRoutineButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: colors.primary + '20',
  },
  editButtonText: {
    color: colors.primary,
  },
  slotExerciseName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  slotTargets: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  slotTargetsMissing: {
    color: colors.errorText,
    fontStyle: 'italic',
  },
  generateButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
