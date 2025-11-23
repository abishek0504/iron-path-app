import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="signup-success" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="planner-day" options={{ presentation: 'modal' }} />
      <Stack.Screen name="exercise-select" options={{ presentation: 'modal' }} />
      <Stack.Screen name="workout-active" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
