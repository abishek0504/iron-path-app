/**
 * Tab Header
 * Shared header for main tabs with title + top-right settings gear.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Settings } from 'lucide-react-native';
import { spacing, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { useModal } from '../../hooks/useModal';
import { devLog } from '../../lib/utils/logger';
import { TourTarget } from '../tour/TourTarget';

/** Content height below safe area — used to balance full-screen loaders on tab screens. */
export const TAB_HEADER_HEIGHT =
  spacing.md + spacing.sm + typography.sizes['2xl'] + 4;

interface TabHeaderProps {
  title: string;
  tabId: 'workout' | 'plan' | 'progress' | 'dashboard';
  /** When false, hides the settings button (e.g. PRs modal). Default: true only when tabId === 'dashboard'. */
  showSettings?: boolean;
  /** Optional tour target id for the settings gear button. */
  settingsTourTargetId?: string;
}

export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  tabId,
  showSettings: showSettingsProp,
  settingsTourTargetId,
}) => {
  const colors = useTheme();
  const { openSheet } = useModal();

  const handleOpenSettings = () => {
    if (__DEV__) {
      devLog('ui-header', { action: 'openSettingsFromTab', tabId });
    }
    openSheet('settingsMenu');
  };

  const showSettings = showSettingsProp ?? (tabId === 'dashboard');

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.bold,
      color: colors.primary,
    },
    iconButton: {
      padding: spacing.sm,
      borderRadius: 999,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {showSettings && (
        settingsTourTargetId ? (
          <TourTarget id={settingsTourTargetId} testID="tour-dashboard-settings">
            <TouchableOpacity
              onPress={handleOpenSettings}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              activeOpacity={0.7}
            >
              <Settings size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </TourTarget>
        ) : (
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            activeOpacity={0.7}
          >
            <Settings size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )
      )}
    </View>
  );
};
