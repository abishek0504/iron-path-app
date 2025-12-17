import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
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
  onConfirm,
  onCancel,
}) => {
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
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onCancel}>
              <Text style={styles.secondaryText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.primary]} onPress={onConfirm}>
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});


