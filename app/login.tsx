import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { getUserProfileCached, invalidateProfileCache } from '../src/lib/cache/dashboardStatsCache';
import { useUserStore } from '../src/stores/userStore';
import { devLog } from '../src/lib/utils/logger';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { restoreAccount } from '../src/lib/supabase/queries/users';
import type { UserProfile } from '../src/stores/userStore';

export default function Login() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Soft-delete restore prompt state
  const [pendingRestore, setPendingRestore] = useState<{
    profile: UserProfile;
    daysRemaining: number;
  } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  /** Continue to the appropriate post-login route once we know the profile is healthy. */
  const continueAfterLogin = (profile: UserProfile | null) => {
    if (!profile) {
      router.replace('/onboarding');
      return;
    }
    setProfile(profile);
    const hasRequired =
      !!profile.experience_level &&
      !!profile.days_per_week &&
      Array.isArray(profile.equipment_access) &&
      (profile.equipment_access?.length || 0) > 0;

    if (__DEV__) {
      devLog('login-onboarding-check', {
        hasProfile: true,
        hasRequired,
        hasExperience: !!profile.experience_level,
        hasDaysPerWeek: !!profile.days_per_week,
        equipmentCount: profile.equipment_access?.length || 0,
      });
    }

    router.replace(hasRequired ? '/' : '/onboarding');
  };

  const handleLogin = async () => {
    setErrorText(null);

    if (!email.trim() || !password) {
      setErrorText('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorText(error.message);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/');
        return;
      }

      const userId = session.user.id;
      const profile = await getUserProfileCached(userId);

      // Soft-delete grace period: if marked for deletion but still within
      // the window, prompt the user to restore. If past purge time, the
      // scheduled job should have removed the row already.
      if (profile?.deleted_at && profile.scheduled_purge_at) {
        const purgeAt = new Date(profile.scheduled_purge_at).getTime();
        const now = Date.now();
        if (purgeAt > now) {
          const daysRemaining = Math.max(1, Math.ceil((purgeAt - now) / (24 * 60 * 60 * 1000)));
          setPendingRestore({ profile, daysRemaining });
          return;
        }
      }

      continueAfterLogin(profile ?? null);
    } catch (error: any) {
      setErrorText(error?.message || 'Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreAccount = async () => {
    if (!pendingRestore || restoreLoading) return;
    setRestoreLoading(true);
    try {
      const ok = await restoreAccount(pendingRestore.profile.id);
      if (!ok) {
        setErrorText('Could not restore account. Please try again.');
        return;
      }
      invalidateProfileCache(pendingRestore.profile.id);
      const refreshed = await getUserProfileCached(pendingRestore.profile.id);
      setPendingRestore(null);
      continueAfterLogin(refreshed ?? pendingRestore.profile);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleCancelRestore = async () => {
    setPendingRestore(null);
    await supabase.auth.signOut().catch(() => undefined);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <View style={styles.container}>
      <View style={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to continue</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
        </View>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <LogoEdgeLoader size="small" variant="inverted" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/signup')}>
          <Text style={styles.linkText}>Need an account? Sign up</Text>
        </TouchableOpacity>
      </View>
      </View>

      <ConfirmDialog
        visible={!!pendingRestore}
        title="Restore your account?"
        message={
          pendingRestore
            ? `Your account is scheduled for deletion in ${pendingRestore.daysRemaining} day${pendingRestore.daysRemaining === 1 ? '' : 's'}. Restore now to keep your data, or cancel to sign out and let the deletion proceed.`
            : ''
        }
        confirmLabel={restoreLoading ? 'Restoring…' : 'Restore'}
        cancelLabel="Cancel"
        onConfirm={handleRestoreAccount}
        onCancel={handleCancelRestore}
      />
    </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      zIndex: 1,
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
    errorText: {
      color: colors.error,
      fontSize: typography.sizes.sm,
    },
    linkText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
}
