/**
 * Add Exercise – full-page list of exercises with details and Add button.
 * Replaces the modal picker: navigate from Planner with dayId, templateId, dayName.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../src/lib/utils/theme';
import { useUserStore } from '../src/stores/userStore';
import { supabase } from '../src/lib/supabase/client';
import { listMergedExercisesCached, type MergedExercise } from '../src/lib/cache/exerciseCache';
import { getExerciseHistory } from '../src/lib/supabase/queries/workouts';
import { devLog, devError } from '../src/lib/utils/logger';

function formatImplicitHits(hits: Record<string, number> | undefined): string {
  if (!hits || Object.keys(hits).length === 0) return '—';
  return Object.entries(hits)
    .filter(([, v]) => v != null && v > 0)
    .map(([k, v]) => `${k}: ${Math.round((v as number) * 100)}%`)
    .join(', ');
}

function formatMuscles(muscles: string[] | undefined): string {
  if (!muscles?.length) return '—';
  return muscles.join(', ');
}

export default function AddExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dayId: string; templateId: string; dayName: string }>();
  const { dayId, templateId, dayName } = params;
  const profileId = useUserStore((s) => s.profile?.id);

  const [userId, setUserId] = useState<string | null>(profileId ?? null);
  const [exercises, setExercises] = useState<MergedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastPerformed, setLastPerformed] = useState<Record<string, string>>({});

  // Resolve userId from store or auth session so we don't wait on profile
  useEffect(() => {
    if (profileId) {
      setUserId(profileId);
      return;
    }
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user?.id) {
        setUserId(user.id);
      }
    });
    return () => { cancelled = true; };
  }, [profileId]);

  const loadExercises = useCallback(async () => {
    if (!userId) {
      if (__DEV__) devLog('add-exercise', { action: 'loadExercises_skipped', reason: 'no userId' });
      setLoading(false);
      return;
    }
    setLoading(true);
    if (__DEV__) devLog('add-exercise', { action: 'loadExercises_start', userId });
    try {
      const list = await listMergedExercisesCached(userId);
      setExercises(list.sort((a, b) => a.name.localeCompare(b.name)));
      if (__DEV__) devLog('add-exercise', { action: 'loadExercises_result', count: list.length });
    } catch (e) {
      if (__DEV__) devError('add-exercise', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const loadLastPerformed = useCallback(
    async (exerciseId: string) => {
      if (!userId || lastPerformed[exerciseId] !== undefined) return;
      try {
        const history = await getExerciseHistory(exerciseId, userId, 1);
        const s = history.sets[0];
        if (!s) {
          setLastPerformed((prev) => ({ ...prev, [exerciseId]: 'No history' }));
          return;
        }
        if (s.weight != null && s.reps != null) {
          setLastPerformed((prev) => ({ ...prev, [exerciseId]: `${s.weight} × ${s.reps} reps` }));
        } else if (s.duration_sec != null) {
          setLastPerformed((prev) => ({
            ...prev,
            [exerciseId]: `${Math.round(s.duration_sec / 60)} min`,
          }));
        } else {
          setLastPerformed((prev) => ({ ...prev, [exerciseId]: 'Last performed' }));
        }
      } catch {
        setLastPerformed((prev) => ({ ...prev, [exerciseId]: '—' }));
      }
    },
    [userId, lastPerformed]
  );

  const filtered = search.trim()
    ? exercises.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : exercises;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (expandedId !== id) loadLastPerformed(id);
  };

  const handleAdd = (exercise: MergedExercise) => {
    if (!dayId || !templateId || !dayName) return;
    const isCustom = exercise.source === 'custom';
    router.push({
      pathname: '/add-exercise-edit',
      params: {
        dayId,
        templateId,
        dayName,
        exerciseId: isCustom ? '' : exercise.id,
        customExerciseId: isCustom ? exercise.id : '',
        exerciseName: exercise.name,
        isTimed: exercise.is_timed ? '1' : '0',
      },
    });
  };

  if (!dayId || !templateId || !dayName) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Exercise</Text>
      </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing day or template. Go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Exercise</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search exercises..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {!userId && !loading ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Loading profile…</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            return (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.rowMain}
                  onPress={() => toggleExpand(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.name}>{item.name}</Text>
                    {isExpanded ? (
                      <ChevronUp size={20} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={colors.textSecondary} />
                    )}
                  </View>
                  {isExpanded && (
                    <View style={styles.expanded}>
                      {item.description ? (
                        <>
                          <Text style={styles.detailLabel}>How to do</Text>
                          <Text style={styles.detailText}>{item.description}</Text>
                        </>
                      ) : null}
                      <Text style={styles.detailLabel}>Primary muscles</Text>
                      <Text style={styles.detailText}>{formatMuscles(item.primary_muscles)}</Text>
                      <Text style={styles.detailLabel}>Implicit hits</Text>
                      <Text style={styles.detailText}>{formatImplicitHits(item.implicit_hits)}</Text>
                      <Text style={styles.detailLabel}>Last / PR</Text>
                      <Text style={styles.detailText}>
                        {lastPerformed[item.id] ?? 'Loading…'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleAdd(item)}
                >
                  <Plus size={20} color={colors.background} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  search: {
    margin: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: typography.sizes.base,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  expanded: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  addBtnText: {
    color: colors.background,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
});
