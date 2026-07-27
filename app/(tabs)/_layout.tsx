import { Tabs, useRouter } from "expo-router";
import { View, StyleSheet, Platform, TouchableOpacity, Text } from "react-native";
import { LogoEdgeLoader } from "../../src/components/ui/LogoEdgeLoader";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Dumbbell, Calendar, TrendingUp, Trophy } from "lucide-react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useMemo } from "react";
import { spacing, typography, type ThemeColors } from "../../src/lib/utils/theme";
import { useTheme } from "../../src/lib/utils/ThemeContext";
import { supabase } from "../../src/lib/supabase/client";
import { getUserProfile } from "../../src/lib/supabase/queries/users";
import { isAccountPendingDeletion } from "../../src/lib/auth/accountLifecycle";
import { hapticSelection } from "../../src/lib/utils/haptics";
import { usePaywall } from "../../src/components/paywall/PaywallProvider";
import { APP_OPEN_PAYWALL_DELAY_MS } from "../../src/lib/subscriptions/constants";
import { hasPendingAppTour, takePendingAppTour } from "../../src/lib/onboarding/tourBridge";
import { useTourStore } from "../../src/stores/tourStore";
import { useUserStore } from "../../src/stores/userStore";
import { TourTarget } from "../../src/components/tour/TourTarget";
import { syncSessionAuthToWatch } from "../../src/lib/watch/syncWatchAuth";

const CustomTabBar = (props: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { state, descriptors, navigation } = props;
  const activeIndex = state.index;
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isTourActive = useTourStore((s) => s.isActive);

  // Animation for the sliding circle indicator
  const circlePosition = useSharedValue(0);

  // Store tab button positions
  const [tabLayouts, setTabLayouts] = useState<({ x: number; width: number } | null)[]>([
    null, null, null, null
  ]);

  // Update circle position when active tab changes
  useEffect(() => {
    const layout = tabLayouts[activeIndex];
    if (layout && layout.width > 0) {
      // Center the circle on the tab button (circle is 40px, so center it in the tab button)
      const tabCenter = layout.x + layout.width / 2;
      circlePosition.value = withTiming(tabCenter - 20, {
        duration: 300,
      });
    } else if (tabLayouts.some(l => l !== null)) {
      // If current tab layout not ready but others are, set initial position
      const firstLayout = tabLayouts.find(l => l !== null);
      if (firstLayout) {
        const tabCenter = firstLayout.x + firstLayout.width / 2;
        circlePosition.value = tabCenter - 20;
      }
    }
  }, [activeIndex, tabLayouts, circlePosition]);

  // Handle tab button layout
  const handleTabLayout = (index: number) => (event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => {
      const newLayouts = [...prev];
      newLayouts[index] = { x, width };
      return newLayouts;
    });
  };

  // Animated style for the sliding circle
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: circlePosition.value }],
  }));

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <TourTarget id="tour.tabs.bar" testID="tour-tabs-bar">
        <View style={styles.tabBarCapsule}>
          <Animated.View style={[styles.slidingCircle, circleStyle]} />
          {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const rawLabel = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;
          // tabBarLabel can be a render function; we render plain text in the capsule, so coerce.
          const label = typeof rawLabel === 'string' ? rawLabel : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            if (isTourActive) {
              return;
            }

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              hapticSelection();
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Get icon component
          let IconComponent = Dumbbell;
          if (route.name === 'planner') IconComponent = Calendar;
          else if (route.name === 'progress') IconComponent = TrendingUp;
          else if (route.name === 'dashboard') IconComponent = Trophy;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                typeof options.tabBarAccessibilityLabel === 'string'
                  ? options.tabBarAccessibilityLabel
                  : `${label} tab`
              }
              // tabBarTestID is supplied by some screens but not declared on the option type
              testID={(options as { tabBarTestID?: string }).tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              onLayout={handleTabLayout(index)}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <IconComponent
                  size={24}
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
        </View>
      </TourTarget>
    </View>
  );
};

/**
 * Session guard: protects all tabs from being reached without an authenticated session.
 * - Initial mount: checks session and redirects to /get-started if absent.
 * - Lifetime: subscribes to auth state and redirects on sign-out / user-deleted events
 *   so background sign-outs (token revocation, password change, account deletion) drop
 *   the user back to the unauthenticated entry point instead of stranding them on a tab.
 */
function useSessionGuard(): { ready: boolean; authenticated: boolean } {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace('/get-started');
        setAuthenticated(false);
        void syncSessionAuthToWatch(null);
      } else {
        const profile = await getUserProfile(session.user.id);
        if (cancelled) return;
        if (isAccountPendingDeletion(profile)) {
          await supabase.auth.signOut();
          router.replace('/login');
          setAuthenticated(false);
          void syncSessionAuthToWatch(null);
        } else {
          setAuthenticated(true);
          void syncSessionAuthToWatch(session);
        }
      }
      setReady(true);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setAuthenticated(false);
        void syncSessionAuthToWatch(null);
        router.replace('/get-started');
      } else if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true);
        void syncSessionAuthToWatch(session);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        void syncSessionAuthToWatch(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  return { ready, authenticated };
}

function AppTourEffect() {
  const startTour = useTourStore((s) => s.startTour);
  const profile = useUserStore((s) => s.profile);

  useEffect(() => {
    if (profile?.app_tour_completed_at) {
      return;
    }
    if (takePendingAppTour()) {
      startTour();
    }
  }, [profile?.app_tour_completed_at, startTour]);

  return null;
}

function AppOpenPaywallEffect() {
  const { tryAppOpenPaywall, isLoading } = usePaywall();
  const isTourActive = useTourStore((s) => s.isActive);

  useEffect(() => {
    if (isLoading) return;
    if (isTourActive || hasPendingAppTour()) return;

    const timer = setTimeout(() => {
      tryAppOpenPaywall();
    }, APP_OPEN_PAYWALL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoading, isTourActive, tryAppOpenPaywall]);

  return null;
}

export default function TabLayout() {
  const { ready, authenticated } = useSessionGuard();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!ready || !authenticated) {
    return (
      <View style={styles.guardContainer}>
        <LogoEdgeLoader size="xlarge" />
      </View>
    );
  }

  return (
    <>
    <AppTourEffect />
    <AppOpenPaywallEffect />
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: 'transparent',
          height: 72,
          paddingBottom: spacing.md,
          paddingTop: 12,
          borderTopWidth: 0,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Workout",
          headerShown: false,
          tabBarAccessibilityLabel: "Workout tab",
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Plan",
          tabBarAccessibilityLabel: "Plan tab",
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarAccessibilityLabel: "Progress tab",
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarAccessibilityLabel: "Dashboard tab",
        }}
      />
    </Tabs>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    slidingCircle: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardBorder,
      top: 12,
      left: 0,
      zIndex: 0,
    },
    tabBarWrapper: {
      position: Platform.OS === 'web' ? 'relative' as const : 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: Platform.OS === 'web' ? colors.background : 'transparent',
      paddingHorizontal: spacing.md,
      zIndex: 1000,
      pointerEvents: 'box-none',
    },
    tabBarCapsule: {
      backgroundColor: colors.tabBarSurface,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
      flexDirection: 'row',
      position: 'relative',
      padding: spacing.xs,
      gap: spacing.xs,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      zIndex: 1,
      minHeight: 60,
    },
    tabLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    tabLabelActive: {
      color: colors.textPrimary,
      fontWeight: typography.weights.semibold,
    },
    guardContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
