/**
 * Create / edit a user custom exercise.
 *
 * Backed by v2_user_custom_exercises (owner-only RLS). Users provide a name,
 * mode (reps/timed), the muscles worked, set/rep or duration bands, and optional
 * equipment. Low-level scheduling internals (density, timing buffers, implicit
 * hits) use sensible defaults so users are never asked to fill them in.
 *
 * On save the merged-exercise cache is invalidated (inside the mutation) so the
 * exercise immediately appears in the Add Exercise list and flows into
 * templates, sessions, PRs, and analytics via custom_exercise_id.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { useUserStore } from '../src/stores/userStore';
import { useToast } from '../src/hooks/useToast';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { Button } from '../src/components/ui/Button';
import { Chip } from '../src/components/ui/Chip';
import { supabase } from '../src/lib/supabase/client';
import { devError } from '../src/lib/utils/logger';
import { MUSCLE_KEY_TO_DISPLAY_NAME } from '../src/lib/constants/muscleHeatmapSlugs';
import {
  createUserCustomExercise,
  updateUserCustomExercise,
  type CreateUserCustomExercisePayload,
} from '../src/lib/supabase/queries/customExerciseMutations';
import { getMergedExercise } from '../src/lib/supabase/queries/exercises';

const NAME_MAX_LENGTH = 60;
const SETS_MIN_ALLOWED = 1;
const SETS_MAX_ALLOWED = 10;
const REPS_MIN_ALLOWED = 1;
const REPS_MAX_ALLOWED = 50;
const DURATION_MIN_ALLOWED = 5;
const DURATION_MAX_ALLOWED = 3600;

/** Defaults for scheduling internals we do not ask users to fill in. */
const DEFAULT_DENSITY_SCORE = 5;
const DEFAULT_SETUP_BUFFER_SEC = 30;
const DEFAULT_AVG_TIME_PER_SET_SEC = 120;

const DEFAULT_SETS_MIN = '3';
const DEFAULT_SETS_MAX = '4';
const DEFAULT_REPS_MIN = '8';
const DEFAULT_REPS_MAX = '12';
const DEFAULT_DURATION_MIN = '30';
const DEFAULT_DURATION_MAX = '60';

