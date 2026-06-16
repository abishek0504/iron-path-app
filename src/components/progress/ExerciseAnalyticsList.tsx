import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { getRangeForPreset } from '../../lib/analytics/dateBuckets';
import { getExerciseRankingsCached } from '../../lib/cache/analyticsCache';
import type { ExerciseRankEntry } from '../../lib/supabase/queries/analytics';
import { useUserStore } from '../../stores/userStore';

const LBS_PER_KG = 2.20462;

export function ExerciseAnalyticsList() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const useImperial = profile?.use_imperial !== false;

  const [entries, setEntries] = useState<ExerciseRankEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) return;
    setLoading(true);
    try {
      const { start, end } = getRangeForPreset('12w');
      const data = await getExerciseRankingsCached(
        userId,
        start.toISOString(),
        end.toISOString(),
      );
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, search]);

  const formatVolume = (lbs: number) => {
    const v = useImperial ? lbs : lbs / LBS_PER_KG;
    const unit = useImperial ? 'lb' : 'kg';
    return `${Math.round(v).toLocaleString()} ${unit}`;
  };

  const handlePress = (item: ExerciseRankEntry) => {
    router.push({
      pathname: '/analytics/exercise/[id]',
      params: {
        id: item.exerciseKey,
        name: item.name,
        exerciseId: item.exerciseId ?? '',
        customExerciseId: item.customExerciseId ?? '',
      },
    });
  };

  if (loading && entries.length === 0) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading exercises…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search exercises"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.exerciseKey}
        scrollEnabled={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No exercises in the last 12 weeks</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handlePress(item)}>
            <View style={styles.rowMain}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.sessionCount} sessions · {formatVolume(item.volumeLbs)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    loading: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    search: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowMain: {
      flex: 1,
      gap: 2,
    },
    name: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    empty: {
      color: colors.textSecondary,
      textAlign: 'center',
      padding: spacing.lg,
    },
  });
}
