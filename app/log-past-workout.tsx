/**
 * Log Past Workout screen: back-add a completed workout for an arbitrary past date.
 *
 * Users pick a date, add exercises (master catalog), and type in performed sets
 * (weight/reps or duration + optional RPE). On save, a completed, past-dated session
 * is written via createBackloggedWorkout so it flows into PRs, volume, trends, streaks,
 * the calendar, and progressive-overload history. No timers/rest flow.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ArrowLeft, Calendar, Flame, Plus, Trash2 } from 'lucide-react-native';
import { spacing, typography, borderRadius, isLightTheme, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { useUserStore } from '../src/stores/userStore';
import { useToast } from '../src/hooks/useToast';
import { useModal } from '../src/hooks/useModal';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { Button } from '../src/components/ui/Button';
import { supabase } from '../src/lib/supabase/client';
import { devLog, devError } from '../src/lib/utils/logger';
import { createBackloggedWorkout, type BackloggedExerciseInput } from '../src/lib/supabase/queries/workouts';
import { invalidateSessionsInRangeForUser } from '../src/lib/cache/sessionsCache';
import { invalidateWorkoutStatsCache } from '../src/lib/cache/dashboardStatsCache';
import type { Exercise } from '../src/types/exercisePicker';

const REPS_MIN = 1;
const REPS_MAX = 50;
const DURATION_MIN = 5;
const DURATION_MAX = 3600;
const RPE_MIN = 1;
const RPE_MAX = 10;
/** Backlogged sets land at local noon so the intended calendar day is unambiguous across timezones. */
const PERFORMED_HOUR = 12;

interface FormSet {
  id: string;
  weight: string;
  reps: string;
  duration_sec: string;
  rpe: string;
  set_type: 'normal' | 'warmup';
}

interface FormExercise {
  key: string;
  exerciseId: string;
  name: string;
  isTimed: boolean;
  sets: FormSet[];
}

function makeDefaultSet(): FormSet {
  return {
    id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weight: '',
    reps: '10',
    duration_sec: '60',
    rpe: '',
    set_type: 'normal',
  };
}

function validateSet(set: FormSet, isTimed: boolean): {
  weight?: string;
  reps?: string;
  duration_sec?: string;
  rpe?: string;
} {
  const err: { weight?: string; reps?: string; duration_sec?: string; rpe?: string } = {};
  if (isTimed) {
    const d = set.duration_sec.trim();
    if (!d) {
      err.duration_sec = `Required (${DURATION_MIN}–${DURATION_MAX} sec)`;
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
      err.reps = `Required (${REPS_MIN}–${REPS_MAX})`;
    } else {
      const n = parseInt(r, 10);
      if (Number.isNaN(n) || n < REPS_MIN || n > REPS_MAX) {
        err.reps = `Enter ${REPS_MIN}–${REPS_MAX}`;
      }
    }
  }
  const rpe = set.rpe.trim();
  if (rpe !== '') {
    const n = parseInt(rpe, 10);
    if (Number.isNaN(n) || n < RPE_MIN || n > RPE_MAX) {
      err.rpe = `Enter ${RPE_MIN}–${RPE_MAX}`;
    }
  }
  return err;
}

function allExercisesValid(exercises: FormExercise[]): boolean {
  if (exercises.length === 0) return false;
  return exercises.every(
    (ex) =>
      ex.sets.length > 0 &&
      ex.sets.every((s) => Object.keys(validateSet(s, ex.isTimed)).length === 0)
  );
}

