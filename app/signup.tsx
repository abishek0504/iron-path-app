import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { Check, X, Eye, EyeOff } from 'lucide-react-native';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Animation values for dropdowns
  const passwordDropdownAnim = useRef(new Animated.Value(0)).current;
  const confirmPasswordDropdownAnim = useRef(new Animated.Value(0)).current;
  
  // Refs to preserve password values (workaround for React Native secureTextEntry bug)
  const passwordRef = useRef<string>('');
  const confirmPasswordRef = useRef<string>('');

  const getPasswordErrorMessage = (error: any): string => {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Map common Supabase password errors to user-friendly messages
    if (errorMessage.includes('password') && errorMessage.includes('weak')) {
      return 'Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.';
    }
    if (errorMessage.includes('password') && errorMessage.includes('length')) {
      return 'Password must be at least 8 characters long.';
    }
    if (errorMessage.includes('password') && (errorMessage.includes('common') || errorMessage.includes('dictionary'))) {
      return 'Password is too common. Please choose a more unique password.';
    }
    if (errorMessage.includes('password')) {
      return 'Password does not meet security requirements. Use at least 8 characters with a mix of letters, numbers, and symbols.';
    }
    
    // Return original message for non-password errors
    return error?.message || 'Unable to sign up right now.';
  };

  // Animate password dropdown
  useEffect(() => {
    Animated.timing(passwordDropdownAnim, {
      toValue: passwordFocused ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [passwordFocused, passwordDropdownAnim]);

  // Animate confirm password dropdown
  useEffect(() => {
    Animated.timing(confirmPasswordDropdownAnim, {
      toValue: confirmPasswordFocused ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [confirmPasswordFocused, confirmPasswordDropdownAnim]);

  const getPasswordRequirements = () => {
    return [
      {
        text: 'At least 8 characters',
        met: password.length >= 8,
      },
      {
        text: 'One lowercase letter',
        met: /[a-z]/.test(password),
      },
      {
        text: 'One uppercase letter',
        met: /[A-Z]/.test(password),
      },
      {
        text: 'One number',
        met: /[0-9]/.test(password),
      },
      {
        text: 'One special character (e.g., !@#$%^&*)',
        met: /[^a-zA-Z0-9]/.test(password),
      },
    ];
  };

  const validatePassword = (pwd: string): string | null => {
    const errors: string[] = [];
    
    if (pwd.length < 8) {
      errors.push('at least 8 characters');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('one lowercase letter');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('one uppercase letter');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('one number');
    }
    if (!/[^a-zA-Z0-9]/.test(pwd)) {
      errors.push('one special character (e.g., !@#$%^&*)');
    }
    
    if (errors.length > 0) {
      return `Password must contain: ${errors.join(', ')}.`;
    }
    
    return null;
  };

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

    // Client-side password validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorText(passwordError);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorText(getPasswordErrorMessage(error));
        return;
      }

      if (data.session) {
        // Always route to onboarding after successful signup
        router.replace('/onboarding');
      } else {
        // Email confirmation required
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
          <View style={styles.inputContainer}>
            <TextInput
              key="password-input"
              style={styles.inputWithIcon}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                passwordRef.current = text;
              }}
              onFocus={() => {
                setPasswordFocused(true);
                // Restore password if it was cleared by React Native bug
                if (!password && passwordRef.current) {
                  setPassword(passwordRef.current);
                }
              }}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.textSecondary} />
              ) : (
                <Eye size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          <Animated.View
            style={[
              styles.requirementsBox,
              {
                maxHeight: passwordDropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 200],
                }),
                opacity: passwordDropdownAnim,
                marginTop: passwordDropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, spacing.sm],
                }),
              },
            ]}
            pointerEvents={passwordFocused ? 'auto' : 'none'}
            collapsable={false}
          >
            {getPasswordRequirements().map((req, index) => (
              <View key={index} style={styles.requirementItem}>
                {req.met ? (
                  <Check size={16} color={colors.primary} />
                ) : (
                  <X size={16} color={colors.textMuted} />
                )}
                <Text
                  style={[
                    styles.requirementText,
                    req.met && styles.requirementTextMet,
                  ]}
                >
                  {req.text}
                </Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              key="confirm-password-input"
              style={styles.inputWithIcon}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                confirmPasswordRef.current = text;
              }}
              onFocus={() => {
                setConfirmPasswordFocused(true);
                // Restore password if it was cleared by React Native bug
                if (!confirmPassword && confirmPasswordRef.current) {
                  setConfirmPassword(confirmPasswordRef.current);
                }
              }}
              onBlur={() => setConfirmPasswordFocused(false)}
              secureTextEntry={!showConfirmPassword}
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff size={20} color={colors.textSecondary} />
              ) : (
                <Eye size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          <Animated.View
            style={[
              styles.requirementsBox,
              {
                maxHeight: confirmPasswordDropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 100],
                }),
                opacity: confirmPasswordDropdownAnim,
                marginTop: confirmPasswordDropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, spacing.sm],
                }),
              },
            ]}
            pointerEvents={confirmPasswordFocused ? 'auto' : 'none'}
            collapsable={false}
          >
            <View style={styles.requirementItem}>
              {password === confirmPassword && password.length > 0 ? (
                <Check size={16} color={colors.primary} />
              ) : (
                <X size={16} color={colors.textMuted} />
              )}
              <Text
                style={[
                  styles.requirementText,
                  password === confirmPassword &&
                    password.length > 0 &&
                    styles.requirementTextMet,
                ]}
              >
                Passwords match
              </Text>
            </View>
          </Animated.View>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  inputWithIcon: {
    flex: 1,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  eyeButton: {
    padding: spacing.md,
    paddingLeft: spacing.sm,
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
  requirementsBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requirementText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  requirementTextMet: {
    color: colors.textSecondary,
  },
});



