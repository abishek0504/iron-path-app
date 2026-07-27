import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { BottomSheet, type BottomSheetHandle } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
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
  const sheetRef = useRef<BottomSheetHandle>(null);
  const requestClose = useCallback(() => {
    sheetRef.current?.requestClose();
  }, []);
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
          gap: spacing.md,
          paddingBottom: spacing.md,
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
        actionButton: {
          minWidth: 88,
        },
      }),
    [colors]
  );

  return (
    <BottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      title={mode === 'create' ? 'Save as preset' : 'Rename preset'}
      height={320}
      avoidKeyboard
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
          <Button
            label="Cancel"
            variant="secondary"
            size="sm"
            onPress={requestClose}
            disabled={saving}
            style={styles.actionButton}
          />
          <Button
            label={mode === 'create' ? 'Save' : 'Rename'}
            size="sm"
            onPress={() => canSave && onSave(trimmed)}
            disabled={!canSave}
            style={styles.actionButton}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimaryContrast} size="small" />
            ) : undefined}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
};
