import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import {
  BODYWEIGHT_LOAD_LABEL,
  isBodyweightLoadInput,
} from '../../lib/workout/addedLoad';

interface BodyweightLoadToggleProps {
  value: string;
  onChange: (next: string) => void;
  inputStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  placeholder?: string;
  placeholderTextColor?: string;
  accessibilityLabel?: string;
  keyboardType?: 'numeric' | 'decimal-pad';
  returnKeyType?: 'next' | 'done';
  blurOnSubmit?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  inputRef?: React.Ref<TextInput>;
  children?: React.ReactNode;
}

export function BodyweightLoadToggle({
  value,
  onChange,
  inputStyle,
  style,
  placeholder = 'Added',
  placeholderTextColor,
  accessibilityLabel = 'Weight',
  keyboardType = 'decimal-pad',
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
  inputRef,
  children,
}: BodyweightLoadToggleProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isBodyweight = isBodyweightLoadInput(value);

  return (
    <View style={style}>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, isBodyweight && styles.chipActive]}
          onPress={() => onChange('0')}
          accessibilityRole="button"
          accessibilityLabel={BODYWEIGHT_LOAD_LABEL}
          accessibilityState={{ selected: isBodyweight }}
        >
          <Text style={[styles.chipText, isBodyweight && styles.chipTextActive]}>
            {BODYWEIGHT_LOAD_LABEL}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, !isBodyweight && styles.chipActive]}
          onPress={() => {
            if (isBodyweight) onChange('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Added weight"
          accessibilityState={{ selected: !isBodyweight }}
        >
          <Text style={[styles.chipText, !isBodyweight && styles.chipTextActive]}>
            Added weight
          </Text>
        </TouchableOpacity>
      </View>
      {isBodyweight ? null : (
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={inputStyle}
            value={value}
            onChangeText={onChange}
            keyboardType={keyboardType}
            returnKeyType={returnKeyType}
            blurOnSubmit={blurOnSubmit}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            accessibilityLabel={accessibilityLabel}
          />
          {children}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    chip: {
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    chipText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },
    chipTextActive: {
      color: colors.primary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      width: '100%',
    },
  });
}
