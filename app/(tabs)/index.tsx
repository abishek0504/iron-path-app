/**
 * Workout tab - V2
 * Shows today's workout with pulsing start/continue button
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Dumbbell, Timer, RotateCcw } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { useToast } from '../../src/hooks/useToast';
import { useModal } from '../../src/hooks/useModal';
import { getActiveSession } from '../../src/lib/supabase/queries/workouts';
import { getTemplateWithDaysAndSlots } from '../../src/lib/supabase/queries/templates';
import { getUserTemplates } from '../../src/lib/supabase/queries/templates';
import { getMergedExercise } from '../../src/lib/supabase/queries/exercises';
import { devLog, devError } from '../../src/lib/utils/logger';
import type { TemplateSlot } from '../../src/lib/supabase/queries/templates';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getTodayDayName(): string {
  const dayIndex = new Date().getDay();
  return WEEK_DAYS[dayIndex];
}

// Circular Button with Ripple Effect Component
const CircularButton = ({
  onPress,
  disabled,
  text,
  isCompleted,
}: {
  onPress: () => void;
  disabled: boolean;
  text: string;
  isCompleted: boolean;
}) => {
  const ripple = useSharedValue(0);

  useEffect(() => {
    if (isCompleted || disabled) return;

    // Single ripple animation that repeats every 5 seconds
    const startRipple = () => {
      ripple.value = 0;
      ripple.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: 3000,
            easing: Easing.out(Easing.ease),
          }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    };

    startRipple();
    const interval = setInterval(startRipple, 5000); // Restart every 5 seconds

    return () => {
      clearInterval(interval);
      ripple.value = 0;
    };
  }, [isCompleted, disabled, ripple]);

  const rippleStyle = useAnimatedStyle(() => {
    const scale = interpolate(ripple.value, [0, 1], [1, 1.8]);
    const opacity = interpolate(ripple.value, [0, 0.5, 1], [0.6, 0.3, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={styles.circularButtonContainer}>
      {/* Ripple ring */}
      {!isCompleted && !disabled && (
        <Animated.View style={[styles.rippleRing, rippleStyle]} pointerEvents="none">
          <Svg width={160} height={160} style={styles.rippleSvg}>
            <Defs>
              <LinearGradient id="rippleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <Stop offset="50%" stopColor="#22d3ee" stopOpacity="0.4" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.6" />
              </LinearGradient>
            </Defs>
            <Circle cx="80" cy="80" r="79" fill="none" stroke="url(#rippleGradient)" strokeWidth="2" />
          </Svg>
        </Animated.View>
      )}

      {/* Main button with gradient border */}
      <View style={styles.circularButtonWrapper}>
        {!isCompleted && !disabled && (
          <Svg width={164} height={164} style={styles.gradientBorderSvg} pointerEvents="none">
            <Defs>
              <LinearGradient id="buttonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
                <Stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Circle cx="82" cy="82" r="80" fill="none" stroke="url(#buttonGradient)" strokeWidth="2" />
          </Svg>
        )}
        {disabled && !isCompleted && (
          <Svg width={164} height={164} style={styles.gradientBorderSvg} pointerEvents="none">
            <Circle cx="82" cy="82" r="80" fill="none" stroke={colors.borderLight} strokeWidth="2" />
          </Svg>
        )}
        <Pressable
          style={[
            styles.circularButton,
            isCompleted && styles.circularButtonCompleted,
            disabled && styles.circularButtonDisabled,
          ]}
          onPress={onPress}
          disabled={disabled}
        >
          <View
            style={[
              styles.circularButtonInner,
              isCompleted && styles.circularButtonInnerCompleted,
              disabled && styles.circularButtonInnerDisabled,
            ]}
          >
            {!isCompleted ? (
              <View style={styles.circularButtonTextContainer}>
                <Text style={[styles.circularButtonText, disabled && styles.circularButtonTextDisabled]}>
                  {text}
                </Text>
              </View>
            ) : (
              <Text style={styles.circularButtonTextCompleted}>✓</Text>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export default function WorkoutTab() {
  const router = useRouter();
  const toast = useToast();
  const modal = useModal();
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [templateDays, setTemplateDays] = useState<Array<{ day: { day_name: string }; slots: TemplateSlot[] }>>([]);
  const [selectedPlanDayName, setSelectedPlanDayName] = useState<string>(getTodayDayName());
  const [selectedDayExercises, setSelectedDayExercises] = useState<Array<{ id: string; name: string }>>([]);
  const [currentDay, setCurrentDay] = useState<string>('');
  const [hasActiveWorkout, setHasActiveWorkout] = useState<boolean>(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());

  // Get current user
  const getCurrentUserId = useCallback(async (): Promise<string | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      if (__DEV__) {
        devError('workout-tab', error, { action: 'getCurrentUserId' });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    setCurrentDay(getTodayDayName());
  }, []);

  // Load workout data (template + sessions) and populate selected plan day
  const loadTodayWorkout = useCallback(async () => {
    if (!hasInitiallyLoaded) {
      setIsLoading(true);
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      setIsLoading(false);
      setHasInitiallyLoaded(true);
      return;
    }

    try {
      if (__DEV__) {
        devLog('workout-tab', { action: 'loadTodayWorkout:start', userId });
      }

      // Get user's active template (first template, or system template)
      const templates = await getUserTemplates(userId);
      const template = templates.length > 0 ? templates[0] : null;

      if (!template) {
        setActiveTemplate(null);
        setTemplateDays([]);
        setSelectedDayExercises([]);
        setHasActiveWorkout(false);
        setIsWorkoutCompleted(false);
        setIsLoading(false);
        setHasInitiallyLoaded(true);
        return;
      }

      setActiveTemplate(template);

      // Get full template with days and slots
      const fullTemplate = await getTemplateWithDaysAndSlots(template.id);
      if (!fullTemplate) {
        setTemplateDays([]);
        setSelectedDayExercises([]);
        setIsLoading(false);
        setHasInitiallyLoaded(true);
        return;
      }

      const sortedDays = [...fullTemplate.days].sort(
        (a, b) => (DAY_ORDER[a.day.day_name] ?? 0) - (DAY_ORDER[b.day.day_name] ?? 0)
      );
      setTemplateDays(sortedDays);

      // Default selected plan day to today on first load
      const planDayName = hasInitiallyLoaded ? selectedPlanDayName : getTodayDayName();
      if (!hasInitiallyLoaded) {
        setSelectedPlanDayName(planDayName);
      }

      // Load exercise names for selected plan day
      const selectedDay = sortedDays.find((d) => d.day.day_name === planDayName);
      if (selectedDay) {
        const namesMap = new Map<string, string>();
        for (const slot of selectedDay.slots) {
          if (slot.exercise_id || slot.custom_exercise_id) {
            const exercise = await getMergedExercise(
              slot.exercise_id ? { exerciseId: slot.exercise_id } : { customExerciseId: slot.custom_exercise_id! },
              userId
            );
            if (exercise) {
              namesMap.set(slot.id, exercise.name);
            }
          }
        }
        setExerciseNames(namesMap);
        setSelectedDayExercises(
          selectedDay.slots.map((slot) => ({
            id: slot.id,
            name: namesMap.get(slot.id) || 'Unknown Exercise',
          }))
        );
      } else {
        setSelectedDayExercises([]);
      }

      // Check for active session
      const activeSession = await getActiveSession(userId);
      if (activeSession) {
        // Check if session is from today (performed date)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sessionDate = new Date(activeSession.started_at);
        sessionDate.setHours(0, 0, 0, 0);

        if (sessionDate.getTime() === today.getTime()) {
          setHasActiveWorkout(true);
        } else {
          setHasActiveWorkout(false);
        }
      } else {
        setHasActiveWorkout(false);
      }

      // Check for completed session from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: completedSession } = await supabase
        .from('v2_workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('template_id', template.id)
        .eq('day_name', planDayName)
        .eq('status', 'completed')
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString())
        .maybeSingle();

      // Check if all exercises were completed
      let isTrulyCompleted = false;
      if (completedSession && !activeSession) {
        // Count session exercises
        const { data: sessionExercises } = await supabase
          .from('v2_session_exercises')
          .select('id')
          .eq('session_id', completedSession.id);

        const currentExerciseCount =
          fullTemplate.days.find((d) => d.day.day_name === planDayName)?.slots.length || 0;
        const loggedExerciseCount = sessionExercises?.length || 0;

        // Workout is truly completed if all exercises were logged
        isTrulyCompleted = loggedExerciseCount >= currentExerciseCount || currentExerciseCount === 0;
      }

      setIsWorkoutCompleted(isTrulyCompleted);

      if (__DEV__) {
        devLog('workout-tab', {
          action: 'loadTodayWorkout:done',
          hasTemplate: !!template,
          exerciseCount: fullTemplate.days?.reduce((acc, d) => acc + d.slots.length, 0) || 0,
          hasActiveWorkout,
          isWorkoutCompleted: isTrulyCompleted,
          selectedPlanDayName: planDayName,
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('workout-tab', error, { action: 'loadTodayWorkout' });
      }
      toast.error('Failed to load workout');
    } finally {
      setIsLoading(false);
      setHasInitiallyLoaded(true);
    }
  }, [getCurrentUserId, toast, selectedPlanDayName, hasInitiallyLoaded]);

  useEffect(() => {
    loadTodayWorkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (hasInitiallyLoaded) {
        loadTodayWorkout();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasInitiallyLoaded]) // Only depend on hasInitiallyLoaded, not loadTodayWorkout
  );

  const openPlanDayPicker = useCallback(() => {
    if (!templateDays.length) return;
    modal.openSheet('planDayPicker', {
      selectedDayName: selectedPlanDayName,
      todayDayName: currentDay || getTodayDayName(),
      days: templateDays
        .slice()
        .sort((a, b) => (DAY_ORDER[a.day.day_name] ?? 0) - (DAY_ORDER[b.day.day_name] ?? 0))
        .map((d) => ({
          dayName: d.day.day_name,
          hasWorkout: d.slots.length > 0,
        })),
      onSelect: (dayName: string) => {
        setSelectedPlanDayName(dayName);
        modal.closeSheet();
      },
      onResetToToday: () => {
        setSelectedPlanDayName(getTodayDayName());
        modal.closeSheet();
      },
    });
  }, [modal, templateDays, selectedPlanDayName, currentDay]);

  const handleStartWorkout = () => {
    if (!activeTemplate || !currentDay) return;

    const selectedSlots =
      templateDays.find((d) => d.day.day_name === selectedPlanDayName)?.slots || [];

    if (selectedSlots.length === 0) {
      openPlanDayPicker();
      return;
    }

    // Navigate to workout execution; plan day stored when creating session (future screen)
    router.push('/workout/active');
  };

  const handleResetWorkout = async () => {
    if (!activeTemplate || !currentDay) return;

    setIsResetting(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Please log in');
        setIsResetting(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Delete any active workout sessions from today
      const { error: deleteError } = await supabase
        .from('v2_workout_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('template_id', activeTemplate.id)
        .eq('day_name', currentDay)
        .eq('status', 'active')
        .gte('started_at', today.toISOString())
        .lt('started_at', tomorrow.toISOString());

      if (deleteError && __DEV__) {
        devError('workout-tab', deleteError, { action: 'handleResetWorkout' });
      }

      // Update state
      setHasActiveWorkout(false);
      setIsWorkoutCompleted(false);
      setShowResetModal(false);

      toast.success('Workout has been reset. You can now start fresh!');
    } catch (error) {
      if (__DEV__) {
        devError('workout-tab', error, { action: 'handleResetWorkout' });
      }
      toast.error('Failed to reset workout');
    } finally {
      setIsResetting(false);
    }
  };

  const isRestDay = selectedDayExercises.length === 0;
  const isBorrowingPlanDay = selectedPlanDayName !== currentDay;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Workout" tabId="workout" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Workout" tabId="workout" />

      {/* Background Ambient Glows */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.dayTitle}>{currentDay || 'Loading...'}</Text>
          <Text style={styles.greetingText}>{getGreeting()}</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!activeTemplate ? (
          <Animated.View entering={FadeIn.duration(400).delay(50)} style={styles.card}>
            <View style={styles.iconContainer}>
              <Dumbbell size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.cardTitle}>No Active Workout Plan</Text>
            <Text style={styles.cardSubtext}>Create a plan in the Planner tab to get started!</Text>
          </Animated.View>
        ) : (
          <>
            {isRestDay ? (
              <Animated.View entering={FadeIn.duration(400).delay(50)} style={styles.card}>
                <View style={styles.restDayIconContainer}>
                  <Timer size={40} color="#22d3ee" />
                </View>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDayText}>Take it easy!</Text>
                <Text style={styles.cardSubtext}>You can pick another plan day to train today.</Text>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(400).delay(50)} style={styles.workoutCard}>
                <View style={styles.workoutCardContent}>
                  <View style={styles.badgeContainer}>
                    <View style={styles.badgeLeft}>
                      <View style={styles.badgePrimary}>
                        <Text style={styles.badgePrimaryText}>Active Plan</Text>
                      </View>
                      <View style={styles.badgeSecondary}>
                        <Text style={styles.badgeSecondaryText}>
                          {selectedDayExercises.length} Exercises
                        </Text>
                      </View>
                    </View>
                    {hasActiveWorkout && (
                      <Pressable onPress={() => setShowResetModal(true)} style={styles.resetButton}>
                        <RotateCcw size={20} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>

                  <Text style={styles.workoutTitle}>Today's Workout</Text>
                  <Text style={styles.workoutSubtitle}>
                    Plan day: {selectedPlanDayName} • {selectedDayExercises.length} exercise
                    {selectedDayExercises.length !== 1 ? 's' : ''} scheduled
                  </Text>

                  {isBorrowingPlanDay && (
                    <Text style={styles.helperText}>
                      Doing {selectedPlanDayName}'s workout today
                    </Text>
                  )}

                  {selectedDayExercises.length > 0 && (
                    <View style={styles.exercisesContainer}>
                      {selectedDayExercises.slice(0, 3).map((exercise: any, index: number) => (
                        <Animated.View
                          key={exercise.id || index}
                          entering={FadeIn.duration(300).delay(100 + index * 50)}
                          style={styles.exerciseItem}
                        >
                          <View style={styles.exerciseIcon}>
                            <Dumbbell size={12} color={colors.primary} />
                          </View>
                          <Text style={styles.exerciseName}>{exercise.name}</Text>
                        </Animated.View>
                      ))}
                      {selectedDayExercises.length > 3 && (
                        <Animated.View
                          entering={FadeIn.duration(300).delay(250)}
                          style={styles.exerciseItem}
                        >
                          <View style={styles.exerciseIconPlaceholder} />
                          <Text style={styles.moreExercisesText}>
                            +{selectedDayExercises.length - 3} more exercises
                          </Text>
                        </Animated.View>
                      )}
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Start/Continue Workout Button - Always visible */}
            <Animated.View entering={FadeIn.duration(400).delay(150)} style={styles.buttonContainer}>
              {isWorkoutCompleted ? (
                <CircularButton
                  onPress={handleStartWorkout}
                  disabled={isRestDay}
                  text="Completed"
                  isCompleted={true}
                />
              ) : (
                <CircularButton
                  onPress={handleStartWorkout}
                  disabled={isRestDay}
                  text={hasActiveWorkout ? 'Continue' : 'Start'}
                  isCompleted={false}
                />
              )}
              {templateDays.length > 0 && (
                <View style={styles.planDayRow}>
                  <Text style={styles.planDayLabel}>Plan day: {selectedPlanDayName}</Text>
                  <Pressable onPress={openPlanDayPicker} style={styles.planDayChangeButton}>
                    <Text style={styles.planDayChangeText}>Change</Text>
                  </Pressable>
                </View>
              )}
              {isBorrowingPlanDay && (
                <Text style={styles.helperTextSmall}>
                  Doing {selectedPlanDayName}'s workout today
                </Text>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Reset Workout Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Workout?</Text>
            <Text style={styles.modalMessage}>
              This will delete your current workout progress and allow you to start from the beginning.
              This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalResetButton, isResetting && styles.modalResetButtonDisabled]}
                onPress={handleResetWorkout}
                disabled={isResetting}
              >
                <Text style={styles.modalResetText}>
                  {isResetting ? 'Resetting...' : 'Reset Workout'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 500,
    height: 500,
    backgroundColor: colors.primaryDark,
    opacity: 0.1,
    borderRadius: 250,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 400,
    height: 400,
    backgroundColor: '#06b6d4',
    opacity: 0.1,
    borderRadius: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 3, // keep CTA above tab bar with less scroll
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  dayTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  greetingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  cardSubtext: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  restDayIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  restDayTitle: {
    color: '#22d3ee',
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  restDayText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    marginBottom: spacing.sm,
  },
  workoutCard: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(39, 39, 42, 0.5)',
  },
  workoutCardContent: {
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  badgePrimary: {
    backgroundColor: 'rgba(163, 230, 53, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.2)',
  },
  badgePrimaryText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  badgeSecondary: {
    backgroundColor: 'rgba(39, 39, 42, 0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(63, 63, 70, 0.3)',
  },
  badgeSecondaryText: {
    color: '#d4d4d8',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  resetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(39, 39, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  workoutTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 32,
    marginBottom: spacing.sm,
  },
  workoutSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  exercisesContainer: {
    marginBottom: spacing.md,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exerciseIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(163, 230, 53, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exerciseIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardBorder,
    marginRight: spacing.md,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    flex: 1,
  },
  moreExercisesText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg, // breathing room above tab bar with less scroll
  },
  planDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  planDayLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  planDayChangeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  planDayChangeText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  helperTextSmall: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  circularButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleSvg: {
    position: 'absolute',
  },
  circularButtonWrapper: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gradientBorderSvg: {
    position: 'absolute',
  },
  circularButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  circularButtonCompleted: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.borderLight,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  circularButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.borderLight,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
  },
  circularButtonInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularButtonInnerCompleted: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
  },
  circularButtonInnerDisabled: {
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
    opacity: 0.6,
  },
  circularButtonTextContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  circularButtonTextCompleted: {
    color: colors.textMuted,
    fontSize: typography.sizes['2xl'],
    fontWeight: '700',
  },
  circularButtonTextDisabled: {
    color: colors.textMuted,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: 'rgba(39, 39, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  modalResetButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetButtonDisabled: {
    opacity: 0.6,
  },
  modalResetText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
  chooseWorkoutButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  chooseWorkoutText: {
    color: '#000',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
});
