/**
 * Plan tab
 * Weekly workout planner with template management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Trash2, CheckCircle, Link2 } from 'lucide-react-native';
import { spacing, layout, typography, borderRadius, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
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
  reorderTemplateSlots,
  type FullTemplate,
  type TemplateSlot,
  type TemplateDay,
} from '../../src/lib/supabase/queries/templates';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { hapticSelection, hapticSuccess } from '../../src/lib/utils/haptics';
import { GripVertical } from 'lucide-react-native';
import {
  getUserTemplatesCached,
  getTemplateWithDaysAndSlotsCached,
  invalidateTemplates,
  invalidateTemplate,
} from '../../src/lib/cache/templateCache';
import { listMergedExercisesCached } from '../../src/lib/cache/exerciseCache';
import { getMergedExercise } from '../../src/lib/supabase/queries/exercises';
import {
  selectExerciseTargets,
  type ExerciseTarget,
  type TargetSelectionContext,
} from '../../src/lib/engine/targetSelection';
import {
  createWorkoutSession,
  deleteSessionWithExercises,
  getSessionsForToday,
  prefillSessionSets,
  getLast7DaysSessionStructure,
  getUniqueSetRepCombinations,
  syncTemplateSlotToSessionsForDay,
  type WorkoutSession,
} from '../../src/lib/supabase/queries/workouts';
import { invalidateSessionsInRangeForUser } from '../../src/lib/cache/sessionsCache';
import { devLog, devError } from '../../src/lib/utils/logger';
import { getDateBoundsForDayName, WEEK_DAYS, SHORT_WEEKDAY_LABELS } from '../../src/lib/utils/date';
import { SmartAdjustPrompt } from '../../src/components/ui/SmartAdjustPrompt';
import { SessionExerciseEditSheet } from '../../src/components/workout/SessionExerciseEditSheet';
import { applyStructureEditToTemplate, applySessionStructureToTemplate, createTemplateSlot, setTemplateSlotSupersetGroup } from '../../src/lib/supabase/queries/templates';
import { needsRebalance, type RebalanceResult } from '../../src/lib/engine/rebalance';
import { generateAiDay } from '../../src/lib/ai/generateWorkoutDay';

const SHORT_DAY_NAMES = SHORT_WEEKDAY_LABELS;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Get today's day name using Date.getDay() (0=Sunday, 6=Saturday)
 */
function getTodayDayName(): string {
  const dayIndex = new Date().getDay();
  return WEEK_DAYS[dayIndex];
}

function getTodayBoundsIso(): { startIso: string; endIsoExclusive: string } {
  const todayKey = new Date().toISOString().slice(0, 10);
  const startIso = `${todayKey}T00:00:00.000Z`;
  const endIsoExclusive = new Date(new Date(startIso).getTime() + MS_PER_DAY).toISOString();
  return { startIso, endIsoExclusive };
}

