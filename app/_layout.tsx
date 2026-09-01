/**
 * Root Layout
 * Integrates global UI components (ToastProvider, ModalManager)
 * Sets up Expo Router stack navigation
 */

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { ToastProvider } from '../src/components/ui/ToastProvider';
import { ModalManager } from '../src/components/ui/ModalManager';
import { PaywallProvider } from '../src/components/paywall/PaywallProvider';
import { TourProvider } from '../src/components/tour/TourProvider';
import { ThemeProvider } from '../src/lib/utils/ThemeContext';
import { RootErrorBoundary } from '../src/components/ui/RootErrorBoundary';
import { initNotifications, setupNotificationResponseRouting } from '../src/lib/utils/notifications';
import { initSentry } from '../src/lib/monitoring/initSentry';

initSentry();

// Keep native splash up until index finishes auth routing (see app/index.tsx).
void SplashScreen.preventAutoHideAsync();

// Import web scrollbar styles
if (Platform.OS === 'web') {
  require('../styles/scrollbar.css');
}

function RootLayout() {
  useEffect(() => {
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
            gestureEnabled: false,
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
          name="workout-settings"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="export-data"
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
        <Stack.Screen
          name="help-support"
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack>

      {/* Global UI components */}
      <ToastProvider />
      <ModalManager />
      </TourProvider>
    </PaywallProvider>
  );

  const wrapped = (
    <ThemeProvider>
      <RootErrorBoundary>
        {Platform.OS !== 'web' ? (
          <GestureHandlerRootView style={{ flex: 1 }}>{content}</GestureHandlerRootView>
        ) : (
          content
        )}
      </RootErrorBoundary>
    </ThemeProvider>
  );

  return wrapped;
}

export default Sentry.wrap(RootLayout);

