/**
 * Tab Header
 * Shared header for main tabs with title + top-right settings gear.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Settings } from 'lucide-react-native';
import { colors, spacing, typography } from '../../lib/utils/theme';
import { useModal } from '../../hooks/useModal';
import { devLog } from '../../lib/utils/logger';

interface TabHeaderProps {
  title: string;
  tabId: 'workout' | 'plan' | 'progress' | 'profile';
}

export const TabHeader: React.FC<TabHeaderProps> = ({ title, tabId }) => {
  const { openSheet } = useModal();

  const handleOpenSettings = () => {
    if (__DEV__) {
      devLog('ui-header', { action: 'openSettingsFromTab', tabId });
    }
    openSheet('settingsMenu');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity
        onPress={handleOpenSettings}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        activeOpacity={0.7}
      >
        <Settings size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  iconButton: {
    padding: spacing.sm,
    borderRadius: 999,
  },
});


