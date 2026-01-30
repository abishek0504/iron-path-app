/**
 * Progress tab
 * Shows weekly and monthly calendar views with completed workout sessions
 *
 * NOTE: Grouping is by completed_at date (performed truth), not day_name
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, spacing, layout, typography, borderRadius } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { supabase } from '../../src/lib/supabase/client';
import { getSessionsInRange, type WorkoutSession } from '../../src/lib/supabase/queries/workouts';
import { devLog, devError } from '../../src/lib/utils/logger';
import { useUIStore } from '../../src/stores/uiStore';
import { ProgressCalendar } from '../../src/components/progress/ProgressCalendar';
import { useModal } from '../../src/hooks/useModal';

type ViewMode = 'week' | 'month';

export default function ProgressTab() {
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((state) => state.showToast);
  const { openSheet } = useModal();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sessionsByDate, setSessionsByDate] = useState<Map<string, { count: number }>>(
    new Map()
  );

  const getLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = useCallback((date: Date, mode: ViewMode): [Date, Date] => {
    if (mode === 'week') {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return [start, end];
    } else {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 41);
      endDate.setHours(23, 59, 59, 999);

      return [startDate, endDate];
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        showToast('Please log in', 'error');
        return;
      }

      const [start, end] = getDateRange(currentDate, viewMode);

      const sessions: WorkoutSession[] = await getSessionsInRange(
        userId,
        start.toISOString(),
        end.toISOString()
      );

      const dateMap = new Map<string, { count: number }>();
      for (const session of sessions) {
        if (session.completed_at) {
          const completed = new Date(session.completed_at);
          const dateKey = getLocalDateKey(completed);
          const existing = dateMap.get(dateKey);
          dateMap.set(dateKey, { count: (existing?.count || 0) + 1 });
        }
      }

      setSessionsByDate(dateMap);

      if (__DEV__) {
        devLog('progress', {
          action: 'load_calendar_done',
          viewMode,
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
          sessionCount: sessions.length,
          datesWithSessions: dateMap.size,
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('progress', error, { viewMode, currentDate });
      }
      showToast('Failed to load progress', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, getDateRange, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    openSheet('sessionDetail', { 
      selectedDate: date,
      onSessionDeleted: () => {
        // Reload calendar after deletion
        load();
      },
    });
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Progress" tabId="progress" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading progress...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: layout.tabBarHeight + insets.bottom + spacing.lg },
          ]}
        >
          <View style={styles.controls}>
            <View style={styles.viewToggle}>
              <Pressable
                style={[styles.toggleChip, viewMode === 'week' && styles.toggleChipActive]}
                onPress={() => handleViewModeChange('week')}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    viewMode === 'week' && styles.toggleChipTextActive,
                  ]}
                >
                  Week
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleChip, viewMode === 'month' && styles.toggleChipActive]}
                onPress={() => handleViewModeChange('month')}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    viewMode === 'month' && styles.toggleChipTextActive,
                  ]}
                >
                  Month
                </Text>
              </Pressable>
            </View>

            <View style={styles.navigation}>
              <Pressable style={styles.navButton} onPress={handlePrevious}>
                <ChevronLeft size={20} color={colors.textPrimary} />
              </Pressable>
              <Pressable style={styles.navButton} onPress={handleNext}>
                <ChevronRight size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <ProgressCalendar
              viewMode={viewMode}
              currentDate={currentDate}
              sessionsByDate={sessionsByDate}
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  toggleChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
  },
  toggleChipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  toggleChipTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  navigation: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
});

