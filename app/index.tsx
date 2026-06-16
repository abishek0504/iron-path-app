/**
 * Root index route
 * Handles initial app entry and routing to login/home
 */

import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { spacing, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { getUserProfileCached } from '../src/lib/cache/dashboardStatsCache';
import { useUserStore } from '../src/stores/userStore';
import { getActiveSession } from '../src/lib/supabase/queries/workouts';
import { isAccountPendingDeletion } from '../src/lib/auth/accountLifecycle';

export default function Index() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const [errorText, setErrorText] = useState<string | null>(null);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    checkAuthAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once on app entry
  }, []);

  const checkAuthAndRedirect = async () => {
    setErrorText(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const userId = session.user.id;
        const profile = await getUserProfileCached(userId);

        if (profile) {
          setProfile(profile);
        }

        if (isAccountPendingDeletion(profile)) {
          router.replace('/login');
          return;
        }

        const hasRequired =
          !!profile?.experience_level &&
          !!profile?.days_per_week &&
          Array.isArray(profile?.equipment_access) &&
          (profile?.equipment_access?.length || 0) > 0;

        if (hasRequired) {
          // Auto-resume an in-progress workout that already has a save point.
          // "Save point" = active session with at least one completed (performed_at IS NOT NULL) set,
          // mirroring the heuristic used by the Workout tab to decide whether to show "Continue".
          // Without a save point we land on the tabs so the user can review the day's plan first.
          const activeSession = await getActiveSession(userId);
          let routeToActive = false;

          if (activeSession?.id) {
            const { data: sessionExercises } = await supabase
              .from('v2_session_exercises')
              .select('id')
              .eq('session_id', activeSession.id);
            const exerciseIds = (sessionExercises ?? []).map((e) => e.id);

            if (exerciseIds.length > 0) {
              const { count: completedSetCount } = await supabase
                .from('v2_session_sets')
                .select('*', { count: 'exact', head: true })
                .in('session_exercise_id', exerciseIds)
                .not('performed_at', 'is', null);
              routeToActive = (completedSetCount ?? 0) > 0;
            }
          }

          if (routeToActive && activeSession?.id) {
            router.replace({
              pathname: '/workout/active',
              params: { sessionId: activeSession.id },
            });
          } else {
            router.replace('/(tabs)');
          }
        } else {
          router.replace('/onboarding');
        }
      } else {
        // User is not authenticated, redirect to get started page
        router.replace('/get-started');
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
      <LoadingScreen message="Loading..." style={styles.loader} />
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loader: {
      flex: 1,
    },
    error: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
    },
  });
}
