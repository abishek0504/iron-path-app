/**
 * Root Layout
 * Integrates global UI components (ToastProvider, ModalManager)
 * Sets up Expo Router stack navigation
 */

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { ToastProvider } from '../src/components/ui/ToastProvider';
import { ModalManager } from '../src/components/ui/ModalManager';

// Import web scrollbar styles
if (Platform.OS === 'web') {
  require('../styles/scrollbar.css');
}

export default function RootLayout() {
  // Apply web-specific styles
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const content = (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup-success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth/forgot-password" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="auth/change-email" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="auth/callback" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen
          name="planner-day"
          options={{
            gestureEnabled: true,
            fullScreenGestureEnabled: false,
            gestureDirection: 'horizontal',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="(stack)/workout/active"
          options={{ 
            presentation: 'modal', 
            gestureEnabled: true,
            animation: 'slide_from_right'
          }}
        />
        <Stack.Screen
          name="exercise-detail"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack>

      {/* Global UI components */}
      <ToastProvider />
      <ModalManager />
    </>
  );

  // Wrap with GestureHandlerRootView for native platforms
  if (Platform.OS !== 'web') {
    return <GestureHandlerRootView style={{ flex: 1 }}>{content}</GestureHandlerRootView>;
  }

  return content;
}