const MUSCLE_OPTIONS: { key: string; label: string }[] = Object.entries(MUSCLE_KEY_TO_DISPLAY_NAME)
  .map(([key, label]) => ({ key, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

type Mode = 'reps' | 'timed';

interface FormState {
  name: string;
  mode: Mode;
  isUnilateral: boolean;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setsMin: string;
  setsMax: string;
  repsMin: string;
  repsMax: string;
  durationMin: string;
  durationMax: string;
  equipment: string;
}

function makeInitialForm(): FormState {
  return {
    name: '',
    mode: 'reps',
    isUnilateral: false,
    primaryMuscles: [],
    secondaryMuscles: [],
    setsMin: DEFAULT_SETS_MIN,
    setsMax: DEFAULT_SETS_MAX,
    repsMin: DEFAULT_REPS_MIN,
    repsMax: DEFAULT_REPS_MAX,
    durationMin: DEFAULT_DURATION_MIN,
    durationMax: DEFAULT_DURATION_MAX,
    equipment: '',
  };
}

function parseIntOrNull(value: string): number | null {
  const n = parseInt(value.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'Enter an exercise name';
  if (form.primaryMuscles.length === 0) return 'Pick at least one primary muscle';

  const setsMin = parseIntOrNull(form.setsMin);
  const setsMax = parseIntOrNull(form.setsMax);
  if (setsMin === null || setsMax === null) return 'Enter valid set numbers';
  if (setsMin < SETS_MIN_ALLOWED || setsMax > SETS_MAX_ALLOWED) {
    return `Sets must be between ${SETS_MIN_ALLOWED} and ${SETS_MAX_ALLOWED}`;
  }
  if (setsMin > setsMax) return 'Min sets cannot exceed max sets';

  if (form.mode === 'reps') {
    const repsMin = parseIntOrNull(form.repsMin);
    const repsMax = parseIntOrNull(form.repsMax);
    if (repsMin === null || repsMax === null) return 'Enter valid rep numbers';
    if (repsMin < REPS_MIN_ALLOWED || repsMax > REPS_MAX_ALLOWED) {
      return `Reps must be between ${REPS_MIN_ALLOWED} and ${REPS_MAX_ALLOWED}`;
    }
    if (repsMin > repsMax) return 'Min reps cannot exceed max reps';
  } else {
    const durMin = parseIntOrNull(form.durationMin);
    const durMax = parseIntOrNull(form.durationMax);
    if (durMin === null || durMax === null) return 'Enter valid duration values';
    if (durMin < DURATION_MIN_ALLOWED || durMax > DURATION_MAX_ALLOWED) {
      return `Duration must be between ${DURATION_MIN_ALLOWED} and ${DURATION_MAX_ALLOWED} sec`;
    }
    if (durMin > durMax) return 'Min duration cannot exceed max duration';
  }

  return null;
}

function buildPayload(form: FormState): CreateUserCustomExercisePayload {
  const isTimed = form.mode === 'timed';
  const equipment = form.equipment
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  return {
    name: form.name.trim(),
    density_score: DEFAULT_DENSITY_SCORE,
    primary_muscles: form.primaryMuscles,
    secondary_muscles: form.secondaryMuscles.length > 0 ? form.secondaryMuscles : undefined,
    implicit_hits: {},
    is_unilateral: form.isUnilateral,
    setup_buffer_sec: DEFAULT_SETUP_BUFFER_SEC,
    avg_time_per_set_sec: DEFAULT_AVG_TIME_PER_SET_SEC,
    is_timed: isTimed,
    equipment_needed: equipment.length > 0 ? equipment : undefined,
    mode: form.mode,
    sets_min: parseInt(form.setsMin, 10),
    sets_max: parseInt(form.setsMax, 10),
    reps_min: isTimed ? undefined : parseInt(form.repsMin, 10),
    reps_max: isTimed ? undefined : parseInt(form.repsMax, 10),
    duration_sec_min: isTimed ? parseInt(form.durationMin, 10) : undefined,
    duration_sec_max: isTimed ? parseInt(form.durationMax, 10) : undefined,
  };
}

export default function CreateCustomExerciseScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const params = useLocalSearchParams<{ customExerciseId?: string }>();
  const editingId = typeof params.customExerciseId === 'string' && params.customExerciseId ? params.customExerciseId : null;
  const isEditing = !!editingId;

  const profileId = useUserStore((s) => s.profile?.id);
  const [userId, setUserId] = useState<string | null>(profileId ?? null);
  const [form, setForm] = useState<FormState>(makeInitialForm);
  const [loading, setLoading] = useState(isEditing);
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

  useEffect(() => {
    if (!isEditing || !editingId || !userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const existing = await getMergedExercise({ customExerciseId: editingId }, userId);
        if (cancelled) return;
        if (!existing) {
          toast.error('Could not load exercise');
          if (router.canGoBack()) router.back();
          return;
        }
        const isTimed = existing.is_timed;
        setForm({
          name: existing.name,
          mode: existing.mode ?? (isTimed ? 'timed' : 'reps'),
          isUnilateral: existing.is_unilateral,
          primaryMuscles: existing.primary_muscles ?? [],
          secondaryMuscles: existing.secondary_muscles ?? [],
          setsMin: existing.sets_min != null ? String(existing.sets_min) : DEFAULT_SETS_MIN,
          setsMax: existing.sets_max != null ? String(existing.sets_max) : DEFAULT_SETS_MAX,
          repsMin: existing.reps_min != null ? String(existing.reps_min) : DEFAULT_REPS_MIN,
          repsMax: existing.reps_max != null ? String(existing.reps_max) : DEFAULT_REPS_MAX,
          durationMin: existing.duration_sec_min != null ? String(existing.duration_sec_min) : DEFAULT_DURATION_MIN,
          durationMax: existing.duration_sec_max != null ? String(existing.duration_sec_max) : DEFAULT_DURATION_MAX,
          equipment: (existing.equipment_needed ?? []).join(', '),
        });
      } catch (e) {
        if (__DEV__) devError('create-custom-exercise', e, { action: 'load', editingId });
        if (!cancelled) toast.error('Could not load exercise');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditing, editingId, userId, router, toast]);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleMuscle = useCallback((list: 'primaryMuscles' | 'secondaryMuscles', key: string) => {
    setForm((prev) => {
      const current = prev[list];
      const next = current.includes(key)
        ? current.filter((m) => m !== key)
        : [...current, key];
      // A muscle cannot be both primary and secondary.
      const other = list === 'primaryMuscles' ? 'secondaryMuscles' : 'primaryMuscles';
      return {
        ...prev,
        [list]: next,
        [other]: prev[other].filter((m) => m !== key),
      };
    });
  }, []);

  const handleSave = async () => {
    if (!userId) {
      toast.error('Not signed in');
      return;
    }
    const error = validate(form);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEditing && editingId) {
        const ok = await updateUserCustomExercise(userId, editingId, payload);
        if (!ok) {
          toast.error('Failed to save exercise');
          return;
        }
        toast.success('Exercise updated');
      } else {
        const created = await createUserCustomExercise(userId, payload);
        if (!created) {
          toast.error('Failed to create exercise');
          return;
        }
        toast.success('Exercise created');
      }
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/planner');
    } catch (e) {
      if (__DEV__) devError('create-custom-exercise', e, { action: 'save', isEditing });
      toast.error('Failed to save exercise');
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
            else router.replace('/(tabs)/planner');
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isEditing ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
        </Text>
      </View>

      {loading ? (
        <LoadingScreenInline />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => update('name', v.slice(0, NAME_MAX_LENGTH))}
            placeholder="e.g. Cable Y-Raise"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, styles.spacer]}>Type</Text>
          <View style={styles.chipRow}>
            {(['reps', 'timed'] as Mode[]).map((m) => (
              <Chip
                key={m}
                label={m === 'reps' ? 'Reps & weight' : 'Timed'}
                selected={form.mode === m}
                onPress={() => update('mode', m)}
              />
            ))}
          </View>

          <View style={[styles.switchRow, styles.spacer]}>
            <View style={styles.switchLabelWrap}>
              <Text style={styles.label}>Unilateral</Text>
              <Text style={styles.hint}>One side at a time (doubles est. time)</Text>
            </View>
            <Switch
              value={form.isUnilateral}
              onValueChange={(v) => update('isUnilateral', v)}
              trackColor={{ true: colors.primary, false: colors.borderLight }}
            />
          </View>

          <Text style={[styles.label, styles.spacer]}>Sets</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.subLabel}>Min</Text>
              <TextInput
                style={styles.input}
                value={form.setsMin}
                onChangeText={(v) => update('setsMin', v)}
                keyboardType="numeric"
                placeholder={DEFAULT_SETS_MIN}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.subLabel}>Max</Text>
              <TextInput
                style={styles.input}
                value={form.setsMax}
                onChangeText={(v) => update('setsMax', v)}
                keyboardType="numeric"
                placeholder={DEFAULT_SETS_MAX}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {form.mode === 'reps' ? (
            <>
              <Text style={[styles.label, styles.spacer]}>Reps</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.subLabel}>Min</Text>
                  <TextInput
                    style={styles.input}
                    value={form.repsMin}
                    onChangeText={(v) => update('repsMin', v)}
                    keyboardType="numeric"
                    placeholder={DEFAULT_REPS_MIN}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.subLabel}>Max</Text>
                  <TextInput
                    style={styles.input}
                    value={form.repsMax}
                    onChangeText={(v) => update('repsMax', v)}
                    keyboardType="numeric"
                    placeholder={DEFAULT_REPS_MAX}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.label, styles.spacer]}>Duration (sec)</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.subLabel}>Min</Text>
                  <TextInput
                    style={styles.input}
                    value={form.durationMin}
                    onChangeText={(v) => update('durationMin', v)}
                    keyboardType="numeric"
                    placeholder={DEFAULT_DURATION_MIN}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.subLabel}>Max</Text>
                  <TextInput
                    style={styles.input}
                    value={form.durationMax}
                    onChangeText={(v) => update('durationMax', v)}
                    keyboardType="numeric"
                    placeholder={DEFAULT_DURATION_MAX}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </>
          )}

          <Text style={[styles.label, styles.spacer]}>Primary muscles</Text>
          <Text style={styles.hint}>Tap the muscles this exercise mainly targets.</Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_OPTIONS.map(({ key, label }) => (
              <Chip
                key={`p-${key}`}
                label={label}
                selected={form.primaryMuscles.includes(key)}
                onPress={() => toggleMuscle('primaryMuscles', key)}
              />
            ))}
          </View>

          <Text style={[styles.label, styles.spacer]}>Secondary muscles (optional)</Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_OPTIONS.map(({ key, label }) => (
              <Chip
                key={`s-${key}`}
                label={label}
                selected={form.secondaryMuscles.includes(key)}
                onPress={() => toggleMuscle('secondaryMuscles', key)}
              />
            ))}
          </View>

          <Text style={[styles.label, styles.spacer]}>Equipment (optional)</Text>
          <TextInput
            style={styles.input}
            value={form.equipment}
            onChangeText={(v) => update('equipment', v)}
            placeholder="e.g. dumbbell, cable"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.hint}>Separate multiple items with commas.</Text>

          <Button
            label={isEditing ? 'Save changes' : 'Create exercise'}
            onPress={handleSave}
            disabled={saving}
            fullWidth
            style={styles.primaryBtn}
          >
            {saving ? <LogoEdgeLoader size="small" variant="inverted" /> : undefined}
          </Button>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LoadingScreenInline() {
  return (
    <View style={loaderWrapStyle}>
      <LogoEdgeLoader size="large" />
    </View>
  );
}

const loaderWrapStyle = { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const };

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
    label: {
      fontSize: typography.sizes.base,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    spacer: {
      marginTop: spacing.lg,
    },
    hint: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      marginBottom: spacing.sm,
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
    inputRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    inputGroup: {
      flex: 1,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    switchLabelWrap: {
      flex: 1,
    },
    muscleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    primaryBtn: {
      minHeight: 52,
      marginTop: spacing.xl,
    },
  });
}