export default function PlannerTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const profile = useUserStore((state) => state.profile);
  const plannerNeedsRefetch = useUIStore((s) => s.plannerNeedsRefetch);
  const setPlannerNeedsRefetch = useUIStore((s) => s.setPlannerNeedsRefetch);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<FullTemplate | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());
  const [slotTargets, setSlotTargets] = useState<Map<string, ExerciseTarget>>(new Map());
  const [exerciseVariations, setExerciseVariations] = useState<Map<string, Array<{ sets: number; reps?: number; duration_sec?: number }>>>(new Map());
  const [isLoadingTargets, setIsLoadingTargets] = useState(false);
  const [showSmartAdjustPrompt, setShowSmartAdjustPrompt] = useState(false);
  const [rebalanceResult, setRebalanceResult] = useState<RebalanceResult | null>(null);
  /** Remaining AI generations today, surfaced from the last edge response. */
  const [aiRemainingToday, setAiRemainingToday] = useState<number | null>(null);
  const [todaySessionExercises, setTodaySessionExercises] = useState<Array<{
    id: string;
    exercise_id?: string;
    custom_exercise_id?: string;
    sort_order: number;
  }>>([]);
  /** When selected day is Today: one entry per session with its exercises (for workout containers) */
  const [sessionsTodayWithExercises, setSessionsTodayWithExercises] = useState<
    Array<{ session: WorkoutSession; exercises: Array<{ id: string; exercise_id?: string; custom_exercise_id?: string; sort_order: number }> }>
  >([]);
  /** Per session-exercise set/rep variations (from this workout's sets), keyed by session_exercise id. */
  const [sessionExerciseVariations, setSessionExerciseVariations] = useState<
    Map<string, Array<{ sets: number; reps?: number; duration_sec?: number }>>
  >(new Map());
  const [showSessionEditSheet, setShowSessionEditSheet] = useState(false);
  const [showSessionsPerDayPrompt, setShowSessionsPerDayPrompt] = useState(false);
  const [isLoadingSessionsForDay, setIsLoadingSessionsForDay] = useState(false);
  const [sessionsPerDayInput, setSessionsPerDayInput] = useState('1');
  const [editingSessionExercise, setEditingSessionExercise] = useState<{
    id: string;
    name: string;
    mode: 'reps' | 'timed';
  } | null>(null);

  const loadTemplateInFlightRef = useRef(false);
  /** Run the muscle-coverage rebalance check at most once per planner mount. */
  const rebalanceCheckedRef = useRef(false);
  const loadTodaySessionInFlightRef = useRef(false);
  const loadTodaySessionsInFlightRef = useRef(false);
  const recoveryAttemptedThisFocusRef = useRef(false);
  const lastRecoveryAttemptRef = useRef(0);
  const RECOVERY_THROTTLE_MS = 5000;
  const lastPlanRefetchRef = useRef(0);
  const REFETCH_THROTTLE_MS = 3000;
  /** Refs for load callbacks so useFocusEffect doesn't re-run when their identity changes (e.g. loadTemplate when hasInitializedSelection flips). */
  const loadTemplateRef = useRef<(id: string) => Promise<void>>(() => Promise.resolve());
  const loadTodaySessionExercisesRef = useRef<(userId: string) => Promise<void>>(() => Promise.resolve());
  const loadTodaySessionsRef = useRef<(_userId: string, _opts?: { forceRefresh?: boolean; templateExerciseKeys?: string[]; dayName?: string }) => Promise<void>>(() => Promise.resolve());
  /** Set by loadTemplate after it runs loadTodaySessionExercises + loadTodaySessions; cleared when useFocusEffect/useEffect would run the same. Skips duplicate today load on first focus. */
  const loadTemplateDidTodayLoadRef = useRef(false);
  /** Current selected day name; used to ignore stale loadSessionsForDay results when user switches days quickly. */
  const selectedDayNameRef = useRef<string>(getTodayDayName());

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

  // Smart Adjust: once per mount, after the template loads, check whether recent
  // sessions left muscle-coverage gaps. Only prompts when today has planned
  // exercises and no session has been started yet, so it never interrupts an
  // in-progress or finished day.
  useEffect(() => {
    if (rebalanceCheckedRef.current || !templateData) return;
    const todayName = getTodayDayName();
    const todayDay = templateData.days.find((d) => d.day.day_name === todayName);
    if (!todayDay || todayDay.slots.length === 0) return;
    rebalanceCheckedRef.current = true;

    (async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) return;
        const { startIso, endIsoExclusive } = getTodayBoundsIso();
        const sessionsToday = await getSessionsForToday(userId, startIso, endIsoExclusive);
        if (sessionsToday.length > 0) return;

        const result = await needsRebalance(userId, templateData.template.id, todayName);
        if (__DEV__) {
          devLog('planner', {
            action: 'rebalanceCheck',
            needsRebalance: result.needsRebalance,
            missedMuscleCount: result.missedMuscles.length,
          });
        }
        if (result.needsRebalance) {
          setRebalanceResult(result);
          setShowSmartAdjustPrompt(true);
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'rebalanceCheck' });
        }
      }
    })();
  }, [templateData, getCurrentUserId]);

  // Calculate targets for slots (scoped to selected day to reduce work)
  const calculateTargetsForSlots = useCallback(
    async (fullTemplate: FullTemplate, userId: string, dayName?: string) => {
      if (__DEV__) {
        devLog('planner', {
          action: 'calculateTargetsForSlots',
          templateId: fullTemplate.template.id,
          dayName: dayName ?? 'all',
        });
      }

      setIsLoadingTargets(true);
      try {
        const effectiveExperience = profile?.experience_level || 'beginner';
        const context: TargetSelectionContext = { experience: effectiveExperience };

        const targetsMap = new Map<string, ExerciseTarget>();
        const slotDetails: Array<{ slotId: string; exerciseId?: string; customExerciseId?: string; hasTarget: boolean }> = [];

        const daysToProcess = dayName
          ? fullTemplate.days.filter((d) => d.day.day_name === dayName)
          : fullTemplate.days;

        const uniqueSlotsByExercise = new Map<string, { slot: TemplateSlot; context: TargetSelectionContext }>();
        for (const day of daysToProcess) {
          for (const slot of day.slots) {
            const key = slot.exercise_id || slot.custom_exercise_id;
            if (!key) continue;
            if (uniqueSlotsByExercise.has(key)) continue;
            const slotExperience = slot.experience || effectiveExperience;
            uniqueSlotsByExercise.set(key, {
              slot,
              context: { experience: slotExperience },
            });
          }
        }

        const uniqueRefs = Array.from(uniqueSlotsByExercise.entries()).map(([_, v]) => v);
        const targetResults = await Promise.all(
          uniqueRefs.map(({ slot, context }) =>
            selectExerciseTargets(
              {
                exerciseId: slot.exercise_id || undefined,
                customExerciseId: slot.custom_exercise_id || undefined,
              },
              userId,
              context,
              0
            ).then((target) => ({ slot, target }))
          )
        );

        let slotsWithPrescriptions = 0;
        let slotsWithoutPrescriptions = 0;
        for (const { slot, target } of targetResults) {
          const exerciseKey = slot.exercise_id || slot.custom_exercise_id;
          if (target && exerciseKey) {
            targetsMap.set(exerciseKey, target);
            slotsWithPrescriptions++;
            slotDetails.push({
              slotId: slot.id,
              exerciseId: slot.exercise_id ?? undefined,
              customExerciseId: slot.custom_exercise_id ?? undefined,
              hasTarget: true,
            });
          } else {
            slotsWithoutPrescriptions++;
            slotDetails.push({
              slotId: slot.id,
              exerciseId: slot.exercise_id ?? undefined,
              customExerciseId: slot.custom_exercise_id ?? undefined,
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

        setSlotTargets((prev) => {
          const next = new Map(prev);
          targetsMap.forEach((v, k) => next.set(k, v));
          return next;
        });

        // Fetch unique variations for all exercises
        const variationsMap = new Map<string, Array<{ sets: number; reps?: number; duration_sec?: number }>>();
        const exerciseIds = new Set<string>();
        for (const { slot, target } of targetResults) {
          const exerciseId = slot.exercise_id || slot.custom_exercise_id;
          if (exerciseId && target) {
            exerciseIds.add(exerciseId);
          }
        }

        const variationResults = await Promise.all(
          Array.from(exerciseIds).map(async (exerciseId) => {
            const target = targetResults.find(({ slot }) => 
              (slot.exercise_id || slot.custom_exercise_id) === exerciseId
            )?.target;
            if (!target) return { exerciseId, variations: [] };
            
            const variations = await getUniqueSetRepCombinations(exerciseId, userId, target.mode);
            return { exerciseId, variations };
          })
        );

        for (const { exerciseId, variations } of variationResults) {
          if (variations.length > 0) {
            variationsMap.set(exerciseId, variations);
          }
        }

        setExerciseVariations(variationsMap);

        if (__DEV__) {
          devLog('planner', {
            action: 'calculateTargetsForSlots_result',
            slotsWithPrescriptions,
            slotsWithoutPrescriptions,
            totalSlots: slotsWithPrescriptions + slotsWithoutPrescriptions,
            slotDetails,
            variationsCount: variationsMap.size,
            variationsDetails: Array.from(variationsMap.entries()).map(([id, vars]) => ({
              exerciseId: id,
              variationCount: vars.length,
              variations: vars,
            })),
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
          .select('id, template_id, day_name, status, started_at, completed_at')
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
            const effectiveContext = { experience: effectiveExperience };
            const exerciseIds = sessionExercises
              .filter((se) => se.exercise_id || se.custom_exercise_id)
              .map((se) => se.exercise_id || se.custom_exercise_id!);

            const mergedList = await listMergedExercisesCached(userId, exerciseIds);
            const mergedMap = new Map(mergedList.map((e) => [e.id, e]));

            const results = await Promise.all(
              sessionExercises
                .filter((se) => se.exercise_id || se.custom_exercise_id)
                .map(async (se) => {
                  const exerciseId = se.exercise_id || se.custom_exercise_id!;
                  const ref = se.exercise_id
                    ? { exerciseId: se.exercise_id }
                    : { customExerciseId: se.custom_exercise_id! };
                  const merged = mergedMap.get(exerciseId) ?? null;
                  const target = await selectExerciseTargets(ref, userId, effectiveContext, 0, merged);
                  return { exerciseId, name: merged?.name, target };
                })
            );

            const namesToAdd = new Map<string, string>();
            const targetsToAdd = new Map<string, ExerciseTarget>();
            for (const { exerciseId, name, target } of results) {
              if (name) namesToAdd.set(exerciseId, name);
              if (target) targetsToAdd.set(exerciseId, target);
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

  /** Load sessions for a given day (today or another weekday in the current week). Used for workout containers. */
  const loadSessionsForDay = useCallback(
    async (userId: string, options?: { forceRefresh?: boolean; templateExerciseKeys?: string[]; dayName?: string }) => {
      loadTodaySessionsInFlightRef.current = true;
      setIsLoadingSessionsForDay(true);
      const dayName = options?.dayName ?? getTodayDayName();
      const requestedDayName = dayName;
      const { startIso, endIsoExclusive } = dayName === getTodayDayName() ? getTodayBoundsIso() : getDateBoundsForDayName(dayName);
      if (__DEV__) devLog('planner', { action: 'loadSessionsForDay', userId, dayName, forceRefresh: options?.forceRefresh });
      try {
        const sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
        if (__DEV__) {
          devLog('planner', {
            action: 'loadTodaySessions_fetched',
            sessionIds: sessions.map((s) => s.id),
            count: sessions.length,
            startIso,
            endIsoExclusive,
          });
        }
        if (sessions.length === 0) {
          if (__DEV__) {
            devLog('planner', {
              action: 'loadTodaySessions_empty',
              startIso,
              endIsoExclusive,
              forceRefresh: options?.forceRefresh,
            });
          }
          if (requestedDayName !== selectedDayNameRef.current) return;
          setSessionsTodayWithExercises([]);
          setSessionExerciseVariations(new Map());
          if (options?.templateExerciseKeys && options.templateExerciseKeys.length > 0) {
            const keepKeys = new Set(options.templateExerciseKeys);
            setExerciseNames((prev) => {
              const next = new Map(prev);
              for (const k of next.keys()) {
                if (!keepKeys.has(k)) next.delete(k);
              }
              return next;
            });
            setSlotTargets((prev) => {
              const next = new Map(prev);
              for (const k of next.keys()) {
                if (!keepKeys.has(k)) next.delete(k);
              }
              return next;
            });
            setExerciseVariations((prev) => {
              const next = new Map(prev);
              for (const k of next.keys()) {
                if (!keepKeys.has(k)) next.delete(k);
              }
              return next;
            });
          }
          loadTodaySessionsInFlightRef.current = false;
          if (requestedDayName === selectedDayNameRef.current) setIsLoadingSessionsForDay(false);
          return;
        }

        const sessionIds = sessions.map((s) => s.id);
        const { data: allSessionExercises } = await supabase
          .from('v2_session_exercises')
          .select('id, session_id, exercise_id, custom_exercise_id, sort_order')
          .in('session_id', sessionIds)
          .order('sort_order', { ascending: true });

        const withExercises: Array<{
          session: WorkoutSession;
          exercises: Array<{ id: string; exercise_id?: string; custom_exercise_id?: string; sort_order: number }>;
        }> = [];
        const exerciseKeys = new Set<string>();

        for (const session of sessions) {
          const sessionExercises = (allSessionExercises || []).filter((se) => se.session_id === session.id);
          const exercises = sessionExercises.map((se) => {
            const key = se.exercise_id || se.custom_exercise_id;
            if (key) exerciseKeys.add(key);
            return {
              id: se.id,
              exercise_id: se.exercise_id,
              custom_exercise_id: se.custom_exercise_id,
              sort_order: se.sort_order ?? 0,
            };
          });
          withExercises.push({ session, exercises });
        }

        const sessionExerciseIds = withExercises.flatMap(({ exercises }) => exercises.map((e) => e.id));
        const variationsBySessionExercise = new Map<string, Array<{ sets: number; reps?: number; duration_sec?: number }>>();
        if (sessionExerciseIds.length > 0) {
          const { data: setsRows } = await supabase
            .from('v2_session_sets')
            .select('session_exercise_id, reps, duration_sec')
            .in('session_exercise_id', sessionExerciseIds);
          const setsBySe = new Map<string, Array<{ reps?: number; duration_sec?: number }>>();
          for (const row of setsRows || []) {
            const id = row.session_exercise_id;
            if (!id) continue;
            if (!setsBySe.has(id)) setsBySe.set(id, []);
            setsBySe.get(id)!.push({ reps: row.reps ?? undefined, duration_sec: row.duration_sec ?? undefined });
          }
          for (const [seId, sets] of setsBySe) {
            const hasReps = sets.some((s) => s.reps != null);
            if (hasReps) {
              const byRep = new Map<number, number>();
              for (const s of sets) {
                if (s.reps != null) byRep.set(s.reps, (byRep.get(s.reps) ?? 0) + 1);
              }
              const arr = Array.from(byRep.entries()).map(([reps, count]) => ({ sets: count, reps }));
              variationsBySessionExercise.set(seId, arr);
            } else {
              const byDuration = new Map<number, number>();
              for (const s of sets) {
                if (s.duration_sec != null) byDuration.set(s.duration_sec, (byDuration.get(s.duration_sec) ?? 0) + 1);
              }
              const arr = Array.from(byDuration.entries()).map(([duration_sec, count]) => ({ sets: count, duration_sec }));
              variationsBySessionExercise.set(seId, arr);
            }
          }
        }

        if (requestedDayName !== selectedDayNameRef.current) return;
        setSessionsTodayWithExercises(withExercises);
        setSessionExerciseVariations(variationsBySessionExercise);

        if (__DEV__) {
          devLog('planner', {
            action: 'loadTodaySessions_result',
            sessionCount: withExercises.length,
            perSessionExerciseCounts: withExercises.map(({ session, exercises }) => ({ sessionId: session.id, exerciseCount: exercises.length })),
          });
        }

        if (exerciseKeys.size > 0) {
          if (requestedDayName !== selectedDayNameRef.current) return;
          const effectiveExperience = profile?.experience_level || 'beginner';
          const ids = Array.from(exerciseKeys);
          const refs = new Map<string, { exerciseId?: string; customExerciseId?: string }>();
          for (const { exercises: sessExs } of withExercises) {
            for (const se of sessExs) {
              const key = se.exercise_id || se.custom_exercise_id;
              if (key && !refs.has(key)) refs.set(key, { exerciseId: se.exercise_id || undefined, customExerciseId: se.custom_exercise_id || undefined });
            }
          }
          const refList = ids.map((key) => refs.get(key)!).filter(Boolean);

          const [merged, ...targetResults] = await Promise.all([
            listMergedExercisesCached(userId, ids),
            ...refList.map((ref) => selectExerciseTargets(ref, userId, { experience: effectiveExperience }, 0)),
          ]);

          const namesToAdd = new Map(merged.map((e) => [e.id, e.name]));
          const targetsToAdd = new Map<string, ExerciseTarget>();
          refList.forEach((ref, i) => {
            const target = targetResults[i];
            const key = ref.exerciseId || ref.customExerciseId;
            if (target && key) targetsToAdd.set(key, target);
          });

          const keepKeys = new Set<string>([
            ...exerciseKeys,
            ...(options?.templateExerciseKeys ?? []),
          ]);
          setExerciseNames((prev) => {
            const next = new Map(prev);
            namesToAdd.forEach((v, k) => next.set(k, v));
            for (const k of next.keys()) {
              if (!keepKeys.has(k)) next.delete(k);
            }
            return next;
          });
          setSlotTargets((prev) => {
            const next = new Map(prev);
            targetsToAdd.forEach((v, k) => next.set(k, v));
            for (const k of next.keys()) {
              if (!keepKeys.has(k)) next.delete(k);
            }
            return next;
          });
        }
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'loadSessionsForDay' });
      } finally {
        loadTodaySessionsInFlightRef.current = false;
        if (requestedDayName === selectedDayNameRef.current) {
          setIsLoadingSessionsForDay(false);
        }
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

          const userId = await getCurrentUserId();
          if (userId) {
            const todayDayName = getTodayDayName();
            const todayIndex = fullTemplate.days.findIndex((d) => d.day.day_name === todayDayName);
            const selectedIndex = hasInitializedSelection
              ? undefined
              : (todayIndex >= 0 ? todayIndex : 0);
            const dayToLoad = selectedIndex !== undefined
              ? fullTemplate.days[selectedIndex] ?? fullTemplate.days[0]
              : fullTemplate.days.find((d) => d.day.day_name === selectedDayNameRef.current) ?? fullTemplate.days[0];
            const dayName = dayToLoad?.day.day_name ?? todayDayName;
            selectedDayNameRef.current = dayName;

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
              await calculateTargetsForSlots(fullTemplate, userId, dayName);
            } else {
              if (__DEV__) devLog('planner', { action: 'loadTemplate_noExerciseIds' });
            }

            try {
              const templateKeys = dayToLoad?.slots.flatMap((s) => [s.exercise_id, s.custom_exercise_id].filter((id): id is string => id != null)) ?? [];
              if (dayName === todayDayName) {
                await loadTodaySessionExercises(userId);
              }
              await loadSessionsForDay(userId, { dayName, templateExerciseKeys: templateKeys });
              loadTemplateDidTodayLoadRef.current = true;
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
    [toast, getCurrentUserId, calculateTargetsForSlots, hasInitializedSelection, loadTodaySessionExercises, loadSessionsForDay]
  );

  loadTemplateRef.current = loadTemplate;
  loadTodaySessionExercisesRef.current = loadTodaySessionExercises;
  loadTodaySessionsRef.current = loadSessionsForDay;

  /**
   * Pull-to-refresh: invalidate the template cache and re-fetch the active template.
   * Uses the in-flight ref to avoid double-fetching if the user pulls during a load.
   */
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    if (!activeTemplateId) return;
    setIsRefreshing(true);
    try {
      const userId = await getCurrentUserId();
      invalidateTemplate(activeTemplateId);
      if (userId) invalidateTemplates(userId);
      loadTemplateInFlightRef.current = false;
      await loadTemplate(activeTemplateId);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTemplateId, isRefreshing, loadTemplate, getCurrentUserId]);

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
  const todayTemplateKeys = useMemo(
    () =>
      templateData?.days.find((d) => d.day.day_name === getTodayDayName())?.slots.flatMap((s) =>
        [s.exercise_id, s.custom_exercise_id].filter(Boolean) as string[]
      ) ?? [],
    [templateData]
  );

  const selectedDayTemplateKeys = useMemo(
    () =>
      selectedDay?.slots.flatMap((s) => [s.exercise_id, s.custom_exercise_id].filter((id): id is string => id != null)) ?? [],
    [selectedDay]
  );

  /**
   * Persist a new slot order after a drag-and-drop reorder. We optimistically update local
   * templateData so the UI doesn't snap back during the round-trip; on failure we reload
   * from server to resolve the divergence visually.
   */
  const handleSlotsReordered = useCallback(
    async (orderedSlots: TemplateSlot[]) => {
      if (!templateData || !selectedDay) return;
      const previousSlots = selectedDay.slots;
      const sameOrder = orderedSlots.every((s, i) => s.id === previousSlots[i]?.id);
      if (sameOrder) return;

      hapticSelection();

      const optimistic: FullTemplate = {
        ...templateData,
        days: templateData.days.map((d) =>
          d.day.id === selectedDay.day.id
            ? { ...d, slots: orderedSlots.map((s, idx) => ({ ...s, sort_order: idx })) }
            : d,
        ),
      };
      setTemplateData(optimistic);

      try {
        const success = await reorderTemplateSlots(orderedSlots.map((s) => s.id));
        if (!success) {
          toast.error('Failed to save new order');
          if (activeTemplateId) {
            invalidateTemplate(activeTemplateId);
            await loadTemplate(activeTemplateId);
          }
          return;
        }
        if (activeTemplateId) {
          invalidateTemplate(activeTemplateId);
        }
        hapticSuccess();
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'reorderTemplateSlots' });
        toast.error('Failed to save new order');
        if (activeTemplateId) {
          invalidateTemplate(activeTemplateId);
          await loadTemplate(activeTemplateId);
        }
      }
    },
    [templateData, selectedDay, activeTemplateId, loadTemplate, toast],
  );

  /**
   * Hevy-style superset toggle on template slots: grouped slots alternate during
   * the active workout. Ungrouped slots pair with the slot below them; leaving a
   * group dissolves it if fewer than two members remain.
   */
  const handleToggleSlotSuperset = useCallback(
    async (slot: TemplateSlot) => {
      if (!activeTemplateId || !selectedDay || isSaving) return;
      const daySlots = [...selectedDay.slots].sort((a, b) => a.sort_order - b.sort_order);

      setIsSaving(true);
      try {
        let success: boolean;
        if (slot.superset_group != null) {
          const remaining = daySlots.filter(
            (s) => s.superset_group === slot.superset_group && s.id !== slot.id,
          );
          const idsToClear =
            remaining.length < 2 ? [slot.id, ...remaining.map((s) => s.id)] : [slot.id];
          success = await setTemplateSlotSupersetGroup(idsToClear, null);
        } else {
          const idx = daySlots.findIndex((s) => s.id === slot.id);
          const next = idx >= 0 ? daySlots[idx + 1] : undefined;
          if (!next) {
            toast.error('Add an exercise below to superset with');
            return;
          }
          if (next.superset_group != null) {
            success = await setTemplateSlotSupersetGroup([slot.id], next.superset_group);
          } else {
            const maxGroup = Math.max(0, ...daySlots.map((s) => s.superset_group ?? 0));
            success = await setTemplateSlotSupersetGroup([slot.id, next.id], maxGroup + 1);
          }
        }

        if (success) {
          hapticSelection();
          invalidateTemplate(activeTemplateId);
          await loadTemplate(activeTemplateId);
        } else {
          toast.error('Failed to update superset');
        }
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'toggleSlotSuperset' });
        toast.error('Failed to update superset');
      } finally {
        setIsSaving(false);
      }
    },
    [activeTemplateId, selectedDay, isSaving, loadTemplate, toast],
  );

  // Refetch when needed: flag set (e.g. after add/remove in add-exercise-edit), or templateData lost (e.g. back from workout). Throttle recovery to avoid infinite retry when load fails.
  // Uses refs for loadTemplate/loadTodaySessionExercises/loadTodaySessions so callback identity doesn't change when e.g. hasInitializedSelection flips (which would re-run this effect and re-trigger loadTodaySessionExercises/loadTodaySessions repeatedly).
  useFocusEffect(
    useCallback(() => {
      const loadTemplate = loadTemplateRef.current;
      const loadTodaySessionExercises = loadTodaySessionExercisesRef.current;
      const loadTodaySessions = loadTodaySessionsRef.current;

      if (plannerNeedsRefetch) {
        setPlannerNeedsRefetch(false);
        const now = Date.now();
        if (now - lastPlanRefetchRef.current < REFETCH_THROTTLE_MS) {
          if (__DEV__) devLog('planner', { action: 'useFocusEffect_refetchThrottled', elapsed: now - lastPlanRefetchRef.current });
          return;
        }
        lastPlanRefetchRef.current = now;
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
        if (now - lastPlanRefetchRef.current < REFETCH_THROTTLE_MS) {
          if (__DEV__) devLog('planner', { action: 'useFocusEffect_recoveryThrottled', elapsed: now - lastPlanRefetchRef.current });
        } else {
          lastPlanRefetchRef.current = now;
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
        }
      } else if (selectedDay) {
        if (!loadTemplateDidTodayLoadRef.current) {
          const dayName = selectedDay.day.day_name;
          selectedDayNameRef.current = dayName;
          const templateKeys = selectedDay.slots.flatMap((s) => [s.exercise_id, s.custom_exercise_id].filter((id): id is string => id != null));
          getCurrentUserId().then((id) => {
            if (id) {
              if (dayName === getTodayDayName()) {
                loadTodaySessionExercises(id);
              }
              const loadSessions = loadTodaySessionsRef.current;
              loadSessions(id, { dayName, templateExerciseKeys: templateKeys });
            }
          });
        }
      }

      return () => {
        recoveryAttemptedThisFocusRef.current = false;
        loadTemplateDidTodayLoadRef.current = false;
      };
    }, [plannerNeedsRefetch, activeTemplateId, setPlannerNeedsRefetch, selectedDay?.day.day_name, getCurrentUserId, templateData, isLoadingTemplate, todayTemplateKeys])
  );
  const dateContext = useDateContext(selectedDay?.day.day_name);

  // When switching selected day: load sessions + targets for that day
  useEffect(() => {
    if (!selectedDay || !templateData) return;
    selectedDayNameRef.current = selectedDay.day.day_name;
    const userId = getCurrentUserId();
    userId.then(async (id) => {
      if (!id) return;
      if (selectedDay.day.day_name === getTodayDayName()) {
        loadTodaySessionExercises(id);
      }
      await loadSessionsForDay(id, { dayName: selectedDay.day.day_name, templateExerciseKeys: selectedDayTemplateKeys });
      if (selectedDay.slots.length > 0) {
        await calculateTargetsForSlots(templateData, id, selectedDay.day.day_name);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayIndex, selectedDay?.day.id]);

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
      const templateId = activeTemplateId!;
      setIsSaving(true);
      try {
        invalidateTemplate(templateId);
        const dayData = templateData?.days.find((d) => d.day.id === dayId);
        const sortOrder = (dayData?.slots.length ?? 0) + 1;
        const success = await applyStructureEditToTemplate(templateId, {
          type: 'addSlot',
          dayId,
          exerciseId: exerciseId || undefined,
          customExerciseId: customExerciseId || undefined,
          sortOrder,
        });
        if (success) {
          await loadTemplate(templateId);
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

  const runGenerateWithAI = useCallback(
    async (sessionsPerDay: number) => {
      if (!templateData || !activeTemplateId || !selectedDay) {
        toast.error('No template or day selected');
        return;
      }
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Please log in');
        return;
      }
      const dayIndex = templateData.days.findIndex((d) => d.day.id === selectedDay.day.id);
      if (dayIndex < 0) {
        toast.error('Selected day not found');
        return;
      }
      if (__DEV__) {
        devLog('planner-ai', {
          action: 'generateDay',
          templateId: activeTemplateId,
          dayName: selectedDay.day.day_name,
          dayIndex,
          sessionsPerDay,
        });
      }
      setIsGenerating(true);
      try {
        if (sessionsPerDay === 0) {
          // Rest day: clear the day's planned slots and remove unstarted
          // exercises from any of that day's sessions (performed sets are kept).
          const slotIds = selectedDay.slots.map((s) => s.id);
          if (slotIds.length > 0) {
            const { error: slotErr } = await supabase
              .from('v2_template_slots')
              .delete()
              .in('id', slotIds);
            if (slotErr) {
              if (__DEV__) devError('planner-ai', slotErr, { action: 'restDay_clearSlots' });
              toast.error('Failed to clear the day');
              return;
            }
          }

          const { startIso, endIsoExclusive } = getDateBoundsForDayName(selectedDay.day.day_name);
          const daySessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
          for (const session of daySessions) {
            if (session.status !== 'active') continue;
            const { data: sessionExercises } = await supabase
              .from('v2_session_exercises')
              .select('id')
              .eq('session_id', session.id);
            const exerciseIds = (sessionExercises || []).map((r) => r.id);
            if (exerciseIds.length === 0) continue;
            const { data: performedSets } = await supabase
              .from('v2_session_sets')
              .select('session_exercise_id')
              .in('session_exercise_id', exerciseIds)
              .not('performed_at', 'is', null);
            const protectedIds = new Set((performedSets || []).map((r) => r.session_exercise_id));
            const deletableIds = exerciseIds.filter((id) => !protectedIds.has(id));
            if (deletableIds.length > 0) {
              await supabase.from('v2_session_sets').delete().in('session_exercise_id', deletableIds);
              await supabase.from('v2_session_exercises').delete().in('id', deletableIds);
            }
          }

          invalidateTemplate(activeTemplateId);
          invalidateSessionsInRangeForUser(userId);
          await loadTemplate(activeTemplateId);
          useUIStore.getState().setPlannerNeedsRefetch(true);
          toast.success(`${selectedDay.day.day_name} set as rest day`);
          return;
        }

        const aiResult = await generateAiDay({
          template: templateData,
          userId,
          profile,
          dayIndex,
          sessionsPerDay,
        });

        if (aiResult.source === 'quota_exceeded') {
          setAiRemainingToday(0);
          toast.error(
            `Daily AI limit reached (${aiResult.quota}/day). Try again in ${aiResult.retryAfterHours}h.`,
          );
          return;
        }

        if (aiResult.source === 'auth_error') {
          toast.error('Session expired — please log in again to use AI generation');
          return;
        }

        if (aiResult.source === 'gemini' || aiResult.source === 'fallback') {
          setAiRemainingToday(aiResult.remainingToday);
        }

        if (aiResult.source === 'empty') {
          toast.error('No exercises available for AI generation');
          return;
        }

        if (aiResult.source === 'rest') {
          toast.success(`${selectedDay.day.day_name} set as rest day`);
          return;
        }

        const sessionGroups = aiResult.sessions;
        if (sessionGroups.length === 0 || sessionGroups.every((g) => g.length === 0)) {
          toast.error('No exercises available for AI generation');
          return;
        }

        const day = selectedDay;
        const slotsBefore = day.slots.length;
        let slotsCreated = 0;

        let sortOrder = day.slots.length;
        const exp = profile?.experience_level || 'beginner';

        for (let sIdx = 0; sIdx < sessionGroups.length; sIdx++) {
          const group = sessionGroups[sIdx];
          if (!group || group.length === 0) continue;

          let targetSessionId: string | null = null;
          if (sessionsTodayWithExercises && sIdx < sessionsTodayWithExercises.length) {
            targetSessionId = sessionsTodayWithExercises[sIdx].session.id;
          } else {
            const { startIso } = getDateBoundsForDayName(day.day.day_name);
            const newSession = await createWorkoutSession(
              userId,
              activeTemplateId,
              day.day.day_name,
              startIso
            );
            if (newSession) {
              targetSessionId = newSession.id;
            }
          }

          const sessionExercises: Array<{ id: string; exercise_id?: string }> = [];
          const targetsMap = new Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>();

          for (const exerciseId of group) {
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
              if (mergedExercise) {
                setExerciseNames((prev) => {
                  const next = new Map(prev);
                  next.set(exerciseId, mergedExercise.name);
                  return next;
                });
              }
              
              setTemplateData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  days: prev.days.map((d) =>
                    d.day.id === day.day.id ? { ...d, slots: [...d.slots, newSlot] } : d
                  ),
                };
              });

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

                  const target = await selectExerciseTargets(
                    { exerciseId },
                    userId,
                    { experience: exp },
                    0
                  );
                  if (target) {
                    targetsMap.set(exerciseId, {
                      sets: target.sets,
                      reps: target.reps,
                      duration_sec: target.duration_sec,
                      weight: target.weight
                    });
                  }
                } else if (__DEV__) {
                   devError('planner-ai', seErr || new Error('Failed to create session exercise'), { sessionId: targetSessionId, exerciseId });
                }
              }

            } else if (__DEV__) {
              devError('planner-ai', new Error('createTemplateSlot returned null'), { dayId: day.day.id, exerciseId, sortOrder });
            }
          }

          if (targetSessionId && sessionExercises.length > 0 && targetsMap.size > 0) {
            await prefillSessionSets(targetSessionId, sessionExercises, targetsMap);
          }
        }

        if (slotsCreated === 0) {
          if (__DEV__) devLog('planner-ai', { action: 'generateDay_noSlotsCreated', templateId: activeTemplateId, dayName: day.day.day_name });
          toast.error('No exercises were added. Check the console for details.');
          return;
        }

        invalidateTemplate(activeTemplateId);
        invalidateSessionsInRangeForUser(userId);
        await loadTemplate(activeTemplateId);
        useUIStore.getState().setPlannerNeedsRefetch(true);
        if (__DEV__) {
          devLog('planner-ai', {
            action: 'generateDay_result',
            templateId: activeTemplateId,
            dayName: day.day.day_name,
            slotsCreated,
            source: aiResult.source,
          });
        }
        const sourceSuffix =
          aiResult.source === 'gemini' ? '' : ' (using local engine)';
        const remaining =
          aiResult.source === 'gemini' || aiResult.source === 'fallback'
            ? aiResult.remainingToday
            : null;
        const quotaSuffix = remaining != null ? ` · ${remaining} AI left today` : '';
        toast.success(`${day.day.day_name} generated${sourceSuffix}${quotaSuffix}`);
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
    },
    [
      templateData,
      activeTemplateId,
      selectedDay,
      profile,
      getCurrentUserId,
      loadTemplate,
      toast,
    ]
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
      <NestableScrollContainer
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: layout.tabBarHeight + insets.bottom + spacing.lg },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
                onPress={async () => {
                  if (!activeTemplateId || !selectedDay) return;
                  if (dateContext.isToday) {
                    const userId = await getCurrentUserId();
                    if (!userId) {
                      toast.error('Please log in');
                      return;
                    }
                    setIsSaving(true);
                    try {
                      const session = await createWorkoutSession(
                        userId,
                        activeTemplateId,
                        selectedDay.day.day_name
                      );
                      if (session) {
                        const sessionExercises: Array<{ id: string; exercise_id?: string; custom_exercise_id?: string }> = [];
                        const targetsMap = new Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>();
                        if (sessionsTodayWithExercises.length === 0) {
                          for (const slot of selectedDay.slots) {
                            const exerciseId = slot.exercise_id || slot.custom_exercise_id;
                            if (!exerciseId) continue;
                            const { data: se, error: seErr } = await supabase
                              .from('v2_session_exercises')
                              .insert({
                                session_id: session.id,
                                exercise_id: slot.exercise_id || null,
                                custom_exercise_id: slot.custom_exercise_id || null,
                                sort_order: slot.sort_order,
                                superset_group: slot.superset_group ?? null,
                                rest_sec: slot.rest_sec ?? null,
                              })
                              .select()
                              .single();
                            if (seErr || !se) {
                              if (__DEV__) devError('planner', seErr || new Error('Failed to create session exercise'), { sessionId: session.id });
                              continue;
                            }
                            sessionExercises.push(se);
                            const effectiveExperience = profile?.experience_level || 'beginner';
                            const target = await selectExerciseTargets(
                              { exerciseId: slot.exercise_id || undefined, customExerciseId: slot.custom_exercise_id || undefined },
                              userId,
                              { experience: slot.experience || effectiveExperience },
                              0
                            );
                            if (target) targetsMap.set(exerciseId, { sets: target.sets, reps: target.reps, duration_sec: target.duration_sec, weight: target.weight });
                          }
                        }
                        if (sessionExercises.length > 0 && targetsMap.size > 0) {
                          await prefillSessionSets(session.id, sessionExercises, targetsMap);
                        }
                        toast.success('Workout added');
                        setPlannerNeedsRefetch(true);
                        await loadSessionsForDay(userId, { forceRefresh: true, dayName: selectedDay.day.day_name, templateExerciseKeys: todayTemplateKeys });
                      } else {
                        toast.error('Failed to add workout');
                      }
                    } catch (error) {
                      if (__DEV__) devError('planner', error, { action: 'addWorkout' });
                      toast.error('Failed to add workout');
                    } finally {
                      setIsSaving(false);
                    }
                  } else {
                    const userId = await getCurrentUserId();
                    if (!userId) {
                      toast.error('Please log in');
                      return;
                    }
                    setIsSaving(true);
                    try {
                      const { startIso } = getDateBoundsForDayName(selectedDay.day.day_name);
                      const session = await createWorkoutSession(
                        userId,
                        activeTemplateId,
                        selectedDay.day.day_name,
                        startIso
                      );
                      if (session) {
                        const sessionExercises: Array<{ id: string; exercise_id?: string; custom_exercise_id?: string }> = [];
                        const targetsMap = new Map<string, { sets: number; reps?: number; duration_sec?: number; weight?: number }>();
                        if (sessionsTodayWithExercises.length === 0) {
                          for (const slot of selectedDay.slots) {
                            const exerciseId = slot.exercise_id || slot.custom_exercise_id;
                            if (!exerciseId) continue;
                            const { data: se, error: seErr } = await supabase
                              .from('v2_session_exercises')
                              .insert({
                                session_id: session.id,
                                exercise_id: slot.exercise_id || null,
                                custom_exercise_id: slot.custom_exercise_id || null,
                                sort_order: slot.sort_order,
                                superset_group: slot.superset_group ?? null,
                                rest_sec: slot.rest_sec ?? null,
                              })
                              .select()
                              .single();
                            if (seErr || !se) {
                              if (__DEV__) devError('planner', seErr || new Error('Failed to create session exercise'), { sessionId: session.id });
                              continue;
                            }
                            sessionExercises.push(se);
                            const effectiveExperience = profile?.experience_level || 'beginner';
                            const target = await selectExerciseTargets(
                              { exerciseId: slot.exercise_id || undefined, customExerciseId: slot.custom_exercise_id || undefined },
                              userId,
                              { experience: slot.experience || effectiveExperience },
                              0
                            );
                            if (target) targetsMap.set(exerciseId, { sets: target.sets, reps: target.reps, duration_sec: target.duration_sec, weight: target.weight });
                          }
                        }
                        if (sessionExercises.length > 0 && targetsMap.size > 0) {
                          await prefillSessionSets(session.id, sessionExercises, targetsMap);
                        }
                        toast.success('Workout added');
                        invalidateSessionsInRangeForUser(userId);
                        await loadSessionsForDay(userId, {
                          forceRefresh: true,
                          dayName: selectedDay.day.day_name,
                          templateExerciseKeys: selectedDayTemplateKeys,
                        });
                      } else {
                        toast.error('Failed to add workout');
                      }
                    } catch (error) {
                      if (__DEV__) devError('planner', error, { action: 'addWorkout_otherDay' });
                      toast.error('Failed to add workout');
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
                disabled={isSaving}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Workout</Text>
              </TouchableOpacity>
            </View>

            {/* Workout containers for selected day (sessions for today or chosen weekday) */}
            <>
              {isLoadingSessionsForDay ? (
                <View style={styles.emptySlotsContainer}>
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.sm }} />
                  <Text style={styles.emptySlotsSubtext}>Loading workouts...</Text>
                </View>
              ) : sessionsTodayWithExercises.length === 0 ? (
                selectedDay.slots.length > 0 ? (
                  <View style={styles.workoutContainer}>
                    <View style={styles.workoutContainerHeader}>
                      <Text style={styles.planForDayHeader}>Plan for {selectedDay.day.day_name}</Text>
                    </View>
                    <View style={[styles.slotsList, styles.workoutContainerContent]}>
                      <NestableDraggableFlatList<TemplateSlot>
                        data={selectedDay.slots}
                        keyExtractor={(slot) => slot.id}
                        scrollEnabled={false}
                        activationDistance={12}
                        onDragEnd={({ data }) => {
                          void handleSlotsReordered(data);
                        }}
                        renderItem={({ item: slot, drag, isActive }: RenderItemParams<TemplateSlot>) => {
                          const key = slot.exercise_id || slot.custom_exercise_id;
                          const name = key ? exerciseNames.get(key) || 'Loading...' : 'Unknown';
                          const target = key ? slotTargets.get(key) : null;
                          const targetText = target
                            ? target.mode === 'reps'
                              ? `${target.sets} sets × ${target.reps} reps`
                              : `${target.sets} sets × ${Math.floor((target.duration_sec || 0) / 60)} min`
                            : null;
                          const supersetLabel = (() => {
                            if (slot.superset_group == null) return null;
                            const groups = Array.from(
                              new Set(
                                selectedDay.slots
                                  .map((s) => s.superset_group)
                                  .filter((g): g is number => g != null),
                              ),
                            ).sort((a, b) => a - b);
                            const letter = String.fromCharCode(65 + groups.indexOf(slot.superset_group));
                            return `Superset ${letter}`;
                          })();
                          return (
                            <View
                              style={[styles.slotCard, isActive && styles.slotCardDragging]}
                            >
                              <TouchableOpacity
                                style={styles.dragHandle}
                                onLongPress={drag}
                                delayLongPress={120}
                                disabled={isSaving}
                                accessibilityRole="button"
                                accessibilityLabel="Reorder exercise"
                              >
                                <GripVertical size={18} color={colors.textMuted} />
                              </TouchableOpacity>
                              <View style={styles.slotContent}>
                                <Text style={styles.slotExerciseName}>{name}</Text>
                                {targetText && (
                                  <Text style={styles.slotTargets}>{targetText}</Text>
                                )}
                                {supersetLabel && (
                                  <Text style={styles.slotSupersetChip}>{supersetLabel}</Text>
                                )}
                              </View>
                              <TouchableOpacity
                                style={[styles.deleteButton, styles.editButton]}
                                onPress={() => handleToggleSlotSuperset(slot)}
                                disabled={isSaving}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  slot.superset_group != null
                                    ? 'Remove from superset'
                                    : 'Superset with next exercise'
                                }
                              >
                                <Link2
                                  size={16}
                                  color={slot.superset_group != null ? colors.primary : colors.textMuted}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.deleteButton, styles.editButton]}
                                onPress={async () => {
                                  if (!activeTemplateId || isSaving) return;
                                  setIsSaving(true);
                                  try {
                                    const success = await applyStructureEditToTemplate(
                                      activeTemplateId,
                                      { type: 'removeSlot', slotId: slot.id },
                                    );
                                    if (success) {
                                      invalidateTemplate(activeTemplateId);
                                      await loadTemplate(activeTemplateId);
                                      toast.success('Exercise removed from plan');
                                    } else {
                                      toast.error('Failed to remove');
                                    }
                                  } catch (e) {
                                    if (__DEV__)
                                      devError('planner', e, { action: 'removeTemplateSlot' });
                                    toast.error('Failed to remove');
                                  } finally {
                                    setIsSaving(false);
                                  }
                                }}
                                disabled={isSaving}
                              >
                                <Trash2 size={16} color={colors.errorText} />
                              </TouchableOpacity>
                            </View>
                          );
                        }}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.addButton, styles.addExerciseInContent]}
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
                      <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
                    </TouchableOpacity>
                    <View style={[styles.emptySlotsContainer, { paddingTop: 0 }]}>
                      <Text style={styles.emptySlotsSubtext}>Add a workout to begin</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptySlotsContainer}>
                    <Text style={styles.emptySlotsText}>
                      {dateContext.isToday ? 'No workouts scheduled for today' : `No workouts planned for ${selectedDay.day.day_name}`}
                    </Text>
                    <Text style={styles.emptySlotsSubtext}>Add exercises or generate with AI to get started</Text>
                    <TouchableOpacity
                      style={[styles.addButton, styles.addExerciseInContent, { marginTop: spacing.md }]}
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
                      <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
                    </TouchableOpacity>
                  </View>
                )
              ) : (
                  sessionsTodayWithExercises.map(({ session, exercises }, idx) => (
                    <View key={session.id} style={styles.workoutContainer}>
                      <View style={styles.workoutContainerHeader}>
                        <View style={styles.workoutContainerTitleRow}>
                          <Text style={styles.workoutContainerTitle}>Workout {idx + 1}</Text>
                          {session.status === 'completed' && (
                            <CheckCircle size={20} color={colors.success} style={styles.workoutCompletedBadge} />
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={async () => {
                            const userId = await getCurrentUserId();
                            if (!userId) return;
                            const sessionIdToRemove = session.id;
                            if (__DEV__) {
                              devLog('planner', {
                                action: 'deleteWorkout_start',
                                sessionId: sessionIdToRemove,
                                currentSessionIds: sessionsTodayWithExercises.map(({ session: s }) => s.id),
                              });
                            }
                            
                            const slotIdsToRemove: string[] = [];
                            if (selectedDay && activeTemplateId) {
                               const availableSlots = [...selectedDay.slots];
                               for (const se of exercises) {
                                  const key = se.exercise_id || se.custom_exercise_id;
                                  if (!key) continue;
                                  const matchIdx = availableSlots.findIndex(
                                     (s) => (s.exercise_id || s.custom_exercise_id) === key
                                  );
                                  if (matchIdx !== -1) {
                                     slotIdsToRemove.push(availableSlots[matchIdx].id);
                                     availableSlots.splice(matchIdx, 1);
                                  }
                               }
                            }

                            setSessionsTodayWithExercises((prev) =>
                              prev.filter(({ session: s }) => s.id !== sessionIdToRemove)
                            );
                            setIsSaving(true);
                            try {
                              const { error } = await deleteSessionWithExercises(userId, sessionIdToRemove);
                              if (__DEV__) {
                                devLog('planner', {
                                  action: 'deleteWorkout_complete',
                                  sessionId: sessionIdToRemove,
                                  error: error?.message,
                                });
                              }
                              if (error) {
                                toast.error('Failed to delete workout');
                                if (__DEV__) devError('planner', error, { sessionId: sessionIdToRemove });
                              } else {
                                toast.success('Workout removed');
                                invalidateSessionsInRangeForUser(userId);
                                
                                if (activeTemplateId && slotIdsToRemove.length > 0) {
                                  let templateChanged = false;
                                  for (const sId of slotIdsToRemove) {
                                    const success = await applyStructureEditToTemplate(activeTemplateId, { type: 'removeSlot', slotId: sId });
                                    if (success) templateChanged = true;
                                  }
                                  if (templateChanged) {
                                    invalidateTemplate(activeTemplateId);
                                    await loadTemplate(activeTemplateId);
                                  }
                                }
                              }
                              await loadSessionsForDay(userId, { forceRefresh: true, dayName: selectedDay.day.day_name, templateExerciseKeys: selectedDayTemplateKeys });
                              if (__DEV__) {
                                devLog('planner', {
                                  action: 'deleteWorkout_afterReload',
                                  sessionId: sessionIdToRemove,
                                });
                              }
                            } catch (err) {
                              if (__DEV__) devError('planner', err, { action: 'deleteWorkout_exception', sessionId: sessionIdToRemove });
                              toast.error('Failed to delete workout');
                              await loadSessionsForDay(userId, { forceRefresh: true, dayName: selectedDay.day.day_name, templateExerciseKeys: selectedDayTemplateKeys });
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving}
                          style={styles.deleteWorkoutButton}
                        >
                          <Trash2 size={18} color={colors.errorText} />
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.slotsList, styles.workoutContainerContent]}>
                        {(() => {
                          const templateCountByExercise = new Map<string, number>();
                          if (selectedDay) {
                            for (const s of selectedDay.slots) {
                              const key = s.exercise_id || s.custom_exercise_id;
                              if (key) templateCountByExercise.set(key, (templateCountByExercise.get(key) ?? 0) + 1);
                            }
                          }
                          const usedCountByExercise = new Map<string, number>();
                          const routineSessionExerciseIds = new Set<string>();
                          for (const { exercises: sessExs } of sessionsTodayWithExercises) {
                            for (const se of sessExs) {
                              const key = se.exercise_id || se.custom_exercise_id;
                              if (!key) continue;
                              const templateCount = templateCountByExercise.get(key) ?? 0;
                              const used = usedCountByExercise.get(key) ?? 0;
                              if (used < templateCount) {
                                routineSessionExerciseIds.add(se.id);
                                usedCountByExercise.set(key, used + 1);
                              }
                            }
                          }
                          return exercises.map((sessionExercise) => {
                            const exerciseId = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
                            const exerciseName = exerciseId ? exerciseNames.get(exerciseId) || 'Loading...' : 'Unknown';
                            const target = exerciseId ? slotTargets.get(exerciseId) : null;
                            const variations = sessionExerciseVariations.get(sessionExercise.id) ?? null;
                            
                            let targetContent: React.ReactNode;
                            if (variations && variations.length > 0) {
                              const variationStrings = variations.map(v => {
                                if (v.reps != null) {
                                  return `${v.sets} sets × ${v.reps} reps`;
                                }
                                if (v.duration_sec != null) {
                                  return `${v.sets} sets × ${Math.floor(v.duration_sec / 60)} min`;
                                }
                                return '';
                              }).filter(Boolean);
                              targetContent = (
                                <View style={styles.slotTargetsStack}>
                                  {variationStrings.map((s, i) => (
                                    <Text key={i} style={styles.slotTargets}>{s}</Text>
                                  ))}
                                </View>
                              );
                            } else if (target) {
                              const targetText = target.mode === 'reps'
                                ? `${target.sets} sets × ${target.reps} reps`
                                : `${target.sets} sets × ${Math.floor((target.duration_sec || 0) / 60)} min`;
                              targetContent = <Text style={styles.slotTargets}>{targetText}</Text>;
                            } else {
                              targetContent = <Text style={styles.slotTargets}>Loading targets...</Text>;
                            }
                            
                            const isTodayOnly = !routineSessionExerciseIds.has(sessionExercise.id);
                            return (
                            <View key={sessionExercise.id} style={styles.slotCard}>
                              <View style={styles.slotContent}>
                                <Text style={styles.slotExerciseName}>{exerciseName}</Text>
                                <View style={styles.slotTargetRow}>
                                  {targetContent}
                                  {isTodayOnly && (
                                    <View style={styles.todayOnlyTag}>
                                      <Text style={styles.todayOnlyTagText}>Today Only</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
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
                            );
                          });
                        })()}
                        <TouchableOpacity
                          style={[styles.addButton, styles.addExerciseInContent]}
                          onPress={() => {
                            if (!activeTemplateId || !selectedDay) return;
                            router.push({
                              pathname: '/add-exercise',
                              params: {
                                dayId: selectedDay.day.id,
                                templateId: activeTemplateId,
                                dayName: selectedDay.day.day_name,
                                sessionId: session.id,
                              },
                            });
                          }}
                          disabled={isSaving}
                        >
                          <Plus size={20} color={colors.primary} />
                          <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>

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
              onPress={() => {
                const missing: string[] = [];
                if (!templateData) missing.push('templateData');
                if (!activeTemplateId) missing.push('activeTemplateId');
                if (missing.length > 0) {
                  if (__DEV__) devLog('planner', { action: 'generateWeek_skipped', missing });
                  toast.error('No template loaded');
                  return;
                }
                setSessionsPerDayInput('1');
                setShowSessionsPerDayPrompt(true);
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
      </NestableScrollContainer>

      {/* Sessions per day prompt for Generate with AI (works on web where Alert doesn't) */}
      <Modal
        visible={showSessionsPerDayPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSessionsPerDayPrompt(false)}
      >
        <Pressable
          style={styles.sessionsPerDayOverlay}
          onPress={() => setShowSessionsPerDayPrompt(false)}
        >
            <Pressable style={styles.sessionsPerDayCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sessionsPerDayTitle}>Sessions for {selectedDay?.day.day_name ?? 'this day'}</Text>
            <Text style={styles.sessionsPerDaySubtitle}>
              0 = rest day (no exercises). 1–6 = workout sessions. e.g. morning + evening = 2.
            </Text>
            {aiRemainingToday != null && (
              <Text style={styles.sessionsPerDayQuota}>
                {aiRemainingToday > 0
                  ? `${aiRemainingToday} AI generation${aiRemainingToday === 1 ? '' : 's'} left today`
                  : 'Daily AI limit reached — the local engine will be used'}
              </Text>
            )}
            <TextInput
              style={styles.sessionsPerDayInput}
              value={sessionsPerDayInput}
              onChangeText={(t) => setSessionsPerDayInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              maxLength={2}
            />
            <View style={styles.sessionsPerDayButtons}>
              <TouchableOpacity
                style={[styles.sessionsPerDayButton, styles.sessionsPerDayButtonSecondary]}
                onPress={() => {
                  setShowSessionsPerDayPrompt(false);
                  setSessionsPerDayInput('1');
                }}
              >
                <Text style={styles.sessionsPerDayButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sessionsPerDayButton}
                onPress={() => {
                  const n = Math.min(6, Math.max(0, parseInt(sessionsPerDayInput, 10) ?? 1));
                  setShowSessionsPerDayPrompt(false);
                  setSessionsPerDayInput('1');
                  runGenerateWithAI(n);
                }}
              >
                <Text style={styles.sessionsPerDayButtonText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-screen overlay while the AI builds the day */}
      <Modal visible={isGenerating} transparent animationType="fade">
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.generatingTitle}>Generating workout…</Text>
            <Text style={styles.generatingSubtitle}>
              Building {selectedDay?.day.day_name ?? 'your day'} with AI
            </Text>
          </View>
        </View>
      </Modal>

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
            if (userId && selectedDay) {
              await loadSessionsForDay(userId, { dayName: selectedDay.day.day_name, templateExerciseKeys: selectedDayTemplateKeys });
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
                if (userId && selectedDay) {
                  await loadSessionsForDay(userId, { dayName: selectedDay.day.day_name, templateExerciseKeys: selectedDayTemplateKeys });
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
        onDismiss={() => {
          setShowSmartAdjustPrompt(false);
          setRebalanceResult(null);
        }}
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

          const day = selectedDay!;
          const templateId = activeTemplateId!;
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
              templateId,
              day.day.day_name
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

            for (const slot of day.slots) {
              const exerciseId = slot.exercise_id || slot.custom_exercise_id;
              if (!exerciseId) continue;

              const { data: sessionExercise, error: exerciseError } = await supabase
                .from('v2_session_exercises')
                .insert({
                  session_id: session.id,
                  exercise_id: slot.exercise_id || null,
                  custom_exercise_id: slot.custom_exercise_id || null,
                  sort_order: slot.sort_order,
                  superset_group: slot.superset_group ?? null,
                  rest_sec: slot.rest_sec ?? null,
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

function createStyles(colors: ThemeColors) { return StyleSheet.create({
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
  addExerciseInContent: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.inverseActionBg,
    borderColor: colors.inverseActionBg,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  addExerciseButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  workoutContainer: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  workoutContainerContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  workoutContainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  planForDayHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  workoutContainerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  workoutContainerTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  workoutCompletedBadge: {
    marginLeft: 0,
  },
  deleteWorkoutButton: {
    padding: spacing.xs,
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
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  slotCardDragging: {
    borderColor: colors.primary,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
    justifyContent: 'center',
  },
  slotContent: {
    flex: 1,
    gap: spacing.xs,
  },
  slotTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  todayOnlyTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  todayOnlyTagText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
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
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  slotTargetsStack: {
    gap: spacing.xs,
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
  sessionsPerDayOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sessionsPerDayCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    minWidth: 280,
    maxWidth: 360,
  },
  sessionsPerDayTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sessionsPerDaySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  sessionsPerDayInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    minWidth: 72,
  },
  slotSupersetChip: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: 2,
  },
  sessionsPerDayQuota: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  generatingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  generatingCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 240,
  },
  generatingTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  generatingSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  sessionsPerDayButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  sessionsPerDayButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  sessionsPerDayButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sessionsPerDayButtonText: {
    color: colors.onPrimaryContrast,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  sessionsPerDayButtonTextSecondary: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
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
  }); }
