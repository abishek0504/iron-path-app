/**
 * Exercise detail screen: hero image, muscle chips, description, per-set editor
 * (weight/reps/duration/rest + warmup toggle), and explicit scope actions:
 * "Add to routine" (template slot + session sync) vs "Add to this day only".
 * Validation: weight >= 0, reps 1–50, duration 5–3600, rest 0–600.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Dumbbell, Flame } from 'lucide-react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { useUserStore } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { useToast } from '../src/hooks/useToast';
import { useDateContext } from '../src/hooks/useDateContext';
import { selectExerciseTargets } from '../src/lib/engine/targetSelection';
import {
  getOrCreateActiveSessionForToday,
  createSessionExercise,
} from '../src/lib/supabase/queries/workouts_helpers';
import {
  getSessionsForToday,
  syncTemplateSlotToSessionsForDay,
  type SetType,
} from '../src/lib/supabase/queries/workouts';
import {
  applyStructureEditToTemplate,
  getTemplateSlotsForDay,
} from '../src/lib/supabase/queries/templates';
import { invalidateTemplate } from '../src/lib/cache/templateCache';
import {
  getUserExerciseDefaults,
  upsertUserExerciseDefaults,
} from '../src/lib/supabase/queries/exercises';
import { listMergedExercisesCached, type MergedExercise } from '../src/lib/cache/exerciseCache';
import { getExerciseImage } from '../src/lib/exerciseImages';
import { supabase } from '../src/lib/supabase/client';
import { devLog, devError } from '../src/lib/utils/logger';
import { getDateBoundsForDayName } from '../src/lib/utils/date';

const DEFAULT_REST_SEC = 90;
const REPS_MIN = 1;
const REPS_MAX = 50;
const DURATION_MIN = 5;
const DURATION_MAX = 3600;
const REST_MIN = 0;
const REST_MAX = 600;
const HERO_ASPECT_RATIO = 3 / 2;
/** Cap the hero so it never dominates small/tall screens. */
const HERO_MAX_HEIGHT_FRACTION = 0.35;

interface EditSet {
  id: string;
  set_number: number;
  weight: string;
  reps: string;
  duration_sec: string;
  rest_sec: string;
  set_type: SetType;
}

function validateSet(set: EditSet, isTimedMode: boolean): { weight?: string; reps?: string; duration_sec?: string; rest_sec?: string } {
  const err: { weight?: string; reps?: string; duration_sec?: string; rest_sec?: string } = {};
  if (isTimedMode) {
    const d = set.duration_sec.trim();
    if (!d) {
      err.duration_sec = 'Required (5–3600 sec)';
    } else {
      const n = parseInt(d, 10);
      if (Number.isNaN(n) || n < DURATION_MIN || n > DURATION_MAX) {
        err.duration_sec = `Enter ${DURATION_MIN}–${DURATION_MAX}`;
      }
    }
  } else {
    const w = set.weight.trim();
    if (w !== '') {
      const n = parseFloat(w);
      if (Number.isNaN(n) || n < 0) err.weight = 'Weight must be ≥ 0';
    }
    const r = set.reps.trim();
    if (!r) {
      err.reps = 'Required (1–50)';
    } else {
      const n = parseInt(r, 10);
      if (Number.isNaN(n) || n < REPS_MIN || n > REPS_MAX) {
        err.reps = `Enter ${REPS_MIN}–${REPS_MAX}`;
      }
    }
  }
  const rest = set.rest_sec.trim();
  if (rest !== '') {
    const n = parseInt(rest, 10);
    if (Number.isNaN(n) || n < REST_MIN || n > REST_MAX) {
      err.rest_sec = `Enter ${REST_MIN}–${REST_MAX}`;
    }
  }
  return err;
}

function allSetsValid(sets: EditSet[], isTimedMode: boolean): boolean {
  return sets.every((s) => Object.keys(validateSet(s, isTimedMode)).length === 0);
}