/** Normalize the picked date to local noon, clamped so it is never in the future. */
function toPerformedIso(date: Date): string {
  const performed = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    PERFORMED_HOUR,
    0,
    0,
    0
  );
  const clampedMs = Math.min(performed.getTime(), Date.now());
  return new Date(clampedMs).toISOString();
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function LogPastWorkoutScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const modal = useModal();

  const params = useLocalSearchParams<{ date?: string }>();
  const profileId = useUserStore((s) => s.profile?.id);
  const [userId, setUserId] = useState<string | null>(profileId ?? null);

  const initialDate = useMemo(() => {
    const raw = typeof params.date === 'string' ? params.date : undefined;
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now()) {
        return parsed;
      }
    }
    return new Date();
  }, [params.date]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exercises, setExercises] = useState<FormExercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profileId) {
      setUserId(profileId);
      return;
    }
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user?.id) setUserId(user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !date) return;
    setSelectedDate(date);
  };

  const handleAddExercises = useCallback(() => {
    modal.openSheet('exercisePicker', {
      multiSelect: true,
      onSelectMultiple: (selected: Exercise[]) => {
        const picked = selected || [];
        if (picked.length === 0) return;
        setExercises((prev) => {
          const existing = new Set(prev.map((e) => e.exerciseId));
          const additions: FormExercise[] = picked
            .filter((ex) => ex.id && !existing.has(ex.id))
            .map((ex) => ({
              key: `ex-${ex.id}-${Date.now()}`,
              exerciseId: ex.id,
              name: ex.name,
              isTimed: ex.is_timed,
              sets: [makeDefaultSet()],
            }));
          return [...prev, ...additions];
        });
      },
    });
  }, [modal]);

  const removeExercise = (key: string) => {
    setExercises((prev) => prev.filter((e) => e.key !== key));
  };

  const addSet = (exerciseKey: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.key !== exerciseKey) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const next: FormSet = {
          ...makeDefaultSet(),
          weight: last?.weight ?? '',
          reps: last?.reps ?? '10',
          duration_sec: last?.duration_sec ?? '60',
          rpe: last?.rpe ?? '',
        };
        return { ...ex, sets: [...ex.sets, next] };
      })
    );
  };

  const removeSet = (exerciseKey: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.key !== exerciseKey) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((s) => s.id !== setId) };
      })
    );
  };

  const updateSet = (exerciseKey: string, setId: string, field: keyof FormSet, value: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.key !== exerciseKey) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      })
    );
  };

  const toggleWarmup = (exerciseKey: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.key !== exerciseKey) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) =>
            s.id === setId
              ? { ...s, set_type: s.set_type === 'warmup' ? 'normal' : 'warmup' }
              : s
          ),
        };
      })
    );
  };

  const isValid = allExercisesValid(exercises);

  const handleSave = async () => {
    if (!userId) {
      toast.error('Not signed in');
      return;
    }
    if (!isValid) {
      toast.error('Add at least one exercise and fix any errors');
      return;
    }
    setSaving(true);
    try {
      const performedAtIso = toPerformedIso(selectedDate);
      const payload: BackloggedExerciseInput[] = exercises.map((ex) => ({
        exercise_id: ex.exerciseId,
        sets: ex.sets.map((s) => {
          const rpe = s.rpe.trim() !== '' ? parseInt(s.rpe, 10) : null;
          if (ex.isTimed) {
            return {
              duration_sec: parseInt(s.duration_sec, 10),
              rpe,
              set_type: s.set_type,
            };
          }
          return {
            reps: parseInt(s.reps, 10),
            weight: s.weight.trim() !== '' ? parseFloat(s.weight) : null,
            rpe,
            set_type: s.set_type,
          };
        }),
      }));

      const sessionId = await createBackloggedWorkout(userId, { performedAtIso, exercises: payload });
      if (!sessionId) {
        toast.error('Failed to log workout');
        return;
      }

      // Match the app's pattern: caller invalidates the sessions-in-range cache.
      invalidateSessionsInRangeForUser(userId);
      invalidateWorkoutStatsCache(userId);

      if (__DEV__) {
        devLog('log-past-workout', {
          action: 'save_complete',
          sessionId,
          performedAtIso,
          exerciseCount: payload.length,
          totalSets: payload.reduce((sum, e) => sum + e.sets.length, 0),
        });
      }

      toast.success('Workout logged');
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/progress');
    } catch (e) {
      if (__DEV__) devError('log-past-workout', e, { action: 'handleSave' });
      toast.error('Failed to log workout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/progress');
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Log Past Workout
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Date</Text>
        <TouchableOpacity
          style={styles.dateRow}
          onPress={() => setShowDatePicker((v) => !v)}
          activeOpacity={0.7}
        >
          <Calendar size={18} color={colors.primary} />
          <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              onChange={handleDateChange}
              themeVariant={isLightTheme(colors) ? 'light' : 'dark'}
            />
          </View>
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpacer]}>Exercises</Text>

        {exercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No exercises yet. Add what you did.</Text>
          </View>
        ) : (
          exercises.map((ex) => (
            <View key={ex.key} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {ex.name}
                </Text>
                <TouchableOpacity
                  onPress={() => removeExercise(ex.key)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {ex.sets.map((set, index) => {
                const err = validateSet(set, ex.isTimed);
                const isWarmup = set.set_type === 'warmup';
                return (
                  <View key={set.id} style={[styles.setCard, isWarmup && styles.setCardWarmup]}>
                    <View style={styles.setHeaderRow}>
                      <View style={styles.setHeaderLeft}>
                        <Text style={styles.setNumber}>Set {index + 1}</Text>
                        <TouchableOpacity
                          style={[styles.warmupChip, isWarmup && styles.warmupChipActive]}
                          onPress={() => toggleWarmup(ex.key, set.id)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Flame
                            size={12}
                            color={isWarmup ? colors.onPrimaryContrast : colors.textSecondary}
                          />
                          <Text
                            style={[styles.warmupChipText, isWarmup && styles.warmupChipTextActive]}
                          >
                            Warmup
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {ex.sets.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeSet(ex.key, set.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.removeSetText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.inputRow}>
                      {ex.isTimed ? (
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Duration (sec)</Text>
                          <TextInput
                            style={[styles.input, err.duration_sec && styles.inputError]}
                            value={set.duration_sec}
                            onChangeText={(v) => updateSet(ex.key, set.id, 'duration_sec', v)}
                            placeholder={`${DURATION_MIN}–${DURATION_MAX}`}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                          />
                          {err.duration_sec ? (
                            <Text style={styles.errorText}>{err.duration_sec}</Text>
                          ) : null}
                        </View>
                      ) : (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Weight</Text>
                            <TextInput
                              style={[styles.input, err.weight && styles.inputError]}
                              value={set.weight}
                              onChangeText={(v) => updateSet(ex.key, set.id, 'weight', v)}
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
                              onChangeText={(v) => updateSet(ex.key, set.id, 'reps', v)}
                              placeholder={`${REPS_MIN}–${REPS_MAX}`}
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numeric"
                            />
                            {err.reps ? <Text style={styles.errorText}>{err.reps}</Text> : null}
                          </View>
                        </>
                      )}
                      <View style={styles.inputGroupSmall}>
                        <Text style={styles.label}>RPE</Text>
                        <TextInput
                          style={[styles.input, err.rpe && styles.inputError]}
                          value={set.rpe}
                          onChangeText={(v) => updateSet(ex.key, set.id, 'rpe', v)}
                          placeholder="1–10"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                        {err.rpe ? <Text style={styles.errorText}>{err.rpe}</Text> : null}
                      </View>
                    </View>
                  </View>
                );
              })}

              <Button
                label="Add Set"
                variant="secondary"
                size="sm"
                onPress={() => addSet(ex.key)}
                fullWidth
              />
            </View>
          ))
        )}

        <TouchableOpacity style={styles.addExerciseButton} onPress={handleAddExercises}>
          <Plus size={18} color={colors.primary} />
          <Text style={styles.addExerciseButtonText}>Add exercise</Text>
        </TouchableOpacity>

        <Button
          label="Save workout"
          onPress={handleSave}
          disabled={saving || !isValid}
          fullWidth
          style={styles.primaryBtn}
        >
          {saving ? <LogoEdgeLoader size="small" variant="inverted" /> : undefined}
        </Button>

        <Text style={styles.hint}>
          Logged workouts count toward your metrics, PRs, streaks, and progressive overload.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    sectionTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    sectionSpacer: {
      marginTop: spacing.lg,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    dateText: {
      fontSize: typography.sizes.base,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    pickerWrap: {
      marginTop: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderStyle: 'dashed',
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    exerciseCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    exerciseName: {
      flex: 1,
      fontSize: typography.sizes.base,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    setCard: {
      backgroundColor: colors.background,
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
      justifyContent: 'center',
      gap: 4,
      minHeight: 36,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.card,
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
      color: colors.onPrimaryContrast,
    },
    removeSetText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    inputRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    inputGroup: {
      flex: 1,
    },
    inputGroupSmall: {
      width: 72,
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
    errorText: {
      fontSize: typography.sizes.xs,
      color: colors.error,
      marginTop: spacing.xs,
    },
    addExerciseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginBottom: spacing.lg,
    },
    addExerciseButtonText: {
      fontSize: typography.sizes.base,
      fontWeight: '600',
      color: colors.primary,
    },
    primaryBtn: {
      minHeight: 52,
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.md,
    },
  });
}
