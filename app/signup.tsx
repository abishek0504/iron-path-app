import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setErrorText(null);

    if (!email.trim() || !password || !confirmPassword) {
      setErrorText('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorText('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorText('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorText(error.message);
        return;
      }

      if (data.session) {
        router.replace('/onboarding');
      } else {
        router.replace('/signup-success');
      }
    } catch (error: any) {
      setErrorText(error?.message || 'Unable to sign up right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
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
          <Text style={styles.label}>Confirm Password</Text>
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

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')}>
          <Text style={styles.linkText}>Already have an account? Log in</Text>
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


