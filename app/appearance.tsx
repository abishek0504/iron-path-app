import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { spacing, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme, useThemeMode } from '../src/lib/utils/ThemeContext';
import { ThemePickerGrid } from '../src/components/settings/ThemePickerGrid';

export default function AppearanceScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { themeMode, setThemeMode } = useThemeMode();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appearance</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Theme</Text>
        <ThemePickerGrid selectedMode={themeMode} onSelect={setThemeMode} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: 'center',
      gap: spacing.md,
    },
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: spacing.xs,
    },
  });
}
