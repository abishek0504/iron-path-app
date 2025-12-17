import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { useUserStore } from '../../src/stores/userStore';
import { useUIStore } from '../../src/stores/uiStore';
import { getUserProfile } from '../../src/lib/supabase/queries/users';
import { listMergedExercises } from '../../src/lib/supabase/queries/exercises';
import {
  getSessionsInRange,
  getRecentSessions,
  getTopPRs,
  type TopPR,
} from '../../src/lib/supabase/queries/workouts';
import { supabase } from '../../src/lib/supabase/client';
import { devLog, devError } from '../../src/lib/utils/logger';

type SessionSummary = {
  id: string;
  completed_at?: string;
  day_name?: string;
};

export default function DashboardTab() {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);

  const [loading, setLoading] = useState(true);
  const [weekCompleted, setWeekCompleted] = useState<number>(0);
  const [weekTarget, setWeekTarget] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [recentSessions, setRecentSessionsState] = useState<SessionSummary[]>([]);
  const [prs, setPrs] = useState<Array<TopPR & { name?: string }>>([]);

  const today = useMemo(() => new Date(), []);
  const unitsLabel = useMemo(() => ((profile?.use_imperial ?? true) ? 'lbs' : 'kg'), [profile]);

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

  const calculateStreak = (sessions: SessionSummary[]) => {
    if (!sessions.length) return 0;
    const dates = Array.from(
      new Set(
        sessions
          .map((s) => (s.completed_at ? new Date(s.completed_at).toDateString() : null))
          .filter(Boolean) as string[]
      )
    )
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    let streakCount = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    const dateSet = new Set(dates.map((d) => d.toDateString()));
    while (dateSet.has(cursor.toDateString())) {
      streakCount += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streakCount;
  };

  const load = useCallback(async () => {
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

      let userProfile = profile;
      if (!userProfile) {
        userProfile = await getUserProfile(userId);
        if (userProfile) setProfile(userProfile);
      }
      const targetDays = userProfile?.days_per_week ?? 0;

      const { start, end } = getWeekRange();
      const thisWeek = await getSessionsInRange(userId, start.toISOString(), end.toISOString());
      const recent = await getRecentSessions(userId, 7);
      const topPrs = await getTopPRs(userId, 3);

      // Map exercise names for PRs
      const exerciseIds = topPrs
        .map((p) => p.exercise_id || p.custom_exercise_id)
        .filter(Boolean) as string[];
      let mergedNames: Record<string, string> = {};
      if (exerciseIds.length) {
        const merged = await listMergedExercises(userId, exerciseIds);
        mergedNames = merged.reduce<Record<string, string>>((acc, ex) => {
          acc[ex.id] = ex.name || 'Exercise';
          return acc;
        }, {});
      }

      setWeekCompleted(thisWeek.length);
      setWeekTarget(targetDays);
      setRecentSessionsState(recent);
      setStreak(calculateStreak(recent));
      setPrs(
        topPrs.map((p) => ({
          ...p,
          name: mergedNames[p.exercise_id || p.custom_exercise_id || ''] || 'Exercise',
        }))
      );

      if (__DEV__) {
        devLog('profile-dashboard', {
          action: 'load:done',
          weekCompleted: thisWeek.length,
          weekTarget: targetDays,
          streak: calculateStreak(recent),
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <View style={[styles.card, styles.flex1]}>
            <Text style={styles.cardTitle}>This week</Text>
            <Text style={styles.metric}>{weekCompleted}/{weekTarget || '—'}</Text>
            <Text style={styles.metricSub}>Completed workouts</Text>
            <View style={styles.progressBarTrack}>
              <View
                style={[styles.progressBarFill, { width: `${weekTarget ? progressPct : 0}%` }]}
              />
            </View>
          </View>
          <View style={[styles.card, styles.flex1]}>
            <Text style={styles.cardTitle}>Streak</Text>
            <Text style={styles.metric}>{streak} days</Text>
            <Text style={styles.metricSub}>Consecutive active days</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top PRs</Text>
          {prs.length === 0 ? (
            <Text style={styles.emptyText}>No PRs yet</Text>
          ) : (
            prs.map((p) => (
              <View key={p.set_id} style={styles.listRow}>
                <Text style={styles.listPrimary}>{p.name}</Text>
                <Text style={styles.listSecondary}>
                  {p.weight ? `${p.weight} ${unitsLabel}` : p.duration_sec ? `${p.duration_sec}s` : '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent sessions</Text>
          {recentSessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions yet</Text>
          ) : (
            recentSessions.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <Text style={styles.listPrimary}>{s.day_name || 'Session'}</Text>
                <Text style={styles.listSecondary}>
                  {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connect Health</Text>
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
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
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
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  metric: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  metricSub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
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


