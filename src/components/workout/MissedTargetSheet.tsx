import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../ui/BottomSheet';
import { NUMERIC_DONE_PROPS, NUMERIC_NEXT_PROPS } from '../../lib/constants/numericKeyboard';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { BodyweightLoadToggle } from './BodyweightLoadToggle';

type Props = {
  visible: boolean;
  unitsLabel: string;
  initialWeight: string;
  initialReps: string;
  onSave: (weight: string, reps: string) => void;
  onClose: () => void;
};

export function MissedTargetSheet({
  visible,
  unitsLabel,
  initialWeight,
  initialReps,
  onSave,
  onClose,
}: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (visible) {
      setWeight(initialWeight);
      setReps(initialReps);
    }
  }, [visible, initialWeight, initialReps]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="What did you hit?"
      height={360}
      avoidKeyboard
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(spacing.xl, insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>
          Keep the prescribed target on screen. Save only what you actually did this set.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Weight ({unitsLabel})</Text>
          <BodyweightLoadToggle
            value={weight}
            onChange={setWeight}
            inputStyle={styles.input}
            keyboardType="decimal-pad"
            {...NUMERIC_NEXT_PROPS}
            placeholder="Added"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Weight"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reps</Text>
          <TextInput
            style={styles.input}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            {...NUMERIC_DONE_PROPS}
            onSubmitEditing={Keyboard.dismiss}
            placeholder="Reps"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Reps"
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => {
            onSave(weight, reps);
            onClose();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Save what you hit"
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      lineHeight: 20,
    },
    field: {
      gap: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: borderRadius.md,
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 48,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    saveButtonText: {
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
  });
}
