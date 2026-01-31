import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, RotateCcw, Activity, Calendar, CalendarCheck, BarChart2, Flame, Trophy, Clock, Heart } from 'lucide-react-native';
import { colors, spacing, layout, borderRadius, typography } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { useUserStore } from '../../src/stores/userStore';
import { useUIStore } from '../../src/stores/uiStore';
import { listMergedExercisesCached } from '../../src/lib/cache/exerciseCache';
import {
  getRecentSessions,
  formatPRDisplay,
  type TopPR,
} from '../../src/lib/supabase/queries/workouts';
import {
  getYearToDateStatsCached,
  getStreakCached,
  getCachedTopPRsCached,
  getUserProfileCached,
} from '../../src/lib/cache/dashboardStatsCache';
import { getSessionsInRangeCached } from '../../src/lib/cache/sessionsCache';
import { WorkoutHeatmap } from '../../src/components/workout/WorkoutHeatmap';
import { WeightTrackerCard } from '@/components/ui/WeightTrackerCard';
import { supabase } from '../../src/lib/supabase/client';
import { devLog, devError } from '../../src/lib/utils/logger';

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

  const [loading, setLoading] = useState(true);
  const [weekCompleted, setWeekCompleted] = useState<number>(0);
  const [weekTarget, setWeekTarget] = useState<number>(0);
  const [yearDaysWorkedOut, setYearDaysWorkedOut] = useState<number>(0);
  const [yearTotalVolume, setYearTotalVolume] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [recentSessions, setRecentSessionsState] = useState<SessionSummary[]>([]);
  const [prs, setPrs] = useState<Array<TopPR & { name?: string }>>([]);
  const [bodySide, setBodySide] = useState<'front' | 'back'>('front');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const loadInFlightRef = useRef(false);

  const today = useMemo(() => new Date(), []);
  const unitsLabel = useMemo(() => ((profile?.use_imperial ?? true) ? 'lbs' : 'kg'), [profile]);
  const displayVolume = useMemo(() => {
    const useImperial = profile?.use_imperial ?? true;
    const raw = yearTotalVolume;
    return useImperial ? raw : raw / LBS_PER_KG;
  }, [profile?.use_imperial, yearTotalVolume]);

  /**
   * Calculate Sunday-Saturday week range for the current week
   * Returns start (Sunday 00:00:00) and end (Saturday 23:59:59.999) as Date objects
   * 
   * Logic:
   * - If today is Sunday (getDay() === 0), start stays on Sunday
   * - If today is Monday (getDay() === 1), start goes back 1 day to Sunday
   * - End is always 6 days after start (Saturday)
   */
  const getWeekRange = () => {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    // Sunday = 0, so subtracting getDay() moves to the start of the week (Sunday)
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Saturday (6 days after Sunday)
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const load = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        loadInFlightRef.current = false;
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
        getRecentSessions(userId, 3),
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
      setLoading(false);
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
      setLoading(false);
      loadInFlightRef.current = false;
    }
  }, [profile, router, setProfile, showToast, today]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="Dashboard" tabId="dashboard" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressPct =
    weekTarget > 0 ? Math.min(100, Math.round((weekCompleted / weekTarget) * 100)) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Dashboard" tabId="dashboard" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: layout.tabBarHeight + insets.bottom + spacing.lg },
        ]}
      >
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
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.heatmapPlaceholderText}>Loading…</Text>
            </View>
          ) : null}
        </View>

        {profile?.id && (
          <WeightTrackerCard userId={profile.id} onRefresh={load} />
        )}

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
            <View style={[styles.card, styles.statCard]}>
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
              <Text style={styles.metricSub}>This year</Text>
            </View>
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
            <Text style={styles.cardTitle}>Connect Health</Text>
          </View>
          <Text style={styles.listSecondary}>Integrations coming soon</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => showToast('Coming soon', 'info')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    backgroundColor: colors.cardBorder,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  fullWidth: {
    width: '100%',
  },
});


