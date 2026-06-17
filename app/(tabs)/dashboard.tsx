import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, RefreshControl } from 'react-native';
import { LogoEdgeLoader } from '../../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, RotateCcw, Activity, Calendar, CalendarCheck, BarChart2, Flame, Trophy, Clock, Heart, CheckCircle2 } from 'lucide-react-native';
import { spacing, layout, borderRadius, typography, type ThemeColors } from '../../src/lib/utils/theme';
import { useTheme } from '../../src/lib/utils/ThemeContext';
import { TAB_HEADER_HEIGHT, TabHeader } from '../../src/components/ui/TabHeader';
import { useUserStore } from '../../src/stores/userStore';
import { useUIStore } from '../../src/stores/uiStore';
import { listMergedExercisesCached } from '../../src/lib/cache/exerciseCache';
import {
  formatPRDisplay,
  type TopPR,
} from '../../src/lib/supabase/queries/workouts';
import {
  getYearToDateStatsCached,
  getStreakCached,
  getCachedTopPRsCached,
  getRecentSessionsCached,
  getUserProfileCached,
  invalidateWeightCache,
  invalidateProfileCache,
} from '../../src/lib/cache/dashboardStatsCache';
import { getSessionsInRangeCached } from '../../src/lib/cache/sessionsCache';
import { WorkoutHeatmap } from '../../src/components/workout/WorkoutHeatmap';
import { WeightTrackerCard } from '@/components/ui/WeightTrackerCard';
import { supabase } from '../../src/lib/supabase/client';
import { devLog, devError } from '../../src/lib/utils/logger';
import { isAppleHealthConnected, syncBodyMassWithHealth } from '../../src/lib/health/healthIntegration';
import { TourTarget } from '../../src/components/tour/TourTarget';

/** Volume from getYearToDateStats is in lbs; convert to kg for metric display. */
const LBS_PER_KG = 2.20462;

type SessionSummary = {
  id: string;
  completed_at?: string;
  day_name?: string;
};

