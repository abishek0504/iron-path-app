/**
 * Get Started Landing Page
 * Entry point for unauthenticated users. Looping workout b-roll video with welcome text overlay.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { AuthVideoBackground } from '../src/components/ui/AuthVideoBackground';

export default function GetStarted() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <AuthVideoBackground />

      <View style={styles.content}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <Text style={styles.title}>Welcome to IronPath</Text>
          <Text style={styles.subtitle}>
            Your personalized strength training companion
          </Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.secondaryButtonText}>
              Already have an account? Log in
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: 420,
      justifyContent: 'space-between',
      zIndex: 1,
    },
    hero: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      fontSize: typography.sizes['3xl'],
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      textAlign: 'center',
      textShadowColor: colors.authTextShadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    subtitle: {
      fontSize: typography.sizes.base,
      color: colors.textPrimary,
      textAlign: 'center',
      opacity: 0.95,
      textShadowColor: colors.authTextShadow,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    card: {
      backgroundColor: colors.authOverlayCard,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    primaryButton: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    secondaryButton: {
      marginTop: spacing.xs,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
    },
  });
}
