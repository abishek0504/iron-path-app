/**
 * Add Exercise – searchable list of exercises (name + primary muscles + chevron).
 * Tapping a row opens the exercise detail screen.
 * Navigate from Planner with dayId, templateId, dayName (and optional sessionId).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { useUserStore } from '../src/stores/userStore';
import { supabase } from '../src/lib/supabase/client';
import { listMergedExercisesCached, type MergedExercise } from '../src/lib/cache/exerciseCache';
import { devLog, devError } from '../src/lib/utils/logger';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';

function formatMuscles(muscles: string[] | undefined): string {
  if (!muscles?.length) return '';
  return muscles.join(', ');
}

export default function AddExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dayId: string; templateId: string; dayName: string; sessionId?: string }>();
  const { dayId, templateId, dayName, sessionId } = params;
  const profileId = useUserStore((s) => s.profile?.id);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [userId, setUserId] = useState<string | null>(profileId ?? null);
  const [exercises, setExercises] = useState<MergedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filtered = search.trim()
    ? exercises.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    : exercises;

  const openDetail = (exercise: MergedExercise) => {
    if (!dayId || !templateId || !dayName) return;
    const isCustom = exercise.source === 'custom';
    const resolvedSessionId =
      typeof sessionId === 'string' ? sessionId : Array.isArray(sessionId) ? sessionId[0] : undefined;
    router.push({
      pathname: '/add-exercise-edit',
      params: {
        dayId,
        templateId,
        dayName,
        ...(resolvedSessionId ? { sessionId: resolvedSessionId } : {}),
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
        <LoadingScreen style={styles.centered} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const muscles = formatMuscles(item.primary_muscles);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => openDetail(item)}
                activeOpacity={0.7}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  {muscles ? <Text style={styles.subtitle}>{muscles}</Text> : null}
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          }}
        />
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
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowText: {
      flex: 1,
      marginRight: spacing.sm,
    },
    name: {
      fontSize: typography.sizes.base,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginTop: 2,
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
}
