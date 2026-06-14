/**
 * Session Exercise Edit Sheet
 * 
 * Allows editing set defaults for session exercises before starting workout
 * Pre-fills weight, reps, and duration so minimal typing is needed during workout
 */

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link2, X } from 'lucide-react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { BottomSheet, type BottomSheetHandle } from '../ui/BottomSheet';
import { supabase } from '../../lib/supabase/client';
import { devLog, devError } from '../../lib/utils/logger';
import type { SetType } from '../../lib/supabase/queries/workouts';

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];

const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
};

interface SessionSet {
  id: string;
  set_number: number;
  weight?: number;
  reps?: number;
  duration_sec?: number;
  rpe?: number;
  set_type?: SetType;
  isNew?: boolean;
}

interface SessionExerciseEditSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void; // Optional delete handler
  sessionExerciseId: string;
  exerciseName: string;
  mode: 'reps' | 'timed';
  useImperial: boolean;
  supersetGroup?: number | null;
  canAddToSuperset?: boolean;
  onToggleSuperset?: () => void | Promise<void>;
  supersetToggleDisabled?: boolean;
}

export const SessionExerciseEditSheet: React.FC<SessionExerciseEditSheetProps> = ({
  visible,
  onClose,
  onSave,
  onDelete,
  sessionExerciseId,
  exerciseName,
  mode,
  useImperial,
  supersetGroup,
  canAddToSuperset = true,
  onToggleSuperset,
  supersetToggleDisabled = false,
}) => {
  const colors = useTheme();
  const sheetRef = useRef<BottomSheetHandle>(null);
  const requestClose = useCallback(() => {
    sheetRef.current?.requestClose();
  }, []);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSetIds, setOriginalSetIds] = useState<string[]>([]);
  const [restSec, setRestSec] = useState<string>('');
  const [isStretch, setIsStretch] = useState(false);
  const insets = useSafeAreaInsets();

  const weightUnit = useImperial ? 'lbs' : 'kg';

  useEffect(() => {
    if (visible) {
      loadSets();
    }
  }, [visible, sessionExerciseId]);

  const loadSets = async () => {
    if (__DEV__) {
      devLog('session-edit', { action: 'loadSets', sessionExerciseId });
    }

    setLoading(true);
    try {
      const [{ data, error }, { data: exerciseRow }] = await Promise.all([
        supabase
          .from('v2_session_sets')
          .select('id, set_number, weight, reps, duration_sec, rpe, set_type')
          .eq('session_exercise_id', sessionExerciseId)
          .order('set_number', { ascending: true }),
        supabase
          .from('v2_session_exercises')
          .select('rest_sec, exercise_id, v2_exercises(is_stretch)')
          .eq('id', sessionExerciseId)
          .maybeSingle(),
      ]);

      if (error) {
        if (__DEV__) {
          devError('session-edit', error, { sessionExerciseId });
        }
        return;
      }

      const stretchFlag =
        (exerciseRow as { v2_exercises?: { is_stretch?: boolean } | null } | null)?.v2_exercises
          ?.is_stretch === true;
      setIsStretch(stretchFlag);

      const loaded = (data || []) as SessionSet[];
      setSets(loaded);
      setOriginalSetIds(loaded.map((s) => s.id));
      setRestSec(exerciseRow?.rest_sec != null ? String(exerciseRow.rest_sec) : '');
    } catch (error) {
      if (__DEV__) {
        devError('session-edit', error, { action: 'loadSets' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (__DEV__) {
      devLog('session-edit', { action: 'saveSets', sessionExerciseId, setCount: sets.length });
    }

    setSaving(true);
    try {
      // Determine which existing sets should be deleted
      const existingIdsInState = new Set(
        sets.filter((s) => !s.isNew).map((s) => s.id)
      );
      const idsToDelete = originalSetIds.filter((id) => !existingIdsInState.has(id));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('v2_session_sets')
          .delete()
          .in('id', idsToDelete);

        if (deleteError && __DEV__) {
          devError('session-edit', deleteError, {
            action: 'deleteSets',
            sessionExerciseId,
            deleteCount: idsToDelete.length,
          });
        }
      }

      // Upsert remaining sets
      for (const set of sets) {
        if (set.isNew) {
          const { error } = await supabase
            .from('v2_session_sets')
            .insert({
              session_exercise_id: sessionExerciseId,
              set_number: set.set_number,
              weight: set.weight || null,
              reps: set.reps || null,
              duration_sec: set.duration_sec || null,
              rpe: isStretch ? null : (set.rpe || null),
              set_type: set.set_type || 'normal',
            });

          if (error && __DEV__) {
            devError('session-edit', error, {
              action: 'insertSet',
              sessionExerciseId,
              setNumber: set.set_number,
            });
          }
        } else {
          const { error } = await supabase
            .from('v2_session_sets')
            .update({
              set_number: set.set_number,
              weight: set.weight || null,
              reps: set.reps || null,
              duration_sec: set.duration_sec || null,
              rpe: isStretch ? null : (set.rpe || null),
              set_type: set.set_type || 'normal',
            })
            .eq('id', set.id);

          if (error && __DEV__) {
            devError('session-edit', error, {
              action: 'updateSet',
              setId: set.id,
            });
          }
        }
      }

      // Persist the per-exercise rest override (empty input clears it)
      const parsedRest = restSec.trim() === '' ? null : parseInt(restSec, 10);
      const { error: restError } = await supabase
        .from('v2_session_exercises')
        .update({ rest_sec: parsedRest != null && !isNaN(parsedRest) ? parsedRest : null })
        .eq('id', sessionExerciseId);

      if (restError && __DEV__) {
        devError('session-edit', restError, { action: 'updateRestSec', sessionExerciseId });
      }

      onSave();
      requestClose();
    } catch (error) {
      if (__DEV__) {
        devError('session-edit', error, { action: 'saveSets' });
      }
    } finally {
      setSaving(false);
    }
  };

  const updateSet = (setId: string, field: keyof SessionSet, value: string) => {
    setSets(prev =>
      prev.map(s =>
        s.id === setId
          ? {
              ...s,
              [field]: value === '' ? undefined : field === 'rpe' ? parseInt(value) || undefined : parseFloat(value) || undefined,
            }
          : s
      )
    );
  };

  const handleAddSet = () => {
    setSets((prev) => {
      const last = prev[prev.length - 1];
      const nextNumber = (last?.set_number ?? 0) + 1;
      return [
        ...prev,
        {
          id: `new-${nextNumber}-${Date.now()}`,
          set_number: nextNumber,
          weight: last?.weight,
          reps: last?.reps,
          duration_sec: last?.duration_sec,
          rpe: undefined,
          isNew: true,
        },
      ];
    });
  };

  const handleRemoveSet = (setId: string) => {
    setSets((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((s) => s.id !== setId);
      // Re-number sequentially
      return filtered.map((s, index) => ({
        ...s,
        set_number: index + 1,
      }));
    });
  };

  return (
    <BottomSheet ref={sheetRef} visible={visible} onClose={onClose} height="75%">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Set Defaults</Text>
            <Text style={styles.exerciseName}>{exerciseName}</Text>
          </View>
          <TouchableOpacity 
            onPress={requestClose} 
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Pre-fill weight and reps so you only need to swipe during your workout
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading sets...</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.setsContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.restRow}>
              <View style={styles.restLabelGroup}>
                <Text style={styles.inputLabel}>Rest between sets (sec)</Text>
                <Text style={styles.restHint}>Leave empty for default (90s)</Text>
              </View>
              <TextInput
                style={[styles.input, styles.restInput]}
                placeholder="90"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={restSec}
                onChangeText={setRestSec}
                maxLength={4}
              />
            </View>

            {onToggleSuperset && (
              <View style={styles.supersetRow}>
                <View style={styles.restLabelGroup}>
                  <Text style={styles.inputLabel}>Superset</Text>
                  <Text style={styles.restHint}>
                    {supersetGroup != null
                      ? 'Paired with the next exercise in this group'
                      : canAddToSuperset
                        ? 'Alternate with the next exercise with minimal rest'
                        : 'Add an exercise below to superset with'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.supersetToggle,
                    supersetGroup != null && styles.supersetToggleActive,
                    (!canAddToSuperset || supersetToggleDisabled) && styles.supersetToggleDisabled,
                  ]}
                  onPress={() => void onToggleSuperset()}
                  disabled={supersetToggleDisabled || (!canAddToSuperset && supersetGroup == null)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    supersetGroup != null ? 'Remove from superset' : 'Superset with next exercise'
                  }
                >
                  <Link2
                    size={16}
                    color={supersetGroup != null ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.supersetToggleText,
                      supersetGroup != null && styles.supersetToggleTextActive,
                    ]}
                  >
                    {supersetGroup != null ? 'Linked' : 'Link next'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {sets.map((set, index) => (
              <View key={set.id} style={styles.setCard}>
                <View style={styles.setHeaderRow}>
                  <View style={styles.setHeaderLeft}>
                    <Text style={styles.setNumber}>Set {set.set_number}</Text>
                    <TouchableOpacity
                      style={[
                        styles.setTypeChip,
                        (set.set_type ?? 'normal') !== 'normal' && styles.setTypeChipActive,
                      ]}
                      onPress={() => {
                        setSets((prev) =>
                          prev.map((s) => {
                            if (s.id !== set.id) return s;
                            const cycleIdx = SET_TYPE_CYCLE.indexOf(s.set_type ?? 'normal');
                            return { ...s, set_type: SET_TYPE_CYCLE[(cycleIdx + 1) % SET_TYPE_CYCLE.length] };
                          })
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.setTypeChipText,
                          (set.set_type ?? 'normal') !== 'normal' && styles.setTypeChipTextActive,
                        ]}
                      >
                        {SET_TYPE_LABELS[set.set_type ?? 'normal']}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {sets.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveSet(set.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeSetText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputRow}>
                  {mode === 'reps' && (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Weight ({weightUnit})</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          returnKeyType="next"
                          value={set.weight?.toString() || ''}
                          onChangeText={(value) => updateSet(set.id, 'weight', value)}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Reps</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          returnKeyType="next"
                          value={set.reps?.toString() || ''}
                          onChangeText={(value) => updateSet(set.id, 'reps', value)}
                        />
                      </View>
                    </>
                  )}

                  {mode === 'timed' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Duration (seconds)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        returnKeyType="next"
                        value={set.duration_sec?.toString() || ''}
                        onChangeText={(value) => updateSet(set.id, 'duration_sec', value)}
                      />
                    </View>
                  )}

                  {!isStretch && (
                  <View style={styles.inputGroupSmall}>
                    <Text style={styles.inputLabel}>RPE</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="7"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      returnKeyType={index === sets.length - 1 ? "done" : "next"}
                      value={set.rpe?.toString() || ''}
                      onChangeText={(value) => updateSet(set.id, 'rpe', value)}
                      onSubmitEditing={() => {
                        if (index === sets.length - 1) {
                          Keyboard.dismiss();
                        }
                      }}
                      maxLength={2}
                    />
                  </View>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetButton} onPress={handleAddSet}>
              <Text style={styles.addSetButtonText}>Add Set</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                onDelete();
                requestClose();
              }}
              disabled={saving || loading}
            >
              <Text style={styles.deleteButtonText}>Delete Exercise</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || loading}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Defaults'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  titleContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
    marginTop: -spacing.xs,
    marginRight: -spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  setsContainer: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  setCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  setNumber: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputGroup: {
    flex: 1,
  },
  inputGroupSmall: {
    width: 80,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
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
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  restLabelGroup: {
    flex: 1,
  },
  restHint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  restInput: {
    width: 80,
    textAlign: 'center',
  },
  supersetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  supersetToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  supersetToggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  supersetToggleDisabled: {
    opacity: 0.5,
  },
  supersetToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  supersetToggleTextActive: {
    color: colors.primary,
  },
  removeSetText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  addSetButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    alignItems: 'center',
  },
  addSetButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.error + '20',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  });
}
