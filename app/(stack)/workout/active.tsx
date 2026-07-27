/**
 * Active Workout Screen (Improved Flow)
 * 
 * Flow:
 * 1. Set Execution: Show minimal info, quick RPE adjustment, Complete button
 * 2. Rest Timer: Auto-starts after completing each set
 * 3. Batch Logging: After all sets complete, log weight/reps for all sets at once
 * 4. Move to next exercise
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowDown, ArrowUp, CheckCircle, ChevronRight, Heart, Info, Link2, RefreshCcw, Repeat2, MoreVertical, Plus, Trash2, XCircle, ListOrdered } from 'lucide-react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../../src/lib/utils/theme';
import { useTheme } from '../../../src/lib/utils/ThemeContext';
import { RestTimer } from '../../../src/components/workout/RestTimer';
import { ExerciseTimer } from '../../../src/components/workout/ExerciseTimer';
import { computeHeldDurationSec, clampSessionDurationSec } from '../../../src/lib/utils/workoutDuration';
import { RPESlider } from '../../../src/components/workout/RPESlider';
import { listMergedExercisesCached } from '../../../src/lib/cache/exerciseCache';
import {
  getActiveSession,
  getSessionById,
  getSessionWithSets,
  markSetComplete,
  completeWorkoutSession,
  getLastCompletedWorkoutAt,
  prefillSessionSets,
  abandonWorkoutSession,
  getPreviousExercisePerformance,
  type PreviousPerformance,
  type SetType,
} from '../../../src/lib/supabase/queries/workouts';
import { invalidateSessionsInRangeForUser } from '../../../src/lib/cache/sessionsCache';
import { tryRandomPaywallFromOutside } from '../../../src/lib/subscriptions/paywallBridge';
import { LogoEdgeLoader } from '../../../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../../../src/components/ui/LoadingScreen';
import { invalidateMuscleFreshnessCache } from '../../../src/lib/cache/muscleFreshnessCache';
import { getTemplateSlotsForDay } from '../../../src/lib/supabase/queries/templates';
import { supabase } from '../../../src/lib/supabase/client';
import { useUserStore } from '../../../src/stores/userStore';
import { useUIStore } from '../../../src/stores/uiStore';
import { useToast } from '../../../src/hooks/useToast';
import { calculateWeightSuggestion } from '../../../src/lib/utils/weightSuggestions';
import { hapticHeavy, hapticSuccess } from '../../../src/lib/utils/haptics';
import { devError, devLog } from '../../../src/lib/utils/logger';
import { selectExerciseTargets } from '../../../src/lib/engine/targetSelection';
import { detectSessionStaleness } from '../../../src/lib/engine/sessionStaleness';
import {
  getSmartRefreshPlan,
  applySmartRefresh,
  applyStructureEditToSession,
  setSessionSupersetGroup,
  type SmartRefreshPlan,
} from '../../../src/lib/supabase/queries/workouts_helpers';
import { SmartRefreshConfirmationSheet } from '../../../src/components/ui/SmartRefreshConfirmationSheet';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { Button } from '../../../src/components/ui/Button';
import { useModal } from '../../../src/hooks/useModal';
import {
  updateWorkoutContext,
  clearWorkoutContext,
  addSetCompletedListener,
  addSkipRestListener,
  addExtendRestListener,
  addSubmitRpeListener,
  addHeartRateListener,
  addWorkoutEndedListener,
  addWatchStateChangedListener,
  getWatchState,
  startWatchApp,
  type WatchWorkoutContext,
} from '../../../modules/watch-connectivity';
import { REST_EXTEND_SEC } from '../../../src/lib/workout/restConstants';
import { formatPreviousPerformanceLabel } from '../../../src/lib/workout/formatPreviousPerformance';
import {
  appendHeartRateSample,
  setWatchHkWorkoutUuid,
  clearWorkoutHealthBuffer,
} from '../../../src/lib/health/workoutHealthBuffer';
import {
  resolveRestSec,
  getSupersetMembers,
  findNextStep,
} from '../../../src/lib/engine/workoutFlow';

interface Exercise {
  id: string; // session_exercise_id
  name: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  mode: 'reps' | 'timed';
  is_stretch?: boolean;
  notes?: string;
  superset_group?: number | null;
  rest_sec?: number | null;
  sets: SetData[];
}

interface SetData {
  id: string;
  set_number: number;
  reps?: number;
  weight?: number;
  duration_sec?: number;
  rpe?: number;
  rest_sec?: number | null;
  set_type?: SetType;
  completed: boolean;
}

interface SetLog {
  setNumber: number;
  weight: string; // empty string for timed exercises
  reps: string; // empty string for timed exercises
  duration_sec: string; // empty string for reps exercises
  rpe?: number;
  setType: SetType;
}

type WorkoutPhase = 
  | { type: 'execution'; setIndex: number } // Executing a set (minimal UI)
  | { type: 'timedSetRpe'; setIndex: number; elapsedDurationSec: number } // RPE after timed hold
  | { type: 'rest'; nextExerciseIndex: number; nextSetIndex: number } // Resting between sets
  | { type: 'logging' } // Batch logging after all sets
  | { type: 'complete' }; // All exercises complete

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];

const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
};

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const toast = useToast();
  const profile = useUserStore((state) => state.profile);
  const userId = profile?.id;
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(params.sessionId ?? null);
  const [sessionTemplateId, setSessionTemplateId] = useState<string | null>(null);
  const [sessionDayName, setSessionDayName] = useState<string | null>(null);
  const [controlDevice, setControlDevice] = useState<'phone' | 'watch'>('phone');
  const controlDeviceRef = useRef<'phone' | 'watch'>('phone');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>({ type: 'execution', setIndex: 0 });

  // Current set RPE tracking (during execution)
  const [currentSetRPEs, setCurrentSetRPEs] = useState<number[]>([]);

  // Batch logging state
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);

  // Weight suggestion
  const [suggestedWeight, setSuggestedWeight] = useState<string>('');

  // Previous performance for the current exercise (Hevy-style "last time" prefill context)
  const [prevPerformance, setPrevPerformance] = useState<PreviousPerformance | null>(null);

  // Reorder exercises modal
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderDraft, setReorderDraft] = useState<{ id: string; name: string }[]>([]);
  const [isSavingReorder, setIsSavingReorder] = useState(false);

  // Exercise info modal
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);
  const [isRecalculatingTargets, setIsRecalculatingTargets] = useState(false);

  // Smart Refresh: staleness and confirmation sheet
  const [staleness, setStaleness] = useState<{
    structural: boolean;
    biomechanical: boolean;
    target: boolean;
  } | null>(null);
  const [showRefreshSheet, setShowRefreshSheet] = useState(false);
  const [refreshPlan, setRefreshPlan] = useState<SmartRefreshPlan | null>(null);
  const [isApplyingRefresh, setIsApplyingRefresh] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [liveHeartRateBpm, setLiveHeartRateBpm] = useState<number | null>(null);
  const [restEndsAtEpoch, setRestEndsAtEpoch] = useState<number | null>(null);
  const [restStartedAtEpoch, setRestStartedAtEpoch] = useState<number | null>(null);

  // Workout overflow menu (Add exercise / Remove current exercise / Abandon workout)
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showRemoveExerciseConfirm, setShowRemoveExerciseConfirm] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [isMutatingExercises, setIsMutatingExercises] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const modal = useModal();

  useEffect(() => {
    if (userId) {
      loadActiveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadActiveSession is stable for session bootstrap
  }, [userId, params.sessionId]);

  // Load weight suggestion when exercise changes
  useEffect(() => {
    if (exercises.length > 0 && currentExerciseIndex < exercises.length) {
      loadWeightSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWeightSuggestion tracks exercise index only
  }, [currentExerciseIndex, exercises]);

  // Load previous performance when the exercise identity changes
  useEffect(() => {
    const exercise = exercises[currentExerciseIndex];
    const exerciseKey = exercise?.exercise_id || exercise?.custom_exercise_id;
    if (!exerciseKey || !userId) {
      setPrevPerformance(null);
      return;
    }
    let cancelled = false;
    getPreviousExercisePerformance(exerciseKey, userId).then((result) => {
      if (!cancelled) setPrevPerformance(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch when active exercise identity changes
  }, [currentExerciseIndex, exercises[currentExerciseIndex]?.id, userId]);

  // --- Apple Watch mirror ---------------------------------------------------
  // The watch renders whatever state the phone pushes; completion taps come
  // back as events and reuse the exact same handler as the on-screen button.
  const handleCompleteSetRef = useRef<(elapsedDurationSec?: number, rpeOverride?: number) => void>(() => {});
  const workoutPhaseRef = useRef(workoutPhase);
  workoutPhaseRef.current = workoutPhase;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;
  const currentExerciseIndexRef = useRef(currentExerciseIndex);
  currentExerciseIndexRef.current = currentExerciseIndex;
  const exerciseTimerEndsAtRef = useRef<number | null>(null);
  const [exerciseTimerEndsAt, setExerciseTimerEndsAt] = useState<number | null>(null);

  const resolveTimedHoldElapsed = (setIndex: number): number => {
    const target = exercises[currentExerciseIndex]?.sets[setIndex]?.duration_sec ?? 0;
    const endsAt = exerciseTimerEndsAtRef.current;
    if (endsAt != null) {
      const remaining = Math.max(0, Math.ceil(endsAt - Date.now() / 1000));
      return computeHeldDurationSec(target, remaining);
    }
    return target;
  };

  const setExerciseTimerEnd = (endsAtEpochSec: number | null) => {
    exerciseTimerEndsAtRef.current = endsAtEpochSec;
    setExerciseTimerEndsAt(endsAtEpochSec);
  };

  const advanceFromRestRef = useRef<() => void>(() => {});
  const extendRestByRef = useRef<(seconds: number) => void>(() => {});

  const advanceFromRest = () => {
    const phase = workoutPhaseRef.current;
    if (phase.type !== 'rest') return;

    setRestEndsAtEpoch(null);
    setRestStartedAtEpoch(null);

    const exerciseList = exercisesRef.current;
    const exerciseIdx = currentExerciseIndexRef.current;
    if (phase.nextExerciseIndex !== exerciseIdx) {
      const rpes = exerciseList[phase.nextExerciseIndex].sets.map((s) => s.rpe || 7);
      setCurrentExerciseIndex(phase.nextExerciseIndex);
      setCurrentSetRPEs(rpes);
    }
    setWorkoutPhase({ type: 'execution', setIndex: phase.nextSetIndex });
  };
  advanceFromRestRef.current = advanceFromRest;

  const extendRestBy = (seconds: number) => {
    if (workoutPhaseRef.current.type !== 'rest') return;
    setRestEndsAtEpoch((prev) => (prev != null ? prev + seconds : prev));
  };
  extendRestByRef.current = extendRestBy;

  useEffect(() => {
    const unsubscribe = addSetCompletedListener((event) => {
      // Watch events only drive phone-owned sessions (mirror mode).
      if (controlDeviceRef.current !== 'phone') return;
      if (workoutPhaseRef.current.type !== 'execution') return;

      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || event.sessionId !== activeSessionId) {
        if (__DEV__) {
          devLog('workout-active', {
            action: 'watch_completeSet_ignored',
            reason: 'session_mismatch',
            expectedSessionId: activeSessionId,
            receivedSessionId: event.sessionId,
          });
        }
        return;
      }

      const expectedSetNumber =
        workoutPhaseRef.current.type === 'execution'
          ? workoutPhaseRef.current.setIndex + 1
          : -1;
      if (event.setNumber !== expectedSetNumber) {
        if (__DEV__) {
          devLog('workout-active', {
            action: 'watch_completeSet_ignored',
            reason: 'set_mismatch',
            expectedSetNumber,
            receivedSetNumber: event.setNumber,
          });
        }
        return;
      }

      const WATCH_EVENT_MAX_AGE_MS = 5 * 60 * 1000;
      if (event.sentAt && Date.now() - event.sentAt * 1000 > WATCH_EVENT_MAX_AGE_MS) {
        if (__DEV__) {
          devLog('workout-active', { action: 'watch_completeSet_ignored', reason: 'stale_event' });
        }
        return;
      }

      handleCompleteSetRef.current();
    });
    // Do not clear watch context on unmount — only on complete/abandon so mirror
    // mode survives navigating away from the active screen briefly.
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubSkip = addSkipRestListener((event) => {
      if (controlDeviceRef.current !== 'phone') return;
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || event.sessionId !== activeSessionId) return;
      if (workoutPhaseRef.current.type !== 'rest') return;
      advanceFromRestRef.current();
    });

    const unsubExtend = addExtendRestListener((event) => {
      if (controlDeviceRef.current !== 'phone') return;
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || event.sessionId !== activeSessionId) return;
      if (workoutPhaseRef.current.type !== 'rest') return;
      extendRestByRef.current(event.seconds);
    });

    const unsubRpe = addSubmitRpeListener((event) => {
      if (controlDeviceRef.current !== 'phone') return;
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || event.sessionId !== activeSessionId) return;
      const phase = workoutPhaseRef.current;
      if (phase.type !== 'timedSetRpe') return;
      if (event.setNumber !== phase.setIndex + 1) return;
      setCurrentSetRPEs((prev) => {
        const updated = [...prev];
        updated[phase.setIndex] = event.rpe;
        return updated;
      });
      handleCompleteSetRef.current(undefined, event.rpe);
    });

    return () => {
      unsubSkip();
      unsubExtend();
      unsubRpe();
    };
  }, []);

  const watchAppOpenedRef = useRef<string | null>(null);
  const latestWatchContextRef = useRef<WatchWorkoutContext | null>(null);

  useEffect(() => {
    if (loading || !sessionId || controlDevice !== 'phone') return;
    if (watchAppOpenedRef.current === sessionId) return;
    watchAppOpenedRef.current = sessionId;
    void getWatchState().then((state) => {
      if (state.installed) {
        void startWatchApp(sessionId);
      }
    });
  }, [loading, sessionId, controlDevice]);

  useEffect(() => {
    const unsub = addWatchStateChangedListener((state) => {
      if (!state.paired || !state.installed) return;
      const ctx = latestWatchContextRef.current;
      if (ctx?.active) {
        void updateWorkoutContext(ctx);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubHr = addHeartRateListener((event) => {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || event.sessionId !== activeSessionId) return;
      appendHeartRateSample(activeSessionId, event.bpm, event.timestamp);
      setLiveHeartRateBpm(event.bpm);
    });

    const unsubEnded = addWorkoutEndedListener((event) => {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId || event.sessionId !== activeSessionId) return;
      setWatchHkWorkoutUuid(activeSessionId, event.hkWorkoutUuid);
      if (__DEV__) {
        devLog('workout-active', {
          action: 'watch_workout_ended',
          hkWorkoutUuid: event.hkWorkoutUuid,
        });
      }
    });

    return () => {
      unsubHr();
      unsubEnded();
    };
  }, []);

  const executionSetIndex = workoutPhase.type === 'execution' ? workoutPhase.setIndex : -1;

  useEffect(() => {
    if (workoutPhase.type !== 'execution') {
      setExerciseTimerEnd(null);
      return;
    }
    setExerciseTimerEnd(null);
  }, [currentExerciseIndex, executionSetIndex, workoutPhase.type]);

  useEffect(() => {
    if (loading || !sessionId) return;
    // Phone only pushes mirror context when it owns the session.
    if (controlDevice !== 'phone') {
      latestWatchContextRef.current = null;
      return;
    }
    const exercise = exercises[currentExerciseIndex];
    if (!exercise) {
      latestWatchContextRef.current = null;
      return;
    }

    const unitsLabel = profile?.use_imperial ? 'lbs' : 'kg';
    const formatSetTarget = (set?: SetData): string => {
      if (!set) return '';
      if (exercise.mode === 'timed') {
        return set.duration_sec ? `${set.duration_sec}s hold` : '';
      }
      const reps = set.reps ?? 0;
      return set.weight ? `${set.weight} ${unitsLabel} × ${reps}` : `${reps} reps`;
    };

    const members = getSupersetMembers(exercises, currentExerciseIndex);
    const supersetLabel =
      members.length > 1
        ? `Superset ${members.indexOf(currentExerciseIndex) + 1} of ${members.length}`
        : undefined;

    const progressText = `Exercise ${currentExerciseIndex + 1} of ${exercises.length}`;

    const pushWatchContext = (ctx: WatchWorkoutContext) => {
      latestWatchContextRef.current = ctx;
      void updateWorkoutContext(ctx);
    };

    if (workoutPhase.type === 'execution') {
      const set = exercise.sets[workoutPhase.setIndex];
      const nextSet = exercise.sets[workoutPhase.setIndex + 1];
      const lastTimeText = formatPreviousPerformanceLabel(prevPerformance, {
        mode: exercise.mode,
        setNumber: set?.set_number,
        useImperial: profile?.use_imperial,
      });
      pushWatchContext({
        active: true,
        sessionId,
        controlDevice: 'phone',
        exerciseName: exercise.name,
        setNumber: workoutPhase.setIndex + 1,
        totalSets: exercise.sets.length,
        targetText: formatSetTarget(set),
        setType: set?.set_type ?? 'normal',
        phase: 'execution',
        progressText,
        ...(lastTimeText ? { lastTimeText } : {}),
        ...(exerciseTimerEndsAt != null ? { exerciseEndsAt: exerciseTimerEndsAt } : {}),
        nextUp: nextSet ? `Set ${workoutPhase.setIndex + 2}` : exercises[currentExerciseIndex + 1]?.name,
        supersetLabel,
      });
    } else if (workoutPhase.type === 'timedSetRpe') {
      pushWatchContext({
        active: true,
        sessionId,
        controlDevice: 'phone',
        exerciseName: exercise.name,
        setNumber: workoutPhase.setIndex + 1,
        totalSets: exercise.sets.length,
        targetText: `${workoutPhase.elapsedDurationSec}s held`,
        phase: 'setRpe',
        timedSetRpe: true,
        progressText,
        supersetLabel,
      });
    } else if (workoutPhase.type === 'rest') {
      const nextExercise = exercises[workoutPhase.nextExerciseIndex] ?? exercise;
      pushWatchContext({
        active: true,
        sessionId,
        controlDevice: 'phone',
        exerciseName: exercise.name,
        setNumber: workoutPhase.nextSetIndex + 1,
        totalSets: nextExercise.sets.length,
        targetText: '',
        phase: 'rest',
        ...(restEndsAtEpoch != null ? { restEndsAt: restEndsAtEpoch } : {}),
        progressText,
        nextUp:
          workoutPhase.nextExerciseIndex !== currentExerciseIndex
            ? `${nextExercise.name} — Set ${workoutPhase.nextSetIndex + 1}`
            : `Set ${workoutPhase.nextSetIndex + 1} of ${exercise.sets.length}`,
        supersetLabel,
      });
    } else if (workoutPhase.type === 'logging') {
      pushWatchContext({
        active: true,
        sessionId,
        controlDevice: 'phone',
        exerciseName: exercise.name,
        setNumber: exercise.sets.length,
        totalSets: exercise.sets.length,
        phase: 'logging',
        progressText,
        supersetLabel,
      });
    } else {
      pushWatchContext({
        active: true,
        sessionId,
        controlDevice: 'phone',
        exerciseName: exercise.name,
        setNumber: exercise.sets.length,
        totalSets: exercise.sets.length,
        phase: 'complete',
        progressText,
      });
    }
  }, [loading, sessionId, controlDevice, exercises, currentExerciseIndex, workoutPhase, profile?.use_imperial, exerciseTimerEndsAt, restEndsAtEpoch, prevPerformance]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const loadActiveSession = async () => {
    if (!userId) return;

    setLoading(true);
    if (__DEV__) {
      const { devLog } = require('../../../src/lib/utils/logger');
      devLog('workout-active', { action: 'loadActiveSession_start', sessionId: params.sessionId });
    }
    try {
      const session = params.sessionId
        ? await getSessionById(userId, params.sessionId)
        : await getActiveSession(userId);
      if (!session) {
        toast.error(params.sessionId ? 'Workout not found' : 'No active workout found');
        goBack();
        return;
      }

      const device = session.control_device === 'watch' ? 'watch' : 'phone';
      if (device === 'watch') {
        if (__DEV__) {
          const { devLog } = require('../../../src/lib/utils/logger');
          devLog('workout-active', {
            action: 'loadActiveSession_blocked_watch_owned',
            sessionId: session.id,
          });
        }
        toast.error('This workout is active on Apple Watch');
        goBack();
        return;
      }

      setSessionId(session.id);
      setSessionTemplateId(session.template_id ?? null);
      setSessionDayName(session.day_name ?? null);
      setControlDevice(device);
      controlDeviceRef.current = device;

      const sessionData = await getSessionWithSets(session.id);
      if (!sessionData) {
        toast.error('Failed to load workout data');
        return;
      }

      const exerciseIds = [
        ...new Set(
          sessionData.exercises
            .flatMap((ex) => [ex.exercise_id, ex.custom_exercise_id].filter(Boolean) as string[])
        ),
      ];
      const mergedList = exerciseIds.length > 0
        ? await listMergedExercisesCached(userId, exerciseIds)
        : [];
      const metaById = new Map(mergedList.map((m) => [m.id, m]));

      const exercisesWithMeta: Exercise[] = [];
      for (const ex of sessionData.exercises) {
        const key = ex.exercise_id || ex.custom_exercise_id;
        const meta = key ? metaById.get(key) : null;
        if (meta) {
          exercisesWithMeta.push({
            id: ex.id,
            name: meta.name,
            exercise_id: ex.exercise_id,
            custom_exercise_id: ex.custom_exercise_id,
            mode: meta.is_timed ? 'timed' : 'reps',
            is_stretch: meta.is_stretch === true,
            notes: ex.notes,
            superset_group: ex.superset_group ?? null,
            rest_sec: ex.rest_sec ?? null,
            sets: ex.sets.map((s) => ({ ...s, completed: !!s.performed_at })),
          });
        }
      }

      setExercises(exercisesWithMeta);

      // Find first incomplete exercise and resume at its first incomplete set
      let foundIncomplete = false;
      for (let i = 0; i < exercisesWithMeta.length; i++) {
        const firstIncompleteSetIndex = exercisesWithMeta[i].sets.findIndex(s => !s.completed);
        if (firstIncompleteSetIndex >= 0) {
          setCurrentExerciseIndex(i);
          // Initialize RPEs from existing set data or default to 7
          const rpes = exercisesWithMeta[i].sets.map(s => s.rpe || 7);
          setCurrentSetRPEs(rpes);
          setWorkoutPhase({ type: 'execution', setIndex: firstIncompleteSetIndex });
          foundIncomplete = true;
          break;
        }
      }

      if (!foundIncomplete && exercisesWithMeta.length > 0) {
        // All exercises complete
        setWorkoutPhase({ type: 'complete' });
      }

      // Smart Refresh: detect staleness when session has template + day
      if (session?.template_id && session?.day_name && userId) {
        try {
          const [templateSlots, lastCompletedAt] = await Promise.all([
            getTemplateSlotsForDay(session.template_id, session.day_name),
            getLastCompletedWorkoutAt(userId),
          ]);
          const result = detectSessionStaleness({
            session: {
              id: session.id,
              template_id: session.template_id,
              day_name: session.day_name,
              started_at: session.started_at,
            },
            sessionExercises: sessionData.exercises.map((e) => ({
              exercise_id: e.exercise_id,
              custom_exercise_id: e.custom_exercise_id,
              sort_order: e.sort_order,
            })),
            templateSlots: templateSlots.map((s) => ({
              exercise_id: s.exercise_id,
              custom_exercise_id: s.custom_exercise_id,
              sort_order: s.sort_order,
            })),
            lastCompletedWorkoutAt: lastCompletedAt ?? undefined,
          });
          setStaleness(result);
        } catch {
          setStaleness(null);
        }
      } else {
        setStaleness(null);
      }
      if (__DEV__) {
        const { devLog } = require('../../../src/lib/utils/logger');
        devLog('workout-active', { action: 'loadActiveSession_done', exerciseCount: exercisesWithMeta.length });
      }
    } catch (error) {
      if (__DEV__) {
        const { devError } = require('../../../src/lib/utils/logger');
        devError('workout-active', error, { action: 'loadActiveSession' });
      }
      toast.error('Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const loadWeightSuggestion = async () => {
    if (!userId) return;

    const exercise = exercises[currentExerciseIndex];
    if (!exercise) return;

    const firstSet = exercise.sets[0];
    if (!firstSet) return;

    const suggestion = await calculateWeightSuggestion(
      exercise.exercise_id,
      exercise.custom_exercise_id,
      userId,
      firstSet.set_number,
      exercise.mode,
      firstSet.reps,
      firstSet.duration_sec
    );

    // Set suggested weight for display (use existing set weight or suggestion)
    const firstSetWeight = exercise.sets[0]?.weight;
    if (firstSetWeight !== undefined && firstSetWeight !== null) {
      setSuggestedWeight(firstSetWeight === 0 ? 'Bodyweight' : firstSetWeight.toString());
    } else if (suggestion.weight !== undefined) {
      setSuggestedWeight(suggestion.weight === 0 ? 'Bodyweight' : suggestion.weight.toString());
    } else {
      setSuggestedWeight('');
    }
    
    // Pre-fill all sets for batch logging.
    // Priority for each field: 1) existing set value (from Edit Defaults), 2) engine suggestion.
    const logs: SetLog[] = exercise.sets.map((set, idx) => ({
      setNumber: set.set_number,
      weight: set.weight !== undefined && set.weight !== null
        ? set.weight.toString()
        : (suggestion.weight !== undefined ? suggestion.weight.toString() : ''),
      reps: set.reps?.toString() || '',
      duration_sec: set.duration_sec !== undefined && set.duration_sec !== null
        ? set.duration_sec.toString()
        : (suggestion.duration_sec !== undefined ? suggestion.duration_sec.toString() : ''),
      ...(exercise.is_stretch ? {} : { rpe: currentSetRPEs[idx] || set.rpe || 7 }),
      setType: set.set_type ?? 'normal',
    }));
    setSetLogs(logs);
  };

  const handleRecalculateTargets = async () => {
    if (!userId || !sessionId || exercises.length === 0) {
      return;
    }

    setIsRecalculatingTargets(true);
    try {
      let updatedSetCount = 0;
      const experience = profile?.experience_level || 'beginner';

      for (const exercise of exercises) {
        const exerciseRef = {
          exerciseId: exercise.exercise_id,
          customExerciseId: exercise.custom_exercise_id,
        };

        const target = await selectExerciseTargets(
          exerciseRef,
          userId,
          { experience },
          0
        );

        if (!target) continue;

        for (const set of exercise.sets) {
          if (set.completed) continue;

          const updatePayload: {
            reps?: number | null;
            weight?: number | null;
            duration_sec?: number | null;
          } = {};

          if (target.mode === 'reps') {
            if (target.reps !== undefined) {
              updatePayload.reps = target.reps;
            }
            if (target.weight !== undefined) {
              updatePayload.weight = target.weight;
            }
          } else {
            if (target.duration_sec !== undefined) {
              updatePayload.duration_sec = target.duration_sec;
            }
          }

          if (Object.keys(updatePayload).length === 0) {
            continue;
          }

          const { error } = await supabase
            .from('v2_session_sets')
            .update(updatePayload)
            .eq('id', set.id)
            .is('performed_at', null);

          if (!error) {
            updatedSetCount += 1;
          }
        }
      }

      if (updatedSetCount > 0) {
        toast.success(
          `Recalculated targets for ${updatedSetCount} set${updatedSetCount === 1 ? '' : 's'}`
        );
        await loadActiveSession();
      } else {
        toast.info?.('No incomplete sets to update');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error recalculating targets:', error);
      }
      toast.error('Failed to recalculate targets');
    } finally {
      setIsRecalculatingTargets(false);
    }
  };

  /** Switch the active exercise, re-seeding the per-set RPE array from its sets. */
  const moveToExercise = (exerciseList: Exercise[], exerciseIndex: number) => {
    setCurrentExerciseIndex(exerciseIndex);
    const rpes = exerciseList[exerciseIndex].sets.map((s) => s.rpe || 7);
    setCurrentSetRPEs(rpes);
  };

  const goToTimedSetRpeStep = (setIndex: number, elapsedDurationSec: number) => {
    setExerciseTimerEnd(null);
    setWorkoutPhase({ type: 'timedSetRpe', setIndex, elapsedDurationSec });
  };

  const handleCompleteSet = async (elapsedDurationSec?: number, rpeOverride?: number) => {
    const exercise = exercises[currentExerciseIndex];

    if (workoutPhase.type !== 'execution' && workoutPhase.type !== 'timedSetRpe') return;

    const currentSetIdx = workoutPhase.setIndex;
    const isStretch = exercise.is_stretch === true;

    // Timed strength: watch early-complete during execution → RPE step first
    if (
      workoutPhase.type === 'execution' &&
      exercise.mode === 'timed' &&
      !isStretch &&
      elapsedDurationSec === undefined
    ) {
      const elapsed = resolveTimedHoldElapsed(currentSetIdx);
      goToTimedSetRpeStep(currentSetIdx, elapsed);
      return;
    }

    hapticHeavy();

    let timedDurationSec = elapsedDurationSec;
    if (workoutPhase.type === 'timedSetRpe') {
      timedDurationSec = workoutPhase.elapsedDurationSec;
    } else if (exercise.mode === 'timed' && timedDurationSec === undefined) {
      timedDurationSec = resolveTimedHoldElapsed(currentSetIdx);
    }

    // Update RPE for this set (strength only)
    const updatedRPEs = [...currentSetRPEs];
    if (!isStretch) {
      updatedRPEs[currentSetIdx] = rpeOverride ?? (currentSetRPEs[currentSetIdx] || 7);
      setCurrentSetRPEs(updatedRPEs);
    }

    // Persist set immediately so progress survives an unexpected exit, then
    // user can fine-tune in the batch logging phase. Always mark complete with
    // performed_at so the "Continue" button surfaces on the workout tab.
    const currentSet = exercise.sets[currentSetIdx];
    let updatedExercises = exercises;
    if (currentSet) {
      // Preserve set_type so a warmup completed by tap/watch isn't saved as 'normal'.
      if (exercise.mode === 'reps') {
        const hasValidDefaults = currentSet.weight !== null && currentSet.weight !== undefined &&
                                 currentSet.reps !== null && currentSet.reps !== undefined;
        await markSetComplete(currentSet.id, {
          weight: hasValidDefaults ? currentSet.weight! : 0,
          reps: hasValidDefaults ? currentSet.reps! : (currentSet.reps || 0),
          ...(isStretch ? {} : { rpe: updatedRPEs[currentSetIdx] }),
          set_type: currentSet.set_type ?? 'normal',
        });
      } else {
        const heldSec = timedDurationSec ?? currentSet.duration_sec ?? 0;
        const persistedSec = clampSessionDurationSec(heldSec);
        if (__DEV__) {
          const { devLog } = require('../../../src/lib/utils/logger');
          devLog('workout-active', {
            action: 'complete_timed_set',
            setIndex: currentSetIdx,
            targetDurationSec: currentSet.duration_sec,
            heldSec,
            persistedSec,
          });
        }
        await markSetComplete(currentSet.id, {
          duration_sec: persistedSec,
          ...(isStretch ? {} : { rpe: updatedRPEs[currentSetIdx] }),
          set_type: currentSet.set_type ?? 'normal',
        });
      }

      updatedExercises = exercises.map((ex, idx) =>
        idx === currentExerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, sIdx) =>
                sIdx === currentSetIdx
                  ? {
                      ...s,
                      completed: true,
                      ...(exercise.mode === 'timed'
                        ? { duration_sec: timedDurationSec ?? s.duration_sec }
                        : {}),
                      ...(isStretch ? {} : { rpe: updatedRPEs[currentSetIdx] }),
                    }
                  : s
              ),
            }
          : ex
      );
      setExercises(updatedExercises);
    }

    setExerciseTimerEnd(null);

    const next = findNextStep(updatedExercises, currentExerciseIndex);

    if (next.kind === 'log') {
      // Every set in this exercise (or superset group) is done → batch logging,
      // starting with the first member of the group.
      const members = getSupersetMembers(updatedExercises, currentExerciseIndex);
      if (members[0] !== currentExerciseIndex) {
        moveToExercise(updatedExercises, members[0]);
      }
      setWorkoutPhase({ type: 'logging' });
    } else if (next.withRest) {
      const justCompletedSet = [...updatedExercises[currentExerciseIndex].sets]
        .reverse()
        .find((s) => s.completed);
      const restDuration = resolveRestSec(
        updatedExercises[currentExerciseIndex],
        justCompletedSet ?? updatedExercises[currentExerciseIndex].sets[0],
      );
      if (restDuration <= 0) {
        if (next.exerciseIndex !== currentExerciseIndex) {
          moveToExercise(updatedExercises, next.exerciseIndex);
        }
        setWorkoutPhase({ type: 'execution', setIndex: next.setIndex });
      } else {
        const nowSec = Date.now() / 1000;
        const restEndsAt = nowSec + restDuration;
        setRestStartedAtEpoch(nowSec);
        setRestEndsAtEpoch(restEndsAt);
        setWorkoutPhase({
          type: 'rest',
          nextExerciseIndex: next.exerciseIndex,
          nextSetIndex: next.setIndex,
        });
        if (__DEV__) {
          const { devLog } = require('../../../src/lib/utils/logger');
          devLog('workout-active', {
            action: 'enter_rest_phase',
            restDuration,
            restEndsAtEpoch: restEndsAt,
            nextExerciseIndex: next.exerciseIndex,
            nextSetIndex: next.setIndex,
          });
        }
      }
    } else {
      // Superset: move straight to the partner exercise with no rest
      moveToExercise(updatedExercises, next.exerciseIndex);
      setWorkoutPhase({ type: 'execution', setIndex: next.setIndex });
    }
  };
  // Keep the watch-event handler pointing at the latest closure.
  handleCompleteSetRef.current = handleCompleteSet;

  const handleSaveAndContinue = async () => {
    const exercise = exercises[currentExerciseIndex];

    const hasErrors = setLogs.some(log => {
      if (exercise.mode === 'reps') {
        // Allow 0 weight for bodyweight exercises
        const weight = parseFloat(log.weight);
        const reps = parseInt(log.reps);
        return log.weight === '' || isNaN(weight) || weight < 0 || log.reps === '' || isNaN(reps) || reps <= 0;
      }
      // timed: require a positive duration
      const duration = parseInt(log.duration_sec);
      return log.duration_sec === '' || isNaN(duration) || duration <= 0;
    });

    if (hasErrors) {
      toast.error(
        exercise.mode === 'reps'
          ? 'Please fill in valid weight and reps'
          : 'Please enter a valid duration in seconds'
      );
      return;
    }

    for (const log of setLogs) {
      const set = exercise.sets[log.setNumber - 1];
      const includeRpe = exercise.is_stretch !== true && log.rpe != null;
      const payload = exercise.mode === 'reps'
        ? {
            weight: parseFloat(log.weight),
            reps: parseInt(log.reps),
            ...(includeRpe ? { rpe: log.rpe } : {}),
            set_type: log.setType,
          }
        : {
            duration_sec: parseInt(log.duration_sec),
            ...(includeRpe ? { rpe: log.rpe } : {}),
            set_type: log.setType,
          };

      const success = await markSetComplete(set.id, payload);

      if (!success) {
        toast.error(`Failed to save set ${log.setNumber}`);
        return;
      }
    }

    const updatedExercises = exercises.map((ex, idx) =>
      idx === currentExerciseIndex
        ? {
            ...ex,
            sets: ex.sets.map((s, sIdx) => {
              const log = setLogs[sIdx];
              if (ex.mode === 'reps') {
                return {
                  ...s,
                  weight: parseFloat(log.weight),
                  reps: parseInt(log.reps),
                  ...(ex.is_stretch ? {} : { rpe: log.rpe }),
                  set_type: log.setType,
                  completed: true,
                };
              }
              return {
                ...s,
                duration_sec: parseInt(log.duration_sec),
                ...(ex.is_stretch ? {} : { rpe: log.rpe }),
                set_type: log.setType,
                completed: true,
              };
            }),
          }
        : ex
    );
    setExercises(updatedExercises);

    // Move to next exercise
    const isLastExercise = currentExerciseIndex === exercises.length - 1;
    
    if (isLastExercise) {
      setWorkoutPhase({ type: 'complete' });
      toast.success('All exercises complete!');
    } else {
      const nextIndex = currentExerciseIndex + 1;
      const nextExercise = updatedExercises[nextIndex];
      moveToExercise(updatedExercises, nextIndex);
      const firstIncompleteSet = nextExercise.sets.findIndex((s) => !s.completed);
      if (firstIncompleteSet < 0) {
        // Already executed (superset partner): review its logs next
        setWorkoutPhase({ type: 'logging' });
      } else {
        setWorkoutPhase({ type: 'execution', setIndex: firstIncompleteSet });
      }
    }
  };

  const handleCompleteWorkout = async () => {
    if (!sessionId) return;
    if (isCompleting) return;
    setIsCompleting(true);

    const success = await completeWorkoutSession(sessionId);
    if (success) {
      const userId = useUserStore.getState().profile?.id;
      if (userId) {
        invalidateSessionsInRangeForUser(userId);
        invalidateMuscleFreshnessCache(userId);
      }
      useUIStore.getState().setWorkoutNeedsRefetch(true);
      void clearWorkoutContext();
      if (sessionId) clearWorkoutHealthBuffer(sessionId);
      hapticSuccess();
      toast.success('Workout completed!');
      tryRandomPaywallFromOutside('finish_workout');
      goBack();
    } else {
      setIsCompleting(false);
      toast.error('Failed to complete workout');
    }
  };

  /**
   * Add one or more exercises to the live session without altering the user's saved
   * template. Batch-inserts v2_session_exercises rows and prefills default sets from
   * selectExerciseTargets for each, scoped to the currently-running session.
   */
  const handleAddExercisesToSession = async (exerciseIds: string[]) => {
    if (!sessionId || !userId || exerciseIds.length === 0) return;
    setIsMutatingExercises(true);
    try {
      const experience = profile?.experience_level || 'beginner';

      const targetsMap = new Map<
        string,
        { sets: number; reps?: number; duration_sec?: number; weight?: number }
      >();
      const targets = await Promise.all(
        exerciseIds.map((id) => selectExerciseTargets({ exerciseId: id }, userId, { experience }, 0)),
      );
      const resolvedIds: string[] = [];
      targets.forEach((target, i) => {
        if (target) {
          resolvedIds.push(exerciseIds[i]);
          targetsMap.set(exerciseIds[i], {
            sets: target.sets,
            reps: target.reps,
            duration_sec: target.duration_sec,
            weight: target.weight,
          });
        }
      });
      if (resolvedIds.length === 0) {
        toast.error('Could not load defaults for those exercises');
        return;
      }

      const baseSortOrder = exercises.length;
      const insertRows = resolvedIds.map((exerciseId, i) => ({
        session_id: sessionId,
        exercise_id: exerciseId,
        custom_exercise_id: null,
        sort_order: baseSortOrder + i + 1,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('v2_session_exercises')
        .insert(insertRows)
        .select();
      if (insertErr || !inserted || inserted.length === 0) {
        if (__DEV__) {
          devError('workout-active', insertErr || new Error('insert failed'), {
            action: 'addExercisesToSession',
            sessionId,
            count: resolvedIds.length,
          });
        }
        toast.error('Failed to add exercises');
        return;
      }

      await prefillSessionSets(sessionId, inserted, targetsMap);

      hapticSuccess();
      toast.success(inserted.length === 1 ? 'Exercise added' : `${inserted.length} exercises added`);
      tryRandomPaywallFromOutside('add_exercise');
      await loadActiveSession();
    } catch (error) {
      if (__DEV__) devError('workout-active', error, { action: 'addExercisesToSession' });
      toast.error('Failed to add exercises');
    } finally {
      setIsMutatingExercises(false);
    }
  };

  /**
   * Remove the currently-displayed exercise from the live session. Refuses if the user
   * has already logged a completed set for that exercise — those sets are part of the
   * workout's truth and must not be silently destroyed. Caller should surface a confirm
   * dialog before invoking.
   */
  const handleRemoveCurrentExercise = async () => {
    const target = exercises[currentExerciseIndex];
    if (!target || !sessionId) return;

    const hasCompletedSet = target.sets.some((s) => s.completed);
    if (hasCompletedSet) {
      toast.error('Cannot remove an exercise with completed sets');
      setShowRemoveExerciseConfirm(false);
      return;
    }

    setIsMutatingExercises(true);
    try {
      const { error } = await supabase
        .from('v2_session_exercises')
        .delete()
        .eq('id', target.id);
      if (error) {
        if (__DEV__) {
          devError('workout-active', error, {
            action: 'removeCurrentExercise',
            sessionExerciseId: target.id,
          });
        }
        toast.error('Failed to remove exercise');
        return;
      }
      toast.success('Exercise removed');
      setShowRemoveExerciseConfirm(false);

      // If we just removed the last exercise in the list, step back so the UI doesn't
      // index out-of-bounds before reload completes.
      if (currentExerciseIndex >= exercises.length - 1 && currentExerciseIndex > 0) {
        setCurrentExerciseIndex(currentExerciseIndex - 1);
      }
      await loadActiveSession();
    } catch (error) {
      if (__DEV__) devError('workout-active', error, { action: 'removeCurrentExercise' });
      toast.error('Failed to remove exercise');
    } finally {
      setIsMutatingExercises(false);
    }
  };

  /**
   * Replace the current exercise in-place: swap the session exercise reference,
   * drop its (incomplete) prefilled sets, and prefill fresh targets for the new
   * movement. Blocked when any set has already been completed.
   */
  const handleReplaceCurrentExercise = async (newExerciseId: string) => {
    const target = exercises[currentExerciseIndex];
    if (!target || !sessionId || !userId) return;

    if (target.sets.some((s) => s.completed)) {
      toast.error('Cannot replace an exercise with completed sets');
      return;
    }

    setIsMutatingExercises(true);
    try {
      const swapped = await applyStructureEditToSession(sessionId, userId, {
        type: 'swapExercise',
        targetSessionExerciseId: target.id,
        newExerciseId,
      });
      if (!swapped) {
        toast.error('Failed to replace exercise');
        return;
      }

      // Old prefilled sets carry the previous movement's targets; rebuild them.
      await supabase.from('v2_session_sets').delete().eq('session_exercise_id', target.id);

      const newTarget = await selectExerciseTargets(
        { exerciseId: newExerciseId },
        userId,
        { experience: profile?.experience_level || 'beginner' },
        0,
      );
      if (newTarget) {
        const targetsMap = new Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>();
        targetsMap.set(newExerciseId, {
          sets: newTarget.sets,
          reps: newTarget.reps,
          duration_sec: newTarget.duration_sec,
          weight: newTarget.weight,
        });
        await prefillSessionSets(sessionId, [{ id: target.id, exercise_id: newExerciseId }], targetsMap);
      }

      hapticSuccess();
      toast.success('Exercise replaced');
      await loadActiveSession();
    } catch (error) {
      if (__DEV__) devError('workout-active', error, { action: 'replaceCurrentExercise' });
      toast.error('Failed to replace exercise');
    } finally {
      setIsMutatingExercises(false);
    }
  };

  const openReplaceExercisePicker = () => {
    setShowOverflowMenu(false);
    const target = exercises[currentExerciseIndex];
    if (target?.sets.some((s) => s.completed)) {
      toast.error('Cannot replace an exercise with completed sets');
      return;
    }
    modal.openSheet('exercisePicker', {
      onSelect: (exercise: { id: string }) => {
        modal.closeSheet();
        if (exercise?.id) {
          void handleReplaceCurrentExercise(exercise.id);
        }
      },
    });
  };

  /**
   * Link the current exercise with the next one as a superset, or remove the
   * current exercise from its superset. Groups with a single remaining member
   * are dissolved.
   */
  const handleToggleSuperset = async () => {
    setShowOverflowMenu(false);
    const current = exercises[currentExerciseIndex];
    if (!current) return;

    setIsMutatingExercises(true);
    try {
      if (current.superset_group != null) {
        const remaining = exercises.filter(
          (ex, i) => i !== currentExerciseIndex && ex.superset_group === current.superset_group,
        );
        const ok = await setSessionSupersetGroup([current.id], null);
        if (!ok) {
          toast.error('Failed to update superset');
          return;
        }
        if (remaining.length === 1) {
          await setSessionSupersetGroup([remaining[0].id], null);
        }
        toast.success('Removed from superset');
      } else {
        const next = exercises[currentExerciseIndex + 1];
        if (!next) {
          toast.error('No next exercise to superset with');
          return;
        }
        const existingGroup = next.superset_group;
        const group = existingGroup ?? Math.max(0, ...exercises.map((e) => e.superset_group ?? 0)) + 1;
        const ids = existingGroup != null ? [current.id] : [current.id, next.id];
        const ok = await setSessionSupersetGroup(ids, group);
        if (!ok) {
          toast.error('Failed to create superset');
          return;
        }
        hapticSuccess();
        toast.success(`Superset with ${next.name}`);
      }
      await loadActiveSession();
    } catch (error) {
      if (__DEV__) devError('workout-active', error, { action: 'toggleSuperset' });
      toast.error('Failed to update superset');
    } finally {
      setIsMutatingExercises(false);
    }
  };

  const openReorderModal = () => {
    setShowOverflowMenu(false);
    setReorderDraft(exercises.map((e) => ({ id: e.id, name: e.name })));
    setShowReorderModal(true);
  };

  const moveReorderItem = (index: number, direction: -1 | 1) => {
    setReorderDraft((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleSaveReorder = async () => {
    if (!sessionId || !userId) return;
    setIsSavingReorder(true);
    try {
      const ok = await applyStructureEditToSession(sessionId, userId, {
        type: 'reorderSlots',
        orderedSessionExerciseIds: reorderDraft.map((d) => d.id),
      });
      if (!ok) {
        toast.error('Failed to reorder exercises');
        return;
      }
      setShowReorderModal(false);
      toast.success('Exercises reordered');
      await loadActiveSession();
    } catch (error) {
      if (__DEV__) devError('workout-active', error, { action: 'saveReorder' });
      toast.error('Failed to reorder exercises');
    } finally {
      setIsSavingReorder(false);
    }
  };

  const handleAbandonWorkout = async () => {
    if (!sessionId) return;
    if (isAbandoning) return;
    setIsAbandoning(true);
    try {
      const success = await abandonWorkoutSession(sessionId);
      if (!success) {
        toast.error('Failed to abandon workout');
        return;
      }
      if (userId) invalidateSessionsInRangeForUser(userId);
      void clearWorkoutContext();
      clearWorkoutHealthBuffer(sessionId);
      setShowAbandonConfirm(false);
      toast.success('Workout abandoned');
      goBack();
    } finally {
      setIsAbandoning(false);
    }
  };

  /** Open the exercise picker bottom sheet (multi-select) and batch-add the selection. */
  const openAddExercisePicker = () => {
    setShowOverflowMenu(false);
    modal.openSheet('exercisePicker', {
      multiSelect: true,
      onSelectMultiple: (selected: { id: string }[]) => {
        const ids = (selected || []).map((e) => e.id).filter(Boolean);
        if (ids.length > 0) {
          void handleAddExercisesToSession(ids);
        }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LoadingScreen message="Loading workout..." style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  if (exercises.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No exercises in this workout</Text>
          <Button label="Go Back" onPress={goBack} />
        </View>
      </SafeAreaView>
    );
  }

  const currentExercise = exercises[currentExerciseIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            goBack();
          }} 
          style={styles.headerButton}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Active Workout</Text>
          {liveHeartRateBpm != null ? (
            <View style={styles.heartRateBadge}>
              <Heart size={12} color={colors.error} fill={colors.error} />
              <Text style={styles.heartRateText}>{liveHeartRateBpm} BPM</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          {(() => {
            const hasDivergence =
              staleness && (staleness.structural || staleness.target || staleness.biomechanical);
            const refreshColor = staleness?.biomechanical
              ? colors.error
              : hasDivergence
                ? colors.warning
                : colors.textPrimary;
            return (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={async () => {
                  if (hasDivergence && sessionId && sessionTemplateId && sessionDayName && userId) {
                    const plan = await getSmartRefreshPlan(
                      sessionId,
                      sessionTemplateId,
                      sessionDayName,
                      userId
                    );
                    setRefreshPlan(plan ?? null);
                    setShowRefreshSheet(true);
                  } else {
                    await handleRecalculateTargets();
                  }
                }}
                disabled={isRecalculatingTargets || isApplyingRefresh}
              >
                <RefreshCcw
                  size={20}
                  color={
                    isRecalculatingTargets || isApplyingRefresh
                      ? colors.textSecondary
                      : refreshColor
                  }
                />
              </TouchableOpacity>
            );
          })()}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowOverflowMenu(true)}
            accessibilityRole="button"
            accessibilityLabel="Workout actions"
          >
            <MoreVertical size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {workoutPhase.type === 'rest' && restEndsAtEpoch != null ? (
          <View style={styles.restContainer}>
            <Text style={[styles.exerciseName, styles.restExerciseName]}>{currentExercise.name}</Text>
            <RestTimer
              endsAtEpoch={restEndsAtEpoch}
              startedAtEpoch={restStartedAtEpoch ?? undefined}
              onComplete={advanceFromRest}
              onSkip={advanceFromRest}
              onExtend={() => extendRestBy(REST_EXTEND_SEC)}
            />
            <Text style={styles.nextSetText}>
              {(() => {
                const nextExercise = exercises[workoutPhase.nextExerciseIndex] ?? currentExercise;
                return workoutPhase.nextExerciseIndex !== currentExerciseIndex
                  ? `Next: ${nextExercise.name} — Set ${workoutPhase.nextSetIndex + 1}`
                  : `Next: Set ${workoutPhase.nextSetIndex + 1} of ${currentExercise.sets.length}`;
              })()}
            </Text>
          </View>
        ) : (
          <>
        {/* Progress Indicator */}
        <View style={styles.progressSection}>
          <Text style={styles.progressText}>
            Exercise {currentExerciseIndex + 1} of {exercises.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Exercise Name */}
        <Text style={styles.exerciseName}>{currentExercise.name}</Text>

        {/* Superset badge */}
        {currentExercise.superset_group != null && (() => {
          const members = getSupersetMembers(exercises, currentExerciseIndex);
          const position = members.indexOf(currentExerciseIndex) + 1;
          return (
            <View style={styles.supersetBadge}>
              <Link2 size={14} color={colors.primary} />
              <Text style={styles.supersetBadgeText}>
                Superset · {position} of {members.length}
              </Text>
            </View>
          );
        })()}

        {/* Exercise Notes */}
        {currentExercise.notes && (
          <View style={styles.notesContainer}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={styles.notesText}>{currentExercise.notes}</Text>
          </View>
        )}

        {/* EXECUTION PHASE */}
        {workoutPhase.type === 'execution' && (
          <View style={styles.executionContainer}>
            <View style={styles.setInfoRow}>
              <Text style={styles.setInfo}>
                Set {workoutPhase.setIndex + 1} of {currentExercise.sets.length}
              </Text>
              {(() => {
                const setType = currentExercise.sets[workoutPhase.setIndex]?.set_type;
                if (!setType || setType === 'normal') return null;
                return (
                  <View style={styles.setTypeBadge}>
                    <Text style={styles.setTypeBadgeText}>{SET_TYPE_LABELS[setType]}</Text>
                  </View>
                );
              })()}
            </View>

            {/* Target Info */}
            <View style={styles.targetCard}>
              <Text style={styles.targetLabel}>Target</Text>
              <Text style={styles.targetValue}>
                {currentExercise.mode === 'timed'
                  ? `${currentExercise.sets[workoutPhase.setIndex]?.duration_sec || 0} sec hold`
                  : `${currentExercise.sets[workoutPhase.setIndex]?.reps || 0} reps${suggestedWeight ? ` @ ${suggestedWeight} ${profile?.use_imperial ? 'lbs' : 'kg'}` : ''}`}
              </Text>
              {(() => {
                const prevLabel = formatPreviousPerformanceLabel(prevPerformance, {
                  mode: currentExercise.mode,
                  setNumber: currentExercise.sets[workoutPhase.setIndex]?.set_number,
                  useImperial: profile?.use_imperial,
                });
                if (!prevLabel) return null;
                return <Text style={styles.prevPerformanceText}>Last time: {prevLabel}</Text>;
              })()}
            </View>

            {/* Exercise Info (Optional) */}
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={() => setShowExerciseInfo(!showExerciseInfo)}
            >
              <Info size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                {showExerciseInfo ? 'Hide' : 'Show'} Exercise Info
              </Text>
            </TouchableOpacity>

            {showExerciseInfo && (
              <View style={styles.exerciseInfoCard}>
                <Text style={styles.exerciseInfoTitle}>Target Muscles</Text>
                <Text style={styles.exerciseInfoText}>
                  Primary: {currentExercise.name.includes('Bicep') ? 'Biceps, Forearms' : 
                           currentExercise.name.includes('Tricep') ? 'Triceps' :
                           currentExercise.name.includes('Pull') ? 'Lats, Biceps, Upper Back' :
                           currentExercise.name.includes('Squat') ? 'Quads, Glutes, Core' :
                           currentExercise.name.includes('Press') ? 'Chest, Triceps, Front Delts' :
                           'Multiple muscle groups'}
                </Text>
                <Text style={styles.exerciseInfoTitle}>Form Tips</Text>
                <Text style={styles.exerciseInfoText}>
                  • Control the weight on both up and down phases{'\n'}
                  • Maintain proper breathing (exhale on exertion){'\n'}
                  • Focus on mind-muscle connection{'\n'}
                  • Don&apos;t sacrifice form for more weight
                </Text>
              </View>
            )}

            {/* RPE during execution — reps only; timed sets rate effort after the hold */}
            {!currentExercise.is_stretch && currentExercise.mode === 'reps' && (
            <View style={styles.rpeSection}>
              <Text style={styles.inputLabel}>How hard was this set? (RPE)</Text>
              <RPESlider
                value={currentSetRPEs[workoutPhase.setIndex] || 7}
                onChange={(value) => {
                  const updated = [...currentSetRPEs];
                  updated[workoutPhase.setIndex] = value;
                  setCurrentSetRPEs(updated);
                }}
              />
            </View>
            )}

            {currentExercise.mode === 'timed' ? (
              <ExerciseTimer
                key={`${currentExercise.id}-${workoutPhase.setIndex}`}
                durationSec={currentExercise.sets[workoutPhase.setIndex]?.duration_sec ?? 0}
                onStarted={() => {
                  const durationSec = currentExercise.sets[workoutPhase.setIndex]?.duration_sec ?? 0;
                  setExerciseTimerEnd(Date.now() / 1000 + durationSec);
                  if (__DEV__) {
                    const { devLog } = require('../../../src/lib/utils/logger');
                    devLog('workout-active', {
                      action: 'exercise_timer_start',
                      setIndex: workoutPhase.setIndex,
                      durationSec,
                    });
                  }
                }}
                onComplete={(elapsedSec) => {
                  if (currentExercise.is_stretch) {
                    void handleCompleteSet(elapsedSec);
                  } else {
                    goToTimedSetRpeStep(workoutPhase.setIndex, elapsedSec);
                  }
                }}
              />
            ) : (
              <TouchableOpacity style={styles.completeSetButton} onPress={() => void handleCompleteSet()}>
                <CheckCircle size={20} color={colors.onPrimaryContrast} />
                <Text style={styles.completeSetText}>Complete Set</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TIMED SET RPE — after hold completes (strength timed exercises only) */}
        {workoutPhase.type === 'timedSetRpe' && (
          <View style={styles.executionContainer}>
            <View style={styles.setInfoRow}>
              <Text style={styles.setInfo}>
                Set {workoutPhase.setIndex + 1} of {currentExercise.sets.length}
              </Text>
            </View>
            <View style={styles.targetCard}>
              <Text style={styles.targetLabel}>Held for</Text>
              <Text style={styles.targetValue}>{workoutPhase.elapsedDurationSec} sec</Text>
            </View>
            <View style={styles.rpeSection}>
              <Text style={styles.inputLabel}>How hard was this set? (RPE)</Text>
              <RPESlider
                value={currentSetRPEs[workoutPhase.setIndex] || 7}
                onChange={(value) => {
                  const updated = [...currentSetRPEs];
                  updated[workoutPhase.setIndex] = value;
                  setCurrentSetRPEs(updated);
                }}
              />
            </View>
            <TouchableOpacity
              style={styles.completeSetButton}
              onPress={() => void handleCompleteSet()}
            >
              <CheckCircle size={20} color={colors.onPrimaryContrast} />
              <Text style={styles.completeSetText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* BATCH LOGGING PHASE */}
        {workoutPhase.type === 'logging' && (
          <View style={styles.loggingContainer}>
            <Text style={styles.loggingTitle}>Log Your Sets</Text>
            <Text style={styles.loggingSubtitle}>
              {currentExercise.mode === 'reps'
                ? 'Enter weight and reps for each set'
                : 'Enter the duration you held for each set'}
            </Text>

            {setLogs.map((log, idx) => (
              <View key={log.setNumber} style={styles.logCard}>
                <View style={styles.logCardHeader}>
                  <Text style={styles.logSetNumber}>Set {log.setNumber}</Text>
                  <TouchableOpacity
                    style={[
                      styles.setTypeChip,
                      log.setType !== 'normal' && styles.setTypeChipActive,
                    ]}
                    onPress={() => {
                      const updated = [...setLogs];
                      const cycleIdx = SET_TYPE_CYCLE.indexOf(updated[idx].setType);
                      updated[idx].setType = SET_TYPE_CYCLE[(cycleIdx + 1) % SET_TYPE_CYCLE.length];
                      setSetLogs(updated);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Set type: ${SET_TYPE_LABELS[log.setType]}. Tap to change.`}
                  >
                    <Text
                      style={[
                        styles.setTypeChipText,
                        log.setType !== 'normal' && styles.setTypeChipTextActive,
                      ]}
                    >
                      {SET_TYPE_LABELS[log.setType]}
                    </Text>
                  </TouchableOpacity>
                </View>

                {(() => {
                  const prevSet = prevPerformance?.sets.find((s) => s.set_number === log.setNumber);
                  if (!prevSet) return null;
                  const unitsLabel = profile?.use_imperial ? 'lbs' : 'kg';
                  const prevLabel =
                    currentExercise.mode === 'timed'
                      ? prevSet.duration_sec != null
                        ? `${prevSet.duration_sec} sec`
                        : null
                      : prevSet.reps != null
                        ? `${prevSet.weight != null && prevSet.weight > 0 ? `${prevSet.weight} ${unitsLabel} × ` : ''}${prevSet.reps}`
                        : null;
                  if (!prevLabel) return null;
                  return <Text style={styles.logPrevText}>Previous: {prevLabel}</Text>;
                })()}

                <View style={styles.logInputRow}>
                  {currentExercise.mode === 'reps' ? (
                    <>
                      <View style={styles.logInputGroup}>
                        <Text style={styles.logInputLabel}>Weight ({profile?.use_imperial ? 'lbs' : 'kg'})</Text>
                        <TextInput
                          style={styles.logInput}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          returnKeyType="next"
                          value={log.weight}
                          onChangeText={(text) => {
                            const updated = [...setLogs];
                            updated[idx].weight = text;
                            setSetLogs(updated);
                          }}
                        />
                      </View>

                      <View style={styles.logInputGroup}>
                        <Text style={styles.logInputLabel}>Reps</Text>
                        <TextInput
                          style={styles.logInput}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          returnKeyType={idx === setLogs.length - 1 ? "done" : "next"}
                          value={log.reps}
                          onChangeText={(text) => {
                            const updated = [...setLogs];
                            updated[idx].reps = text;
                            setSetLogs(updated);
                          }}
                          onSubmitEditing={() => {
                            if (idx === setLogs.length - 1) {
                              Keyboard.dismiss();
                            }
                          }}
                        />
                      </View>
                    </>
                  ) : (
                    <View style={styles.logInputGroup}>
                      <Text style={styles.logInputLabel}>Duration (sec)</Text>
                      <TextInput
                        style={styles.logInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        returnKeyType={idx === setLogs.length - 1 ? "done" : "next"}
                        value={log.duration_sec}
                        onChangeText={(text) => {
                          const updated = [...setLogs];
                          updated[idx].duration_sec = text;
                          setSetLogs(updated);
                        }}
                        onSubmitEditing={() => {
                          if (idx === setLogs.length - 1) {
                            Keyboard.dismiss();
                          }
                        }}
                      />
                    </View>
                  )}

                  {!currentExercise.is_stretch && (
                    <View style={styles.logInputGroupSmall}>
                      <Text style={styles.logInputLabel}>RPE</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const updated = [...setLogs];
                          const current = updated[idx].rpe ?? 7;
                          updated[idx].rpe = current < 10 ? current + 1 : 5;
                          setSetLogs(updated);
                        }}
                      >
                        <Text style={styles.rpeDisplayValue}>{log.rpe ?? 7}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {!currentExercise.is_stretch && (
                  <View style={styles.rpeSliderContainer}>
                    <RPESlider
                      value={log.rpe ?? 7}
                      onChange={(value) => {
                        const updated = [...setLogs];
                        updated[idx].rpe = value;
                        setSetLogs(updated);
                      }}
                    />
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAndContinue}>
              {currentExerciseIndex === exercises.length - 1 ? (
                <Text style={styles.saveButtonText}>Save & Finish</Text>
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save & Continue</Text>
                  <ChevronRight size={20} color={colors.onPrimaryContrast} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* COMPLETE PHASE */}
        {workoutPhase.type === 'complete' && (
          <View style={styles.completeContainer}>
            <CheckCircle size={64} color={colors.success} />
            <Text style={styles.completeTitle}>Workout Complete!</Text>
            <Text style={styles.completeText}>Great job today!</Text>

            {isCompleting ? (
              <View style={styles.finishButton}>
                <LogoEdgeLoader size="small" variant="inverted" />
                <Text style={styles.finishText}>Saving…</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.finishButton} onPress={handleCompleteWorkout} disabled={isCompleting}>
                <CheckCircle size={24} color={colors.onPrimaryContrast} />
                <Text style={styles.finishText}>Finish Workout</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
          </>
        )}
      </ScrollView>

      <SmartRefreshConfirmationSheet
        visible={showRefreshSheet}
        plan={refreshPlan}
        onClose={() => {
          setShowRefreshSheet(false);
          setRefreshPlan(null);
        }}
        onApply={async () => {
          if (!sessionId || !sessionTemplateId || !sessionDayName || !userId) return;
          setIsApplyingRefresh(true);
          try {
            const success = await applySmartRefresh(
              sessionId,
              sessionTemplateId,
              sessionDayName,
              userId,
              profile?.experience_level || 'beginner'
            );
            if (success) {
              toast.success('Workout updated from plan');
              await loadActiveSession();
              setShowRefreshSheet(false);
              setRefreshPlan(null);
            } else {
              toast.error('Failed to apply updates');
            }
          } catch (error) {
            if (__DEV__) {
              console.error('Smart Refresh apply error:', error);
            }
            toast.error('Failed to apply updates');
          } finally {
            setIsApplyingRefresh(false);
          }
        }}
        applying={isApplyingRefresh}
      />

      {/* Workout overflow menu: anchored top-right via the overlay; tap outside to dismiss. */}
      <Modal
        visible={showOverflowMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverflowMenu(false)}
      >
        <Pressable style={styles.overflowOverlay} onPress={() => setShowOverflowMenu(false)}>
          <Pressable style={styles.overflowCard} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity
              style={[styles.overflowItem, isMutatingExercises && styles.overflowItemDisabled]}
              onPress={openAddExercisePicker}
              disabled={isMutatingExercises}
            >
              <Plus size={18} color={colors.primary} />
              <Text style={styles.overflowItemLabel}>Add exercise</Text>
            </TouchableOpacity>
            <View style={styles.overflowItemDivider} />
            <TouchableOpacity
              style={[styles.overflowItem, isMutatingExercises && styles.overflowItemDisabled]}
              onPress={openReplaceExercisePicker}
              disabled={isMutatingExercises || exercises.length === 0}
            >
              <Repeat2 size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemLabel}>Replace current exercise</Text>
            </TouchableOpacity>
            <View style={styles.overflowItemDivider} />
            <TouchableOpacity
              style={[styles.overflowItem, isMutatingExercises && styles.overflowItemDisabled]}
              onPress={() => void handleToggleSuperset()}
              disabled={
                isMutatingExercises ||
                exercises.length === 0 ||
                (exercises[currentExerciseIndex]?.superset_group == null &&
                  currentExerciseIndex >= exercises.length - 1)
              }
            >
              <Link2 size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemLabel}>
                {exercises[currentExerciseIndex]?.superset_group != null
                  ? 'Remove from superset'
                  : 'Superset with next exercise'}
              </Text>
            </TouchableOpacity>
            <View style={styles.overflowItemDivider} />
            <TouchableOpacity
              style={[styles.overflowItem, isMutatingExercises && styles.overflowItemDisabled]}
              onPress={openReorderModal}
              disabled={isMutatingExercises || exercises.length < 2}
            >
              <ListOrdered size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemLabel}>Reorder exercises</Text>
            </TouchableOpacity>
            <View style={styles.overflowItemDivider} />
            <TouchableOpacity
              style={[styles.overflowItem, isMutatingExercises && styles.overflowItemDisabled]}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowRemoveExerciseConfirm(true);
              }}
              disabled={isMutatingExercises || exercises.length === 0}
            >
              <Trash2 size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemLabel}>Remove current exercise</Text>
            </TouchableOpacity>
            <View style={styles.overflowItemDivider} />
            <TouchableOpacity
              style={[styles.overflowItem, styles.overflowItemDanger]}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowAbandonConfirm(true);
              }}
              disabled={isAbandoning}
            >
              <XCircle size={18} color={colors.error} />
              <Text style={[styles.overflowItemLabel, styles.overflowItemLabelDanger]}>
                Abandon workout
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reorder exercises: simple up/down list, persisted on save */}
      <Modal
        visible={showReorderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReorderModal(false)}
      >
        <Pressable style={styles.reorderOverlay} onPress={() => setShowReorderModal(false)}>
          <Pressable style={styles.reorderCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.reorderTitle}>Reorder Exercises</Text>
            <ScrollView style={styles.reorderList}>
              {reorderDraft.map((item, index) => (
                <View key={item.id} style={styles.reorderRow}>
                  <Text style={styles.reorderName} numberOfLines={1}>
                    {index + 1}. {item.name}
                  </Text>
                  <View style={styles.reorderActions}>
                    <TouchableOpacity
                      style={[styles.reorderArrow, index === 0 && styles.reorderArrowDisabled]}
                      onPress={() => moveReorderItem(index, -1)}
                      disabled={index === 0}
                      accessibilityLabel={`Move ${item.name} up`}
                    >
                      <ArrowUp size={18} color={index === 0 ? colors.textMuted : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reorderArrow,
                        index === reorderDraft.length - 1 && styles.reorderArrowDisabled,
                      ]}
                      onPress={() => moveReorderItem(index, 1)}
                      disabled={index === reorderDraft.length - 1}
                      accessibilityLabel={`Move ${item.name} down`}
                    >
                      <ArrowDown
                        size={18}
                        color={index === reorderDraft.length - 1 ? colors.textMuted : colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.reorderFooter}>
              <Button
                label="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => setShowReorderModal(false)}
                disabled={isSavingReorder}
              />
              <Button
                label={isSavingReorder ? 'Saving…' : 'Save order'}
                size="sm"
                onPress={handleSaveReorder}
                disabled={isSavingReorder}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={showRemoveExerciseConfirm}
        title="Remove this exercise?"
        message={`"${exercises[currentExerciseIndex]?.name ?? 'Exercise'}" will be removed from this workout. Completed sets are protected — if any sets have been logged, removal will be blocked.`}
        confirmLabel={isMutatingExercises ? 'Removing…' : 'Remove'}
        cancelLabel="Cancel"
        confirmDestructive
        confirmDisabled={isMutatingExercises}
        onConfirm={handleRemoveCurrentExercise}
        onCancel={() => {
          if (!isMutatingExercises) setShowRemoveExerciseConfirm(false);
        }}
      />

      <ConfirmDialog
        visible={showAbandonConfirm}
        title="Abandon this workout?"
        message="Your logged sets will be saved but the session will be marked abandoned. You won't be able to resume it later."
        confirmLabel={isAbandoning ? 'Abandoning…' : 'Abandon workout'}
        cancelLabel="Cancel"
        confirmDestructive
        confirmDisabled={isAbandoning}
        onConfirm={handleAbandonWorkout}
        onCancel={() => {
          if (!isAbandoning) setShowAbandonConfirm(false);
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heartRateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heartRateText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  headerSpacer: {
    width: 40,
  },
  overflowOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdropTint,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: spacing.xl + 56,
    paddingHorizontal: spacing.md,
  },
  overflowCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minWidth: 220,
    overflow: 'hidden',
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  overflowItemDanger: {
    backgroundColor: `${colors.error}10`,
  },
  overflowItemDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  overflowItemLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  overflowItemLabelDanger: {
    color: colors.error,
  },
  overflowItemDisabled: {
    opacity: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    textAlign: 'center',
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  exerciseName: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  notesText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  executionContainer: {
    gap: spacing.md,
  },
  setInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setInfo: {
    fontSize: typography.sizes.xl,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  setTypeBadge: {
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  setTypeBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  supersetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  supersetBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  prevPerformanceText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  targetCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  targetValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  rpeSection: {
    marginTop: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  completeSetButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  completeSetText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.onPrimaryContrast,
  },
  restContainer: {
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  restExerciseName: {
    textAlign: 'center',
    width: '100%',
  },
  nextSetText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loggingContainer: {
    gap: spacing.md,
  },
  loggingTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  loggingSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  logSetNumber: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logPrevText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  setTypeChip: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  setTypeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  setTypeChipText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  setTypeChipTextActive: {
    color: colors.primary,
  },
  reorderOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdropTint,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  reorderCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    maxHeight: '70%',
  },
  reorderTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  reorderList: {
    flexGrow: 0,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    gap: spacing.sm,
  },
  reorderName: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  reorderActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  reorderArrow: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary + '10',
  },
  reorderArrowDisabled: {
    backgroundColor: 'transparent',
  },
  reorderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  logInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logInputGroup: {
    flex: 1,
  },
  logInputGroupSmall: {
    width: 80,
    alignItems: 'center',
  },
  logInputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: typography.sizes.lg,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  rpeDisplayValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  rpeSliderContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseInfoCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: spacing.sm,
  },
  exerciseInfoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  exerciseInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.onPrimaryContrast,
  },
  completeContainer: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  completeTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  completeText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  finishButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    minWidth: '80%',
  },
  finishText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.onPrimaryContrast,
  },
  }); }
