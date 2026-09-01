/**
 * Settings Menu
 * Bottom sheet component for accessing settings/preferences
 * Reusable across all tabs
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { User, Bell, HelpCircle, LogOut, Mail, Shield, Trash2, Heart, Sparkles, RefreshCw, Timer, Download } from 'lucide-react-native';
import { spacing, borderRadius, typography, THEME_OPTIONS, getThemeLabel, type ThemeColors } from '../../lib/utils/theme';
import { useTheme, useThemeMode } from '../../lib/utils/ThemeContext';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase/client';
import { useUIStore } from '../../stores/uiStore';
import { useUserStore } from '../../stores/userStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { LegalLinks } from '../ui/LegalLinks';
import { requestAccountDeletion } from '../../lib/supabase/queries/users';
import { invalidateProfileCache } from '../../lib/cache/dashboardStatsCache';
import { logOutRevenueCat, presentCustomerCenter } from '../../lib/subscriptions/revenueCat';
import { usePaywall } from '../paywall/PaywallProvider';

interface SettingsMenuProps {
  onClose?: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { themeMode } = useThemeMode();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const runAfterBottomSheetClosed = useUIStore((state) => state.runAfterBottomSheetClosed);
  const profile = useUserStore((state) => state.profile);
  const clearProfile = useUserStore((state) => state.clearProfile);
  const { isPro, showPaywall, restoreSubscription } = usePaywall();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleNavigate = (path: string) => {
    if (onClose) {
      onClose();
    }
    router.push(path as any);
  };

  const handleManageSubscription = async () => {
    const presented = await presentCustomerCenter();
    if (presented) {
      return;
    }
    if (Platform.OS === 'ios') {
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
      return;
    }
    showToast('Manage subscriptions in your device app store settings', 'info');
  };

  /** Close settings sheet first so PaywallModal / Customer Center do not stack RN Modals. */
  const handleUpgradeOrManage = () => {
    if (isPro) {
      runAfterBottomSheetClosed(() => {
        void handleManageSubscription();
      });
    } else {
      runAfterBottomSheetClosed(() => {
        showPaywall('app_open');
      });
    }
    onClose?.();
  };

  const handleRestoreSubscription = async () => {
    await restoreSubscription();
  };

  const handleLogout = async () => {
    if (onClose) {
      onClose();
    }
    await logOutRevenueCat().catch(() => undefined);
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast('Unable to log out', 'error');
      return;
    }
    showToast('Logged out', 'success');
    router.replace('/login');
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await requestAccountDeletion();
      if (!result.success) {
        showToast(result.error || 'Unable to delete account', 'error');
        return;
      }

      // Sign out locally regardless (Edge Function also revokes tokens)
      await logOutRevenueCat().catch(() => undefined);
      await supabase.auth.signOut().catch(() => undefined);
      if (profile?.id) {
        invalidateProfileCache(profile.id);
      }
      clearProfile();

      setShowDeleteConfirm(false);
      if (onClose) {
        onClose();
      }
      showToast(
        `Account scheduled for deletion in ${result.grace_days} days. Sign in before then to restore.`,
        'success',
      );
      router.replace('/login');
    } catch {
      showToast('Unable to delete account', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const themeOption = THEME_OPTIONS.find((option) => option.id === themeMode) ?? THEME_OPTIONS[0];
  const ThemeIcon = themeOption.icon;
  const themeModeLabel = getThemeLabel(themeMode);

  const menuItems = [
    {
      id: 'profile',
      label: 'Edit Profile',
      sublabel: undefined as string | undefined,
      icon: User,
      onPress: () => handleNavigate('/edit-profile'),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      sublabel: themeModeLabel,
      icon: ThemeIcon,
      onPress: () => handleNavigate('/appearance'),
    },
    {
      id: 'notifications',
      label: 'Workout Reminders',
      sublabel: undefined,
      icon: Bell,
      onPress: () => handleNavigate('/workout-reminders'),
    },
    {
      id: 'workout-settings',
      label: 'Workout Settings',
      sublabel: undefined,
      icon: Timer,
      onPress: () => handleNavigate('/workout-settings'),
    },
    {
      id: 'export-data',
      label: 'Export Data',
      sublabel: undefined,
      icon: Download,
      onPress: () => handleNavigate('/export-data'),
    },
    {
      id: 'apple-health',
      label: 'Apple Health',
      icon: Heart,
      onPress: () => handleNavigate('/health-connect'),
    },
    {
      id: 'ironpath-pro',
      label: isPro ? 'IronPath Pro' : 'Upgrade to Pro',
      sublabel: isPro ? 'Active' : undefined,
      icon: Sparkles,
      onPress: handleUpgradeOrManage,
    },
    {
      id: 'restore-subscription',
      label: 'Restore subscription',
      icon: RefreshCw,
      onPress: () => void handleRestoreSubscription(),
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: HelpCircle,
      onPress: () => handleNavigate('/help-support'),
    },
    {
      id: 'change-password',
      label: 'Change Password',
      icon: Shield,
      onPress: () => handleNavigate('/auth/change-password'),
    },
    {
      id: 'change-email',
      label: 'Change Email',
      icon: Mail,
      onPress: () => handleNavigate('/auth/change-email'),
    },
    {
      id: 'logout',
      label: 'Log Out',
      icon: LogOut,
      onPress: handleLogout,
    },
  ];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.iconContainer}>
                <Icon size={24} color={colors.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {'sublabel' in item && item.sublabel != null && (
                <Text style={styles.menuSublabel}>{item.sublabel}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.dangerSection}>
          <Text style={styles.dangerHeading}>Danger zone</Text>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemDanger]}
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, styles.iconContainerDanger]}>
              <Trash2 size={24} color={colors.error} />
            </View>
            <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.dangerHelp}>
            Soft-deletes your account with a 30-day grace period. Sign in within
            30 days to restore. After that, all of your data is permanently erased.
          </Text>
        </View>

        <View style={styles.legalContainer}>
          <LegalLinks compact />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete account?"
        message="Your account will be marked for deletion. You have 30 days to sign in and restore it. After that, all workout sessions, plans, and progress are permanently erased."
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete account'}
        cancelLabel="Cancel"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.md,
  },
  menuItemDanger: {
    borderColor: colors.error,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerDanger: {
    backgroundColor: `${colors.error}20`,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  menuSublabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  dangerSection: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  dangerHeading: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: spacing.xs,
  },
  dangerHelp: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
    lineHeight: 16,
  },
  legalContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  });
}
