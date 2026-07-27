/**
 * Session Detail Sheet
 * Displays session details for a selected date
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LogoEdgeLoader } from '../ui/LogoEdgeLoader';
import { Trash2, ChevronDown, Heart, Activity, Plus } from 'lucide-react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { supabase } from '../../lib/supabase/client';
import { getSessionsInRangeCached, invalidateSessionsInRangeForUser } from '../../lib/cache/sessionsCache';
import { invalidateAnalyticsCache } from '../../lib/cache/analyticsCache';
import { deleteSessionWithExercises, getSessionStats, type WorkoutSession } from '../../lib/supabase/queries/workouts';
import { getSessionHealthMetrics, type SessionHealthMetrics } from '../../lib/supabase/queries/analytics';
import { listMergedExercisesCached } from '../../lib/cache/exerciseCache';
import { devLog, devError } from '../../lib/utils/logger';
import { formatDurationDisplay } from '../../lib/utils/formatDuration';
import { useUserStore } from '../../stores/userStore';

type Props = {
  selectedDate: Date;
  onClose: () => void;
  onSessionDeleted?: () => void; // Callback to refresh calendar after deletion
};

type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

type PerformedSet = {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
  rpe: number | null;
  setType: SetType;
};

type SessionExerciseDetail = {
  sessionExerciseId: string;
  name: string;
  sets: PerformedSet[];
};

type SessionWithExercises = WorkoutSession & {
  exercises: SessionExerciseDetail[];
  exerciseCount: number;
  stats?: {
    totalSets: number;
    volumeLbs: number;
    avgRpe: number | null;
    durationMin: number;
  };
  health?: SessionHealthMetrics | null;
};

const SET_TYPE_LABELS: Record<Exclude<SetType, 'normal'>, string> = {
  warmup: 'Warmup',
  drop: 'Drop',
  failure: 'Failure',
};

const EXPAND_DURATION_MS = 220;

type AnimatedChevronProps = {
  expanded: boolean;
  color: string;
};

function AnimatedChevron({ expanded, color }: AnimatedChevronProps) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, {
      duration: EXPAND_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <Animated.View style={chevronStyle}>
      <ChevronDown size={18} color={color} />
    </Animated.View>
  );
}

type AnimatedExerciseSetsProps = {
  expanded: boolean;
  sets: PerformedSet[];
  unitsLabel: string;
  setListStyle: ViewStyle;
  setRowStyle: ViewStyle;
  setLineStyle: TextStyle;
  setTypeBadgeStyle: ViewStyle;
  setTypeBadgeTextStyle: TextStyle;
};

function AnimatedExerciseSets({
  expanded,
  sets,
  unitsLabel,
  setListStyle,
  setRowStyle,
  setLineStyle,
  setTypeBadgeStyle,
  setTypeBadgeTextStyle,
}: AnimatedExerciseSetsProps) {
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: EXPAND_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  const handleMeasureLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    if (measured > 0 && Math.abs(contentHeight.value - measured) > 0.5) {
      contentHeight.value = measured;
    }
  };

  const setRows = sets.map((set) => (
    <View key={set.setNumber} style={setRowStyle}>
      <Text style={setLineStyle}>{formatPerformedSetLine(set, unitsLabel)}</Text>
      {set.setType !== 'normal' && (
        <View style={setTypeBadgeStyle}>
          <Text style={setTypeBadgeTextStyle}>{SET_TYPE_LABELS[set.setType]}</Text>
        </View>
      )}
    </View>
  ));

  return (
    <View>
      <View
        style={stylesMeasureLayer}
        pointerEvents="none"
        onLayout={handleMeasureLayout}
      >
        <View style={setListStyle}>{setRows}</View>
      </View>
      <Animated.View style={[containerStyle, stylesHiddenOverflow]}>
        <View style={setListStyle}>{setRows}</View>
      </Animated.View>
    </View>
  );
}

const stylesMeasureLayer = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  opacity: 0,
  zIndex: -1,
};

const stylesHiddenOverflow = { overflow: 'hidden' as const };

function formatPerformedSetLine(set: PerformedSet, unitsLabel: string): string {
  const setLabel = `Set ${set.setNumber}`;
  let primary: string | null = null;

  if (set.durationSec != null && set.durationSec > 0 && (set.weight == null || set.weight === 0)) {
    primary = `${formatDurationDisplay(set.durationSec)} hold`;
  } else if (set.reps != null) {
    const weightStr =
      set.weight == null || set.weight === 0
        ? 'Bodyweight'
        : `${Math.round(set.weight)} ${unitsLabel}`;
    primary = `${weightStr} × ${Math.round(set.reps)} reps`;
  } else if (set.durationSec != null && set.durationSec > 0) {
    primary = `${formatDurationDisplay(set.durationSec)} hold`;
  }

  const rpeStr = set.rpe == null ? null : `RPE ${Math.round(set.rpe)}`;
  const parts = [primary, rpeStr].filter(Boolean) as string[];
  return parts.length ? `${setLabel}: ${parts.join(' • ')}` : setLabel;
}

export const SessionDetailSheet: React.FC<Props> = ({ selectedDate, onClose, onSessionDeleted }) => {
  const colors = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogPastWorkout = useCallback(() => {
    onClose();
    router.push({ pathname: '/log-past-workout', params: { date: selectedDate.toISOString() } });
  }, [onClose, router, selectedDate]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithExercises[]>([]);
  const [expandedExerciseKeys, setExpandedExerciseKeys] = useState<Set<string>>(new Set());
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; name: string } | null>(null);
  const profile = useUserStore((state) => state.profile);
  const unitsLabel = useMemo(() => ((profile?.use_imperial ?? true) ? 'lbs' : 'kg'), [profile]);

  useEffect(() => {
    setExpandedExerciseKeys(new Set());
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when selected date changes
  }, [selectedDate]);

  const toggleExerciseExpanded = useCallback((sessionId: string, sessionExerciseId: string) => {
    const key = `${sessionId}:${sessionExerciseId}`;
    setExpandedExerciseKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      const dateSessions = await getSessionsInRangeCached(
        userId,
        start.toISOString(),
        end.toISOString()
      );

      if (!dateSessions.length) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionIds = dateSessions.map((s) => s.id);

      const { data: exerciseRows, error: exercisesError } = await supabase
        .from('v2_session_exercises')
        .select('id, session_id, exercise_id, custom_exercise_id, sort_order')
        .in('session_id', sessionIds);

      if (exercisesError && __DEV__) {
        devError('session-detail', exercisesError, { userId, selectedDate });
      }

      const exerciseBySession = new Map<
        string,
        { sessionExerciseId: string; exerciseKey: string; sortOrder: number }[]
      >();
      const exerciseIds = new Set<string>();
      const customExerciseIds = new Set<string>();

      for (const row of exerciseRows || []) {
        const sid = row.session_id as string;
        if (!exerciseBySession.has(sid)) {
          exerciseBySession.set(sid, []);
        }
        const exerciseKey = row.exercise_id || row.custom_exercise_id;
        if (!exerciseKey) continue;
        exerciseBySession.get(sid)!.push({
          sessionExerciseId: row.id as string,
          exerciseKey,
          sortOrder: (row.sort_order as number) ?? 0,
        });
        if (row.exercise_id) exerciseIds.add(row.exercise_id);
        if (row.custom_exercise_id) customExerciseIds.add(row.custom_exercise_id);
      }

      for (const rows of exerciseBySession.values()) {
        rows.sort((a, b) => a.sortOrder - b.sortOrder);
      }

      const sessionExerciseIds = (exerciseRows || []).map((r) => r.id as string);
      const { data: setRows, error: setError } = await supabase
        .from('v2_session_sets')
        .select('session_exercise_id, set_number, weight, reps, duration_sec, rpe, set_type, performed_at')
        .in('session_exercise_id', sessionExerciseIds)
        .not('performed_at', 'is', null);

      if (setError && __DEV__) {
        devError('session-detail', setError, { userId, selectedDate, step: 'setRows' });
      }

      const setsBySessionExercise = new Map<string, PerformedSet[]>();
      for (const row of setRows || []) {
        const seId = row.session_exercise_id as string;
        const performedSet: PerformedSet = {
          setNumber: row.set_number as number,
          weight: row.weight == null ? null : Number(row.weight),
          reps: row.reps == null ? null : Number(row.reps),
          durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
          rpe: row.rpe == null ? null : Number(row.rpe),
          setType: (row.set_type as SetType) ?? 'normal',
        };
        const existing = setsBySessionExercise.get(seId) ?? [];
        existing.push(performedSet);
        setsBySessionExercise.set(seId, existing);
      }

      for (const sets of setsBySessionExercise.values()) {
        sets.sort((a, b) => a.setNumber - b.setNumber);
      }

      const allExerciseIds = Array.from(exerciseIds);
      const allCustomExerciseIds = Array.from(customExerciseIds);
      let mergedExercises: { id: string; name: string }[] = [];

      if (allExerciseIds.length > 0 || allCustomExerciseIds.length > 0) {
        const merged = await listMergedExercisesCached(userId, [
          ...allExerciseIds,
          ...allCustomExerciseIds,
        ]);
        mergedExercises = merged.map((ex) => ({ id: ex.id, name: ex.name || 'Exercise' }));
      }

      const exerciseIdToName = new Map<string, string>();
      for (const ex of mergedExercises) {
        exerciseIdToName.set(ex.id, ex.name);
      }

      const sessionsWithExercises: SessionWithExercises[] = await Promise.all(
        dateSessions.map(async (s) => {
          const rows = exerciseBySession.get(s.id) || [];
          const exercises: SessionExerciseDetail[] = rows.map(({ sessionExerciseId, exerciseKey }) => ({
            sessionExerciseId,
            name: exerciseIdToName.get(exerciseKey) || 'Exercise',
            sets: setsBySessionExercise.get(sessionExerciseId) ?? [],
          }));

          const [dbStats, health] = await Promise.all([
            getSessionStats(s.id),
            getSessionHealthMetrics(s.id),
          ]);

          let volumeLbs = 0;
          for (const ex of exercises) {
            for (const set of ex.sets) {
              if (set.setType === 'warmup') continue;
              const w = set.weight ?? 0;
              const r = set.reps ?? 0;
              if (w > 0 && r > 0) volumeLbs += w * r;
            }
          }

          const durationMin =
            s.started_at && s.completed_at
              ? Math.round(
                  (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000,
                )
              : 0;

          return {
            ...s,
            exercises,
            exerciseCount: rows.length,
            stats: {
              totalSets: dbStats?.totalSets ?? exercises.reduce((n, ex) => n + ex.sets.length, 0),
              volumeLbs,
              avgRpe: dbStats?.avgRPE ?? null,
              durationMin,
            },
            health,
          };
        }),
      );

      setSessions(sessionsWithExercises);

      if (__DEV__) {
        devLog('session-detail', {
          action: 'load_sessions_done',
          selectedDate: selectedDate.toISOString(),
          sessionCount: sessionsWithExercises.length,
          totalExercises: sessionsWithExercises.reduce((sum, s) => sum + s.exerciseCount, 0),
          totalSets: sessionsWithExercises.reduce(
            (sum, s) => sum + s.exercises.reduce((setSum, ex) => setSum + ex.sets.length, 0),
            0
          ),
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('session-detail', error, { selectedDate });
      }
    } finally {
      setLoading(false);
    }
  };

  const openDeleteConfirm = (sessionId: string, sessionName: string) => {
    setSessionToDelete({ id: sessionId, name: sessionName });
  };

  const closeDeleteConfirm = () => {
    setSessionToDelete(null);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const { id: sessionId } = sessionToDelete;
    setDeletingSessionId(sessionId);
    try {
      const userId = useUserStore.getState().profile?.id;
      if (!userId) {
        closeDeleteConfirm();
        setDeletingSessionId(null);
        return;
      }
      const { error } = await deleteSessionWithExercises(userId, sessionId);

      if (error) {
        if (__DEV__) {
          devError('session-detail', error, { sessionId });
        }
        closeDeleteConfirm();
        setDeletingSessionId(null);
        return;
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      invalidateSessionsInRangeForUser(userId);
      invalidateAnalyticsCache(userId);
      if (onSessionDeleted) {
        onSessionDeleted();
      }
      if (__DEV__) {
        devLog('session-detail', { action: 'delete_session', sessionId });
      }
      closeDeleteConfirm();
    } catch (error) {
      if (__DEV__) {
        devError('session-detail', error, { action: 'delete_session', sessionId });
      }
      closeDeleteConfirm();
    } finally {
      setDeletingSessionId(null);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LogoEdgeLoader size="medium" />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  const startOfSelected = new Date(selectedDate);
  startOfSelected.setHours(0, 0, 0, 0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const canLogForThisDay = startOfSelected.getTime() <= startOfToday.getTime();

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No workouts completed on this date</Text>
        {canLogForThisDay && (
          <TouchableOpacity style={styles.logPastButton} onPress={handleLogPastWorkout}>
            <Plus size={18} color={colors.primary} />
            <Text style={styles.logPastButtonText}>Log a workout for this day</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.dateLabel}>{formatDate(selectedDate)}</Text>

      {sessions.map((session) => (
        <View key={session.id} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionHeaderLeft}>
              <Text style={styles.sessionTitle}>{session.day_name || 'Workout'}</Text>
              {session.completed_at && (
                <Text style={styles.sessionTime}>{formatTime(session.completed_at)}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => openDeleteConfirm(session.id, session.day_name || 'Workout')}
              disabled={deletingSessionId === session.id}
            >
              <Trash2
                size={20}
                color={deletingSessionId === session.id ? colors.textMuted : colors.error}
              />
            </TouchableOpacity>
          </View>

          {session.stats ? (
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{session.stats.totalSets}</Text>
                <Text style={styles.statPillLabel}>sets</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>
                  {Math.round(
                    (profile?.use_imperial !== false
                      ? session.stats.volumeLbs
                      : session.stats.volumeLbs / 2.20462),
                  )}{' '}
                  {unitsLabel}
                </Text>
                <Text style={styles.statPillLabel}>volume</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>
                  {session.stats.avgRpe != null ? session.stats.avgRpe.toFixed(1) : '—'}
                </Text>
                <Text style={styles.statPillLabel}>avg RPE</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{session.stats.durationMin}m</Text>
                <Text style={styles.statPillLabel}>duration</Text>
              </View>
            </View>
          ) : null}

          {session.health &&
          (session.health.activeEnergyKcal != null ||
            session.health.avgHeartRateBpm != null) ? (
            <View style={styles.healthCard}>
              <View style={styles.healthHeader}>
                <Heart size={16} color={colors.primary} />
                <Text style={styles.healthTitle}>Apple Health</Text>
              </View>
              <View style={styles.healthRow}>
                {session.health.activeEnergyKcal != null ? (
                  <View style={styles.healthMetaRow}>
                    <Activity size={12} color={colors.textSecondary} />
                    <Text style={styles.healthMeta}>
                      {Math.round(session.health.activeEnergyKcal)} kcal
                    </Text>
                  </View>
                ) : null}
                {session.health.avgHeartRateBpm != null ? (
                  <Text style={styles.healthMeta}>
                    Avg HR {session.health.avgHeartRateBpm} bpm
                    {session.health.maxHeartRateBpm != null
                      ? ` · Max ${session.health.maxHeartRateBpm}`
                      : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.exerciseSection}>
            <Text style={styles.exerciseCount}>
              {session.exerciseCount === 1
                ? '1 exercise'
                : `${session.exerciseCount} exercises`}
            </Text>
            {session.exercises.length > 0 && (
              <View style={styles.exerciseList}>
                {session.exercises.map((ex) => {
                  const expandKey = `${session.id}:${ex.sessionExerciseId}`;
                  const isExpanded = expandedExerciseKeys.has(expandKey);
                  const hasSets = ex.sets.length > 0;
                  const setCountLabel =
                    ex.sets.length === 1 ? '1 set' : `${ex.sets.length} sets`;

                  return (
                    <View key={ex.sessionExerciseId} style={styles.exerciseItem}>
                      <Pressable
                        style={styles.exerciseHeader}
                        onPress={() =>
                          hasSets && toggleExerciseExpanded(session.id, ex.sessionExerciseId)
                        }
                        disabled={!hasSets}
                      >
                        <View style={styles.exerciseHeaderText}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          <Text style={styles.exerciseSetCount}>
                            {hasSets ? setCountLabel : 'No sets logged'}
                          </Text>
                        </View>
                        {hasSets && (
                          <AnimatedChevron expanded={isExpanded} color={colors.textSecondary} />
                        )}
                      </Pressable>
                      {hasSets && (
                        <AnimatedExerciseSets
                          expanded={isExpanded}
                          sets={ex.sets}
                          unitsLabel={unitsLabel}
                          setListStyle={styles.setList}
                          setRowStyle={styles.setRow}
                          setLineStyle={styles.setLine}
                          setTypeBadgeStyle={styles.setTypeBadge}
                          setTypeBadgeTextStyle={styles.setTypeBadgeText}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      ))}

      {canLogForThisDay && (
        <TouchableOpacity style={styles.logPastButton} onPress={handleLogPastWorkout}>
          <Plus size={18} color={colors.primary} />
          <Text style={styles.logPastButtonText}>Log another workout for this day</Text>
        </TouchableOpacity>
      )}

      <ConfirmDialog
        visible={!!sessionToDelete}
        title="Delete Workout"
        message={
          sessionToDelete
            ? `Are you sure you want to delete this workout (${sessionToDelete.name})? This action cannot be undone.`
            : ''
        }
        confirmLabel={deletingSessionId ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        confirmDestructive
        confirmDisabled={!!deletingSessionId}
        onConfirm={confirmDeleteSession}
        onCancel={closeDeleteConfirm}
      />
    </ScrollView>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 200,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.base,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: typography.sizes.base,
    },
    logPastButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.card,
    },
    logPastButtonText: {
      color: colors.primary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    dateLabel: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      marginBottom: spacing.sm,
    },
    sessionCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      gap: spacing.sm,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    sessionHeaderLeft: {
      flex: 1,
      gap: spacing.xs,
    },
    sessionTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    sessionTime: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    deleteButton: {
      padding: spacing.xs,
      marginLeft: spacing.sm,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginVertical: spacing.sm,
    },
    statPill: {
      flex: 1,
      minWidth: '22%',
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      alignItems: 'center',
    },
    statPillValue: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
    },
    statPillLabel: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      marginTop: 2,
    },
    healthCard: {
      backgroundColor: colors.primarySelectedBg,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    healthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    healthTitle: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    healthRow: {
      gap: spacing.xs,
    },
    healthMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    healthMeta: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    exerciseSection: {
      gap: spacing.xs,
    },
    exerciseCount: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    exerciseList: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    exerciseItem: {
      gap: spacing.xs,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    exerciseHeaderText: {
      flex: 1,
      gap: 2,
    },
    exerciseName: {
      color: colors.textPrimary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
    },
    exerciseSetCount: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
    },
    setList: {
      marginLeft: spacing.sm,
      paddingLeft: spacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: colors.cardBorder,
      gap: spacing.xs,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    setLine: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      flexShrink: 1,
    },
    setTypeBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    setTypeBadgeText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
    },
  });
}
