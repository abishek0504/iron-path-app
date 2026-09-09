import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme, useThemeMode } from '../src/lib/utils/ThemeContext';
import { ThemePickerGrid } from '../src/components/settings/ThemePickerGrid';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';

export default function AppearanceScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { themeMode, setThemeMode } = useThemeMode();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Appearance" onBack={() => router.back()} />

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
