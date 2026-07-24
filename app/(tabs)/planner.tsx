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
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Trash2, CheckCircle, Bookmark } from 'lucide-react-native';
import { spacing, layout, typography, borderRadius, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
import { TAB_HEADER_HEIGHT, TabHeader } from '../../src/components/ui/TabHeader';
import { TourTarget } from '../../src/components/tour/TourTarget';
import { useToast } from '../../src/hooks/useToast';
import { useDateContext } from '../../src/hooks/useDateContext';
import { useUserStore } from '../../src/stores/userStore';
import { useUIStore } from '../../src/stores/uiStore';
import { supabase } from '../../src/lib/supabase/client';
import {
  createTemplate,
  ensureTemplateHasWeekDays,
  reorderTemplateSlots,
  type FullTemplate,
  type TemplateSlot,
} from '../../src/lib/supabase/queries/templates';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { hapticSelection, hapticSuccess } from '../../src/lib/utils/haptics';
import { formatTimedSetsTarget } from '../../src/lib/utils/formatDuration';
import {
  getUserTemplatesCached,
  getTemplateWithDaysAndSlotsCached,
  invalidateTemplates,
  invalidateTemplate,
} from '../../src/lib/cache/templateCache';
import { listMergedExercisesCached } from '../../src/lib/cache/exerciseCache';
import {
  selectExerciseTargets,
  type ExerciseTarget,
  type TargetSelectionContext,
} from '../../src/lib/engine/targetSelection';
import {
  createWorkoutSession,
  deleteSessionWithExercises,
  getSessionsForToday,
  materializeWorkoutFromTemplateSlots,
  type WorkoutSession,
} from '../../src/lib/supabase/queries/workouts';
import { applyStructureEditToSession, setSessionSupersetGroup } from '../../src/lib/supabase/queries/workouts_helpers';
import { invalidateSessionsInRangeForUser } from '../../src/lib/cache/sessionsCache';
import { devLog, devError } from '../../src/lib/utils/logger';
import { getDateBoundsForDayName, getLocalDayBoundsIso, WEEK_DAYS } from '../../src/lib/utils/date';
import { SessionExerciseEditSheet } from '../../src/components/workout/SessionExerciseEditSheet';
import { applyStructureEditToTemplate, setTemplateSlotSupersetGroup } from '../../src/lib/supabase/queries/templates';
import {
  listWorkoutPresets,
  createWorkoutPresetFromSession,
  renameWorkoutPreset,
  deleteWorkoutPreset,
  applyWorkoutPresetToDay,
  createSessionFromPreset,
  replaceDayTemplateSlotsFromPreset,
  getWorkoutPresetSlots,
  type WorkoutPreset,
  type PresetLoadMode,
} from '../../src/lib/supabase/queries/presets';
import { SaveWorkoutPresetSheet } from '../../src/components/planner/SaveWorkoutPresetSheet';
import { WorkoutPresetPickerSheet } from '../../src/components/planner/WorkoutPresetPickerSheet';
import { WorkoutPresetLoadOptionsSheet } from '../../src/components/planner/WorkoutPresetLoadOptionsSheet';
import { WorkoutTargetPickerSheet } from '../../src/components/planner/WorkoutTargetPickerSheet';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { DEFAULT_DAY_CONSTRAINTS, type DayConstraints } from '../../src/lib/ai/generateWorkoutDay';
import { GenerateDayForm } from '../../src/components/ai/GenerateDayForm';
import { LogoEdgeLoader } from '../../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { usePaywall } from '../../src/components/paywall/PaywallProvider';

/**
 * Get today's day name using Date.getDay() (0=Sunday, 6=Saturday)
 */
function getTodayDayName(): string {
  const dayIndex = new Date().getDay();
  return WEEK_DAYS[dayIndex];
}

type PlannerSessionExercise = {
  id: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  sort_order: number;
  superset_group?: number | null;
};

export default function PlannerTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { requestGenerateAi } = usePaywall();
  const profile = useUserStore((state) => state.profile);
  const plannerNeedsRefetch = useUIStore((s) => s.plannerNeedsRefetch);
  const setPlannerNeedsRefetch = useUIStore((s) => s.setPlannerNeedsRefetch);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<FullTemplate | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map());
  const [slotTargets, setSlotTargets] = useState<Map<string, ExerciseTarget>>(new Map());
  /** When selected day is Today: one entry per session with its exercises (for workout containers) */
  const [sessionsTodayWithExercises, setSessionsTodayWithExercises] = useState<
    { session: WorkoutSession; exercises: PlannerSessionExercise[] }[]
  >([]);
  /** Per session-exercise set/rep variations (working sets only) + warmup count, keyed by session_exercise id. */
  const [sessionExerciseVariations, setSessionExerciseVariations] = useState<
    Map<string, { variations: { sets: number; reps?: number; duration_sec?: number }[]; warmupCount: number }>
  >(new Map());
  const [showSessionEditSheet, setShowSessionEditSheet] = useState(false);
  const [showGenerateDayForm, setShowGenerateDayForm] = useState(false);
  const [showSavePresetSheet, setShowSavePresetSheet] = useState(false);
  const [savePresetMode, setSavePresetMode] = useState<'create' | 'rename'>('create');
  const [savePresetDefaultName, setSavePresetDefaultName] = useState('');
  const [savePresetSessionId, setSavePresetSessionId] = useState<string | null>(null);
  const [renamePresetId, setRenamePresetId] = useState<string | null>(null);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [workoutPresets, setWorkoutPresets] = useState<WorkoutPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [selectedPresetForLoad, setSelectedPresetForLoad] = useState<WorkoutPreset | null>(null);
  const [showPresetLoadOptions, setShowPresetLoadOptions] = useState(false);
  const [showPresetTargetPicker, setShowPresetTargetPicker] = useState(false);
  const [pendingPresetLoadMode, setPendingPresetLoadMode] = useState<PresetLoadMode | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<WorkoutPreset | null>(null);
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);
  const [isDeletingPreset, setIsDeletingPreset] = useState(false);
  const presetPickerPendingActionRef = useRef<'loadOptions' | 'applyDirect' | 'delete' | null>(null);
  const presetOptionsPendingActionRef = useRef<'targetPicker' | null>(null);
  const pendingPresetForLoadRef = useRef<WorkoutPreset | null>(null);
  const pendingPresetToDeleteRef = useRef<WorkoutPreset | null>(null);
  const [isLoadingSessionsForDay, setIsLoadingSessionsForDay] = useState(false);
  const [editingSessionExercise, setEditingSessionExercise] = useState<{
    id: string;
    name: string;
    mode: 'reps' | 'timed';
    sessionId: string;
    supersetGroup: number | null;
    isLastExercise: boolean;
  } | null>(null);

  const loadTemplateInFlightRef = useRef(false);
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
  const loadTodaySessionsRef = useRef<(
    _userId: string,
    _opts?: {
      forceRefresh?: boolean;
      templateExerciseKeys?: string[];
      dayName?: string;
      templateId?: string;
      templateSlots?: TemplateSlot[];
      skipMaterialize?: boolean;
    },
  ) => Promise<void>>(() => Promise.resolve());
  /** Set by loadTemplate after it runs loadTodaySessionExercises + loadTodaySessions; cleared when useFocusEffect/useEffect would run the same. Skips duplicate today load on first focus. */
  const loadTemplateDidTodayLoadRef = useRef(false);
  /** Current selected day name; used to ignore stale loadSessionsForDay results when user switches days quickly. */
  const selectedDayNameRef = useRef<string>(getTodayDayName());
  /** Prevents duplicate auto-materialize when a day has template slots but no sessions yet. */
  const materializeInFlightRef = useRef<Set<string>>(new Set());

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

      try {
        const effectiveExperience = profile?.experience_level || 'beginner';

        const targetsMap = new Map<string, ExerciseTarget>();
        const slotDetails: { slotId: string; exerciseId?: string; customExerciseId?: string; hasTarget: boolean }[] = [];

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
        const { startIso: todayStartIso, endIsoExclusive: todayEndIso } = getLocalDayBoundsIso();
        const { data: session } = await supabase
          .from('v2_workout_sessions')
          .select('id, template_id, day_name, status, started_at, completed_at')
          .eq('user_id', userId)
          .eq('status', 'active')
          .gte('started_at', todayStartIso)
          .lt('started_at', todayEndIso)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          const { data: sessionExercises } = await supabase
            .from('v2_session_exercises')
            .select('id, exercise_id, custom_exercise_id, sort_order')
            .eq('session_id', session.id)
            .order('sort_order', { ascending: true });

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
        }
      } catch (error) {
        if (__DEV__) {
          devError('planner', error, { action: 'loadTodaySessionExercises' });
        }
        // Use the store directly so we don't add the unstable useToast() wrapper to deps.
        useUIStore.getState().showToast('Failed to load workout details', 'error');
      } finally {
        loadTodaySessionInFlightRef.current = false;
      }
    },
    [profile]
  );

  /** Load sessions for a given day (today or another weekday in the current week). Used for workout containers. */
  const loadSessionsForDay = useCallback(
    async (
      userId: string,
      options?: {
        forceRefresh?: boolean;
        templateExerciseKeys?: string[];
        dayName?: string;
        templateId?: string;
        templateSlots?: TemplateSlot[];
        skipMaterialize?: boolean;
      },
    ) => {
      loadTodaySessionsInFlightRef.current = true;
      setIsLoadingSessionsForDay(true);
      const dayName = options?.dayName ?? getTodayDayName();
      const requestedDayName = dayName;
      const { startIso, endIsoExclusive } = dayName === getTodayDayName() ? getLocalDayBoundsIso() : getDateBoundsForDayName(dayName);
      if (__DEV__) {
        devLog('planner', {
          action: 'loadSessionsForDay',
          userId,
          dayName,
          forceRefresh: options?.forceRefresh,
          startIso,
          endIsoExclusive,
          startLocal: new Date(startIso).toString(),
          endLocalExclusive: new Date(endIsoExclusive).toString(),
        });
      }

      const applySessionsToState = async (sessions: WorkoutSession[]): Promise<void> => {
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
          }
          return;
        }

        const sessionIds = sessions.map((s) => s.id);
        const { data: allSessionExercises } = await supabase
          .from('v2_session_exercises')
          .select('id, session_id, exercise_id, custom_exercise_id, sort_order, superset_group')
          .in('session_id', sessionIds)
          .order('sort_order', { ascending: true });

        const withExercises: {
          session: WorkoutSession;
          exercises: PlannerSessionExercise[];
        }[] = [];
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
              superset_group: se.superset_group ?? null,
            };
          });
          withExercises.push({ session, exercises });
        }

        const sessionExerciseIds = withExercises.flatMap(({ exercises }) => exercises.map((e) => e.id));
        const variationsBySessionExercise = new Map<
          string,
          { variations: { sets: number; reps?: number; duration_sec?: number }[]; warmupCount: number }
        >();
        if (sessionExerciseIds.length > 0) {
          const { data: setsRows } = await supabase
            .from('v2_session_sets')
            .select('session_exercise_id, reps, duration_sec, set_type')
            .in('session_exercise_id', sessionExerciseIds);
          const setsBySe = new Map<string, { reps?: number; duration_sec?: number }[]>();
          const warmupCountBySe = new Map<string, number>();
          for (const row of setsRows || []) {
            const id = row.session_exercise_id;
            if (!id) continue;
            if (row.set_type === 'warmup') {
              warmupCountBySe.set(id, (warmupCountBySe.get(id) ?? 0) + 1);
              continue;
            }
            if (!setsBySe.has(id)) setsBySe.set(id, []);
            setsBySe.get(id)!.push({ reps: row.reps ?? undefined, duration_sec: row.duration_sec ?? undefined });
          }
          for (const [seId, sets] of setsBySe) {
            const warmupCount = warmupCountBySe.get(seId) ?? 0;
            const hasReps = sets.some((s) => s.reps != null);
            if (hasReps) {
              const byRep = new Map<number, number>();
              for (const s of sets) {
                if (s.reps != null) byRep.set(s.reps, (byRep.get(s.reps) ?? 0) + 1);
              }
              const arr = Array.from(byRep.entries()).map(([reps, count]) => ({ sets: count, reps }));
              variationsBySessionExercise.set(seId, { variations: arr, warmupCount });
            } else {
              const byDuration = new Map<number, number>();
              for (const s of sets) {
                if (s.duration_sec != null) byDuration.set(s.duration_sec, (byDuration.get(s.duration_sec) ?? 0) + 1);
              }
              const arr = Array.from(byDuration.entries()).map(([duration_sec, count]) => ({ sets: count, duration_sec }));
              variationsBySessionExercise.set(seId, { variations: arr, warmupCount });
            }
          }
          for (const [seId, warmupCount] of warmupCountBySe) {
            if (!variationsBySessionExercise.has(seId)) {
              variationsBySessionExercise.set(seId, { variations: [], warmupCount });
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
      };

      try {
        let sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
        if (__DEV__) {
          devLog('planner', {
            action: 'loadTodaySessions_fetched',
            sessionIds: sessions.map((s) => s.id),
            count: sessions.length,
            startIso,
            endIsoExclusive,
          });
        }

        if (
          sessions.length === 0 &&
          !options?.skipMaterialize &&
          options?.templateId &&
          options?.templateSlots &&
          options.templateSlots.length > 0
        ) {
          const materializeKey = `${requestedDayName}:${startIso}`;
          if (!materializeInFlightRef.current.has(materializeKey)) {
            materializeInFlightRef.current.add(materializeKey);
            try {
              if (__DEV__) {
                devLog('planner', {
                  action: 'autoMaterializeWorkout',
                  dayName: requestedDayName,
                  slotCount: options.templateSlots.length,
                });
              }
              const startedAt = dayName === getTodayDayName() ? undefined : startIso;
              await materializeWorkoutFromTemplateSlots({
                userId,
                templateId: options.templateId,
                dayName: requestedDayName,
                slots: options.templateSlots,
                startedAt,
                experience: profile?.experience_level || 'beginner',
                origin: 'auto',
              });
              // Always re-fetch after the attempt: on a dedup race the insert is
              // rejected (returns null), but another session now exists, so we
              // still want the winning session in state rather than stale empty.
              if (requestedDayName === selectedDayNameRef.current) {
                invalidateSessionsInRangeForUser(userId);
                sessions = await getSessionsForToday(userId, startIso, endIsoExclusive);
              }
            } catch (materializeError) {
              if (__DEV__) devError('planner', materializeError, { action: 'autoMaterializeWorkout' });
            } finally {
              materializeInFlightRef.current.delete(materializeKey);
            }
          }
        }

        await applySessionsToState(sessions);
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'loadSessionsForDay' });
        // Use the store directly so we don't add the unstable useToast() wrapper to deps.
        useUIStore.getState().showToast('Failed to load your workouts', 'error');
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
              await loadSessionsForDay(userId, {
                dayName,
                templateExerciseKeys: templateKeys,
                templateId,
                templateSlots: dayToLoad?.slots ?? [],
              });
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

  const mapSessionExerciseToTemplateSlot = useCallback(
    (sessionExercise: PlannerSessionExercise, daySlots: TemplateSlot[]): TemplateSlot | null => {
      const key = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
      if (!key) return null;
      const matching = [...daySlots]
        .filter((s) => (s.exercise_id || s.custom_exercise_id) === key)
        .sort((a, b) => a.sort_order - b.sort_order);
      if (matching.length === 0) return null;
      const usedBefore = sessionsTodayWithExercises.flatMap(({ exercises }) => exercises).filter((se) => {
        const seKey = se.exercise_id || se.custom_exercise_id;
        if (seKey !== key) return false;
        return se.sort_order < sessionExercise.sort_order ||
          (se.sort_order === sessionExercise.sort_order && se.id < sessionExercise.id);
      }).length;
      return matching[usedBefore] ?? matching[0] ?? null;
    },
    [sessionsTodayWithExercises],
  );

  const computeRoutineSessionExerciseIds = useCallback((): Set<string> => {
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
    return routineSessionExerciseIds;
  }, [selectedDay, sessionsTodayWithExercises]);

  const computeReorderedTemplateSlotIds = useCallback(
    (
      allSlots: TemplateSlot[],
      previousExercises: PlannerSessionExercise[],
      orderedExercises: PlannerSessionExercise[],
      routineIds: Set<string>,
    ): string[] | null => {
      const sortedSlots = [...allSlots].sort((a, b) => a.sort_order - b.sort_order);
      const mapToSlotIds = (exercises: PlannerSessionExercise[]) => {
        const used = new Map<string, number>();
        return exercises
          .filter((se) => routineIds.has(se.id))
          .map((se) => {
            const key = se.exercise_id || se.custom_exercise_id;
            if (!key) return null;
            const idx = used.get(key) ?? 0;
            used.set(key, idx + 1);
            const matching = sortedSlots.filter((s) => (s.exercise_id || s.custom_exercise_id) === key);
            return matching[idx]?.id ?? null;
          })
          .filter((id): id is string => id != null);
      };

      const oldSlotIds = mapToSlotIds(previousExercises);
      const newSlotIds = mapToSlotIds(orderedExercises);
      if (oldSlotIds.length === 0 || oldSlotIds.length !== newSlotIds.length) return null;

      const result = sortedSlots.map((s) => s.id);
      const positions = oldSlotIds.map((id) => result.indexOf(id)).filter((i) => i >= 0);
      if (positions.length !== newSlotIds.length) return null;
      newSlotIds.forEach((id, i) => {
        result[positions[i]] = id;
      });
      return result;
    },
    [],
  );

  const handleSessionExercisesReordered = useCallback(
    async (sessionId: string, orderedExercises: PlannerSessionExercise[]) => {
      if (!selectedDay || !activeTemplateId) return;
      const previousEntry = sessionsTodayWithExercises.find(({ session }) => session.id === sessionId);
      if (!previousEntry) return;
      const previousExercises = previousEntry.exercises;
      const sameOrder = orderedExercises.every((e, i) => e.id === previousExercises[i]?.id);
      if (sameOrder) return;

      hapticSelection();
      setSessionsTodayWithExercises((prev) =>
        prev.map((entry) =>
          entry.session.id === sessionId ? { ...entry, exercises: orderedExercises } : entry,
        ),
      );

      const userId = await getCurrentUserId();
      if (!userId) return;

      try {
        const ok = await applyStructureEditToSession(sessionId, userId, {
          type: 'reorderSlots',
          orderedSessionExerciseIds: orderedExercises.map((e) => e.id),
        });
        if (!ok) {
          toast.error('Failed to save new order');
          await loadSessionsForDay(userId, {
            forceRefresh: true,
            skipMaterialize: true,
            dayName: selectedDay.day.day_name,
            templateExerciseKeys: selectedDayTemplateKeys,
            templateId: activeTemplateId,
            templateSlots: selectedDay.slots,
          });
          return;
        }

        const routineIds = computeRoutineSessionExerciseIds();
        const reorderedSlotIds = computeReorderedTemplateSlotIds(
          selectedDay.slots,
          previousExercises,
          orderedExercises,
          routineIds,
        );
        if (reorderedSlotIds) {
          const templateOk = await reorderTemplateSlots(reorderedSlotIds);
          if (!templateOk) {
            toast.error('Failed to sync plan order');
          } else {
            invalidateTemplate(activeTemplateId);
            setTemplateData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                days: prev.days.map((d) =>
                  d.day.id === selectedDay.day.id
                    ? {
                        ...d,
                        slots: reorderedSlotIds
                          .map((id, idx) => {
                            const slot = d.slots.find((s) => s.id === id);
                            return slot ? { ...slot, sort_order: idx } : null;
                          })
                          .filter((s): s is TemplateSlot => s != null),
                      }
                    : d,
                ),
              };
            });
          }
        }

        hapticSuccess();
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'reorderSessionExercises' });
        toast.error('Failed to save new order');
        await loadSessionsForDay(userId, {
          forceRefresh: true,
          skipMaterialize: true,
          dayName: selectedDay.day.day_name,
          templateExerciseKeys: selectedDayTemplateKeys,
          templateId: activeTemplateId,
          templateSlots: selectedDay.slots,
        });
      }
    },
    [
      selectedDay,
      activeTemplateId,
      sessionsTodayWithExercises,
      getCurrentUserId,
      computeRoutineSessionExerciseIds,
      computeReorderedTemplateSlotIds,
      selectedDayTemplateKeys,
      loadSessionsForDay,
      toast,
    ],
  );

  const handleToggleSessionExerciseSuperset = useCallback(
    async (sessionId: string, sessionExercise: PlannerSessionExercise, exercisesInSession: PlannerSessionExercise[]) => {
      if (!selectedDay || isSaving) return;
      const sorted = [...exercisesInSession].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((e) => e.id === sessionExercise.id);
      if (idx < 0) return;

      const routineIds = computeRoutineSessionExerciseIds();
      const isRoutine = routineIds.has(sessionExercise.id);
      const matchingSlot = isRoutine ? mapSessionExerciseToTemplateSlot(sessionExercise, selectedDay.slots) : null;

      setIsSaving(true);
      try {
        if (sessionExercise.superset_group != null) {
          const remaining = sorted.filter(
            (ex, i) => i !== idx && ex.superset_group === sessionExercise.superset_group,
          );
          const ok = await setSessionSupersetGroup([sessionExercise.id], null);
          if (!ok) {
            toast.error('Failed to update superset');
            return;
          }
          if (remaining.length === 1) {
            await setSessionSupersetGroup([remaining[0].id], null);
          }
          if (isRoutine && matchingSlot?.superset_group != null) {
            const daySlots = [...selectedDay.slots].sort((a, b) => a.sort_order - b.sort_order);
            const templateRemaining = daySlots.filter(
              (s) => s.superset_group === matchingSlot.superset_group && s.id !== matchingSlot.id,
            );
            const idsToClear =
              templateRemaining.length < 2
                ? [matchingSlot.id, ...templateRemaining.map((s) => s.id)]
                : [matchingSlot.id];
            await setTemplateSlotSupersetGroup(idsToClear, null);
            if (activeTemplateId) {
              invalidateTemplate(activeTemplateId);
              await loadTemplate(activeTemplateId);
            }
          }
          const userId = await getCurrentUserId();
          if (userId) {
            await loadSessionsForDay(userId, {
              forceRefresh: true,
              skipMaterialize: true,
              dayName: selectedDay.day.day_name,
              templateExerciseKeys: selectedDayTemplateKeys,
              templateId: activeTemplateId ?? undefined,
              templateSlots: selectedDay.slots,
            });
          }
          hapticSelection();
        } else {
          const next = sorted[idx + 1];
          if (!next) {
            toast.error('Add an exercise below to superset with');
            return;
          }
          const existingGroup = next.superset_group;
          const group = existingGroup ?? Math.max(0, ...sorted.map((e) => e.superset_group ?? 0)) + 1;
          const ids = existingGroup != null ? [sessionExercise.id] : [sessionExercise.id, next.id];
          const ok = await setSessionSupersetGroup(ids, group);
          if (!ok) {
            toast.error('Failed to create superset');
            return;
          }
          if (isRoutine && matchingSlot) {
            const nextSlot = mapSessionExerciseToTemplateSlot(next, selectedDay.slots);
            if (nextSlot && matchingSlot.superset_group == null) {
              const daySlots = [...selectedDay.slots].sort((a, b) => a.sort_order - b.sort_order);
              const maxGroup = Math.max(0, ...daySlots.map((s) => s.superset_group ?? 0));
              await setTemplateSlotSupersetGroup([matchingSlot.id, nextSlot.id], maxGroup + 1);
              if (activeTemplateId) {
                invalidateTemplate(activeTemplateId);
                await loadTemplate(activeTemplateId);
              }
            } else if (nextSlot) {
              await setTemplateSlotSupersetGroup([matchingSlot.id], nextSlot.superset_group!);
              if (activeTemplateId) {
                invalidateTemplate(activeTemplateId);
                await loadTemplate(activeTemplateId);
              }
            }
          }
          await loadSessionsForDay((await getCurrentUserId())!, {
            forceRefresh: true,
            skipMaterialize: true,
            dayName: selectedDay.day.day_name,
            templateExerciseKeys: selectedDayTemplateKeys,
            templateId: activeTemplateId ?? undefined,
            templateSlots: selectedDay.slots,
          });
          hapticSuccess();
        }
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'toggleSessionExerciseSuperset' });
        toast.error('Failed to update superset');
      } finally {
        setIsSaving(false);
      }
    },
    [
      selectedDay,
      isSaving,
      computeRoutineSessionExerciseIds,
      mapSessionExerciseToTemplateSlot,
      loadSessionsForDay,
      selectedDayTemplateKeys,
      activeTemplateId,
      loadTemplate,
      getCurrentUserId,
      toast,
    ],
  );

  useEffect(() => {
    if (!showSessionEditSheet || !editingSessionExercise) return;
    const entry = sessionsTodayWithExercises.find(
      ({ session }) => session.id === editingSessionExercise.sessionId,
    );
    const exercise = entry?.exercises.find((e) => e.id === editingSessionExercise.id);
    if (!entry || !exercise) return;
    const sorted = [...entry.exercises].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((e) => e.id === editingSessionExercise.id);
    const isLastExercise = idx >= sorted.length - 1;
    const supersetGroup = exercise.superset_group ?? null;
    setEditingSessionExercise((prev) => {
      if (!prev || prev.id !== editingSessionExercise.id) return prev;
      if (prev.supersetGroup === supersetGroup && prev.isLastExercise === isLastExercise) return prev;
      return { ...prev, supersetGroup, isLastExercise };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync derived superset metadata for open edit sheet
  }, [sessionsTodayWithExercises, showSessionEditSheet, editingSessionExercise?.id, editingSessionExercise?.sessionId]);

  const handleEditSheetToggleSuperset = useCallback(async () => {
    if (!editingSessionExercise) return;
    const entry = sessionsTodayWithExercises.find(
      ({ session }) => session.id === editingSessionExercise.sessionId,
    );
    const sessionExercise = entry?.exercises.find((e) => e.id === editingSessionExercise.id);
    if (!entry || !sessionExercise) return;
    const sortedExercises = [...entry.exercises].sort((a, b) => a.sort_order - b.sort_order);
    await handleToggleSessionExerciseSuperset(
      editingSessionExercise.sessionId,
      sessionExercise,
      sortedExercises,
    );
  }, [editingSessionExercise, sessionsTodayWithExercises, handleToggleSessionExerciseSuperset]);

  const handleRemoveSessionExercise = useCallback(
    async (sessionId: string, sessionExercise: PlannerSessionExercise) => {
      if (!selectedDay || !activeTemplateId || isSaving) return;
      const userId = await getCurrentUserId();
      if (!userId) return;

      const routineIds = computeRoutineSessionExerciseIds();
      const isRoutine = routineIds.has(sessionExercise.id);
      const matchingSlot = isRoutine ? mapSessionExerciseToTemplateSlot(sessionExercise, selectedDay.slots) : null;

      setIsSaving(true);
      try {
        const ok = await applyStructureEditToSession(sessionId, userId, {
          type: 'removeSlot',
          sessionExerciseId: sessionExercise.id,
        });
        if (!ok) {
          toast.error('Failed to remove exercise');
          return;
        }
        if (isRoutine && matchingSlot) {
          await applyStructureEditToTemplate(activeTemplateId, {
            type: 'removeSlot',
            slotId: matchingSlot.id,
          });
          invalidateTemplate(activeTemplateId);
          await loadTemplate(activeTemplateId);
        }
        toast.success('Exercise removed');
        await loadSessionsForDay(userId, {
          forceRefresh: true,
          skipMaterialize: true,
          dayName: selectedDay.day.day_name,
          templateExerciseKeys: selectedDayTemplateKeys,
          templateId: activeTemplateId,
          templateSlots: selectedDay.slots,
        });
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'removeSessionExercise' });
        toast.error('Failed to remove exercise');
      } finally {
        setIsSaving(false);
      }
    },
    [
      selectedDay,
      activeTemplateId,
      isSaving,
      computeRoutineSessionExerciseIds,
      mapSessionExerciseToTemplateSlot,
      loadTemplate,
      loadSessionsForDay,
      selectedDayTemplateKeys,
      getCurrentUserId,
      toast,
    ],
  );

  // Refetch when needed: flag set (e.g. after add/remove in add-exercise-edit), or templateData lost (e.g. back from workout). Throttle recovery to avoid infinite retry when load fails.
  // Uses refs for loadTemplate/loadTodaySessionExercises/loadTodaySessions so callback identity doesn't change when e.g. hasInitializedSelection flips (which would re-run this effect and re-trigger loadTodaySessionExercises/loadTodaySessions repeatedly).
  useFocusEffect(
    useCallback(() => {
      const loadTemplate = loadTemplateRef.current;
      const loadTodaySessionExercises = loadTodaySessionExercisesRef.current;

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
              loadSessions(id, {
                dayName,
                templateExerciseKeys: templateKeys,
                templateId: activeTemplateId ?? undefined,
                templateSlots: selectedDay.slots,
              });
            }
          });
        }
      }

      return () => {
        recoveryAttemptedThisFocusRef.current = false;
        loadTemplateDidTodayLoadRef.current = false;
      };
    }, [plannerNeedsRefetch, activeTemplateId, setPlannerNeedsRefetch, selectedDay, getCurrentUserId, templateData, isLoadingTemplate])
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
      await loadSessionsForDay(id, {
        dayName: selectedDay.day.day_name,
        templateExerciseKeys: selectedDayTemplateKeys,
        templateId: activeTemplateId ?? undefined,
        templateSlots: selectedDay.slots,
      });
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

  const refreshWorkoutPresets = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      setWorkoutPresets([]);
      return;
    }
    setIsLoadingPresets(true);
    try {
      const presets = await listWorkoutPresets(userId);
      setWorkoutPresets(presets);
    } finally {
      setIsLoadingPresets(false);
    }
  }, [getCurrentUserId]);

  const handleOpenSavePreset = useCallback(
    (sessionId: string, workoutIndex: number) => {
      const dayName = selectedDay?.day.day_name ?? 'Workout';
      setSavePresetMode('create');
      setRenamePresetId(null);
      setSavePresetSessionId(sessionId);
      setSavePresetDefaultName(`Workout ${workoutIndex + 1} – ${dayName}`);
      setShowSavePresetSheet(true);
    },
    [selectedDay?.day.day_name]
  );

  const handleSavePreset = useCallback(
    async (name: string) => {
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Please log in');
        return;
      }

      setIsSavingPreset(true);
      try {
        if (savePresetMode === 'rename' && renamePresetId) {
          const success = await renameWorkoutPreset(renamePresetId, name);
          if (success) {
            toast.success('Preset renamed');
            setShowSavePresetSheet(false);
            await refreshWorkoutPresets();
          } else {
            toast.error('Failed to rename preset');
          }
          return;
        }

        if (!savePresetSessionId) {
          toast.error('No workout selected');
          return;
        }

        const preset = await createWorkoutPresetFromSession(userId, savePresetSessionId, name);
        if (preset) {
          toast.success('Workout saved as preset');
          setShowSavePresetSheet(false);
          await refreshWorkoutPresets();
        } else {
          toast.error('Failed to save preset');
        }
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'handleSavePreset' });
        toast.error('Failed to save preset');
      } finally {
        setIsSavingPreset(false);
      }
    },
    [
      getCurrentUserId,
      savePresetMode,
      renamePresetId,
      savePresetSessionId,
      refreshWorkoutPresets,
      toast,
    ]
  );

  const applySelectedPreset = useCallback(
    async (presetId: string, mode: PresetLoadMode, targetSessionId?: string) => {
      if (!activeTemplateId || !selectedDay) {
        toast.error('No day selected');
        return;
      }

      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error('Please log in');
        return;
      }

      const experience = profile?.experience_level || 'beginner';
      const startedAt = dateContext.isToday
        ? undefined
        : getDateBoundsForDayName(selectedDay.day.day_name).startIso;
      const sessionCount = sessionsTodayWithExercises.length;

      setIsApplyingPreset(true);
      try {
        let success = false;

        if (sessionCount === 0) {
          const slots = await getWorkoutPresetSlots(presetId);
          if (slots.length === 0) {
            toast.error('Preset has no exercises');
            return;
          }
          const session = await createSessionFromPreset(
            userId,
            activeTemplateId,
            selectedDay.day.day_name,
            slots,
            startedAt,
            experience
          );
          if (session) {
            success = await replaceDayTemplateSlotsFromPreset(selectedDay.day.id, slots);
          }
        } else {
          success = await applyWorkoutPresetToDay({
            userId,
            templateId: activeTemplateId,
            dayId: selectedDay.day.id,
            dayName: selectedDay.day.day_name,
            presetId,
            mode,
            targetSessionId,
            sessionCountOnDay: sessionCount,
            startedAt,
            experience,
          });
        }

        if (success) {
          invalidateTemplate(activeTemplateId);
          await loadTemplate(activeTemplateId);
          if (dateContext.isToday) {
            setPlannerNeedsRefetch(true);
          } else {
            invalidateSessionsInRangeForUser(userId);
          }
          await loadSessionsForDay(userId, {
            forceRefresh: true,
            skipMaterialize: true,
            dayName: selectedDay.day.day_name,
            templateExerciseKeys: dateContext.isToday ? todayTemplateKeys : selectedDayTemplateKeys,
            templateId: activeTemplateId,
            templateSlots: selectedDay.slots,
          });
          toast.success('Preset loaded');
          pendingPresetForLoadRef.current = null;
          presetPickerPendingActionRef.current = null;
          presetOptionsPendingActionRef.current = null;
          setShowPresetPicker(false);
          setShowPresetLoadOptions(false);
          setShowPresetTargetPicker(false);
          setSelectedPresetForLoad(null);
          setPendingPresetLoadMode(null);
        } else {
          toast.error('Failed to load preset');
        }
      } catch (error) {
        if (__DEV__) devError('planner', error, { action: 'applySelectedPreset', presetId, mode });
        toast.error('Failed to load preset');
      } finally {
        setIsApplyingPreset(false);
      }
    },
    [
      activeTemplateId,
      selectedDay,
      getCurrentUserId,
      profile?.experience_level,
      dateContext.isToday,
      sessionsTodayWithExercises.length,
      loadTemplate,
      loadSessionsForDay,
      todayTemplateKeys,
      selectedDayTemplateKeys,
      setPlannerNeedsRefetch,
      toast,
    ]
  );

  const handleSelectPresetForLoad = useCallback((preset: WorkoutPreset) => {
    setSelectedPresetForLoad(preset);
    setPendingPresetLoadMode(null);
  }, []);

  const handleLoadPresetRow = useCallback(
    (preset: WorkoutPreset) => {
      if (isApplyingPreset) return;
      pendingPresetForLoadRef.current = preset;
      setSelectedPresetForLoad(preset);
      setPendingPresetLoadMode(null);

      presetPickerPendingActionRef.current =
        sessionsTodayWithExercises.length === 0 ? 'applyDirect' : 'loadOptions';
      setShowPresetPicker(false);
    },
    [isApplyingPreset, sessionsTodayWithExercises.length]
  );

  const handlePresetPickerClosed = useCallback(() => {
    const pending = presetPickerPendingActionRef.current;
    presetPickerPendingActionRef.current = null;

    if (pending === 'delete') {
      const preset = pendingPresetToDeleteRef.current;
      pendingPresetToDeleteRef.current = null;
      if (preset) setPresetToDelete(preset);
      return;
    }

    const preset = pendingPresetForLoadRef.current;
    if (!pending || !preset) return;

    if (pending === 'applyDirect') {
      void applySelectedPreset(preset.id, 'replace');
      return;
    }

    setShowPresetLoadOptions(true);
  }, [applySelectedPreset]);

  const handleDeletePresetRow = useCallback(
    (preset: WorkoutPreset) => {
      if (isApplyingPreset || isDeletingPreset) return;
      pendingPresetToDeleteRef.current = preset;
      presetPickerPendingActionRef.current = 'delete';
      setShowPresetPicker(false);
    },
    [isApplyingPreset, isDeletingPreset]
  );

  const handlePresetLoadMode = useCallback(
    (mode: PresetLoadMode) => {
      if (!selectedPresetForLoad || isApplyingPreset) return;
      setPendingPresetLoadMode(mode);

      if (mode === 'newWorkout') {
        setShowPresetLoadOptions(false);
        void applySelectedPreset(selectedPresetForLoad.id, mode);
        return;
      }

      if (sessionsTodayWithExercises.length === 1) {
        setShowPresetLoadOptions(false);
        void applySelectedPreset(
          selectedPresetForLoad.id,
          mode,
          sessionsTodayWithExercises[0].session.id
        );
        return;
      }

      presetOptionsPendingActionRef.current = 'targetPicker';
      setShowPresetLoadOptions(false);
    },
    [selectedPresetForLoad, isApplyingPreset, sessionsTodayWithExercises, applySelectedPreset]
  );

  const handlePresetLoadOptionsClosed = useCallback(() => {
    if (presetOptionsPendingActionRef.current === 'targetPicker') {
      presetOptionsPendingActionRef.current = null;
      setShowPresetTargetPicker(true);
    }
  }, []);

  const handlePresetTargetSelected = useCallback(
    (sessionId: string) => {
      if (!selectedPresetForLoad || !pendingPresetLoadMode) return;
      void applySelectedPreset(selectedPresetForLoad.id, pendingPresetLoadMode, sessionId);
    },
    [selectedPresetForLoad, pendingPresetLoadMode, applySelectedPreset]
  );

  const handleOpenLoadPreset = useCallback(async () => {
    if (!selectedDay) {
      toast.error('No day selected');
      return;
    }
    setSelectedPresetForLoad(null);
    setShowPresetLoadOptions(false);
    setShowPresetTargetPicker(false);
    setPendingPresetLoadMode(null);
    presetPickerPendingActionRef.current = null;
    presetOptionsPendingActionRef.current = null;
    pendingPresetForLoadRef.current = null;
    pendingPresetToDeleteRef.current = null;
    await refreshWorkoutPresets();
    setShowPresetPicker(true);
  }, [selectedDay, refreshWorkoutPresets, toast]);

  const handleConfirmDeletePreset = useCallback(async () => {
    if (!presetToDelete || isDeletingPreset) return;
    setIsDeletingPreset(true);
    try {
      const success = await deleteWorkoutPreset(presetToDelete.id);
      if (success) {
        toast.success('Preset deleted');
        await refreshWorkoutPresets();
        setShowPresetPicker(true);
      } else {
        toast.error('Failed to delete preset');
      }
    } catch (error) {
      if (__DEV__) devError('planner', error, { action: 'deleteWorkoutPreset' });
      toast.error('Failed to delete preset');
    } finally {
      setIsDeletingPreset(false);
      setPresetToDelete(null);
    }
  }, [presetToDelete, isDeletingPreset, refreshWorkoutPresets, toast]);

  // Add a workout (session) for the selected day. First workout of the day is
  // seeded from the day's template slots; additional workouts start empty.
  const handleAddWorkout = useCallback(async () => {
    if (!activeTemplateId || !selectedDay) return;
    const userId = await getCurrentUserId();
    if (!userId) {
      toast.error('Please log in');
      return;
    }
    setIsSaving(true);
    try {
      const startedAt = dateContext.isToday
        ? undefined
        : getDateBoundsForDayName(selectedDay.day.day_name).startIso;

      if (sessionsTodayWithExercises.length === 0 && selectedDay.slots.length > 0) {
        const session = await materializeWorkoutFromTemplateSlots({
          userId,
          templateId: activeTemplateId,
          dayName: selectedDay.day.day_name,
          slots: selectedDay.slots,
          startedAt,
          experience: profile?.experience_level || 'beginner',
        });
        if (!session) {
          toast.error('Failed to add workout');
          return;
        }
      } else {
        const session = await createWorkoutSession(
          userId,
          activeTemplateId,
          selectedDay.day.day_name,
          startedAt,
        );
        if (!session) {
          toast.error('Failed to add workout');
          return;
        }
      }

      toast.success('Workout added');
      if (dateContext.isToday) {
        setPlannerNeedsRefetch(true);
      } else {
        invalidateSessionsInRangeForUser(userId);
      }
      await loadSessionsForDay(userId, {
        forceRefresh: true,
        skipMaterialize: true,
        dayName: selectedDay.day.day_name,
        templateExerciseKeys: dateContext.isToday ? todayTemplateKeys : selectedDayTemplateKeys,
        templateId: activeTemplateId,
        templateSlots: selectedDay.slots,
      });
    } catch (error) {
      if (__DEV__) devError('planner', error, { action: 'addWorkout' });
      toast.error('Failed to add workout');
    } finally {
      setIsSaving(false);
    }
  }, [
    activeTemplateId,
    selectedDay,
    dateContext.isToday,
    sessionsTodayWithExercises.length,
    profile,
    todayTemplateKeys,
    selectedDayTemplateKeys,
    loadSessionsForDay,
    getCurrentUserId,
    setPlannerNeedsRefetch,
    toast,
  ]);

  const runGenerateWithAI = useCallback(
    async (sessionsPerDay: number, constraints?: DayConstraints) => {
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
          constraints: constraints ?? null,
        });
      }
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

        router.push({
          pathname: '/generate-ai',
          params: {
            templateId: activeTemplateId,
            dayId: selectedDay.day.id,
            dayName: selectedDay.day.day_name,
            dayIndex: String(dayIndex),
            sessionsPerDay: String(sessionsPerDay),
            constraints: JSON.stringify(constraints ?? DEFAULT_DAY_CONSTRAINTS),
            generationId:
              typeof globalThis.crypto?.randomUUID === 'function'
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          },
        });
      } catch (error) {
        if (__DEV__) {
          devError('planner-ai', error, {
            action: 'generateDay',
            templateId: activeTemplateId,
          });
        }
        toast.error('Failed to start AI generation');
      }
    },
    [
      templateData,
      activeTemplateId,
      selectedDay,
      getCurrentUserId,
      loadTemplate,
      toast,
      router,
    ]
  );

  // Render empty state
  if (isLoadingTemplate) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Plan" tabId="plan" />
        <LoadingScreen
          message="Loading planner..."
          style={styles.loadingContainer}
          centerInViewport
          chrome={{ top: TAB_HEADER_HEIGHT }}
        />
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
        <TourTarget id="tour.plan.daySelector" testID="tour-plan-day-selector">
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
        </TourTarget>

        {/* Selected day content */}
        {selectedDay ? (
          <View style={styles.dayContent}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{selectedDay.day.day_name}</Text>
              <TourTarget id="tour.plan.addWorkout" testID="tour-plan-add-workout">
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddWorkout}
                disabled={isSaving}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Workout</Text>
              </TouchableOpacity>
              </TourTarget>
            </View>

            {/* Workout containers for selected day (sessions for today or chosen weekday) */}
            <>
              {isLoadingSessionsForDay ? (
                <View style={styles.emptySlotsContainer}>
                  <LogoEdgeLoader size="small" style={{ marginBottom: spacing.sm }} />
                  <Text style={styles.emptySlotsSubtext}>Loading workouts...</Text>
                </View>
              ) : sessionsTodayWithExercises.length === 0 && selectedDay.slots.length === 0 ? (
                <View style={styles.emptySlotsContainer}>
                  <Text style={styles.emptySlotsText}>
                    {dateContext.isToday ? 'No workouts scheduled for today' : `No workouts planned for ${selectedDay.day.day_name}`}
                  </Text>
                  <Text style={styles.emptySlotsSubtext}>Add a workout or generate with AI to get started</Text>
                </View>
              ) : (
                sessionsTodayWithExercises.map(({ session, exercises }, idx) => {
                  const routineSessionExerciseIds = computeRoutineSessionExerciseIds();
                  const sortedExercises = [...exercises].sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <View key={session.id} style={styles.workoutContainer}>
                      <View style={styles.workoutContainerHeader}>
                        <View style={styles.workoutContainerTitleRow}>
                          <Text style={styles.workoutContainerTitle}>Workout {idx + 1}</Text>
                          {session.status === 'completed' && (
                            <CheckCircle size={20} color={colors.success} style={styles.workoutCompletedBadge} />
                          )}
                        </View>
                        <View style={styles.workoutHeaderActions}>
                          <TouchableOpacity
                            onPress={() => handleOpenSavePreset(session.id, idx)}
                            disabled={isSaving || exercises.length === 0}
                            style={styles.savePresetButton}
                            accessibilityLabel={`Save workout ${idx + 1} as preset`}
                          >
                            <Bookmark
                              size={18}
                              color={exercises.length === 0 ? colors.textMuted : colors.textSecondary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              const userId = await getCurrentUserId();
                              if (!userId) return;
                              const sessionIdToRemove = session.id;
                              const slotIdsToRemove: string[] = [];
                              if (selectedDay && activeTemplateId) {
                                const availableSlots = [...selectedDay.slots];
                                for (const se of exercises) {
                                  const key = se.exercise_id || se.custom_exercise_id;
                                  if (!key) continue;
                                  const matchIdx = availableSlots.findIndex(
                                    (s) => (s.exercise_id || s.custom_exercise_id) === key,
                                  );
                                  if (matchIdx !== -1) {
                                    slotIdsToRemove.push(availableSlots[matchIdx].id);
                                    availableSlots.splice(matchIdx, 1);
                                  }
                                }
                              }

                              setSessionsTodayWithExercises((prev) =>
                                prev.filter(({ session: s }) => s.id !== sessionIdToRemove),
                              );
                              setIsSaving(true);
                              try {
                                const { error } = await deleteSessionWithExercises(userId, sessionIdToRemove);
                                if (error) {
                                  toast.error('Failed to delete workout');
                                  if (__DEV__) devError('planner', error, { sessionId: sessionIdToRemove });
                                } else {
                                  toast.success('Workout removed');
                                  invalidateSessionsInRangeForUser(userId);
                                  if (activeTemplateId && slotIdsToRemove.length > 0) {
                                    let templateChanged = false;
                                    for (const sId of slotIdsToRemove) {
                                      const success = await applyStructureEditToTemplate(activeTemplateId, {
                                        type: 'removeSlot',
                                        slotId: sId,
                                      });
                                      if (success) templateChanged = true;
                                    }
                                    if (templateChanged) {
                                      invalidateTemplate(activeTemplateId);
                                      await loadTemplate(activeTemplateId);
                                    }
                                  }
                                }
                                await loadSessionsForDay(userId, {
                                  forceRefresh: true,
                                  skipMaterialize: true,
                                  dayName: selectedDay.day.day_name,
                                  templateExerciseKeys: selectedDayTemplateKeys,
                                  templateId: activeTemplateId ?? undefined,
                                  templateSlots: selectedDay.slots,
                                });
                              } catch (err) {
                                if (__DEV__) devError('planner', err, { action: 'deleteWorkout_exception', sessionId: sessionIdToRemove });
                                toast.error('Failed to delete workout');
                                await loadSessionsForDay(userId, {
                                  forceRefresh: true,
                                  skipMaterialize: true,
                                  dayName: selectedDay.day.day_name,
                                  templateExerciseKeys: selectedDayTemplateKeys,
                                  templateId: activeTemplateId ?? undefined,
                                  templateSlots: selectedDay.slots,
                                });
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
                      </View>
                      <View style={[styles.slotsList, styles.workoutContainerContent]}>
                        <NestableDraggableFlatList<PlannerSessionExercise>
                          data={sortedExercises}
                          keyExtractor={(item) => item.id}
                          scrollEnabled={false}
                          activationDistance={12}
                          onDragEnd={({ data }) => {
                            void handleSessionExercisesReordered(session.id, data);
                          }}
                          renderItem={({
                            item: sessionExercise,
                            drag,
                            isActive,
                            getIndex,
                          }: RenderItemParams<PlannerSessionExercise>) => {
                            const exerciseId = sessionExercise.exercise_id || sessionExercise.custom_exercise_id;
                            const exerciseName = exerciseId ? exerciseNames.get(exerciseId) || 'Loading...' : 'Unknown';
                            const target = exerciseId ? slotTargets.get(exerciseId) : null;
                            const variationEntry = sessionExerciseVariations.get(sessionExercise.id) ?? null;
                            const variations = variationEntry?.variations ?? null;
                            const warmupCount = variationEntry?.warmupCount ?? 0;

                            let targetContent: React.ReactNode;
                            if ((variations && variations.length > 0) || warmupCount > 0) {
                              const variationStrings = (variations ?? [])
                                .map((v) => {
                                  if (v.reps != null) return `${v.sets} sets × ${v.reps} reps`;
                                  if (v.duration_sec != null) return formatTimedSetsTarget(v.sets, v.duration_sec);
                                  return '';
                                })
                                .filter(Boolean);
                              if (warmupCount > 0) variationStrings.push(`+ ${warmupCount} warmup`);
                              targetContent = (
                                <View style={styles.slotTargetsStack}>
                                  {variationStrings.map((s, i) => (
                                    <Text key={i} style={styles.slotTargets}>{s}</Text>
                                  ))}
                                </View>
                              );
                            } else if (target) {
                              const targetText =
                                target.mode === 'reps'
                                  ? `${target.sets} sets × ${target.reps} reps`
                                  : formatTimedSetsTarget(target.sets, target.duration_sec);
                              targetContent = <Text style={styles.slotTargets}>{targetText}</Text>;
                            } else {
                              targetContent = <Text style={styles.slotTargets}>Loading targets...</Text>;
                            }

                            const isTodayOnly = !routineSessionExerciseIds.has(sessionExercise.id);
                            const supersetLabel = (() => {
                              if (sessionExercise.superset_group == null) return null;
                              const groups = Array.from(
                                new Set(sortedExercises.map((e) => e.superset_group).filter((g): g is number => g != null)),
                              ).sort((a, b) => a - b);
                              const letter = String.fromCharCode(65 + groups.indexOf(sessionExercise.superset_group));
                              return `Superset ${letter}`;
                            })();
                            const exerciseIndex = getIndex() ?? sortedExercises.findIndex((e) => e.id === sessionExercise.id);

                            return (
                              <View style={[styles.slotCard, styles.slotCardInWorkout, isActive && styles.slotCardDragging]}>
                                <Pressable
                                  style={styles.slotDragArea}
                                  onLongPress={drag}
                                  delayLongPress={200}
                                  disabled={isSaving}
                                  accessibilityRole="button"
                                  accessibilityLabel="Reorder exercise"
                                >
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
                                    {supersetLabel && (
                                      <Text style={styles.slotSupersetChip}>{supersetLabel}</Text>
                                    )}
                                    {isTodayOnly && selectedDay && (
                                      <TouchableOpacity
                                        style={styles.saveToRoutineButton}
                                        onPress={() =>
                                          handleSaveToRoutine(
                                            selectedDay.day.id,
                                            sessionExercise.exercise_id,
                                            sessionExercise.custom_exercise_id,
                                          )
                                        }
                                        disabled={isSaving}
                                      >
                                        <Text style={styles.saveToRoutineButtonText}>Save to Routine</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </Pressable>
                                <TouchableOpacity
                                  style={[styles.deleteButton, styles.editButton]}
                                  onPress={() => {
                                    const idx =
                                      exerciseIndex >= 0 ? exerciseIndex : sortedExercises.findIndex((e) => e.id === sessionExercise.id);
                                    setEditingSessionExercise({
                                      id: sessionExercise.id,
                                      name: exerciseName,
                                      mode: target?.mode || 'reps',
                                      sessionId: session.id,
                                      supersetGroup: sessionExercise.superset_group ?? null,
                                      isLastExercise: idx >= sortedExercises.length - 1,
                                    });
                                    setShowSessionEditSheet(true);
                                  }}
                                  disabled={isSaving}
                                >
                                  <Text style={[styles.deleteButtonText, styles.editButtonText]}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.deleteButton, styles.editButton]}
                                  onPress={() => void handleRemoveSessionExercise(session.id, sessionExercise)}
                                  disabled={isSaving}
                                  accessibilityRole="button"
                                  accessibilityLabel="Remove exercise"
                                >
                                  <Trash2 size={16} color={colors.errorText} />
                                </TouchableOpacity>
                              </View>
                            );
                          }}
                        />
                        <TourTarget id="tour.plan.addExercise" testID="tour-plan-add-exercise">
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
                        </TourTarget>
                      </View>
                    </View>
                  );
                })
              )}
            </>

            <TouchableOpacity
              style={[styles.loadPresetButton, isApplyingPreset && styles.loadPresetButtonDisabled]}
              onPress={() => {
                if (!activeTemplateId) {
                  if (__DEV__) devLog('planner', { action: 'loadPreset_skipped', missing: ['activeTemplateId'] });
                  toast.error('No active template');
                  return;
                }
                void handleOpenLoadPreset();
              }}
              disabled={isApplyingPreset}
            >
              <Text style={styles.loadPresetButtonText}>Load from preset</Text>
            </TouchableOpacity>

            {/* Generate with AI button */}
            <TourTarget id="tour.plan.generateAi" testID="tour-plan-generate-ai">
            <TouchableOpacity
              style={styles.generateButton}
              onPress={() => {
                const missing: string[] = [];
                if (!templateData) missing.push('templateData');
                if (!activeTemplateId) missing.push('activeTemplateId');
                if (missing.length > 0) {
                  if (__DEV__) devLog('planner', { action: 'generateWeek_skipped', missing });
                  toast.error('No template loaded');
                  return;
                }
                requestGenerateAi(() => setShowGenerateDayForm(true));
              }}
            >
              <Text style={styles.generateButtonText}>Generate with AI</Text>
            </TouchableOpacity>
            </TourTarget>

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

      {/* Pre-generation constraints form for Generate with AI */}
      <GenerateDayForm
        visible={showGenerateDayForm}
        dayName={selectedDay?.day.day_name ?? 'this day'}
        splitValue={profile?.preferred_training_style ?? null}
        onCancel={() => setShowGenerateDayForm(false)}
        onGenerate={(sessionsPerDay, constraints) => {
          setShowGenerateDayForm(false);
          runGenerateWithAI(sessionsPerDay, constraints);
        }}
      />

      <SaveWorkoutPresetSheet
        visible={showSavePresetSheet}
        mode={savePresetMode}
        defaultName={savePresetDefaultName}
        saving={isSavingPreset}
        onClose={() => setShowSavePresetSheet(false)}
        onSave={handleSavePreset}
      />

      <WorkoutPresetPickerSheet
        visible={showPresetPicker}
        presets={workoutPresets}
        selectedPreset={selectedPresetForLoad}
        loading={isLoadingPresets}
        applying={isApplyingPreset || isDeletingPreset}
        onClose={() => {
          presetPickerPendingActionRef.current = null;
          pendingPresetForLoadRef.current = null;
          pendingPresetToDeleteRef.current = null;
          setShowPresetPicker(false);
          setSelectedPresetForLoad(null);
          setPendingPresetLoadMode(null);
        }}
        onClosed={handlePresetPickerClosed}
        onSelectPreset={handleSelectPresetForLoad}
        onLoadPreset={handleLoadPresetRow}
        onDelete={handleDeletePresetRow}
      />

      <WorkoutPresetLoadOptionsSheet
        visible={showPresetLoadOptions}
        presetName={selectedPresetForLoad?.name ?? ''}
        onClose={() => {
          presetOptionsPendingActionRef.current = null;
          setShowPresetLoadOptions(false);
          setSelectedPresetForLoad(null);
          setPendingPresetLoadMode(null);
        }}
        onClosed={handlePresetLoadOptionsClosed}
        onSelect={handlePresetLoadMode}
      />

      <WorkoutTargetPickerSheet
        visible={showPresetTargetPicker}
        workouts={sessionsTodayWithExercises.map(({ session }, index) => ({
          sessionId: session.id,
          label: `Workout ${index + 1}`,
        }))}
        onClose={() => setShowPresetTargetPicker(false)}
        onSelect={handlePresetTargetSelected}
      />

      <ConfirmDialog
        visible={!!presetToDelete}
        title="Delete preset?"
        message={`Delete "${presetToDelete?.name ?? 'this preset'}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDestructive
        confirmDisabled={isDeletingPreset}
        onConfirm={() => void handleConfirmDeletePreset()}
        onCancel={() => {
          if (isDeletingPreset) return;
          setPresetToDelete(null);
          setShowPresetPicker(true);
        }}
      />

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
              await loadSessionsForDay(userId, {
                forceRefresh: true,
                skipMaterialize: true,
                dayName: selectedDay.day.day_name,
                templateExerciseKeys: selectedDayTemplateKeys,
                templateId: activeTemplateId ?? undefined,
                templateSlots: selectedDay.slots,
              });
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
                  await loadSessionsForDay(userId, {
                forceRefresh: true,
                skipMaterialize: true,
                dayName: selectedDay.day.day_name,
                templateExerciseKeys: selectedDayTemplateKeys,
                templateId: activeTemplateId ?? undefined,
                templateSlots: selectedDay.slots,
              });
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
          supersetGroup={editingSessionExercise.supersetGroup}
          canAddToSuperset={!editingSessionExercise.isLastExercise || editingSessionExercise.supersetGroup != null}
          onToggleSuperset={handleEditSheetToggleSuperset}
          supersetToggleDisabled={isSaving}
        />
      )}
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
  loadPresetButton: {
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
  loadPresetButtonDisabled: {
    opacity: 0.5,
  },
  loadPresetButtonText: {
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
  workoutHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  savePresetButton: {
    padding: spacing.xs,
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
  slotCardInWorkout: {
    backgroundColor: colors.textPrimary === '#ffffff' ? colors.background : colors.cardHover,
    borderColor: colors.borderLight,
  },
  slotDragArea: {
    flex: 1,
  },
  slotCardDragging: {
    borderColor: colors.primary,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
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
  generateButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  slotSupersetChip: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: 2,
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
