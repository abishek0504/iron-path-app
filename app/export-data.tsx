import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '../src/components/ui/Button';
import { useUIStore } from '../src/stores/uiStore';
import { useUserStore } from '../src/stores/userStore';
import { fetchCompletedWorkoutExport } from '../src/lib/supabase/queries/workoutExport';
import { rowsToCsv } from '../src/lib/workout/workoutExport';
import { borderRadius, spacing, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { devError, devLog } from '../src/lib/utils/logger';

export default function ExportDataScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const userId = useUserStore((state) => state.profile?.id);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!userId) {
      showToast('Please log in', 'error');
      return;
    }
    if (Platform.OS === 'web') {
      showToast('Export is available on iOS and Android', 'info');
      return;
    }
    setExporting(true);
    try {
      const rows = await fetchCompletedWorkoutExport(userId);
      if (rows.length === 0) {
        showToast('No completed workouts to export', 'info');
        return;
      }
      const csv = rowsToCsv(rows);
      const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const path = `${FileSystem.cacheDirectory}ironpath-workouts.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showToast('Sharing is not available on this device', 'error');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Export workouts',
      });
      if (__DEV__) {
        devLog('workout-export', { action: 'shared_csv', setCount: rows.length });
      }
    } catch (error) {
      if (__DEV__) {
        devError('workout-export', error, { action: 'export_screen' });
      }
      showToast('Failed to export workouts', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Data</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Workout CSV</Text>
          <Text style={styles.body}>
            Export every completed session as a spreadsheet: date, exercise, sets, weight, reps,
            RPE, RIR, and set type.
          </Text>
        </View>
        <Button
          label={exporting ? 'Exporting…' : 'Export CSV'}
          onPress={() => void handleExport()}
          disabled={exporting}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
    },
    body: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      lineHeight: 20,
    },
  });
}
