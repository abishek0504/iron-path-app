import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase/client';
import { spacing, borderRadius, typography, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
import { useUIStore } from '../../src/stores/uiStore';
import { devLog, devError } from '../../src/lib/utils/logger';

const MIN_PASSWORD_LENGTH = 8;

/**
 * In-app password change.
 *
 * Verifies the current password by re-issuing signInWithPassword (Supabase
 * does not expose a "verify password" RPC), then calls updateUser({password}).
 * The re-sign-in is required because updateUser will silently succeed for
 * any session without proving the user truly knows the existing password.
 */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const loadCurrentEmail = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email) {
          setEmail(data.user.email);
        }
      } catch (error) {
        if (__DEV__) devError('change-password', error);
      }
    };
    loadCurrentEmail();
  }, []);

  const handleSubmit = async () => {
    setInfo(null);

    if (!email) {
      setInfo('Cannot change password without a signed-in account.');
      return;
    }
    if (!currentPassword) {
      setInfo('Enter your current password.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setInfo(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setInfo('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setInfo('New password must be different from your current password.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        setInfo('Current password is incorrect.');
        if (__DEV__) devError('change-password', verifyError, { email });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setInfo(updateError.message || 'Unable to update password.');
        if (__DEV__) devError('change-password', updateError, { email });
        return;
      }

      if (__DEV__) devLog('change-password', { action: 'password-updated' });

      router.back();
      setTimeout(() => {
        showToast('Password updated', 'success');
      }, 300);
    } catch (error) {
      setInfo('Unable to update password.');
      if (__DEV__) devError('change-password', error, { email });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Change password</Text>
          <Text style={styles.subtitle}>
            Enter your current password, then choose a new one (minimum {MIN_PASSWORD_LENGTH}{' '}
            characters).
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Current password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
              autoComplete="current-password"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="new-password"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="new-password"
            />
          </View>

          {info ? <Text style={styles.infoText}>{info}</Text> : null}

          <TouchableOpacity
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Update password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap}>
            <Text style={styles.linkText}>Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
}
