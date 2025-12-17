import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../../src/lib/utils/theme';
import { useUIStore } from '../../src/stores/uiStore';
import { devLog, devError } from '../../src/lib/utils/logger';

type CallbackType = 'recovery' | 'password' | 'email_change' | string | null;

export default function AuthCallbackScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);

  const [status, setStatus] = useState<'pending' | 'ready' | 'done' | 'error'>('pending');
  const [cbType, setCbType] = useState<CallbackType>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const code = params.get('code');
    const type = (params.get('type') as CallbackType) || null;
    setCbType(type);

    const run = async () => {
      if (!code) {
        setStatus('error');
        setMessage('Missing verification code.');
        return;
      }
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setMessage(error.message || 'Unable to verify link.');
          if (__DEV__) devError('auth-callback', error, { type });
          return;
        }
        if (__DEV__) {
          devLog('auth-callback', { action: 'session-exchanged', type, userId: data.session?.user?.id });
        }
        if (type === 'email_change') {
          setStatus('done');
          setMessage('Email verified. You can continue.');
          showToast('Email updated', 'success');
        } else {
          setStatus('ready');
          setMessage('Set your new password.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Unable to verify link.');
        if (__DEV__) devError('auth-callback', error, { type });
      }
    };

    run();
  }, [params, showToast]);

  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(error.message || 'Unable to update password.');
        if (__DEV__) devError('auth-callback', error, { action: 'update-password' });
        return;
      }
      showToast('Password updated', 'success');
      setStatus('done');
      setMessage('Password updated. You can sign in.');
      if (__DEV__) devLog('auth-callback', { action: 'update-password:done' });
      router.replace('/login');
    } catch (error) {
      setMessage('Unable to update password.');
      if (__DEV__) devError('auth-callback', error, { action: 'update-password' });
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Account update</Text>
        <Text style={styles.subtitle}>
          {cbType === 'email_change'
            ? 'Your email change is almost done.'
            : 'Finish resetting your password.'}
        </Text>

        {message ? <Text style={styles.infoText}>{message}</Text> : null}

        {status === 'pending' ? (
          <ActivityIndicator color={colors.primary} />
        ) : cbType === 'email_change' || status === 'done' ? (
          <TouchableOpacity style={styles.button} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={handleSetPassword}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Update password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
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
});

