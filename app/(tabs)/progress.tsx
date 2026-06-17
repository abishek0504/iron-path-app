/**
 * Progress tab — calendar, analytics trends, and exercise rankings.
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { spacing, layout, typography, borderRadius, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
import { TAB_HEADER_HEIGHT, TabHeader } from '../../src/components/ui/TabHeader';
import { supabase } from '../../src/lib/supabase/client';
import { getSessionsInRangeCached } from '../../src/lib/cache/sessionsCache';
import type { WorkoutSession } from '../../src/lib/supabase/queries/workouts';
import { devLog, devError } from '../../src/lib/utils/logger';
import { useUIStore } from '../../src/stores/uiStore';
import { ProgressCalendar } from '../../src/components/progress/ProgressCalendar';
import { AnalyticsTrendsPanel } from '../../src/components/progress/AnalyticsTrendsPanel';
import { ExerciseAnalyticsList } from '../../src/components/progress/ExerciseAnalyticsList';
import { useModal } from '../../src/hooks/useModal';
import { TourTarget } from '../../src/components/tour/TourTarget';

type CalendarMode = 'week' | 'month';
type ProgressSegment = 'calendar' | 'trends' | 'exercises';

const SEGMENTS: { key: ProgressSegment; label: string }[] = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'trends', label: 'Trends' },
  { key: 'exercises', label: 'Exercises' },
];

export default function ProgressTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const { openSheet } = useModal();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [segment, setSegment] = useState<ProgressSegment>('calendar');
  const [viewMode, setViewMode] = useState<CalendarMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sessionsByDate, setSessionsByDate] = useState<Map<string, { count: number }>>(
    new Map(),
  );
  const lastFocusLoadRef = useRef(0);
  const FOCUS_RELOAD_THROTTLE_MS = 4000;

  const getLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = useCallback((date: Date, mode: CalendarMode): [Date, Date] => {
    if (mode === 'week') {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return [start, end];
    }
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
  }, []);

  const load = useCallback(async () => {
    if (segment !== 'calendar') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        showToast('Please log in', 'error');
        router.replace('/login');
        return;
      }

      const [start, end] = getDateRange(currentDate, viewMode);

      const sessions: WorkoutSession[] = await getSessionsInRangeCached(
        userId,
        start.toISOString(),
        end.toISOString(),
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
          dateRange: { start: start.toISOString(), end: end.toISOString() },
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
  }, [currentDate, viewMode, getDateRange, showToast, router, segment]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusLoadRef.current < FOCUS_RELOAD_THROTTLE_MS) return;
      lastFocusLoadRef.current = now;
      load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    lastFocusLoadRef.current = 0;
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, load]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    openSheet('sessionDetail', {
      selectedDate: date,
      onSessionDeleted: () => {
        load();
      },
    });
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(newDate.getFullYear(), newDate.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(newDate.getFullYear(), newDate.getMonth() + 1, 1));
    }
  };

  const showCalendarLoading = segment === 'calendar' && loading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Progress" tabId="progress" />
      {showCalendarLoading ? (
        <LoadingScreen
          message="Loading progress..."
          style={styles.loadingContainer}
          centerInViewport
          chrome={{ top: TAB_HEADER_HEIGHT }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: layout.tabBarHeight + insets.bottom + spacing.lg },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.segmentRow}>
            {SEGMENTS.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.segmentChip, segment === s.key && styles.segmentChipActive]}
                onPress={() => setSegment(s.key)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    segment === s.key && styles.segmentTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {segment === 'calendar' ? (
            <>
              <View style={styles.controls}>
                <TourTarget id="tour.progress.viewToggle" testID="tour-progress-view-toggle">
                <View style={styles.viewToggle}>
                  <Pressable
                    style={[styles.toggleChip, viewMode === 'week' && styles.toggleChipActive]}
                    onPress={() => setViewMode('week')}
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
                    onPress={() => setViewMode('month')}
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
                </TourTarget>

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
            </>
          ) : null}

          {segment === 'trends' ? <AnalyticsTrendsPanel granularity="week" /> : null}
          {segment === 'exercises' ? <ExerciseAnalyticsList /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    content: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    segmentChip: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    segmentChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySelectedBg,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    segmentTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
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
      backgroundColor: colors.primarySelectedBg,
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
}
