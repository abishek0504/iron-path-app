/**
 * Smart Refresh confirmation sheet
 * Non-blocking overlay showing proposed changes (additions, removals, adjustments) and Apply Updates
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { spacing, typography, borderRadius } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { SmartRefreshPlan } from '../../lib/supabase/queries/workouts_helpers';

interface SmartRefreshConfirmationSheetProps {
  visible: boolean;
  plan: SmartRefreshPlan | null;
  onClose: () => void;
  onApply: () => void;
  applying: boolean;
}

export const SmartRefreshConfirmationSheet: React.FC<SmartRefreshConfirmationSheetProps> = ({
  visible,
  plan,
  onClose,
  onApply,
  applying,
}) => {
  const colors = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
      alignItems: 'stretch',
    },
    container: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      padding: spacing.lg,
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: spacing.xs,
    },
    scroll: {
      maxHeight: 280,
    },
    scrollContent: {
      paddingBottom: spacing.md,
    },
    section: {
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    bullet: {
      fontSize: typography.sizes.sm,
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    noChanges: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    applyButtonDisabled: {
      opacity: 0.7,
    },
    applyButtonText: {
      color: colors.background,
      fontSize: typography.sizes.md,
      fontWeight: '600',
    },
  }), [colors]);

  if (!visible) return null;

  const hasChanges =
    plan &&
    (plan.additions.length > 0 || plan.removals.length > 0 || plan.hasAdjustments);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Plan Update Available</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {plan?.additions && plan.additions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Adding</Text>
                {plan.additions.map((a, i) => (
                  <Text key={i} style={styles.bullet}>
                    • {a.name}
                  </Text>
                ))}
              </View>
            )}
            {plan?.removals && plan.removals.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Removing</Text>
                {plan.removals.map((r, i) => (
                  <Text key={i} style={styles.bullet}>
                    • {r.name}
                  </Text>
                ))}
              </View>
            )}
            {plan?.hasAdjustments && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Adjustments</Text>
                <Text style={styles.bullet}>
                  • Recalculating targets from latest history
                </Text>
              </View>
            )}
            {!hasChanges && (
              <Text style={styles.noChanges}>No structural changes; only target recalculation.</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyButton, applying && styles.applyButtonDisabled]}
            onPress={onApply}
            disabled={applying}
          >
            {applying ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.applyButtonText}>Apply Updates</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
