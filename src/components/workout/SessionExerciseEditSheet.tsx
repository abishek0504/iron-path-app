/**
 * Session Exercise Edit Sheet
 * 
 * Allows editing set defaults for session exercises before starting workout
 * Pre-fills weight, reps, and duration so minimal typing is needed during workout
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { supabase } from '../../lib/supabase/client';
import { devLog, devError } from '../../lib/utils/logger';

interface SessionSet {
  id: string;
  set_number: number;
  weight?: number;
  reps?: number;
  duration_sec?: number;
  rpe?: number;
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
}) => {
  const [sets, setSets] = useState<SessionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const { data, error } = await supabase
        .from('v2_session_sets')
        .select('id, set_number, weight, reps, duration_sec, rpe')
        .eq('session_exercise_id', sessionExerciseId)
        .order('set_number', { ascending: true });

      if (error) {
        if (__DEV__) {
          devError('session-edit', error, { sessionExerciseId });
        }
        return;
      }

      setSets(data || []);
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
      // Update each set
      for (const set of sets) {
        const { error } = await supabase
          .from('v2_session_sets')
          .update({
            weight: set.weight || null,
            reps: set.reps || null,
            duration_sec: set.duration_sec || null,
            rpe: set.rpe || null,
          })
          .eq('id', set.id);

        if (error) {
          if (__DEV__) {
            devError('session-edit', error, { setId: set.id });
          }
        }
      }

      onSave();
      onClose();
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

  return (
    <BottomSheet visible={visible} onClose={onClose} height="75%">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Set Defaults</Text>
            <Text style={styles.exerciseName}>{exerciseName}</Text>
          </View>
          <TouchableOpacity 
            onPress={onClose} 
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
            {sets.map((set, index) => (
              <View key={set.id} style={styles.setCard}>
                <Text style={styles.setNumber}>Set {set.set_number}</Text>

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
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.footer}>
          {onDelete && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                onDelete();
                onClose();
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

const styles = StyleSheet.create({
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
