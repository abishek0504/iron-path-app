/**
 * Login screen
 * Placeholder for authentication
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../src/lib/utils/theme';

export default function Login() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>
        Supabase environment variables need to be configured
      </Text>
      <Text style={styles.text}>
        Create a .env file with:{'\n'}
        EXPO_PUBLIC_SUPABASE_URL=your_url{'\n'}
        EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  text: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

