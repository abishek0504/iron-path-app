import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { PRESET_NAME_MAX_LENGTH } from '../../lib/supabase/queries/presets';

type Mode = 'create' | 'rename';

type Props = {
  visible: boolean;
  mode: Mode;
  defaultName: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
};

export const SaveWorkoutPresetSheet: React.FC<Props> = ({
  visible,
  mode,
  defaultName,
  saving = false,
  onClose,
  onSave,
}) => {
  const colors = useTheme();
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (visible) {
      setName(defaultName);
    }
  }, [visible, defaultName]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= PRESET_NAME_MAX_LENGTH && !saving;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: spacing.lg,
          gap: spacing.md,
        },
        label: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
          backgroundColor: colors.card,
        },
        counter: {
          color: colors.textMuted,
          fontSize: typography.sizes.xs,
          textAlign: 'right',
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        button: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: borderRadius.md,
          minWidth: 88,
          alignItems: 'center',
        },
        cancelButton: {
          borderWidth: 1,
          borderColor: colors.cardBorder,
        },
        saveButton: {
          backgroundColor: colors.primary,
        },
        saveButtonDisabled: {
          opacity: 0.5,
        },
        cancelText: {
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.medium,
        },
        saveText: {
          color: colors.background,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
        },
      }),
    [colors]
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={mode === 'create' ? 'Save as preset' : 'Rename preset'}
      height={320}
    >
      <View style={styles.content}>
        <Text style={styles.label}>Preset name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Push Day"
          placeholderTextColor={colors.textMuted}
          maxLength={PRESET_NAME_MAX_LENGTH}
          autoFocus
          selectTextOnFocus
        />
        <Text style={styles.counter}>
          {trimmed.length}/{PRESET_NAME_MAX_LENGTH}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={() => canSave && onSave(trimmed)}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.saveText}>{mode === 'create' ? 'Save' : 'Rename'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};
