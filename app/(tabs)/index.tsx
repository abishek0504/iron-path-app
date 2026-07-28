/**
 * Workout tab - V2
 * Shows today's workout with pulsing start/continue button
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { spacing, layout, borderRadius, typography, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
import { useToast } from '../../src/hooks/useToast';
import { useModal } from '../../src/hooks/useModal';
import { useUserStore } from '../../src/stores/userStore';
import { useUIStore } from '../../src/stores/uiStore';
import { TourTarget } from '../../src/components/tour/TourTarget';
import { useRegisterTourScroll } from '../../src/components/tour/TourScroll';
import {
  createWorkoutSession,
  deleteSessionWithExercises,
  getActiveSession,
  getSessionsForToday,
  prefillSessionSets,
  type WorkoutSession,
} from '../../src/lib/supabase/queries/workouts';
import {
  getTemplateWithDaysAndSlotsCached,
  getUserTemplatesCached,
  invalidateTemplate,
} from '../../src/lib/cache/templateCache';
import { invalidateSessionsInRangeForUser } from '../../src/lib/cache/sessionsCache';
import { listMergedExercisesCached } from '../../src/lib/cache/exerciseCache';
import { devLog, devError } from '../../src/lib/utils/logger';
import { hapticMedium, hapticWarning } from '../../src/lib/utils/haptics';
import type { TemplateSlot } from '../../src/lib/supabase/queries/templates';
import { selectExerciseTargets, type TargetSelectionContext } from '../../src/lib/engine/targetSelection';
import { WEEK_DAYS, getLocalDayKey, getLocalDayBoundsIso } from '../../src/lib/utils/date';
import {
  computeRoutineSessionExerciseIds,
  dayOnlyBadgeLabel,
  logRoutineClassificationDiagnostics,
} from '../../src/lib/planner/routineClassification';

const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** Workout tab loading header (day title + greeting) — balances loader on tab screens. */
const WORKOUT_LOADING_HEADER_HEIGHT =
  spacing.md + spacing.sm + typography.sizes['2xl'] + spacing.xs + typography.sizes.xs + 8;

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
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
                <Stop offset="0%" stopColor={colors.accentCyan} stopOpacity="0.6" />
                <Stop offset="50%" stopColor={colors.accentCyanBright} stopOpacity="0.4" />
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
                <Stop offset="0%" stopColor={colors.accentCyan} stopOpacity="1" />
                <Stop offset="50%" stopColor={colors.accentCyanBright} stopOpacity="1" />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Circle cx="82" cy="82" r="80" fill="none" stroke="url(#buttonGradient)" strokeWidth="2" />
          </Svg>
        )}
        {disabled && !isCompleted && (
          <Svg width={164} height={164} style={styles.gradientBorderSvg} pointerEvents="none">
            <Circle cx="82" cy="82" r="80" fill="none" stroke={colors.workoutDisabledRing} strokeWidth="2" />
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
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const modal = useModal();
  const profile = useUserStore((state) => state.profile);
  const setWorkoutNeedsRefetch = useUIStore((s) => s.setWorkoutNeedsRefetch);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [templateDays, setTemplateDays] = useState<{ day: { day_name: string }; slots: TemplateSlot[] }[]>([]);
  const [selectedPlanDayName, setSelectedPlanDayName] = useState<string>(getTodayDayName());
  const [selectedDayExercises, setSelectedDayExercises] = useState<{ id: string; name: string; isTodayOnly?: boolean }[]>([]);
  const [currentDay, setCurrentDay] = useState<string>('');
  const [hasActiveWorkout, setHasActiveWorkout] = useState<boolean>(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [sessionsToday, setSessionsToday] = useState<WorkoutSession[]>([]);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState<number>(0);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadInFlightRef = useRef(false);
  const lastFocusLoadRef = useRef(0);
  const startInProgressRef = useRef(false);
  const lastSeenLocalDayKeyRef = useRef<string>(getLocalDayKey(new Date()));
  const tourScrollRef = useRef<ScrollView>(null);
  const { onScroll: onTourScroll } = useRegisterTourScroll('index', tourScrollRef);

  const FOCUS_RELOAD_THROTTLE_MS = 4000;

  const selectedSession = sessionsToday[selectedWorkoutIndex] ?? null;

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

  /** Reset sticky plan day when the local calendar day rolls over (overnight / week boundary).
   *  Returns the plan day name that should be used for this load (avoids stale closure after setState). */
  const syncPlanDayToLocalCalendar = useCallback((): string => {
    const todayKey = getLocalDayKey(new Date());
    const todayName = getTodayDayName();
    if (lastSeenLocalDayKeyRef.current !== todayKey) {
      lastSeenLocalDayKeyRef.current = todayKey;
      setSelectedPlanDayName(todayName);
      if (__DEV__) {
        devLog('workout-tab', {
          action: 'calendarDayRollover_resetPlanDay',
          todayKey,
          todayName,
        });
      }
      setCurrentDay(todayName);
      return todayName;
    }
    setCurrentDay(todayName);
    return selectedPlanDayName;
  }, [selectedPlanDayName]);

  useEffect(() => {
    syncPlanDayToLocalCalendar();
  }, [syncPlanDayToLocalCalendar]);

  // Load workout data (template + sessions) and populate selected workout
  // preserveWorkoutIndex: when user picks a workout via Change, keep that selection
  // selectLast: after Add Workout, select the new (last) workout
  const loadTodayWorkout = useCallback(
    async (preserveWorkoutIndex?: number, options?: { selectLast?: boolean }) => {
      if (loadInFlightRef.current) return;
      loadInFlightRef.current = true;
      const syncedPlanDayName = syncPlanDayToLocalCalendar();
      if (!hasInitiallyLoaded) {
        setIsLoading(true);
      }

      const userId = await getCurrentUserId();
    if (!userId) {
      setIsLoading(false);
      setHasInitiallyLoaded(true);
      loadInFlightRef.current = false;
      return;
    }

    try {
      if (__DEV__) {
        devLog('workout-tab', { action: 'loadTodayWorkout:start', userId });
      }

      const { startIso: todayStartIso, endIsoExclusive: tomorrowStartIso } =
        getLocalDayBoundsIso();

      // First parallel batch: templates and all sessions for today (multi-workout-per-day)
      const [templatesResult, sessionsForToday] = await Promise.all([
        getUserTemplatesCached(userId),
        getSessionsForToday(userId, todayStartIso, tomorrowStartIso),
      ]);
      const template = templatesResult.length > 0 ? templatesResult[0] : null;

      if (!template) {
        setActiveTemplate(null);
        setTemplateDays([]);
        setSessionsToday([]);
        setSelectedWorkoutIndex(0);
        setSelectedDayExercises([]);
        setHasActiveWorkout(false);
        setIsWorkoutCompleted(false);
        setIsLoading(false);
        setHasInitiallyLoaded(true);
        loadInFlightRef.current = false;
        return;
      }

      setActiveTemplate(template);
      setSessionsToday(sessionsForToday);

      // Which workout to show: preserve selection, select last (after Add Workout), or first incomplete
      const firstIncomplete = sessionsForToday.findIndex((s) => s.status !== 'completed');
      const indexToUse =
        options?.selectLast && sessionsForToday.length > 0
          ? sessionsForToday.length - 1
          : preserveWorkoutIndex !== undefined
            ? Math.min(preserveWorkoutIndex, Math.max(0, sessionsForToday.length - 1))
            : firstIncomplete >= 0
              ? firstIncomplete
              : 0;
      setSelectedWorkoutIndex(indexToUse);
      const viewingSession = sessionsForToday[indexToUse] ?? null;

      // Invalidate so we always get fresh template (e.g. after adding exercises in Plan tab)
      invalidateTemplate(template.id);
      const fullTemplate = await getTemplateWithDaysAndSlotsCached(template.id);
      if (!fullTemplate) {
        setTemplateDays([]);
        setSelectedDayExercises([]);
        setIsLoading(false);
        setHasInitiallyLoaded(true);
        loadInFlightRef.current = false;
        return;
      }

      const sortedDays = [...fullTemplate.days].sort(
        (a, b) => (DAY_ORDER[a.day.day_name] ?? 0) - (DAY_ORDER[b.day.day_name] ?? 0)
      );
      setTemplateDays(sortedDays);

      // Default selected plan day to today on first load; after rollover use synced name
      const planDayName = hasInitiallyLoaded ? syncedPlanDayName : getTodayDayName();
      if (!hasInitiallyLoaded) {
        setSelectedPlanDayName(planDayName);
      }

      // For the selected workout: has save point? completed?
      const hasCompletedSets = viewingSession
        ? await (async (): Promise<boolean> => {
            const { data: sessionExerciseIds } = await supabase
              .from('v2_session_exercises')
              .select('id')
              .eq('session_id', viewingSession.id);
            if (!sessionExerciseIds || sessionExerciseIds.length === 0) return false;
            const seIds = sessionExerciseIds.map((se: { id: string }) => se.id);
            const { count } = await supabase
              .from('v2_session_sets')
              .select('*', { count: 'exact', head: true })
              .in('session_exercise_id', seIds)
              .not('performed_at', 'is', null);
            return (count ?? 0) > 0;
          })()
        : false;

      const isViewingToday = selectedPlanDayName === getTodayDayName();
      const hasSavePoint =
        !!viewingSession && viewingSession.status === 'active' && isViewingToday && hasCompletedSets;
      setHasActiveWorkout(hasSavePoint);

      // Match plan day case-insensitively (DB may store "Monday" or "monday")
      const matchDayName = (dayName: string) => (d: { day: { day_name?: string } }) =>
        (d.day.day_name ?? '').toLowerCase() === (dayName ?? '').toLowerCase();

      // When viewing a specific session: always show only that session's exercises (no template mix).
      // When no session exists for today: show template for selected day so user can Start and create a session.
      let exercisesToShow: { id: string; name: string; isTodayOnly?: boolean }[] = [];
      const previewDay = sortedDays.find(matchDayName(planDayName));

      if (viewingSession) {
        // Classify against the session's plan day (not sticky selectedPlanDayName) so
        // overnight/borrowed-day mismatches don't mark routine exercises as Today Only.
        const classificationDayName =
          viewingSession.day_name || getTodayDayName();
        const classificationDay = sortedDays.find(matchDayName(classificationDayName));

        // Only the selected session: load exercises for viewingSession.id only (never combine sessions or template)
        const { data: sessionExercises, error: sessionExercisesError } = await supabase
          .from('v2_session_exercises')
          .select('id, exercise_id, custom_exercise_id, sort_order')
          .eq('session_id', viewingSession.id)
          .order('sort_order', { ascending: true });

        if (sessionExercisesError && __DEV__) {
          devError('workout-tab', sessionExercisesError, {
            action: 'loadTodayWorkout_sessionExercises_error',
            sessionId: viewingSession.id,
          });
        }

        const exercisesForSelectedSessionOnly = sessionExercises ?? [];
        if (exercisesForSelectedSessionOnly.length > 0) {
          const exerciseIds = [
            ...new Set(
              exercisesForSelectedSessionOnly
                .flatMap((se) => [se.exercise_id, se.custom_exercise_id].filter(Boolean) as string[])
            ),
          ];
          const merged = exerciseIds.length > 0 ? await listMergedExercisesCached(userId, exerciseIds) : [];
          const nameByExerciseId = new Map(merged.map((e) => [e.id, e.name]));
          const namesMap = new Map<string, string>();
          for (const se of exercisesForSelectedSessionOnly) {
            const key = se.exercise_id || se.custom_exercise_id;
            if (key) namesMap.set(se.id, nameByExerciseId.get(key) ?? 'Unknown Exercise');
          }

          const templateSlots = classificationDay?.slots ?? [];
          let sessionsWithExercises: {
            exercises: {
              id: string;
              exercise_id: string | null;
              custom_exercise_id: string | null;
              sort_order: number;
            }[];
          }[] = [];

          if (sessionsForToday.length > 0) {
            const allSessionIds = sessionsForToday.map((s) => s.id);
            const { data: allSessionExercises } = await supabase
              .from('v2_session_exercises')
              .select('id, session_id, exercise_id, custom_exercise_id, sort_order')
              .in('session_id', allSessionIds)
              .order('sort_order', { ascending: true });
            const bySession = new Map<
              string,
              { id: string; exercise_id: string | null; custom_exercise_id: string | null; sort_order: number }[]
            >();
            for (const se of allSessionExercises || []) {
              const sid = se.session_id as string;
              if (!bySession.has(sid)) bySession.set(sid, []);
              bySession.get(sid)!.push({
                id: se.id,
                exercise_id: se.exercise_id,
                custom_exercise_id: se.custom_exercise_id,
                sort_order: se.sort_order ?? 0,
              });
            }
            sessionsWithExercises = sessionsForToday.map((session) => ({
              exercises: (bySession.get(session.id) ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order),
            }));
          }

          const routineSessionExerciseIds = computeRoutineSessionExerciseIds(
            templateSlots,
            sessionsWithExercises,
          );
          logRoutineClassificationDiagnostics({
            module: 'workout-tab',
            dayName: classificationDayName,
            templateSlots,
            sessionsWithExercises,
            routineIds: routineSessionExerciseIds,
          });

          exercisesToShow = exercisesForSelectedSessionOnly.map((se) => ({
            id: se.id,
            name: namesMap.get(se.id) ?? 'Unknown Exercise',
            isTodayOnly: !routineSessionExerciseIds.has(se.id),
          }));

          if (__DEV__) {
            devLog('workout-tab', {
              action: 'loadTodayWorkout_sessionExercises_loaded',
              sessionId: viewingSession.id,
              selectedWorkoutIndex: indexToUse,
              sessionExerciseCount: exercisesForSelectedSessionOnly.length,
              classificationDayName,
            });
          }
        } else {
          exercisesToShow = [];
        }
      } else if (previewDay) {
        // No sessions for today: show template for selected day so user can Start and create a session
        const slotIds = [
          ...new Set(
            previewDay.slots.flatMap((s) =>
              [s.exercise_id, s.custom_exercise_id].filter(Boolean) as string[]
            )
          ),
        ];
        const mergedSlots = slotIds.length > 0 ? await listMergedExercisesCached(userId, slotIds) : [];
        const nameByExerciseId = new Map(mergedSlots.map((e) => [e.id, e.name]));
        const namesMap = new Map<string, string>();
        for (const slot of previewDay.slots) {
          const key = slot.exercise_id || slot.custom_exercise_id;
          if (key) namesMap.set(slot.id, nameByExerciseId.get(key) ?? 'Unknown Exercise');
        }
        exercisesToShow = previewDay.slots.map((slot) => ({
          id: slot.id,
          name: namesMap.get(slot.id) ?? 'Unknown Exercise',
          isTodayOnly: false,
        }));
        if (__DEV__ && previewDay.slots.length > 0) {
          devLog('workout-tab', {
            action: 'loadTodayWorkout_template_loaded',
            planDayName,
            templateCount: previewDay.slots.length,
          });
        }
      }

      setSelectedDayExercises(exercisesToShow);

      // Selected workout is completed when its session status is 'completed'
      const isTrulyCompleted = viewingSession?.status === 'completed';
      setIsWorkoutCompleted(isTrulyCompleted);

      if (__DEV__) {
        devLog('workout-tab', {
          action: 'loadTodayWorkout:done',
          hasTemplate: !!template,
          sessionsTodayCount: sessionsForToday.length,
          selectedWorkoutIndex: indexToUse,
          hasActiveWorkout: hasSavePoint,
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
      loadInFlightRef.current = false;
    }
  }, [getCurrentUserId, toast, selectedPlanDayName, hasInitiallyLoaded, syncPlanDayToLocalCalendar]);

  useEffect(() => {
    loadTodayWorkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // When the user changes the selected plan day (e.g., picks Wednesday),
  // refresh the displayed exercises so Start isn't incorrectly disabled.
  useEffect(() => {
    if (!hasInitiallyLoaded) return;
    loadTodayWorkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanDayName]);

  // Refresh on focus - reload when tab becomes active, throttled to avoid request storm (ERR_INSUFFICIENT_RESOURCES)
  useFocusEffect(
    useCallback(() => {
      if (!hasInitiallyLoaded) return;

      syncPlanDayToLocalCalendar();

      const forceRefresh = useUIStore.getState().workoutNeedsRefetch;
      if (forceRefresh) {
        setWorkoutNeedsRefetch(false);
        lastFocusLoadRef.current = 0;
        loadInFlightRef.current = false;
        if (__DEV__) {
          devLog('workout-tab', { action: 'useFocusEffect: force refresh after workout complete' });
        }
      }

      const now = Date.now();
      if (now - lastFocusLoadRef.current < FOCUS_RELOAD_THROTTLE_MS) return;
      lastFocusLoadRef.current = now;
      if (__DEV__) {
        devLog('workout-tab', { action: 'useFocusEffect: reloading workout state' });
      }
      loadTodayWorkout();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasInitiallyLoaded, setWorkoutNeedsRefetch, syncPlanDayToLocalCalendar])
  );

  /**
   * Pull-to-refresh: bypass focus throttle and in-flight guard so a deliberate user gesture
   * always re-runs the load pipeline against the currently selected workout index.
   */
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    loadInFlightRef.current = false;
    lastFocusLoadRef.current = 0;
    try {
      await loadTodayWorkout(selectedWorkoutIndex);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadTodayWorkout, selectedWorkoutIndex]);

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

  const openWorkoutPicker = useCallback(() => {
    if (sessionsToday.length === 0) return;
    modal.openSheet('workoutPicker', {
      workouts: sessionsToday.map((s, i) => ({
        index: i,
        label: `Workout ${i + 1}`,
        isCompleted: s.status === 'completed',
      })),
      selectedIndex: selectedWorkoutIndex,
      onSelect: (index: number) => {
        modal.closeSheet();
        setSelectedWorkoutIndex(index);
        loadTodayWorkout(index);
      },
    });
  }, [modal, sessionsToday, selectedWorkoutIndex, loadTodayWorkout]);

  const handleStartWorkout = async () => {
    if (startInProgressRef.current) return;
    if (selectedSession?.status === 'completed' || isWorkoutCompleted) {
      return;
    }
    if (selectedSession?.status === 'active' && selectedSession.control_device === 'watch') {
      toast.info('Workout is running on Apple Watch. Finish or abandon it there first.');
      return;
    }
    hapticMedium();
    startInProgressRef.current = true;
    setIsStartingWorkout(true);
    try {
      if (!activeTemplate || !currentDay) return;

      // If there is already an active session with save point (Continue flow), open that workout
      if (hasActiveWorkout && selectedSession?.id) {
        if (selectedSession.control_device === 'watch') {
          toast.info('Workout is running on Apple Watch.');
          return;
        }
        router.push({ pathname: '/workout/active', params: { sessionId: selectedSession.id } });
        return;
      }

      // If we're viewing an active session (no save point yet), just open it — don't delete and create new
      if (selectedSession?.status === 'active' && selectedSession?.id) {
        if (selectedSession.control_device === 'watch') {
          toast.info('Workout is running on Apple Watch.');
          return;
        }
        router.push({ pathname: '/workout/active', params: { sessionId: selectedSession.id } });
        return;
      }

      // Otherwise, create a new workout session from the selected plan day
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Please log in');
        return;
      }

      const selectedDay = templateDays.find((d) => d.day.day_name === selectedPlanDayName);
      const slots = selectedDay?.slots || [];

      // Allow starting with only Today Only (no template slots): use selected session or open active
      if (slots.length === 0) {
        if (selectedSession?.status === 'active') {
          router.push({ pathname: '/workout/active', params: { sessionId: selectedSession.id } });
          return;
        }
        const existingSession = await getActiveSession(userId);
        const todayLocalKey = getLocalDayKey(new Date());
        const existingIsToday =
          existingSession &&
          getLocalDayKey(new Date(existingSession.started_at)) === todayLocalKey &&
          existingSession.day_name === selectedPlanDayName;
        if (existingIsToday && existingSession) {
          const { data: existingExercises } = await supabase
            .from('v2_session_exercises')
            .select('id')
            .eq('session_id', existingSession.id);
          if (existingExercises && existingExercises.length > 0) {
            router.push({ pathname: '/workout/active', params: { sessionId: existingSession.id } });
            return;
          }
        }
        toast.error('No exercises scheduled for this day');
        return;
      }

      if (__DEV__) {
        devLog('workout-tab', {
          action: 'startWorkout:createSession',
          templateId: activeTemplate.id,
          selectedPlanDayName,
          slotCount: slots.length,
        });
      }

      const effectiveExperience = profile?.experience_level || 'beginner';
      const context: TargetSelectionContext = { experience: effectiveExperience };
      // Use selected session when viewing an active one (multi-workout-per-day); else single active session
      const existingSession =
        selectedSession?.status === 'active' ? selectedSession : await getActiveSession(userId);
      const todayLocalKey = getLocalDayKey(new Date());
      const existingIsToday =
        existingSession &&
        getLocalDayKey(new Date(existingSession.started_at)) === todayLocalKey &&
        existingSession.day_name === selectedPlanDayName;

      // Collect Today Only from existing session (exercises not in template) so we preserve them when replacing
      let todayOnlyFromExisting: { exercise_id: string | null; custom_exercise_id: string | null; sort_order: number }[] = [];
      if (existingIsToday && existingSession) {
        const { data: existingSes } = await supabase
          .from('v2_session_exercises')
          .select('id, exercise_id, custom_exercise_id, sort_order')
          .eq('session_id', existingSession.id)
          .order('sort_order', { ascending: true });
        const templateSlotKeys = new Set(
          slots.flatMap((s) => [s.exercise_id, s.custom_exercise_id].filter(Boolean) as string[])
        );
        todayOnlyFromExisting = (existingSes || [])
          .filter((se) => {
            const key = se.exercise_id || se.custom_exercise_id;
            return key && !templateSlotKeys.has(key);
          })
          .map((se) => ({
            exercise_id: se.exercise_id ?? null,
            custom_exercise_id: se.custom_exercise_id ?? null,
            sort_order: se.sort_order,
          }));
      }

      // If existing session has no save point, delete it before creating new one (so new session = template + Today Only)
      if (existingIsToday && existingSession) {
        const { data: seIds } = await supabase
          .from('v2_session_exercises')
          .select('id')
          .eq('session_id', existingSession.id);
        const ids = (seIds || []).map((se: { id: string }) => se.id);
        let hasSavePoint = false;
        if (ids.length > 0) {
          const { count } = await supabase
            .from('v2_session_sets')
            .select('*', { count: 'exact', head: true })
            .in('session_exercise_id', ids)
            .not('performed_at', 'is', null);
          hasSavePoint = (count ?? 0) > 0;
        }
        if (!hasSavePoint) {
          const { error } = await deleteSessionWithExercises(userId, existingSession.id);
          if (!error) invalidateSessionsInRangeForUser(userId);
        }
      }

      // Create session (started now, day_name = selected plan day)
      const session = await createWorkoutSession(userId, activeTemplate.id, selectedPlanDayName);
      if (!session) {
        toast.error('Failed to start workout');
        return;
      }

      const sessionExercises: { id: string; exercise_id?: string; custom_exercise_id?: string }[] = [];
      const targetsMap = new Map<
        string,
        { sets: number; reps?: number; duration_sec?: number; weight?: number }
      >();

      let nextSortOrder = 0;

      // 1) Template slots
      for (const slot of slots) {
        if (!slot.exercise_id && !slot.custom_exercise_id) continue;

        const { data: sessionExercise, error: exerciseError } = await supabase
          .from('v2_session_exercises')
          .insert({
            session_id: session.id,
            exercise_id: slot.exercise_id || null,
            custom_exercise_id: slot.custom_exercise_id || null,
            sort_order: nextSortOrder++,
            superset_group: slot.superset_group ?? null,
            rest_sec: slot.rest_sec ?? null,
          })
          .select('id, exercise_id, custom_exercise_id')
          .single();

        if (exerciseError || !sessionExercise) {
          if (__DEV__) {
            devError('workout-tab', exerciseError || new Error('Failed to create session exercise'), {
              sessionId: session.id,
              slotId: slot.id,
            });
          }
          continue;
        }

        sessionExercises.push({
          id: sessionExercise.id,
          exercise_id: sessionExercise.exercise_id || undefined,
          custom_exercise_id: sessionExercise.custom_exercise_id || undefined,
        });

        const exerciseKey = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
        if (!exerciseKey) continue;

        const target = await selectExerciseTargets(
          {
            exerciseId: sessionExercise.exercise_id || undefined,
            customExerciseId: sessionExercise.custom_exercise_id || undefined,
          },
          userId,
          context,
          0
        );
        if (target) {
          targetsMap.set(exerciseKey, {
            sets: target.sets,
            reps: target.reps,
            duration_sec: target.duration_sec,
            weight: target.weight,
          });
        }
      }

      // 2) Today Only from existing session (persist for this date)
      for (const row of todayOnlyFromExisting) {
        const { data: sessionExercise, error: exerciseError } = await supabase
          .from('v2_session_exercises')
          .insert({
            session_id: session.id,
            exercise_id: row.exercise_id,
            custom_exercise_id: row.custom_exercise_id,
            sort_order: nextSortOrder++,
          })
          .select('id, exercise_id, custom_exercise_id')
          .single();

        if (exerciseError || !sessionExercise) {
          if (__DEV__) {
            devError('workout-tab', exerciseError || new Error('Failed to create Today Only session exercise'), {
              sessionId: session.id,
            });
          }
          continue;
        }

        sessionExercises.push({
          id: sessionExercise.id,
          exercise_id: sessionExercise.exercise_id || undefined,
          custom_exercise_id: sessionExercise.custom_exercise_id || undefined,
        });

        const exerciseKey = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
        if (!exerciseKey) continue;

        const target = await selectExerciseTargets(
          {
            exerciseId: sessionExercise.exercise_id || undefined,
            customExerciseId: sessionExercise.custom_exercise_id || undefined,
          },
          userId,
          context,
          0
        );
        if (target) {
          targetsMap.set(exerciseKey, {
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
      router.push({ pathname: '/workout/active', params: { sessionId: session.id } });
    } catch (error) {
      if (__DEV__) {
        devError('workout-tab', error, {
          action: 'startWorkout:createSession_error',
          selectedPlanDayName,
        });
      }
      toast.error('Failed to start workout');
    } finally {
      startInProgressRef.current = false;
      setIsStartingWorkout(false);
    }
  };

  const handleResetWorkout = async () => {
    if (!activeTemplate || !currentDay) return;

    hapticWarning();
    setIsResetting(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Please log in');
        setIsResetting(false);
        return;
      }

      // Reset only the selected workout (multi-workout-per-day)
      if (selectedSession?.id && selectedSession.status === 'active') {
        const { error: deleteError } = await deleteSessionWithExercises(userId, selectedSession.id);
        if (deleteError && __DEV__) {
          devError('workout-tab', deleteError, { action: 'handleResetWorkout', sessionId: selectedSession.id });
        } else {
          invalidateSessionsInRangeForUser(userId);
        }
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: sessionsToDelete } = await supabase
          .from('v2_workout_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('template_id', activeTemplate.id)
          .eq('day_name', currentDay)
          .eq('status', 'active')
          .gte('started_at', today.toISOString())
          .lt('started_at', tomorrow.toISOString());

        for (const s of sessionsToDelete || []) {
          await deleteSessionWithExercises(userId, s.id);
        }
        if ((sessionsToDelete?.length ?? 0) > 0) {
          invalidateSessionsInRangeForUser(userId);
        }
      }

      setShowResetModal(false);
      await loadTodayWorkout(selectedWorkoutIndex);

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

  // Rest day only if no exercises AND no workout completed today
  const isRestDay = selectedDayExercises.length === 0 && !isWorkoutCompleted;
  const isBorrowingPlanDay = selectedPlanDayName !== currentDay;

  const getGreeting = () => {
    const hour = new Date().getHours();
    const firstName = profile?.first_name || '';
    let greeting = '';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';
    
    if (firstName) {
      return `${greeting}, ${firstName}`;
    }
    return greeting.toUpperCase();
  };


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dayTitle}>{currentDay || 'Loading...'}</Text>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
          </View>
        </View>
        <LoadingScreen
          message="Loading workout..."
          style={styles.loadingContainer}
          centerInViewport
          chrome={{ top: WORKOUT_LOADING_HEADER_HEIGHT }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        ref={tourScrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: layout.tabBarHeight + insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onTourScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {!activeTemplate ? (
          <TourTarget id="tour.workout.card" testID="tour-workout-card">
          <Animated.View entering={FadeIn.duration(400).delay(50)} style={styles.card}>
            <View style={styles.iconContainer}>
              <Dumbbell size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.cardTitle}>No Active Workout Plan</Text>
            <Text style={styles.cardSubtext}>Create a plan in the Planner tab to get started!</Text>
          </Animated.View>
          </TourTarget>
        ) : (
          <>
            {isWorkoutCompleted && selectedDayExercises.length === 0 ? (
              <TourTarget id="tour.workout.card" testID="tour-workout-card">
              <Animated.View entering={FadeIn.duration(400).delay(50)} style={styles.card}>
                <View style={styles.restDayIconContainer}>
                  <Text style={styles.completedEmoji}>✓</Text>
                </View>
                <Text style={styles.restDayTitle}>Workout Complete!</Text>
                <Text style={styles.restDayText}>Great job today!</Text>
                <Text style={styles.cardSubtext}>
                  You can start a new workout or add exercises in the Planner tab.
                </Text>
              </Animated.View>
              </TourTarget>
            ) : isRestDay ? (
              <TourTarget id="tour.workout.card" testID="tour-workout-card">
              <Animated.View entering={FadeIn.duration(400).delay(50)} style={styles.card}>
                <View style={styles.restDayIconContainer}>
                  <Timer size={40} color={colors.workoutRestTitle} />
                </View>
                <Text style={styles.restDayTitle}>Rest Day</Text>
                <Text style={styles.restDayText}>Take it easy!</Text>
                <Text style={styles.cardSubtext}>You can pick another plan day to train today.</Text>
              </Animated.View>
              </TourTarget>
            ) : (
              <TourTarget id="tour.workout.card" testID="tour-workout-card">
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

                  <Text style={styles.workoutTitle}>Today&apos;s Workout</Text>
                  <Text style={styles.workoutSubtitle}>
                    Plan day: {selectedPlanDayName} • {selectedDayExercises.length} exercise
                    {selectedDayExercises.length !== 1 ? 's' : ''} scheduled
                  </Text>

                  {selectedSession?.status === 'active' && selectedSession.control_device === 'watch' && (
                    <Text style={styles.helperText}>
                      Active on Apple Watch — finish or abandon there. Phone controls stay locked for this session.
                    </Text>
                  )}

                  {isBorrowingPlanDay && (
                    <Text style={styles.helperText}>
                      Doing {selectedPlanDayName}&apos;s workout today
                    </Text>
                  )}

                  {selectedDayExercises.length > 0 && (
                    <View style={styles.exercisesContainer}>
                      {selectedDayExercises.slice(0, 3).map((exercise: { id: string; name: string; isTodayOnly?: boolean }, index: number) => (
                        <Animated.View
                          key={exercise.id || index}
                          entering={FadeIn.duration(300).delay(100 + index * 50)}
                          style={styles.exerciseItem}
                        >
                          <View style={styles.exerciseIcon}>
                            <Dumbbell size={12} color={colors.primary} />
                          </View>
                          <View style={styles.exerciseNameRow}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            {exercise.isTodayOnly && (
                              <View style={styles.todayOnlyTag}>
                                <Text style={styles.todayOnlyTagText}>
                                  {dayOnlyBadgeLabel(true)}
                                </Text>
                              </View>
                            )}
                          </View>
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
              </TourTarget>
            )}

            {/* Start/Continue Workout Button - Always visible */}
            <Animated.View entering={FadeIn.duration(400).delay(150)} style={styles.buttonContainer}>
              <TourTarget id="tour.workout.start" testID="tour-workout-start">
              {isWorkoutCompleted ? (
                <CircularButton
                  onPress={() => {}}
                  disabled={true}
                  text="Completed"
                  isCompleted={true}
                />
              ) : (
                <CircularButton
                  onPress={handleStartWorkout}
                  disabled={
                    isRestDay
                    || isStartingWorkout
                    || (selectedSession?.status === 'active' && selectedSession.control_device === 'watch')
                  }
                  text={
                    selectedSession?.status === 'active' && selectedSession.control_device === 'watch'
                      ? 'On Watch'
                      : hasActiveWorkout
                        ? 'Continue'
                        : isStartingWorkout
                          ? 'Starting...'
                          : 'Start'
                  }
                  isCompleted={false}
                />
              )}
              </TourTarget>
              {sessionsToday.length > 1 && (
                <View style={styles.planDayRow}>
                  <Text style={styles.planDayLabel}>
                    Workout {selectedWorkoutIndex + 1} of {sessionsToday.length}
                  </Text>
                  <Pressable onPress={openWorkoutPicker} style={styles.planDayChangeButton}>
                    <Text style={styles.planDayChangeText}>Change</Text>
                  </Pressable>
                </View>
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
                  Doing {selectedPlanDayName}&apos;s workout today
                </Text>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={showResetModal}
        title="Reset Workout?"
        message="This will delete your current workout progress and allow you to start from the beginning. This action cannot be undone."
        confirmLabel={isResetting ? 'Resetting...' : 'Reset Workout'}
        cancelLabel="Cancel"
        confirmDestructive
        confirmDisabled={isResetting}
        onConfirm={handleResetWorkout}
        onCancel={() => {
          if (!isResetting) setShowResetModal(false);
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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
    backgroundColor: colors.workoutGlowPrimary,
    borderRadius: 250,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 400,
    height: 400,
    backgroundColor: colors.workoutGlowAccent,
    borderRadius: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
    shadowColor: colors.workoutCardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
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
    backgroundColor: colors.workoutRestIconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  restDayTitle: {
    color: colors.workoutRestTitle,
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  restDayText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    marginBottom: spacing.sm,
  },
  completedEmoji: {
    fontSize: 48,
    color: colors.success,
  },
  workoutCard: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.workoutCardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
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
    backgroundColor: colors.workoutBadgePrimaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.workoutBadgePrimaryBorder,
  },
  badgePrimaryText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  badgeSecondary: {
    backgroundColor: colors.workoutBadgeSecondaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.workoutBadgeSecondaryBorder,
  },
  badgeSecondaryText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  resetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.workoutControlSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.workoutIconTintBg,
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
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    flex: 1,
  },
  todayOnlyTag: {
    backgroundColor: colors.workoutIconTintBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  todayOnlyTagText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  moreExercisesText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: spacing.xl, // Increased to prevent collision with workout banner
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
    borderColor: colors.workoutBadgePrimaryBorder,
    backgroundColor: colors.workoutBadgePrimaryBg,
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
    borderColor: colors.workoutDisabledRing,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  circularButtonInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularButtonInnerCompleted: {
    backgroundColor: colors.card,
  },
  circularButtonInnerDisabled: {
    backgroundColor: colors.workoutDisabledFill,
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
  },
  circularButtonTextCompleted: {
    color: colors.textMuted,
    fontSize: typography.sizes['2xl'],
    fontWeight: '700',
  },
  circularButtonTextDisabled: {
    color: colors.workoutDisabledText,
  },
  chooseWorkoutButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  chooseWorkoutText: {
    color: colors.onPrimaryContrast,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  }); }
