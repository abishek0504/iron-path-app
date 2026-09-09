import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/ui/Button';
import { ScreenHeader } from '../src/components/ui/ScreenHeader';
import { useUIStore } from '../src/stores/uiStore';
import { useUserStore } from '../src/stores/userStore';
import { fetchCompletedWorkoutExport } from '../src/lib/supabase/queries/workoutExport';
import { rowsToCsv } from '../src/lib/workout/workoutExport';
import { importStrongHevyCsv } from '../src/lib/import/strongHevyCsv';
import { invalidateSessionsInRangeForUser } from '../src/lib/cache/sessionsCache';
import { invalidateWorkoutStatsCache } from '../src/lib/cache/dashboardStatsCache';
import { invalidateAnalyticsCache } from '../src/lib/cache/analyticsCache';
import { borderRadius, spacing, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { devError, devLog } from '../src/lib/utils/logger';

export default function ExportDataScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const userId = useUserStore((state) => state.profile?.id);
  const useImperial = useUserStore((state) => state.profile?.use_imperial);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const handleImport = async () => {
    if (!userId) {
      showToast('Please log in', 'error');
      return;
    }
    if (Platform.OS === 'web') {
      showToast('CSV import is available on iOS and Android', 'info');
      return;
    }
    setImporting(true);
    try {
      let csvText: string | null = null;
      try {
        const DocumentPicker = require('expo-document-picker') as {
          getDocumentAsync: (options: Record<string, unknown>) => Promise<{
            canceled?: boolean;
            assets?: { uri: string }[];
          }>;
        };
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text'],
          copyToCacheDirectory: true,
        });
        const uri = picked.canceled ? null : picked.assets?.[0]?.uri;
        if (!uri) {
          return;
        }
        const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
        csvText = await FileSystem.readAsStringAsync(uri);
      } catch (pickerError) {
        if (__DEV__) {
          devError('csv-import', pickerError, { action: 'document_picker' });
        }
        showToast('Install expo-document-picker to import a CSV file', 'info');
        return;
      }

      if (!csvText?.trim()) {
        showToast('CSV file was empty', 'error');
        return;
      }

      const result = await importStrongHevyCsv(userId, csvText, useImperial);
      if (result.sessionCount === 0) {
        showToast('No Strong or Hevy workouts found in that file', 'info');
        return;
      }
      invalidateSessionsInRangeForUser(userId);
      invalidateWorkoutStatsCache(userId);
      invalidateAnalyticsCache(userId);
      showToast(
        `Imported ${result.sessionCount} workout${result.sessionCount === 1 ? '' : 's'}`,
        'success',
      );
      if (__DEV__) {
        devLog('csv-import', { action: 'import_screen_done', ...result });
      }
    } catch (error) {
      if (__DEV__) {
        devError('csv-import', error, { action: 'import_screen' });
      }
      showToast('Failed to import workouts', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Export Data" onBack={() => router.back()} />

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
          disabled={exporting || importing}
          fullWidth
        />
        <View style={styles.card}>
          <Text style={styles.title}>Import CSV</Text>
          <Text style={styles.body}>
            Import Strong or Hevy workout exports. Requires expo-document-picker after npm install.
          </Text>
        </View>
        <Button
          label={importing ? 'Importing…' : 'Import CSV'}
          variant="secondary"
          onPress={() => void handleImport()}
          disabled={exporting || importing}
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