export default function DashboardTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((state) => state.showToast);
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [weekCompleted, setWeekCompleted] = useState<number>(0);
  const [weekTarget, setWeekTarget] = useState<number>(0);
  const [yearDaysWorkedOut, setYearDaysWorkedOut] = useState<number>(0);
  const [yearTotalVolume, setYearTotalVolume] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [recentSessions, setRecentSessionsState] = useState<SessionSummary[]>([]);
  const [prs, setPrs] = useState<(TopPR & { name?: string })[]>([]);
  const [bodySide, setBodySide] = useState<'front' | 'back'>('front');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [healthConnected, setHealthConnected] = useState(false);
  const [weightRefreshKey, setWeightRefreshKey] = useState(0);
  const loadInFlightRef = useRef(false);
  const lastFocusLoadRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const FOCUS_RELOAD_THROTTLE_MS = 4000;

  const runBackgroundWeightSync = useCallback(
    async (userId: string) => {
      if (!isAppleHealthConnected()) return;
      try {
        const { imported, exported } = await syncBodyMassWithHealth(userId);
        if (imported > 0 || exported > 0) {
          invalidateWeightCache(userId);
          invalidateProfileCache(userId);
          setWeightRefreshKey((k) => k + 1);
          const updatedProfile = await getUserProfileCached(userId);
          if (updatedProfile) setProfile(updatedProfile);
        }
        if (__DEV__) {
          devLog('profile-dashboard', {
            action: 'healthWeightSync:done',
            imported,
            exported,
          });
        }
      } catch (error) {
        if (__DEV__) {
          devError('profile-dashboard', error, { action: 'healthWeightSync' });
        }
      }
    },
    [setProfile],
  );

  const today = useMemo(() => new Date(), []);
  const unitsLabel = useMemo(() => ((profile?.use_imperial ?? true) ? 'lbs' : 'kg'), [profile]);
  const displayVolume = useMemo(() => {
    const useImperial = profile?.use_imperial ?? true;
    const raw = yearTotalVolume;
    return useImperial ? raw : raw / LBS_PER_KG;
  }, [profile?.use_imperial, yearTotalVolume]);

  const load = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const isInitialLoad = !hasLoadedOnceRef.current;
    if (isInitialLoad) setLoading(true);
    try {
      const getWeekRange = () => {
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        showToast('Please log in', 'error');
        router.replace('/login');
        return;
      }

      let userProfile = profile;
      if (!userProfile) {
        userProfile = await getUserProfileCached(userId);
        if (userProfile) setProfile(userProfile);
      }
      const targetDays = userProfile?.days_per_week ?? 0;

      const { start, end } = getWeekRange();
      const [thisWeek, recent, topPrs, yearStats, streakCount] = await Promise.all([
        getSessionsInRangeCached(userId, start.toISOString(), end.toISOString()),
        getRecentSessionsCached(userId, 3),
        getCachedTopPRsCached(userId, 3),
        getYearToDateStatsCached(userId),
        getStreakCached(userId),
      ]);

      // Phase 1: show stats and lists immediately with placeholder PR names
      setWeekCompleted(thisWeek.length);
      setWeekTarget(targetDays);
      setYearDaysWorkedOut(yearStats.daysWorkedOut);
      setYearTotalVolume(yearStats.totalVolume);
      setStreak(streakCount);
      setRecentSessionsState(recent);
      setPrs(
        topPrs.map((p) => ({
          ...p,
          name: 'Exercise',
        }))
      );
      hasLoadedOnceRef.current = true;
      if (isInitialLoad) setLoading(false);
      setShowHeatmap(true);

      // Phase 2: fill in PR names (no loading gate; UI already visible)
      const exerciseIds = topPrs
        .map((p) => p.exercise_id || p.custom_exercise_id)
        .filter(Boolean) as string[];
      if (exerciseIds.length) {
        try {
          const merged = await listMergedExercisesCached(userId, exerciseIds);
          const mergedNames = merged.reduce<Record<string, string>>((acc, ex) => {
            acc[ex.id] = ex.name || 'Exercise';
            return acc;
          }, {});
          setPrs(
            topPrs.map((p) => ({
              ...p,
              name: mergedNames[p.exercise_id || p.custom_exercise_id || ''] || 'Exercise',
            }))
          );
        } catch (prNamesError) {
          if (__DEV__) {
            devError('profile-dashboard', prNamesError, { action: 'listMergedExercises_pr_names' });
          }
        }
      }

      if (__DEV__) {
        devLog('profile-dashboard', {
          action: 'load:done',
          weekCompleted: thisWeek.length,
          weekTarget: targetDays,
          yearDaysWorkedOut: yearStats.daysWorkedOut,
          yearTotalVolume: yearStats.totalVolume,
          streak: streakCount,
          prs: topPrs.length,
          recentCount: recent.length,
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('profile-dashboard', error);
      }
      showToast('Failed to load dashboard', 'error');
    } finally {
      if (isInitialLoad) setLoading(false);
      loadInFlightRef.current = false;
    }
  }, [profile, router, setProfile, showToast, today]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Cheap synchronous permission check — refresh on every focus so the
      // card flips to "Connected" right after returning from health-connect.
      setHealthConnected(isAppleHealthConnected());
      const userId = profile?.id;
      if (userId && isAppleHealthConnected()) {
        void runBackgroundWeightSync(userId);
      }
      const now = Date.now();
      if (now - lastFocusLoadRef.current < FOCUS_RELOAD_THROTTLE_MS) return;
      lastFocusLoadRef.current = now;
      load();
       
    }, [load, profile?.id, runBackgroundWeightSync])
  );

  /**
   * Pull-to-refresh: re-runs the same `load` pipeline, but bypasses both the in-flight guard
   * and the focus-throttle so a deliberate user gesture always re-fetches.
   */
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    loadInFlightRef.current = false;
    lastFocusLoadRef.current = 0;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? profile?.id;
      if (userId && isAppleHealthConnected()) {
        void runBackgroundWeightSync(userId);
      }
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, load, profile?.id, runBackgroundWeightSync]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Dashboard" tabId="dashboard" settingsTourTargetId="tour.dashboard.settings" />
        <LoadingScreen
          message="Loading dashboard..."
          style={styles.loadingContainer}
          centerInViewport
          chrome={{ top: TAB_HEADER_HEIGHT }}
        />
      </SafeAreaView>
    );
  }

  const progressPct =
    weekTarget > 0 ? Math.min(100, Math.round((weekCompleted / weekTarget) * 100)) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Dashboard" tabId="dashboard" settingsTourTargetId="tour.dashboard.settings" />
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
        <TourTarget id="tour.dashboard.heatmap" testID="tour-dashboard-heatmap">
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <Activity size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Muscle status</Text>
            </View>
            <Pressable
              style={styles.bodySwitcherButton}
              onPress={() => setBodySide((s) => (s === 'front' ? 'back' : 'front'))}
              accessibilityLabel={bodySide === 'front' ? 'Show back view' : 'Show front view'}
              accessibilityRole="button"
            >
              <RotateCcw size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          {profile?.id && showHeatmap ? (
            <WorkoutHeatmap
              userId={profile.id}
              bodySide={bodySide}
              onBodySideChange={setBodySide}
            />
          ) : profile?.id ? (
            <View style={styles.heatmapPlaceholder}>
              <LogoEdgeLoader size="small" />
              <Text style={styles.heatmapPlaceholderText}>Loading…</Text>
            </View>
          ) : null}
        </View>
        </TourTarget>

        {profile?.id && (
          <WeightTrackerCard
            userId={profile.id}
            onRefresh={load}
            refreshSignal={weightRefreshKey}
          />
        )}

        <TourTarget id="tour.dashboard.stats" testID="tour-dashboard-stats">
        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <View style={[styles.card, styles.statCard]}>
              <View style={styles.weekCardTop}>
                <View style={styles.cardTitleRow}>
                  <Calendar size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>This week</Text>
                </View>
                <Text style={styles.metric}>{weekCompleted}/{weekTarget || '—'}</Text>
              </View>
              <View style={styles.weekCardBottom}>
                <Text style={styles.metricSub}>Completed workouts</Text>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[styles.progressBarFill, { width: `${weekTarget ? progressPct : 0}%` }]}
                  />
                </View>
              </View>
            </View>
            <View style={[styles.card, styles.statCard]}>
              <View style={styles.cardTitleRow}>
                <CalendarCheck size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>This year</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metric}>{yearDaysWorkedOut}</Text>
                <Text style={styles.metric}> days</Text>
              </View>
              <Text style={styles.metricSub}>Worked out</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <TouchableOpacity
              style={[styles.card, styles.statCard]}
              onPress={() => router.push('/(tabs)/progress')}
              accessibilityRole="button"
              accessibilityLabel="View volume trends in Progress"
            >
              <View style={styles.cardTitleRow}>
                <BarChart2 size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Total volume</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metric}>
                  {displayVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.metric}> {unitsLabel}</Text>
              </View>
              <Text style={styles.metricSub}>This year · View trends</Text>
            </TouchableOpacity>
            <View style={[styles.card, styles.statCard]}>
              <View style={styles.cardTitleRow}>
                <Flame size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Streak</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metric}>{streak}</Text>
                <Text style={styles.metric}> days</Text>
              </View>
              <Text style={styles.metricSub}>Consecutively</Text>
            </View>
          </View>
        </View>
        </TourTarget>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <Trophy size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Top PRs</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/prs')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="View all PRs"
            >
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {prs.length === 0 ? (
            <Text style={styles.emptyText}>No PRs yet</Text>
          ) : (
            prs.map((p) => (
              <View key={p.set_id} style={styles.listRow}>
                <Text style={styles.listPrimary}>{p.name}</Text>
                <Text style={styles.listSecondary}>
                  {formatPRDisplay(p, unitsLabel)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Recent sessions</Text>
          </View>
          {recentSessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions yet</Text>
          ) : (
            recentSessions.map((s) => {
              const completedAt = s.completed_at ? new Date(s.completed_at) : null;
              const weekdayLabel =
                completedAt
                  ? completedAt.toLocaleDateString('en-US', { weekday: 'long' })
                  : s.day_name || 'Session';
              return (
                <View key={s.id} style={styles.listRow}>
                  <Text style={styles.listPrimary}>{weekdayLabel}</Text>
                  <Text style={styles.listSecondary}>
                    {completedAt
                      ? `${completedAt.toISOString().split('T')[0]} ${completedAt.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}`
                      : '—'}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Heart size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Apple Health</Text>
          </View>
          <Text style={styles.listSecondary}>
            Sync completed workouts and body weight with Apple Health
          </Text>
          {healthConnected ? (
            <View style={styles.connectedBadge}>
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={styles.connectedBadgeText}>Connected</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/health-connect')}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>Connect</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statGrid: {
    gap: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodySwitcherButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mapControlSurface,
    borderWidth: 1,
    borderColor: colors.mapControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  heatmapPlaceholderText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  metric: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  metricSub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  weekCardTop: {
    gap: spacing.xs,
  },
  weekCardBottom: {
    marginTop: spacing.md,
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.cardBorder,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: colors.primary,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  listPrimary: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  listSecondary: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  actionButton: {
    backgroundColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successBg,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  connectedBadgeText: {
    color: colors.successText,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  fullWidth: {
    width: '100%',
  },
  }); }


