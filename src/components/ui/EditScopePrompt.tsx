/**
 * Edit Scope Prompt
 * Prompts user to choose scope when making structure edits
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../lib/utils/theme';

export type EditScope = 'today' | 'thisWeek' | 'nextWeek';

interface EditScopePromptProps {
  visible: boolean;
  onSelect: (scope: EditScope) => void;
  onCancel: () => void;
}

export const EditScopePrompt: React.FC<EditScopePromptProps> = ({
  visible,
  onSelect,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Apply this change to:</Text>
          
          <TouchableOpacity
            style={styles.option}
            onPress={() => onSelect('today')}
          >
            <Text style={styles.optionText}>Today only (default)</Text>
            <Text style={styles.optionDescription}>
              Write to current session draft or create new session for today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, styles.optionDisabled]}
            disabled
          >
            <Text style={[styles.optionText, styles.optionTextDisabled]}>
              This week only
            </Text>
            <Text style={styles.optionDescription}>
              TODO: Not implemented yet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => onSelect('nextWeek')}
          >
            <Text style={styles.optionText}>From next week onward</Text>
            <Text style={styles.optionDescription}>
              Update template structure (never weight/reps/duration)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  option: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardBackground,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionTextDisabled: {
    color: colors.textSecondary,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cancelButton: {
    marginTop: spacing.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

