import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { supabase } from '../src/lib/supabase';

// Import web scrollbar styles
if (Platform.OS === 'web') {
  require('../styles/scrollbar.css');
}

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
  // Ensure scrollbar styles are applied on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'custom-scrollbar-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          /* Custom scrollbar styling for web to match dark theme */
          html {
            scrollbar-width: thin;
            scrollbar-color: #3f3f46 #18181b;
          }
          html::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          html::-webkit-scrollbar-track {
            background: #18181b;
          }
          html::-webkit-scrollbar-thumb {
            background: #3f3f46;
            border-radius: 5px;
          }
          html::-webkit-scrollbar-thumb:hover {
            background: #52525b;
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: #3f3f46 #18181b;
          }
          *::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          *::-webkit-scrollbar-track {
            background: #18181b;
          }
          *::-webkit-scrollbar-thumb {
            background: #3f3f46;
            border-radius: 5px;
          }
          *::-webkit-scrollbar-thumb:hover {
            background: #52525b;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

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
