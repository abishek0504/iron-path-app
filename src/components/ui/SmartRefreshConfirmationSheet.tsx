/**
 * Smart Refresh confirmation sheet
 * Non-blocking overlay showing proposed changes (additions, removals, adjustments) and Apply Updates
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { spacing, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { SmartRefreshPlan } from '../../lib/supabase/queries/workouts_helpers';
import { LogoEdgeLoader } from './LogoEdgeLoader';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

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
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          flex: 1,
          gap: spacing.md,
          paddingBottom: spacing.md,
        },
        scroll: {
          flexGrow: 0,
          maxHeight: 280,
        },
        scrollContent: {
          paddingBottom: spacing.sm,
        },
        section: {
          marginBottom: spacing.md,
        },
        sectionTitle: {
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
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
      }),
    [colors]
  );

  const hasChanges =
    plan &&
    (plan.additions.length > 0 || plan.removals.length > 0 || plan.hasAdjustments);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Plan Update Available"
      height="70%"
    >
      <View style={styles.body}>
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
              <Text style={styles.bullet}>• Recalculating targets from latest history</Text>
            </View>
          )}
          {!hasChanges && (
            <Text style={styles.noChanges}>No structural changes; only target recalculation.</Text>
          )}
        </ScrollView>

        {applying ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
            <LogoEdgeLoader size="small" variant="inverted" />
          </View>
        ) : (
          <Button label="Apply Updates" onPress={onApply} fullWidth />
        )}
      </View>
    </BottomSheet>
  );
};
