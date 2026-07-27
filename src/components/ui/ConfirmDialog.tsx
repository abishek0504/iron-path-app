import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, styles the cancel button as destructive (red). */
  cancelDestructive?: boolean;
  /** When true, styles the confirm button as destructive (red). */
  confirmDestructive?: boolean;
  /** When true, disables the confirm button. */
  confirmDisabled?: boolean;
  onConfirm: (event?: GestureResponderEvent) => void;
  onCancel: (event?: GestureResponderEvent) => void;
}

/**
 * Themed confirm dialog that can be used from screens, modals, or bottom sheets.
 * Render it near the root of the current screen and control via `visible`.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title = 'Are you sure?',
  message = 'Unsaved changes will be lost.',
  confirmLabel = 'Discard',
  cancelLabel = 'Cancel',
  cancelDestructive = false,
  confirmDestructive = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) => {
  const colors = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.dialogBackdropTint,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
    },
    message: {
      color: colors.textSecondary,
      fontSize: typography.sizes.base,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    button: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondary: {
      backgroundColor: colors.card,
    },
    destructive: {
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    destructiveText: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    secondaryText: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
    },
    primaryText: {
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
  }), [colors]);

  const cancelButtonStyle = cancelDestructive ? styles.destructive : styles.secondary;
  const cancelTextStyle = cancelDestructive ? styles.destructiveText : styles.secondaryText;
  const confirmButtonStyle = confirmDestructive ? styles.destructive : styles.primary;
  const confirmTextStyle = confirmDestructive ? styles.destructiveText : styles.primaryText;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, cancelButtonStyle]} onPress={onCancel}>
              <Text style={cancelTextStyle}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, confirmButtonStyle, confirmDisabled && styles.buttonDisabled]}
              onPress={onConfirm}
              disabled={confirmDisabled}
            >
              <Text style={confirmTextStyle}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
