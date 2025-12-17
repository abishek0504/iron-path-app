/**
 * Smart Adjust Prompt
 * Prompts user when muscle coverage gaps are detected before starting workout
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../lib/utils/theme';

interface SmartAdjustPromptProps {
  visible: boolean;
  reasons: string[];
  onContinue: () => void;
  onSmartAdjust: () => void;
}

export const SmartAdjustPrompt: React.FC<SmartAdjustPromptProps> = ({
  visible,
  reasons,
  onContinue,
  onSmartAdjust,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Muscle Coverage Gap Detected</Text>
          
          <ScrollView style={styles.reasonsContainer}>
            {reasons.map((reason, index) => (
              <Text key={index} style={styles.reasonText}>
                • {reason}
              </Text>
            ))}
          </ScrollView>

          <Text style={styles.description}>
            Smart Adjust can rebalance your workout to cover missed muscles. This will only add or replace the minimum exercises needed.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.continueButton]}
              onPress={onContinue}
            >
              <Text style={styles.continueButtonText}>Continue anyway</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.smartAdjustButton]}
              onPress={onSmartAdjust}
            >
              <Text style={styles.smartAdjustButtonText}>Smart adjust</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '80%',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  reasonsContainer: {
    maxHeight: 150,
    marginBottom: spacing.md,
  },
  reasonText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  buttonContainer: {
    gap: spacing.md,
  },
  button: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  continueButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  smartAdjustButton: {
    backgroundColor: colors.primary,
  },
  smartAdjustButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.background,
  },
});

