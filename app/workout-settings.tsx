import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '../src/components/ui/Button';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { useUIStore } from '../src/stores/uiStore';
import { borderRadius, spacing, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import {
  DEFAULT_REST_OPTIONS,
  DEFAULT_WORKOUT_SETTINGS,
  loadWorkoutSettings,
  saveWorkoutSettings,
  type IntensityMode,
  type WorkoutSettings,
} from '../src/lib/workout/workoutSettings';

function formatRestLabel(sec: number): string {
  return sec < 60 ? `${sec}s` : `${sec / 60}m`;
}

export default function WorkoutSettingsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_WORKOUT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkoutSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWorkoutSettings(settings);
      showToast('Workout settings saved', 'success');
      router.back();
    } catch {
      showToast('Failed to save workout settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingScreen style={styles.centered} />
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Workout Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Default rest</Text>
        <View style={styles.chipRow}>
          {DEFAULT_REST_OPTIONS.map((sec) => {
            const selected = settings.defaultRestSec === sec;
            return (
              <TouchableOpacity
                key={sec}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setSettings((prev) => ({ ...prev, defaultRestSec: sec }))}
                accessibilityRole="button"
                accessibilityLabel={`${formatRestLabel(sec)} rest`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {formatRestLabel(sec)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextGroup}>
              <Text style={styles.cardTitle}>Keep screen awake</Text>
              <Text style={styles.cardSubtext}>Prevents the phone from sleeping during a workout</Text>
            </View>
            <Switch
              value={settings.keepScreenAwake}
              onValueChange={(keepScreenAwake) =>
                setSettings((prev) => ({ ...prev, keepScreenAwake }))
              }
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Intensity</Text>
        <View style={styles.chipRow}>
          {(['rpe', 'rir'] as IntensityMode[]).map((mode) => {
            const selected = settings.intensityMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setSettings((prev) => ({ ...prev, intensityMode: mode }))}
                accessibilityRole="button"
                accessibilityLabel={mode === 'rpe' ? 'Rate of perceived exertion' : 'Reps in reserve'}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {mode === 'rpe' ? 'RPE' : 'RIR'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={saving ? 'Saving…' : 'Save'} onPress={() => void handleSave()} disabled={saving} />
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
    centered: {
      flex: 1,
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
    scroll: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}20`,
    },
    chipText: {
      color: colors.textSecondary,
      fontWeight: typography.weights.semibold,
    },
    chipTextActive: {
      color: colors.primary,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    cardTextGroup: {
      flex: 1,
      gap: 4,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    cardSubtext: {
      color: colors.textMuted,
      fontSize: typography.sizes.sm,
    },
    footer: {
      padding: spacing.lg,
    },
  });
}