function toExplicitSetRows(sets: EditSet[], isTimedMode: boolean) {
  return sets.map((s) => ({
    set_number: s.set_number,
    weight: !isTimedMode && s.weight.trim() !== '' ? parseFloat(s.weight) : null,
    reps: !isTimedMode && s.reps.trim() !== '' ? parseInt(s.reps, 10) : null,
    duration_sec: isTimedMode && s.duration_sec.trim() !== '' ? parseInt(s.duration_sec, 10) : null,
    rest_sec: s.rest_sec.trim() !== '' ? parseInt(s.rest_sec, 10) : null,
    set_type: s.set_type,
  }));
}

export default function AddExerciseEditScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    dayId: string;
    templateId: string;
    dayName: string;
    sessionId?: string;
    exerciseId: string;
    customExerciseId: string;
    exerciseName: string;
    isTimed: string;
    editSlotId?: string;
  }>();
  const {
    dayId,
    templateId,
    dayName,
    exerciseId,
    customExerciseId,
    exerciseName,
    isTimed,
    editSlotId,
  } = params;
  // Expo Router can return string | string[] for query params; normalize to string | undefined
  const sessionId =
    typeof params.sessionId === 'string'
      ? params.sessionId
      : Array.isArray(params.sessionId)
        ? params.sessionId[0]
        : undefined;
  const isEditSlot = !!editSlotId;
  const dateContext = useDateContext(dayName);

  if (__DEV__ && (params.sessionId !== undefined || sessionId !== undefined)) {
    devLog('add-exercise-edit', {
      action: 'sessionId_param',
      raw: params.sessionId,
      resolved: sessionId,
      type: typeof params.sessionId,
    });
  }
  const [removing, setRemoving] = useState(false);

  const profileId = useUserStore((s) => s.profile?.id);
  const experience = useUserStore((s) => s.profile?.experience_level) || 'beginner';
  const isTimedMode = isTimed === '1';

  const [userId, setUserId] = useState<string | null>(profileId ?? null);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<'routine' | 'dayOnly' | 'editSlot' | null>(null);
  const [sets, setSets] = useState<EditSet[]>([]);
  const [exerciseInfo, setExerciseInfo] = useState<MergedExercise | null>(null);
  // Sessions already materialized for the selected day; drives the "this day only" action.
  const [daySessionCount, setDaySessionCount] = useState<number | null>(null);

  const exerciseIdVal = exerciseId || undefined;
  const customExerciseIdVal = customExerciseId || undefined;
  const heroImage = exerciseName ? getExerciseImage(exerciseName) : null;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Scale hero with the screen: 3:2 of the content width, capped to a fraction
  // of the window height so it stays compact on tall phones.
  const heroHeight = Math.min(
    (windowWidth - spacing.lg * 2) / HERO_ASPECT_RATIO,
    windowHeight * HERO_MAX_HEIGHT_FRACTION
  );
  const saving = savingAction !== null;

  useEffect(() => {
    if (profileId) {
      setUserId(profileId);
      return;
    }
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user?.id) setUserId(user.id);
    });
    return () => { cancelled = true; };
  }, [profileId]);

  // Load exercise metadata (description, muscles, equipment) for the detail header.
  useEffect(() => {
    const id = exerciseIdVal || customExerciseIdVal;
    if (!userId || !id) return;
    let cancelled = false;
    listMergedExercisesCached(userId, [id])
      .then((list) => {
        if (!cancelled) setExerciseInfo(list[0] ?? null);
      })
      .catch((e) => {
        if (__DEV__) devError('add-exercise-edit', e, { action: 'loadExerciseInfo' });
      });
    return () => { cancelled = true; };
  }, [userId, exerciseIdVal, customExerciseIdVal]);

  // Check for materialized sessions on the selected day (any day, not just today).
  useEffect(() => {
    if (!userId || !dayName || isEditSlot) return;
    let cancelled = false;
    const { startIso, endIsoExclusive } = getDateBoundsForDayName(dayName);
    getSessionsForToday(userId, startIso, endIsoExclusive)
      .then((sessions) => {
        if (cancelled) return;
        setDaySessionCount(sessions.length);
        if (__DEV__) {
          devLog('add-exercise-edit', {
            action: 'daySessions_check',
            dayName,
            startIso,
            endIsoExclusive,
            sessionCount: sessions.length,
          });
        }
      })
      .catch((e) => {
        if (__DEV__) devError('add-exercise-edit', e, { action: 'daySessions_check' });
        if (!cancelled) setDaySessionCount(0);
      });
    return () => { cancelled = true; };
  }, [userId, dayName, isEditSlot]);

  const loadPrefill = useCallback(async () => {
    const missing: string[] = [];
    if (!userId) missing.push('userId');
    if (!exerciseIdVal && !customExerciseIdVal) missing.push('exerciseId or customExerciseId');
    if (missing.length > 0) {
      if (__DEV__) devLog('add-exercise-edit', { action: 'loadPrefill_skipped', missing });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Prefer user-saved defaults (master exercises only) over prescription
      let count: number;
      let weightStr: string;
      let repsStr: string;
      let durStr: string;
      let restStr: string;

      if (exerciseIdVal) {
        const userDefaults = await getUserExerciseDefaults(userId!, exerciseIdVal);
        if (userDefaults && userDefaults.default_set_count >= 1) {
          count = userDefaults.default_set_count;
          weightStr =
            userDefaults.default_weight != null ? String(userDefaults.default_weight) : '';
          repsStr =
            userDefaults.default_reps != null ? String(userDefaults.default_reps) : '10';
          durStr =
            userDefaults.default_duration_sec != null
              ? String(userDefaults.default_duration_sec)
              : '60';
          restStr =
            userDefaults.default_rest_sec != null
              ? String(userDefaults.default_rest_sec)
              : String(DEFAULT_REST_SEC);
          if (__DEV__) devLog('add-exercise-edit', { action: 'loadPrefill_fromUserDefaults', setCount: count });
        } else {
          const target = await selectExerciseTargets(
            { exerciseId: exerciseIdVal, customExerciseId: customExerciseIdVal },
            userId!,
            { experience },
            0
          );
          count = Math.max(1, target?.sets ?? 3);
          weightStr =
            target?.mode === 'reps' && target.weight != null ? String(target.weight) : '';
          repsStr =
            target?.mode === 'reps' && target.reps != null ? String(target.reps) : '10';
          durStr =
            target?.mode === 'timed' && target.duration_sec != null
              ? String(target.duration_sec)
              : '60';
          restStr = String(DEFAULT_REST_SEC);
        }
      } else {
        const target = await selectExerciseTargets(
          { exerciseId: exerciseIdVal, customExerciseId: customExerciseIdVal },
          userId!,
          { experience },
          0
        );
        count = Math.max(1, target?.sets ?? 3);
        weightStr =
          target?.mode === 'reps' && target.weight != null ? String(target.weight) : '';
        repsStr =
          target?.mode === 'reps' && target.reps != null ? String(target.reps) : '10';
        durStr =
          target?.mode === 'timed' && target.duration_sec != null
            ? String(target.duration_sec)
            : '60';
        restStr = String(DEFAULT_REST_SEC);
      }

      const next: EditSet[] = [];
      for (let i = 1; i <= count; i++) {
        next.push({
          id: `set-${i}-${Date.now()}`,
          set_number: i,
          weight: weightStr,
          reps: repsStr,
          duration_sec: durStr,
          rest_sec: i < count ? restStr : '',
          set_type: 'normal',
        });
      }
      setSets(next);
      if (__DEV__) devLog('add-exercise-edit', { action: 'loadPrefill', setCount: next.length });
    } catch (e) {
      if (__DEV__) devError('add-exercise-edit', e);
    } finally {
      setLoading(false);
    }
  }, [userId, exerciseIdVal, customExerciseIdVal, experience]);

  useEffect(() => {
    loadPrefill();
  }, [loadPrefill]);

  const updateSet = (id: string, field: keyof EditSet, value: string) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const toggleWarmup = (id: string) => {
    setSets((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, set_type: s.set_type === 'warmup' ? 'normal' : 'warmup' } : s
      )
    );
  };

  const addSet = () => {
    setSets((prev) => {
      const last = prev[prev.length - 1];
      const nextNum = (last?.set_number ?? 0) + 1;
      return [
        ...prev,
        {
          id: `set-${nextNum}-${Date.now()}`,
          set_number: nextNum,
          weight: last?.weight ?? '',
          reps: last?.reps ?? '',
          duration_sec: last?.duration_sec ?? '',
          rest_sec: '',
          set_type: 'normal',
        },
      ];
    });
  };

  const removeSet = (id: string) => {
    setSets((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((s) => s.id !== id);
      return filtered.map((s, i) => ({ ...s, set_number: i + 1 }));
    });
  };

  const handleRemoveFromRoutine = async () => {
    if (!editSlotId || !templateId) return;
    setRemoving(true);
    try {
      const success = await applyStructureEditToTemplate(templateId, { type: 'removeSlot', slotId: editSlotId });
      if (success) {
        invalidateTemplate(templateId);
        useUIStore.getState().setPlannerNeedsRefetch(true);
        toast.success('Removed from routine');
        router.replace('/(tabs)/planner');
      } else {
        toast.error('Failed to remove from routine');
      }
    } catch (e) {
      if (__DEV__) devError('add-exercise-edit', e);
      toast.error('Failed to remove from routine');
    } finally {
      setRemoving(false);
    }
  };

  const saveUserDefaultsAndBack = async () => {
    if (!allSetsValid(sets, isTimedMode)) {
      toast.error('Fix errors before saving');
      return;
    }
    setSavingAction('editSlot');
    try {
      if (exerciseIdVal && userId) {
        const first = sets[0];
        const success = await upsertUserExerciseDefaults(userId, exerciseIdVal, {
          setCount: sets.length,
          weight:
            !isTimedMode && first.weight.trim() !== ''
              ? parseFloat(first.weight)
              : null,
          reps:
            !isTimedMode && first.reps.trim() !== ''
              ? parseInt(first.reps, 10)
              : null,
          duration_sec:
            isTimedMode && first.duration_sec.trim() !== ''
              ? parseInt(first.duration_sec, 10)
              : null,
          rest_sec:
            first.rest_sec.trim() !== ''
              ? parseInt(first.rest_sec, 10)
              : null,
        });
        if (!success) {
          toast.error('Failed to save defaults');
          return;
        }
      }
      router.replace('/(tabs)/planner');
    } finally {
      setSavingAction(null);
    }
  };

  const validateAddContext = (): boolean => {
    const missingContext: string[] = [];
    if (!userId) missingContext.push('userId');
    if (!dayId) missingContext.push('dayId');
    if (!templateId) missingContext.push('templateId');
    if (!dayName) missingContext.push('dayName');
    if (missingContext.length > 0) {
      if (__DEV__) devLog('add-exercise-edit', { action: 'confirm_fail', missing: missingContext });
      toast.error('Missing context');
      return false;
    }
    if (!exerciseIdVal && !customExerciseIdVal) {
      if (__DEV__) devLog('add-exercise-edit', { action: 'confirm_fail', missing: ['exerciseId and customExerciseId (need one)'] });
      toast.error('Missing exercise');
      return false;
    }
    if (!allSetsValid(sets, isTimedMode)) {
      toast.error('Fix errors before adding');
      return false;
    }
    return true;
  };

  const insertExerciseWithSetsIntoSession = async (targetSessionId: string): Promise<boolean> => {
    const { data: existing } = await supabase
      .from('v2_session_exercises')
      .select('sort_order')
      .eq('session_id', targetSessionId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (existing?.sort_order ?? 0) + 1;
    const created = await createSessionExercise(targetSessionId, {
      exerciseId: exerciseIdVal,
      customExerciseId: customExerciseIdVal,
      sortOrder,
    });
    if (!created) return false;
    const rows = toExplicitSetRows(sets, isTimedMode).map((s) => ({
      session_exercise_id: created.id,
      ...s,
      rpe: null,
      rir: null,
      notes: null,
    }));
    const { error } = await supabase.from('v2_session_sets').insert(rows);
    if (error) {
      if (__DEV__) devError('add-exercise-edit', error, { action: 'insertSets', sessionId: targetSessionId });
      return false;
    }
    return true;
  };

  /** Add to routine: template slot + sync to the day's existing session(s). */
  const handleAddToRoutine = async () => {
    if (!validateAddContext()) return;
    setSavingAction('routine');
    try {
      const slots = await getTemplateSlotsForDay(templateId, dayName);
      const sortOrder = slots.length + 1;
      const success = await applyStructureEditToTemplate(templateId, {
        type: 'addSlot',
        dayId,
        exerciseId: exerciseIdVal,
        customExerciseId: customExerciseIdVal,
        sortOrder,
      });
      if (!success) {
        toast.error('Failed to add to routine');
        return;
      }
      invalidateTemplate(templateId);

      let syncedSessions = 0;
      if (sessionId) {
        const ok = await insertExerciseWithSetsIntoSession(sessionId);
        if (!ok) {
          toast.error('Added to routine, but failed to update workout');
          return;
        }
        syncedSessions = 1;
      } else {
        syncedSessions = await syncTemplateSlotToSessionsForDay(userId!, dayName, {
          exerciseId: exerciseIdVal,
          customExerciseId: customExerciseIdVal,
          experience,
          explicitSets: toExplicitSetRows(sets, isTimedMode),
        });
      }

      if (__DEV__) {
        devLog('add-exercise-edit', {
          action: 'add_complete',
          scope: 'routine',
          dayName,
          targetSessionId: sessionId ?? null,
          syncedSessions,
          setCount: sets.length,
          warmupCount: sets.filter((s) => s.set_type === 'warmup').length,
        });
      }
      useUIStore.getState().setPlannerNeedsRefetch(true);
      toast.success(syncedSessions > 0 ? 'Added to routine & workout' : 'Added to routine');
      router.replace('/(tabs)/planner');
    } catch (e) {
      if (__DEV__) devError('add-exercise-edit', e, { action: 'handleAddToRoutine' });
      toast.error('Failed to add exercise');
    } finally {
      setSavingAction(null);
    }
  };

  /** Add to this day only: insert into the targeted session, no template change. */
  const handleAddDayOnly = async () => {
    if (!validateAddContext()) return;
    setSavingAction('dayOnly');
    try {
      let targetSessionId: string | null = null;
      if (sessionId) {
        const { data } = await supabase
          .from('v2_workout_sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .maybeSingle();
        targetSessionId = data?.id ?? null;
        if (!targetSessionId) {
          toast.error('Workout not found');
          return;
        }
      } else if (dateContext.isToday) {
        const session = await getOrCreateActiveSessionForToday(userId!, dayName);
        if (!session) {
          toast.error("Failed to get today's session");
          return;
        }
        targetSessionId = session.id;
      } else {
        // Materialized day (non-today): target that day's most recent session.
        const { startIso, endIsoExclusive } = getDateBoundsForDayName(dayName);
        const sessions = await getSessionsForToday(userId!, startIso, endIsoExclusive);
        targetSessionId = sessions[0]?.id ?? null;
        if (!targetSessionId) {
          toast.error('No workout exists for this day');
          return;
        }
      }

      const ok = await insertExerciseWithSetsIntoSession(targetSessionId);
      if (!ok) {
        toast.error('Failed to add to workout');
        return;
      }

      if (__DEV__) {
        devLog('add-exercise-edit', {
          action: 'add_complete',
          scope: 'dayOnly',
          dayName,
          targetSessionId,
          setCount: sets.length,
          warmupCount: sets.filter((s) => s.set_type === 'warmup').length,
        });
      }
      useUIStore.getState().setPlannerNeedsRefetch(true);
      toast.success(dateContext.isToday ? "Added to today's workout" : `Added to ${dayName} only`);
      router.replace('/(tabs)/planner');
    } catch (e) {
      if (__DEV__) devError('add-exercise-edit', e, { action: 'handleAddDayOnly' });
      toast.error('Failed to add exercise');
    } finally {
      setSavingAction(null);
    }
  };

  if (!dayId || !templateId || !dayName) {
    const missing: string[] = [];
    if (!dayId) missing.push('dayId');
    if (!templateId) missing.push('templateId');
    if (!dayName) missing.push('dayName');
    if (__DEV__) devLog('add-exercise-edit', { action: 'render_guard', missing });
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/planner')}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Exercise</Text>
      </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing day or template.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Day-only is available for today (session gets created on demand) or any
  // day that already has a materialized session; hidden otherwise (routine-only).
  const canAddDayOnly =
    !!sessionId || dateContext.isToday || (daySessionCount != null && daySessionCount > 0);
  const setsValid = allSetsValid(sets, isTimedMode);
  const primaryMuscles = exerciseInfo?.primary_muscles ?? [];
  const secondaryMuscles = exerciseInfo?.secondary_muscles ?? [];
  const equipment = exerciseInfo?.equipment_needed ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/planner');
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{exerciseName || 'Add Exercise'}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {heroImage ? (
            <Image source={heroImage} style={[styles.heroImage, { height: heroHeight }]} resizeMode="contain" />
          ) : (
            <View style={[styles.heroImage, { height: heroHeight }, styles.heroPlaceholder]}>
              <Dumbbell size={48} color={colors.textMuted} />
            </View>
          )}

          <Text style={styles.exerciseTitle}>{exerciseName}</Text>

          {(primaryMuscles.length > 0 || secondaryMuscles.length > 0 || equipment.length > 0) && (
            <View style={styles.chipsRow}>
              {primaryMuscles.map((m) => (
                <View key={`p-${m}`} style={[styles.chip, styles.chipPrimary]}>
                  <Text style={styles.chipPrimaryText}>{m}</Text>
                </View>
              ))}
              {secondaryMuscles.map((m) => (
                <View key={`s-${m}`} style={styles.chip}>
                  <Text style={styles.chipText}>{m}</Text>
                </View>
              ))}
              {equipment.map((e) => (
                <View key={`e-${e}`} style={styles.chip}>
                  <Text style={styles.chipText}>{e}</Text>
                </View>
              ))}
            </View>
          )}

          {exerciseInfo?.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>How to do it</Text>
              <Text style={styles.descriptionText}>{exerciseInfo.description}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Sets</Text>
          {sets.map((set, index) => {
            const err = validateSet(set, isTimedMode);
            const isWarmup = set.set_type === 'warmup';
            return (
              <View key={set.id}>
                <View style={[styles.setCard, isWarmup && styles.setCardWarmup]}>
                  <View style={styles.setHeaderRow}>
                    <View style={styles.setHeaderLeft}>
                      <Text style={styles.setNumber}>Set {set.set_number}</Text>
                      <TouchableOpacity
                        style={[styles.warmupChip, isWarmup && styles.warmupChipActive]}
                        onPress={() => toggleWarmup(set.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Flame size={12} color={isWarmup ? colors.background : colors.textSecondary} />
                        <Text style={[styles.warmupChipText, isWarmup && styles.warmupChipTextActive]}>
                          Warmup
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {sets.length > 1 && (
                      <TouchableOpacity onPress={() => removeSet(set.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.removeSetText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {isTimedMode ? (
                    <View style={styles.section}>
                      <Text style={styles.label}>Duration (sec)</Text>
                      <TextInput
                        style={[styles.input, err.duration_sec && styles.inputError]}
                        value={set.duration_sec}
                        onChangeText={(v) => updateSet(set.id, 'duration_sec', v)}
                        placeholder={`${DURATION_MIN}–${DURATION_MAX}`}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                      />
                      {err.duration_sec ? <Text style={styles.errorText}>{err.duration_sec}</Text> : null}
                    </View>
                  ) : (
                    <>
                      <View style={styles.inputRow}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Weight</Text>
                          <TextInput
                            style={[styles.input, err.weight && styles.inputError]}
                            value={set.weight}
                            onChangeText={(v) => updateSet(set.id, 'weight', v)}
                            placeholder="0 = bodyweight"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                          />
                          {err.weight ? <Text style={styles.errorText}>{err.weight}</Text> : null}
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Reps</Text>
                          <TextInput
                            style={[styles.input, err.reps && styles.inputError]}
                            value={set.reps}
                            onChangeText={(v) => updateSet(set.id, 'reps', v)}
                            placeholder={`${REPS_MIN}–${REPS_MAX}`}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                          />
                          {err.reps ? <Text style={styles.errorText}>{err.reps}</Text> : null}
                        </View>
                      </View>
                    </>
                  )}
                </View>
                {index < sets.length - 1 ? (
                  <View style={styles.restSection}>
                    <Text style={styles.label}>Rest after set {set.set_number} (sec)</Text>
                    <TextInput
                      style={[styles.input, err.rest_sec && styles.inputError]}
                      value={set.rest_sec}
                      onChangeText={(v) => updateSet(set.id, 'rest_sec', v)}
                      placeholder={`${REST_MIN}–${REST_MAX}`}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                    {err.rest_sec ? <Text style={styles.errorText}>{err.rest_sec}</Text> : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          <TouchableOpacity style={styles.addSetButton} onPress={addSet}>
            <Text style={styles.addSetButtonText}>Add Set</Text>
          </TouchableOpacity>

          {isEditSlot ? (
            <>
              <TouchableOpacity
                style={[styles.removeFromRoutineBtn, removing && styles.btnDisabled]}
                onPress={handleRemoveFromRoutine}
                disabled={removing}
              >
                {removing ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={styles.removeFromRoutineBtnText}>Remove from routine</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, (saving || !setsValid) && styles.btnDisabled]}
                onPress={saveUserDefaultsAndBack}
                disabled={saving || !setsValid}
              >
                {savingAction === 'editSlot' ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.primaryBtnText}>Done</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {canAddDayOnly && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, (saving || !setsValid) && styles.btnDisabled]}
                  onPress={handleAddDayOnly}
                  disabled={saving || !setsValid}
                >
                  {savingAction === 'dayOnly' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>
                      {dateContext.isToday ? 'Add to today only' : `Add to this ${dayName} only`}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, (saving || !setsValid) && styles.btnDisabled]}
                onPress={handleAddToRoutine}
                disabled={saving || !setsValid}
              >
                {savingAction === 'routine' ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.primaryBtnText}>Add to routine (repeats weekly)</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.hint}>
                {canAddDayOnly
                  ? 'Routine adds repeat every week on this day. Day-only adds affect just this workout.'
                  : `No workout exists for this ${dayName} yet — adding goes to your weekly routine.`}
              </Text>
            </>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroImage: {
    width: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
  },
  heroPlaceholder: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPrimaryText: {
    fontSize: typography.sizes.xs,
    color: colors.background,
    fontWeight: '600',
  },
  descriptionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  descriptionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  descriptionText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  setCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  setCardWarmup: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  setHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setNumber: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  warmupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  warmupChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  warmupChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  warmupChipTextActive: {
    color: colors.background,
  },
  removeSetText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  restSection: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.error,
  },
  addSetButton: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    alignItems: 'center',
  },
  addSetButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  removeFromRoutineBtn: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  removeFromRoutineBtnText: {
    color: colors.error,
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  }); }
