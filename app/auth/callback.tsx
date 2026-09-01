import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { LogoEdgeLoader } from '../../src/components/ui/LogoEdgeLoader';
import { Button } from '../../src/components/ui/Button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase/client';
import { spacing, borderRadius, typography, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
import { useUIStore } from '../../src/stores/uiStore';
import { devLog, devError } from '../../src/lib/utils/logger';
import { mapAuthError } from '../../src/lib/auth/authErrors';

type CallbackType = 'recovery' | 'password' | 'email_change' | 'signup' | 'magiclink' | 'invite' | 'email' | string | null;

function isPasswordResetType(type: CallbackType): boolean {
  return type === 'recovery' || type === 'password';
}

function isEmailChangeType(type: CallbackType): boolean {
  return type === 'email_change';
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; type?: string }>();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState<'pending' | 'ready' | 'done' | 'error'>('pending');
  const [cbType, setCbType] = useState<CallbackType>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const exchangedCodeRef = useRef<string | null>(null);

  const code =
    typeof params.code === 'string'
      ? params.code
      : Array.isArray(params.code)
        ? params.code[0]
        : undefined;
  const type = (typeof params.type === 'string' ? params.type : Array.isArray(params.type) ? params.type[0] : null) as CallbackType;

  useEffect(() => {
    setCbType(type);

    const run = async () => {
      if (!code) {
        setStatus('error');
        setMessage('Missing verification code.');
        return;
      }
      if (exchangedCodeRef.current === code) return;
      exchangedCodeRef.current = code;
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          exchangedCodeRef.current = null;
          setStatus('error');
          setMessage(mapAuthError(error, 'Unable to verify link.'));
          if (__DEV__) devError('auth-callback', error, { type });
          return;
        }
        if (__DEV__) {
          devLog('auth-callback', { action: 'session-exchanged', type, userId: data.session?.user?.id });
        }
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (isEmailChangeType(type)) {
          setStatus('done');
          setMessage('Email verified. You can continue.');
          showToast('Email updated', 'success');
        } else if (isPasswordResetType(type)) {
          setStatus('ready');
          setMessage('Set your new password.');
        } else {
          setStatus('done');
          setMessage('Email confirmed. You can continue.');
          showToast('Email confirmed', 'success');
        }
      } catch (error) {
        exchangedCodeRef.current = null;
        setStatus('error');
        setMessage('Unable to verify link.');
        if (__DEV__) devError('auth-callback', error, { type });
      }
    };

    void run();
  }, [code, type, showToast]);

  const handleSetPassword = async () => {
    if (!password || password.length < 8) {
      setMessage('Password must be at least 8 characters.');
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
        setMessage(mapAuthError(error, 'Unable to update password.'));
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
          {isEmailChangeType(cbType)
            ? 'Your email change is almost done.'
            : isPasswordResetType(cbType)
              ? 'Finish resetting your password.'
              : 'Your email is confirmed.'}
        </Text>

        {message ? <Text style={styles.infoText}>{message}</Text> : null}

        {status === 'pending' ? (
          <LogoEdgeLoader size="large" />
        ) : isEmailChangeType(cbType) || status === 'done' ? (
          <Button label="Continue" onPress={handleContinue} fullWidth style={styles.button} />
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

            <Button
              label="Update password"
              onPress={handleSetPassword}
              disabled={saving}
              fullWidth
              style={styles.button}
            >
              {saving ? <LogoEdgeLoader size="small" variant="inverted" /> : undefined}
            </Button>
          </>
        )}
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
    },
  });
}
