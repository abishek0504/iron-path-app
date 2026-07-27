import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { Button } from '../src/components/ui/Button';

export default function SignupSuccess() {
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We just sent a confirmation link. After confirming, log in to continue onboarding.
        </Text>
        <Button
          label="Back to login"
          onPress={() => router.replace('/login')}
          fullWidth
          style={styles.button}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    button: {
      marginTop: spacing.md,
    },
  });
}
