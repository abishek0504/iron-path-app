/**
 * Root index route
 * Handles initial app entry and routing to login/home
 */

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { colors, spacing } from '../src/lib/utils/theme';
import { getUserProfile } from '../src/lib/supabase/queries/users';
import { useUserStore } from '../src/stores/userStore';

export default function Index() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    setErrorText(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const userId = session.user.id;
        const profile = await getUserProfile(userId);

        if (profile) {
          setProfile(profile);
        }

        const hasRequired =
          !!profile?.experience_level &&
          !!profile?.days_per_week &&
          Array.isArray(profile?.equipment_access) &&
          (profile?.equipment_access?.length || 0) > 0;

        if (hasRequired) {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      } else {
        // User is not authenticated, redirect to login
        router.replace('/login');
      }
    } catch (error) {
      // If there's an error (e.g., missing env vars), redirect to login
      if (__DEV__) {
        console.error('Auth check error:', error);
      }
      setErrorText('Unable to check session. Please log in again.');
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Loading...</Text>
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});

