import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from './BottomSheet';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

const MAX_WEIGHT_INPUT_LENGTH = 6;

type Props = {
  visible: boolean;
  unitsLabel: string;
  initialValue: string;
  placeholder: string;
  onSave: (value: string) => void | Promise<void>;
  onClose: () => void;
  onClosed?: () => void;
};

export function WeightEntrySheet({
  visible,
  unitsLabel,
  initialValue,
  placeholder,
  onSave,
  onClose,
  onClosed,
}: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [weightInput, setWeightInput] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setWeightInput(initialValue);
    }
  }, [visible, initialValue]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pickerScroll: {
          flex: 1,
        },
        pickerContainer: {
          paddingHorizontal: spacing.md,
          gap: spacing.md,
        },
        weightInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.cardBorder,
          paddingVertical: spacing.sm,
        },
        weightInput: {
          flex: 1,
          color: colors.textPrimary,
          fontSize: typography.sizes['2xl'],
          fontWeight: typography.weights.semibold,
          paddingVertical: spacing.sm,
        },
        weightInputUnit: {
          color: colors.textSecondary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.medium,
        },
        confirmButton: {
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          borderRadius: borderRadius.md,
          alignItems: 'center',
        },
        confirmButtonText: {
          color: colors.onPrimaryContrast,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
        },
      }),
    [colors],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title={`Enter weight (${unitsLabel})`}
      height={260}
    >
      <ScrollView
        style={styles.pickerScroll}
        contentContainerStyle={[
          styles.pickerContainer,
          { paddingBottom: Math.max(spacing.xl, insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInput}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoFocus
            selectTextOnFocus
            maxLength={MAX_WEIGHT_INPUT_LENGTH}
            accessibilityLabel={`Weight in ${unitsLabel}`}
          />
          <Text style={styles.weightInputUnit}>{unitsLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => void onSave(weightInput)}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmButtonText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheet>
  );
}
