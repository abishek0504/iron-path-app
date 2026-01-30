/**
 * Edit-before-add: per-set weight/reps/duration, rest between sets, add/remove sets.
 * Checkbox "Add for today only". Default: add to routine. Back and Confirm.
 * Validation: weight >= 0, reps 1–50, duration 5–3600, rest 0–600.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../src/lib/utils/theme';
import { useUserStore } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { useToast } from '../src/hooks/useToast';
import { selectExerciseTargets } from '../src/lib/engine/targetSelection';
import {
  getOrCreateActiveSessionForToday,
  createSessionExercise,
} from '../src/lib/supabase/queries/workouts_helpers';
import {
  applyStructureEditToTemplate,
  getTemplateSlotsForDay,
} from '../src/lib/supabase/queries/templates';
import { invalidateTemplate } from '../src/lib/cache/templateCache';
import {
  getUserExerciseDefaults,
  upsertUserExerciseDefaults,
} from '../src/lib/supabase/queries/exercises';
import { supabase } from '../src/lib/supabase/client';
import { devLog, devError } from '../src/lib/utils/logger';

const DEFAULT_REST_SEC = 90;
const REPS_MIN = 1;
const REPS_MAX = 50;
const DURATION_MIN = 5;
const DURATION_MAX = 3600;
const REST_MIN = 0;
const REST_MAX = 600;

interface EditSet {
  id: string;
  set_number: number;
  weight: string;
  reps: string;
  duration_sec: string;
  rest_sec: string;
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

export default function AddExerciseEditScreen() {
  const router = useRouter();
  const toast = useToast();
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
    sessionId,
    exerciseId,
    customExerciseId,
    exerciseName,
    isTimed,
    editSlotId,
  } = params;
  const isEditSlot = !!editSlotId;
  const [removing, setRemoving] = useState(false);

  const profileId = useUserStore((s) => s.profile?.id);
  const experience = useUserStore((s) => s.profile?.experience_level) || 'beginner';
  const isTimedMode = isTimed === '1';

  const [userId, setUserId] = useState<string | null>(profileId ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sets, setSets] = useState<EditSet[]>([]);
  // When adding from a specific workout container (sessionId), default to today only so the exercise lands in that session
  const [todayOnly, setTodayOnly] = useState(!!params.sessionId);

  const exerciseIdVal = exerciseId || undefined;
  const customExerciseIdVal = customExerciseId || undefined;

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
        const userDefaults = await getUserExerciseDefaults(userId, exerciseIdVal);
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
            userId,
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
          userId,
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
  };

  const handleConfirm = async () => {
    if (isEditSlot) {
      await saveUserDefaultsAndBack();
      return;
    }
    const missingContext: string[] = [];
    if (!userId) missingContext.push('userId');
    if (!dayId) missingContext.push('dayId');
    if (!templateId) missingContext.push('templateId');
    if (!dayName) missingContext.push('dayName');
    if (missingContext.length > 0) {
      if (__DEV__) devLog('add-exercise-edit', { action: 'confirm_fail', missing: missingContext });
      toast.error('Missing context');
      return;
    }
    if (!exerciseIdVal && !customExerciseIdVal) {
      if (__DEV__) devLog('add-exercise-edit', { action: 'confirm_fail', missing: ['exerciseId and customExerciseId (need one)'] });
      toast.error('Missing exercise');
      return;
    }
    if (!allSetsValid(sets, isTimedMode)) {
      toast.error('Fix errors before confirming');
      return;
    }
    setSaving(true);
    try {
      if (todayOnly) {
        let session: { id: string } | null;
        if (sessionId) {
          const { data } = await supabase
            .from('v2_workout_sessions')
            .select('id')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .maybeSingle();
          session = data;
        } else {
          session = await getOrCreateActiveSessionForToday(userId, dayName);
        }
        if (!session) {
          toast.error(sessionId ? 'Workout not found' : 'Failed to get today\'s session');
          return;
        }
        const { data: existing } = await supabase
          .from('v2_session_exercises')
          .select('sort_order')
          .eq('session_id', session.id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const sortOrder = (existing?.sort_order ?? 0) + 1;
        const created = await createSessionExercise(session.id, {
          exerciseId: exerciseIdVal,
          customExerciseId: customExerciseIdVal,
          sortOrder,
        });
        if (!created) {
          toast.error('Failed to add to today\'s session');
          return;
        }
        for (const s of sets) {
          const weightVal = s.weight.trim() !== '' ? parseFloat(s.weight) : null;
          const repsVal = s.reps.trim() !== '' ? parseInt(s.reps, 10) : null;
          const durationVal = s.duration_sec.trim() !== '' ? parseInt(s.duration_sec, 10) : null;
          const restVal = s.rest_sec.trim() !== '' ? parseInt(s.rest_sec, 10) : null;
          const { error } = await supabase.from('v2_session_sets').insert({
            session_exercise_id: created.id,
            set_number: s.set_number,
            weight: isTimedMode ? null : weightVal,
            reps: isTimedMode ? null : repsVal,
            duration_sec: isTimedMode ? durationVal : null,
            rest_sec: restVal,
            rpe: null,
            rir: null,
            notes: null,
          });
          if (error) {
            if (__DEV__) devError('add-exercise-edit', error, { set_number: s.set_number });
            toast.error('Failed to add sets');
            return;
          }
        }
        if (__DEV__) devLog('add-exercise-edit', { action: 'sessionSetsInserted', count: sets.length });
        toast.success('Added to today\'s session');
        useUIStore.getState().setPlannerNeedsRefetch(true);
      } else {
        const slots = await getTemplateSlotsForDay(templateId, dayName);
        const sortOrder = slots.length + 1;
        const success = await applyStructureEditToTemplate(templateId, {
          type: 'addSlot',
          dayId,
          exerciseId: exerciseIdVal,
          customExerciseId: customExerciseIdVal,
          sortOrder,
        });
        if (success) invalidateTemplate(templateId);
        if (!success) {
          toast.error('Failed to add to routine');
          return;
        }
        toast.success('Added to routine');
        if (__DEV__) {
          const before = useUIStore.getState().plannerNeedsRefetch;
          devLog('add-exercise-edit', { action: 'setPlannerNeedsRefetch', before, settingTo: true });
        }
        useUIStore.getState().setPlannerNeedsRefetch(true);
        if (__DEV__) {
          const after = useUIStore.getState().plannerNeedsRefetch;
          devLog('add-exercise-edit', { action: 'setPlannerNeedsRefetch', after, success: after === true });
        }
      }
      router.replace('/(tabs)/planner');
    } catch (e) {
      if (__DEV__) devError('add-exercise-edit', e);
      toast.error('Failed to add exercise');
    } finally {
      setSaving(false);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/planner')}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{exerciseName || 'Add Exercise'}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {sets.map((set, index) => {
            const err = validateSet(set, isTimedMode);
            return (
              <View key={set.id}>
                <View style={styles.setCard}>
                  <View style={styles.setHeaderRow}>
                    <Text style={styles.setNumber}>Set {set.set_number}</Text>
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

          {!isEditSlot && (
            <View style={styles.todayOnlyCard}>
              <View style={styles.checkboxRow}>
                <Text style={styles.checkboxLabel}>Add for today only</Text>
                <Switch
                  value={todayOnly}
                  onValueChange={setTodayOnly}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              <Text style={styles.hint}>
                Off = add to routine for this day. On = add only to today&apos;s session.
              </Text>
            </View>
          )}

          {isEditSlot && (
            <TouchableOpacity
              style={[styles.removeFromRoutineBtn, removing && styles.confirmBtnDisabled]}
              onPress={handleRemoveFromRoutine}
              disabled={removing}
            >
              {removing ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={styles.removeFromRoutineBtnText}>Remove from routine</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (saving || (!isEditSlot && !allSetsValid(sets, isTimedMode))) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={saving || (!isEditSlot && !allSetsValid(sets, isTimedMode))}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.confirmBtnText}>{isEditSlot ? 'Done' : 'Confirm add'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  setNumber: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
    color: colors.textPrimary,
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
  todayOnlyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkboxLabel: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
  confirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
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
});
