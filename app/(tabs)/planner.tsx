/**
 * Plan tab
 * Weekly workout planner with template management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Play } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { useToast } from '../../src/hooks/useToast';
import { useExercisePicker } from '../../src/hooks/useExercisePicker';
import { useUserStore } from '../../src/stores/userStore';
import { supabase } from '../../src/lib/supabase/client';
import {
  getUserTemplates,
  getTemplateWithDaysAndSlots,
  createTemplate,
  upsertTemplateDay,
  createTemplateSlot,
  updateTemplateSlot,
  deleteTemplateSlot,
  type FullTemplate,
  type TemplateSlot,
  type TemplateDay,
} from '../../src/lib/supabase/queries/templates';
import { getMergedExercise, listMergedExercises } from '../../src/lib/supabase/queries/exercises';
import {
  selectExerciseTargets,
  type ExerciseTarget,
  type TargetSelectionContext,
} from '../../src/lib/engine/targetSelection';
import { createWorkoutSession } from '../../src/lib/supabase/queries/workouts';
import { devLog, devError } from '../../src/lib/utils/logger';
import type { Exercise } from '../../src/stores/exerciseStore';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const SHORT_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PlannerTab() {
  const router = useRouter();
  const toast = useToast();
  const picker = useExercisePicker();
  const { profile } = useUserStore();

  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<FullTemplate | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());
  const [slotTargets, setSlotTargets] = useState<Map<string, ExerciseTarget>>(new Map());
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);

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

  // Load template data
  const loadTemplate = useCallback(
    async (templateId: string) => {
      if (__DEV__) {
        devLog('planner', { action: 'loadTemplate', templateId });
      }

      setIsLoadingTemplate(true);
      try {
        const fullTemplate = await getTemplateWithDaysAndSlots(templateId);
        if (fullTemplate) {
          setTemplateData(fullTemplate);
          setActiveTemplateId(templateId);

          // Fetch exercise names for all slots
          const userId = await getCurrentUserId();
          if (userId) {
            const exerciseIds = new Set<string>();
            fullTemplate.days.forEach((day) => {
              day.slots.forEach((slot) => {
                if (slot.exercise_id) {
                  exerciseIds.add(slot.exercise_id);
                }
              });
            });

            if (exerciseIds.size > 0) {
              const exercises = await listMergedExercises(userId, Array.from(exerciseIds));
              const nameMap = new Map<string, string>();
              exercises.forEach((ex) => {
                nameMap.set(ex.id, ex.name);
              });
              setExerciseNames(nameMap);

              // Calculate targets for all slots
              await calculateTargetsForSlots(fullTemplate, userId);
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
      }
    },
    [toast, getCurrentUserId]
  );

  // Initialize: load or create template
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const userId = await getCurrentUserId();
      if (!userId) {
        if (isMounted) {
          setIsLoadingTemplate(false);
          toast.error('Please log in to use the planner');
        }
        return;
      }

      try {
        // Get user templates
        const templates = await getUserTemplates(userId);

        if (templates.length === 0) {
          // Create default template
          if (__DEV__) {
            devLog('planner', { action: 'createDefaultTemplate', userId });
          }

          const newTemplate = await createTemplate(userId);
          if (!newTemplate) {
            if (isMounted) {
              toast.error('Failed to create template');
              setIsLoadingTemplate(false);
            }
            return;
          }

          // Create default days based on profile or safe default
          const workoutDays = profile?.workout_days || ['Monday', 'Wednesday', 'Friday'];
          const daysToCreate = workoutDays.length > 0 ? workoutDays : ['Monday', 'Wednesday', 'Friday'];

          for (let i = 0; i < daysToCreate.length; i++) {
            await upsertTemplateDay(newTemplate.id, daysToCreate[i], i);
          }

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
  }, [getCurrentUserId, loadTemplate, toast, profile]);

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
        const effectiveGoal = profile?.goal || 'strength';
        const effectiveExperience = profile?.experience_level || 'beginner';
        const context: TargetSelectionContext = {
          goal: effectiveGoal,
          experience: effectiveExperience,
        };

        const targetsMap = new Map<string, ExerciseTarget>();
        let slotsWithPrescriptions = 0;
        let slotsWithoutPrescriptions = 0;

        // Calculate targets for each slot
        for (const day of fullTemplate.days) {
          for (const slot of day.slots) {
            if (!slot.exercise_id) continue;

            // Use slot overrides if available, else use profile defaults
            const slotGoal = slot.goal || effectiveGoal;
            const slotExperience = slot.experience || effectiveExperience;
            const slotContext: TargetSelectionContext = {
              goal: slotGoal,
              experience: slotExperience,
            };

            const target = await selectExerciseTargets(
              slot.exercise_id,
              userId,
              slotContext,
              0 // historyCount = 0 for now (can be enhanced later)
            );

            if (target) {
              targetsMap.set(slot.id, target);
              slotsWithPrescriptions++;
            } else {
              slotsWithoutPrescriptions++;
              if (__DEV__) {
                devError(
                  'planner-targets',
                  new Error('Missing prescription'),
                  {
                    exerciseId: slot.exercise_id,
                    goal: slotContext.goal,
                    experience: slotContext.experience,
                  }
                );
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

  // Get selected day
  const selectedDay = templateData?.days[selectedDayIndex] || null;

  // Handle adding exercise to slot
  const handleAddExercise = useCallback(
    async (dayId: string) => {
      if (__DEV__) {
        devLog('planner', { action: 'handleAddExercise', dayId });
      }

      picker.open(async (exercise: Exercise) => {
        if (!templateData) return;

        setIsSaving(true);
        try {
          // Find the day
          const dayData = templateData.days.find((d) => d.day.id === dayId);
          if (!dayData) {
            toast.error('Day not found');
            return;
          }

          // Calculate sort order
          const sortOrder = dayData.slots.length + 1;

          // Create slot
          const newSlot = await createTemplateSlot(dayId, {
            exerciseId: exercise.id,
            goal: null,
            experience: null,
            notes: null,
            sortOrder,
          });

          if (!newSlot) {
            toast.error('Failed to add exercise');
            return;
          }

          // Fetch exercise name and calculate target
          const userId = await getCurrentUserId();
          if (userId && exercise.id) {
            const mergedExercise = await getMergedExercise(exercise.id, userId);
            if (mergedExercise) {
              setExerciseNames((prev) => {
                const next = new Map(prev);
                next.set(exercise.id, mergedExercise.name);
                return next;
              });

              // Calculate target for new slot
              const effectiveGoal = profile?.goal || 'strength';
              const effectiveExperience = profile?.experience_level || 'beginner';
              const context: TargetSelectionContext = {
                goal: newSlot.goal || effectiveGoal,
                experience: newSlot.experience || effectiveExperience,
              };

              const target = await selectExerciseTargets(
                exercise.id,
                userId,
                context,
                0
              );

              if (target) {
                setSlotTargets((prev) => {
                  const next = new Map(prev);
                  next.set(newSlot.id, target);
                  return next;
                });
              }
            }
          }

          // Optimistic update: add slot to local state
          setTemplateData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              days: prev.days.map((day) =>
                day.day.id === dayId
                  ? { ...day, slots: [...day.slots, newSlot] }
                  : day
              ),
            };
          });

          toast.success('Exercise added');
        } catch (error) {
          if (__DEV__) {
            devError('planner', error, { action: 'handleAddExercise', dayId });
          }
          toast.error('Failed to add exercise');
        } finally {
          setIsSaving(false);
        }
      });
    },
    [picker, templateData, toast, getCurrentUserId, profile]
  );

  // Handle removing slot
  const handleRemoveSlot = useCallback(
    async (slotId: string) => {
      if (__DEV__) {
        devLog('planner', { action: 'handleRemoveSlot', slotId });
      }

      setIsSaving(true);
      try {
        const success = await deleteTemplateSlot(slotId);
        if (!success) {
          toast.error('Failed to remove exercise');
          return;
        }

        // Optimistic update: remove slot from local state and targets
        setTemplateData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            days: prev.days.map((day) => ({
              ...day,
              slots: day.slots.filter((slot) => slot.id !== slotId),
            })),
          };
        });

        setSlotTargets((prev) => {
          const next = new Map(prev);
          next.delete(slotId);
          return next;
        });

        toast.success('Exercise removed');
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'handleRemoveSlot', slotId });
        }
        toast.error('Failed to remove exercise');
      } finally {
        setIsSaving(false);
      }
    },
    [toast]
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Day selector */}
        <View style={styles.daySelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {templateData.days.map((dayData, index) => {
              const isSelected = index === selectedDayIndex;
              return (
                <TouchableOpacity
                  key={dayData.day.id}
                  style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                  onPress={() => setSelectedDayIndex(index)}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      isSelected && styles.dayButtonTextSelected,
                    ]}
                  >
                    {dayData.day.day_name}
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
                onPress={() => handleAddExercise(selectedDay.day.id)}
                disabled={isSaving}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Exercise</Text>
              </TouchableOpacity>
            </View>

            {/* Slots list */}
            {selectedDay.slots.length === 0 ? (
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
                    : 'Missing targets';

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
                      {slot.exercise_id && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleRemoveSlot(slot.id)}
                          disabled={isSaving}
                        >
                          <Text style={styles.deleteButtonText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Generate with AI button */}
            <TouchableOpacity
              style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
              onPress={async () => {
                if (!templateData || !activeTemplateId) {
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
                        goal: null,
                        experience: null,
                        notes: null,
                        sortOrder,
                      });

                      if (newSlot) {
                        // Fetch exercise name
                        const mergedExercise = await getMergedExercise(exerciseId, userId);
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

            {/* Start workout button */}
            {selectedDay.slots.length > 0 && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={async () => {
                  if (!activeTemplateId || !selectedDay) {
                    toast.error('No template or day selected');
                    return;
                  }

                  if (__DEV__) {
                    devLog('planner', {
                      action: 'startWorkout',
                      templateId: activeTemplateId,
                      dayName: selectedDay.day.day_name,
                    });
                  }

                  setIsSaving(true);
                  try {
                    const userId = await getCurrentUserId();
                    if (!userId) {
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

                    // Navigate to active workout
                    toast.success('Workout started');
                    router.push('/workout-active');
                  } catch (error) {
                    if (__DEV__) {
                      devError('planner', error, {
                        action: 'startWorkout',
                        templateId: activeTemplateId,
                        dayName: selectedDay.day.day_name,
                      });
                    }
                    toast.error('Failed to start workout');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
              >
                <Play size={20} color={colors.background} />
                <Text style={styles.startButtonText}>Start this day</Text>
              </TouchableOpacity>
            )}
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
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  startButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
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
