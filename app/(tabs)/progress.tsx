/**
 * Progress tab
 * Shows history of completed workouts (log) with basic stats
 *
 * NOTE: Grouping is by completed_at date (performed truth), not day_name
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/lib/utils/theme';
import { TabHeader } from '../../src/components/ui/TabHeader';
import { supabase } from '../../src/lib/supabase/client';
import { getRecentSessions, type WorkoutSession } from '../../src/lib/supabase/queries/workouts';
import { devLog, devError } from '../../src/lib/utils/logger';
import { useUIStore } from '../../src/stores/uiStore';

type SessionWithStats = {
  id: string;
  completed_at?: string;
  day_name?: string;
  exerciseCount: number;
};

export default function ProgressTab() {
  const showToast = useUIStore((state) => state.showToast);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);

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

      const recent: WorkoutSession[] = await getRecentSessions(userId, 90);
      if (!recent.length) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionIds = recent.map((s) => s.id);

      const { data: exerciseRows, error: exercisesError } = await supabase
        .from('v2_session_exercises')
        .select('session_id')
        .in('session_id', sessionIds);

      if (exercisesError && __DEV__) {
        devError('progress', exercisesError, { userId, step: 'session-exercises' });
      }

      const counts = new Map<string, number>();
      for (const row of exerciseRows || []) {
        const sid = row.session_id as string;
        counts.set(sid, (counts.get(sid) || 0) + 1);
      }

      const mapped: SessionWithStats[] = recent.map((s) => ({
        id: s.id,
        completed_at: s.completed_at,
        day_name: s.day_name,
        exerciseCount: counts.get(s.id) || 0,
      }));

      setSessions(mapped);

      if (__DEV__) {
        devLog('progress', {
          action: 'load_history_done',
          sessionCount: mapped.length,
          maxExerciseCount: mapped.reduce(
            (max, s) => (s.exerciseCount > max ? s.exerciseCount : max),
            0
          ),
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('progress', error);
      }
      showToast('Failed to load progress', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: SessionWithStats }) => {
    const dateLabel = item.completed_at
      ? new Date(item.completed_at).toLocaleDateString()
      : '—';
    const name = item.day_name || 'Workout';
    const countLabel =
      item.exerciseCount === 1 ? '1 exercise' : `${item.exerciseCount || 0} exercises`;

    return (
      <View style={styles.listRow}>
        <View>
          <Text style={styles.listPrimary}>{name}</Text>
          <Text style={styles.listSecondary}>{dateLabel}</Text>
        </View>
        <Text style={styles.listSecondary}>{countLabel}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="Progress" tabId="progress" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed workouts</Text>
            {sessions.length === 0 ? (
              <Text style={styles.emptyText}>No completed workouts yet</Text>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </View>
        </View>
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
    flex: 1,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
    flex: 1,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
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
  separator: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.xs,
  },
});

