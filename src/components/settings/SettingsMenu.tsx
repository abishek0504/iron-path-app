/**
 * Settings Menu
 * Bottom sheet component for accessing settings/preferences
 * Reusable across all tabs
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Settings, User, Bell, HelpCircle, LogOut, Mail, Shield } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../../lib/utils/theme';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase/client';
import { useUIStore } from '../../stores/uiStore';

interface SettingsMenuProps {
  onClose?: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);

  const handleNavigate = (path: string) => {
    if (onClose) {
      onClose();
    }
    router.push(path as any);
  };

  const handleLogout = async () => {
    if (onClose) {
      onClose();
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast('Unable to log out', 'error');
      return;
    }
    showToast('Logged out', 'success');
    router.replace('/login');
  };

  const menuItems = [
    {
      id: 'profile',
      label: 'Edit Profile',
      icon: User,
      onPress: () => handleNavigate('/edit-profile'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      onPress: () => {
        // TODO: Implement notifications settings
      },
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: HelpCircle,
      onPress: () => {
        // TODO: Implement help screen
      },
    },
    {
      id: 'change-password',
      label: 'Change Password',
      icon: Shield,
      onPress: () => handleNavigate('/auth/forgot-password'),
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Icon size={24} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
});

