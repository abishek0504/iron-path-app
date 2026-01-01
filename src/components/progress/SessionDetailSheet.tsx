/**
 * Session Detail Sheet
 * Displays session details for a selected date
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../lib/utils/theme';
import { supabase } from '../../lib/supabase/client';
import { getSessionsInRange, type WorkoutSession } from '../../lib/supabase/queries/workouts';
import { listMergedExercises } from '../../lib/supabase/queries/exercises';
import { devLog, devError } from '../../lib/utils/logger';

type Props = {
  selectedDate: Date;
  onClose: () => void;
};

type SessionWithExercises = WorkoutSession & {
  exerciseNames: string[];
  exerciseCount: number;
};

export const SessionDetailSheet: React.FC<Props> = ({ selectedDate, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithExercises[]>([]);

  useEffect(() => {
    loadSessions();
  }, [selectedDate]);

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

      const dateSessions = await getSessionsInRange(
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
        .select('session_id, exercise_id, custom_exercise_id')
        .in('session_id', sessionIds);

      if (exercisesError && __DEV__) {
        devError('session-detail', exercisesError, { userId, selectedDate });
      }

      const exerciseMap = new Map<string, string[]>();
      const exerciseIds = new Set<string>();
      const customExerciseIds = new Set<string>();

      for (const row of exerciseRows || []) {
        const sid = row.session_id as string;
        if (!exerciseMap.has(sid)) {
          exerciseMap.set(sid, []);
        }
        if (row.exercise_id) {
          exerciseIds.add(row.exercise_id);
        }
        if (row.custom_exercise_id) {
          customExerciseIds.add(row.custom_exercise_id);
        }
      }

      const allExerciseIds = Array.from(exerciseIds);
      const allCustomExerciseIds = Array.from(customExerciseIds);
      let mergedExercises: Array<{ id: string; name: string }> = [];

      if (allExerciseIds.length > 0 || allCustomExerciseIds.length > 0) {
        const merged = await listMergedExercises(userId, [
          ...allExerciseIds,
          ...allCustomExerciseIds,
        ]);
        mergedExercises = merged.map((ex) => ({ id: ex.id, name: ex.name || 'Exercise' }));
      }

      const exerciseIdToName = new Map<string, string>();
      for (const ex of mergedExercises) {
        exerciseIdToName.set(ex.id, ex.name);
      }

      for (const row of exerciseRows || []) {
        const sid = row.session_id as string;
        const exerciseId = row.exercise_id || row.custom_exercise_id;
        if (exerciseId && exerciseIdToName.has(exerciseId)) {
          exerciseMap.get(sid)?.push(exerciseIdToName.get(exerciseId)!);
        }
      }

      const sessionsWithExercises: SessionWithExercises[] = dateSessions.map((s) => {
        const exerciseNames = exerciseMap.get(s.id) || [];
        return {
          ...s,
          exerciseNames,
          exerciseCount: exerciseNames.length,
        };
      });

      setSessions(sessionsWithExercises);

      if (__DEV__) {
        devLog('session-detail', {
          action: 'load_sessions_done',
          selectedDate: selectedDate.toISOString(),
          sessionCount: sessionsWithExercises.length,
          totalExercises: sessionsWithExercises.reduce((sum, s) => sum + s.exerciseCount, 0),
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
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No workouts completed on this date</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.dateLabel}>{formatDate(selectedDate)}</Text>

      {sessions.map((session) => (
        <View key={session.id} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionTitle}>{session.day_name || 'Workout'}</Text>
            {session.completed_at && (
              <Text style={styles.sessionTime}>{formatTime(session.completed_at)}</Text>
            )}
          </View>

          <View style={styles.exerciseSection}>
            <Text style={styles.exerciseCount}>
              {session.exerciseCount === 1
                ? '1 exercise'
                : `${session.exerciseCount} exercises`}
            </Text>
            {session.exerciseNames.length > 0 && (
              <View style={styles.exerciseList}>
                {session.exerciseNames.map((name, index) => (
                  <View key={index} style={styles.exerciseItem}>
                    <View style={styles.exerciseDot} />
                    <Text style={styles.exerciseName}>{name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.base,
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
    alignItems: 'center',
    marginBottom: spacing.xs,
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
  exerciseSection: {
    gap: spacing.xs,
  },
  exerciseCount: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  exerciseList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
  },
});

