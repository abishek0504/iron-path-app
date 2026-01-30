import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { TabHeader } from '../src/components/ui/TabHeader';
import { useUIStore } from '../src/stores/uiStore';
import { useUserStore } from '../src/stores/userStore';
import { supabase } from '../src/lib/supabase/client';
import { listMergedExercises } from '../src/lib/supabase/queries/exercises';
import { getCachedTopPRs, formatPRDisplay, type TopPR } from '../src/lib/supabase/queries/workouts';
import { devLog, devError } from '../src/lib/utils/logger';

export default function PRsScreen() {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const profile = useUserStore((state) => state.profile);
  const unitsLabel = useMemo(() => ((profile?.use_imperial ?? true) ? 'lbs' : 'kg'), [profile]);

  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState<Array<TopPR & { name?: string }>>([]);

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

      const topPrs = await getCachedTopPRs(userId, 50);
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

      setPrs(
        topPrs.map((p) => ({
          ...p,
          name: mergedNames[p.exercise_id || p.custom_exercise_id || ''] || 'Exercise',
        }))
      );

      if (__DEV__) {
        devLog('prs', { action: 'load:done', prCount: topPrs.length });
      }
    } catch (error) {
      if (__DEV__) devError('prs', error);
      showToast('Failed to load PRs', 'error');
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TabHeader title="PRs" tabId="dashboard" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading PRs...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {prs.length === 0 ? (
            <Text style={styles.emptyText}>No PRs yet</Text>
          ) : (
            prs.map((p) => (
              <View key={p.set_id} style={styles.card}>
                <Text style={styles.primary}>{p.name}</Text>
                <Text style={styles.secondary}>
                  {formatPRDisplay(p, unitsLabel)}
                </Text>
              </View>
            ))
          )}
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
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  primary: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  secondary: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
});

