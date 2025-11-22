import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="signup-success" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tracker" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
