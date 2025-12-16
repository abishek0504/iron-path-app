/**
 * Custom Exercise Form
 * Minimal scaffold for creating/editing custom exercises
 * Full implementation will be added later
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../lib/utils/theme';

interface CustomExerciseFormProps {
  // TODO: Add props for form state, callbacks, etc.
}

export const CustomExerciseForm: React.FC<CustomExerciseFormProps> = () => {
  // TODO: Implement form with fields:
  // - name (required)
  // - description (optional)
  // - primary_muscles[] (required, validated against v2_muscles)
  // - implicit_hits{} (optional, clamped 0-1)
  // - mode: 'reps' | 'timed' (required)
  // - target bands:
  //   - sets_min, sets_max (required)
  //   - reps_min, reps_max (required if mode='reps')
  //   - duration_sec_min, duration_sec_max (required if mode='timed')
  // - Uses validateCustomExerciseTargets() helper
  // - Saves to v2_user_custom_exercises

  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Custom Exercise Form (scaffold)</Text>
      <Text style={styles.note}>
        TODO: Implement form fields and validation using validateCustomExerciseTargets()
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  placeholder: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  note: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

