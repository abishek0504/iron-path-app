import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { supabase } from '../src/lib/supabase';

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If user is authenticated and trying to navigate to login, redirect to tabs
      if (session && segments[0] === 'login') {
        router.replace('/(tabs)');
      }
    };

    checkAuth();
  }, [segments, router]);

  return null;
}

export default function RootLayout() {
  const content = (
    <>
      <NavigationGuard />
      <Stack screenOptions={{ 
        headerShown: false,
        gestureEnabled: false,
      }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup-success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="planner-day" options={{ 
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
          gestureDirection: 'horizontal',
          animation: 'slide_from_right',
          gestureResponseDistance: { horizontal: 20 },
        }} />
        <Stack.Screen name="exercise-select" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="workout-active" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', gestureEnabled: true }} />
      </Stack>
    </>
  );

  // Wrap with GestureHandlerRootView for native platforms
  if (Platform.OS !== 'web') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        {content}
      </GestureHandlerRootView>
    );
  }

  return content;
}
