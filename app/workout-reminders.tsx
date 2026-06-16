import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft } from 'lucide-react-native';
import { borderRadius, spacing, typography, type ThemeColors, isLightTheme } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { useUIStore } from '../src/stores/uiStore';
import {
  cancelWorkoutReminders,
  loadReminderSettings,
  requestNotificationPermission,
  saveReminderSettings,
  scheduleWorkoutReminders,
  type ReminderSettings,
} from '../src/lib/utils/notifications';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

export default function WorkoutRemindersScreen() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);

  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    days: [1, 2, 3, 4, 5],
    hour: 19,
    minute: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReminderSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  // Date object derived from settings for the native time picker
  const timeDate = useMemo(() => {
    const d = new Date();
    d.setHours(settings.hour, settings.minute, 0, 0);
    return d;
  }, [settings.hour, settings.minute]);

  const handleTimeChange = useCallback((_: unknown, date?: Date) => {
    if (!date) return;
    // Round minutes to nearest 5
    const rawMinute = date.getMinutes();
    const minute = Math.round(rawMinute / 5) * 5 % 60;
    setSettings((prev) => ({ ...prev, hour: date.getHours(), minute }));
  }, []);

  const handleToggleDay = useCallback((day: number) => {
    setSettings((prev) => {
      const days = prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort((a, b) => a - b);
      return { ...prev, days };
    });
  }, []);

  const handleToggleEnabled = useCallback(async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showToast('Enable notifications in iOS Settings to use reminders', 'error');
        return;
      }
    }
    setSettings((prev) => ({ ...prev, enabled: value }));
  }, [showToast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveReminderSettings(settings);
      if (settings.enabled && settings.days.length > 0) {
        await scheduleWorkoutReminders(settings);
        const timeStr = formatTime(settings.hour, settings.minute);
        showToast(`Reminders set for ${timeStr}`, 'success');
      } else {
        await cancelWorkoutReminders();
        showToast('Reminders turned off', 'success');
      }
      router.back();
    } catch {
      showToast('Failed to save reminders', 'error');
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Reminders</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Enable / disable toggle */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextGroup}>
              <Text style={styles.cardTitle}>Enable reminders</Text>
              <Text style={styles.cardSubtext}>Get notified when it&apos;s time to train</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor={colors.switchThumb}
            />
          </View>
        </View>

        {settings.enabled && (
          <>
            {/* Time picker */}
            <Text style={styles.sectionLabel}>Reminder time</Text>
            <View style={styles.card}>
              <Text style={styles.timeDisplay}>{formatTime(settings.hour, settings.minute)}</Text>
              <DateTimePicker
                value={timeDate}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                minuteInterval={5}
                textColor={colors.textPrimary}
                style={styles.timePicker}
                themeVariant={isLightTheme(colors) ? 'light' : 'dark'}
              />
            </View>

            {/* Day selector */}
            <Text style={styles.sectionLabel}>Active days</Text>
            <View style={styles.card}>
              <View style={styles.daysRow}>
                {DAY_LABELS.map((label, index) => {
                  const isSelected = settings.days.includes(index);
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.dayChip, isSelected && styles.dayChipActive]}
                      onPress={() => handleToggleDay(index)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {settings.days.length === 0 && (
                <Text style={styles.noDaysWarning}>Select at least one day</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, (saving || (settings.enabled && settings.days.length === 0)) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || (settings.enabled && settings.days.length === 0)}
          activeOpacity={0.85}
        >
          {saving ? (
            <LogoEdgeLoader size="small" variant="inverted" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
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
      alignItems: 'center',
      justifyContent: 'center',
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      gap: spacing.sm,
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
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    cardTextGroup: {
      flex: 1,
    },
    cardTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    cardSubtext: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    timeDisplay: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    timePicker: {
      height: 130,
    },
    daysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardHover,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    dayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    dayChipTextActive: {
      color: colors.background,
    },
    noDaysWarning: {
      fontSize: typography.sizes.sm,
      color: colors.error,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.background,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
  });
}
