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
import { PaywallProvider } from '../src/components/paywall/PaywallProvider';
import { TourProvider } from '../src/components/tour/TourProvider';
import { ThemeProvider } from '../src/lib/utils/ThemeContext';
import { initNotifications, setupNotificationResponseRouting } from '../src/lib/utils/notifications';
import { initSentry } from '../src/lib/monitoring/initSentry';

// Import web scrollbar styles
if (Platform.OS === 'web') {
  require('../styles/scrollbar.css');
}

export default function RootLayout() {
  useEffect(() => {
    initSentry();
    initNotifications();
    const unsub = setupNotificationResponseRouting();
    return unsub;
  }, []);

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
    <PaywallProvider>
      <TourProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        <Stack.Screen name="get-started" options={{ gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup" options={{ gestureEnabled: false }} />
        <Stack.Screen name="signup-success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth/forgot-password" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="auth/change-email" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="auth/change-password" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen name="auth/callback" options={{ presentation: 'modal', gestureEnabled: true }} />
        <Stack.Screen
          name="add-exercise"
          options={{
            gestureEnabled: true,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="add-exercise-edit"
          options={{
            gestureEnabled: true,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="generate-ai"
          options={{
            gestureEnabled: false,
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
          name="edit-profile"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="prs"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="health-connect"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="workout-reminders"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="appearance"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="weight-history"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="analytics/exercise/[id]"
          options={{ gestureEnabled: true, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="log-past-workout"
          options={{ gestureEnabled: true, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="create-custom-exercise"
          options={{ gestureEnabled: true, animation: 'slide_from_right' }}
        />
      </Stack>

      {/* Global UI components */}
      <ToastProvider />
      <ModalManager />
      </TourProvider>
    </PaywallProvider>
  );

  // Wrap with GestureHandlerRootView for native platforms
  if (Platform.OS !== 'web') {
    return (
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>{content}</GestureHandlerRootView>
      </ThemeProvider>
    );
  }

  return <ThemeProvider>{content}</ThemeProvider>;
}

