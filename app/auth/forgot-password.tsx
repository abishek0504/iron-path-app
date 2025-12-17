import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../../src/lib/utils/theme';
import { useUIStore } from '../../src/stores/uiStore';
import { devLog, devError } from '../../src/lib/utils/logger';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const loadCurrentEmail = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email) {
          setEmail(data.user.email);
        }
      } catch (error) {
        if (__DEV__) devError('forgot-password', error);
      }
    };
    loadCurrentEmail();
  }, []);

  const handleSend = async () => {
    setInfo(null);
    if (!email.trim()) {
      setInfo('Enter an email address.');
      return;
    }
    setSending(true);
    const redirectTo =
      process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL ?? Linking.createURL('/auth/callback');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) {
        setInfo(error.message || 'Unable to send reset email.');
        if (__DEV__) devError('forgot-password', error, { email });
        return;
      }
      showToast('Reset email sent', 'success');
      setInfo('Check your email for the reset link.');
      if (__DEV__) devLog('forgot-password', { action: 'reset-email-sent', redirectTo });
    } catch (error) {
      setInfo('Unable to send reset email.');
      if (__DEV__) devError('forgot-password', error, { email });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>We will email you a link to set a new password.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        {info ? <Text style={styles.infoText}>{info}</Text> : null}

        <TouchableOpacity
          style={[styles.button, sending && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap}>
          <Text style={styles.linkText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontSize: typography.sizes.base,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  linkWrap: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.textSecondary,
  },
});


