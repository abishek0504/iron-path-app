/**
 * Workout tab
 * Placeholder for workout screen with global settings gear
 */

import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';

export default function WorkoutTab() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Workout" tabId="workout" />
      <View style={styles.content}>
        <Text style={styles.title}>Workout</Text>
        <Text style={styles.subtitle}>Workout tab placeholder</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
