/**
 * Session Detail Sheet
 * Displays session details for a selected date
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../lib/utils/theme';
import { supabase } from '../../lib/supabase/client';
import { getSessionsInRangeCached, invalidateSessionsInRangeForUser } from '../../lib/cache/sessionsCache';
import { deleteSessionWithExercises, type WorkoutSession } from '../../lib/supabase/queries/workouts';
import { listMergedExercisesCached } from '../../lib/cache/exerciseCache';
import { devLog, devError } from '../../lib/utils/logger';
import { useUserStore } from '../../stores/userStore';

type Props = {
  selectedDate: Date;
  onClose: () => void;
  onSessionDeleted?: () => void; // Callback to refresh calendar after deletion
};

type SessionWithExercises = WorkoutSession & {
  exercises: Array<{ name: string; summary?: string }>;
  exerciseCount: number;
};

export const SessionDetailSheet: React.FC<Props> = ({ selectedDate, onClose, onSessionDeleted }) => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithExercises[]>([]);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; name: string } | null>(null);
  const profile = useUserStore((state) => state.profile);
  const unitsLabel = useMemo(() => ((profile?.use_imperial ?? true) ? 'lbs' : 'kg'), [profile]);

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
        .select('id, session_id, exercise_id, custom_exercise_id')
        .in('session_id', sessionIds);

      if (exercisesError && __DEV__) {
        devError('session-detail', exercisesError, { userId, selectedDate });
      }

      const exerciseBySession = new Map<string, Array<{ sessionExerciseId: string; exerciseKey: string }>>();
      const exerciseIds = new Set<string>();
      const customExerciseIds = new Set<string>();

      for (const row of exerciseRows || []) {
        const sid = row.session_id as string;
        if (!exerciseBySession.has(sid)) {
          exerciseBySession.set(sid, []);
        }
        const exerciseKey = row.exercise_id || row.custom_exercise_id;
        if (!exerciseKey) continue;
        exerciseBySession.get(sid)!.push({ sessionExerciseId: row.id as string, exerciseKey });
        if (row.exercise_id) exerciseIds.add(row.exercise_id);
        if (row.custom_exercise_id) customExerciseIds.add(row.custom_exercise_id);
      }

      const sessionExerciseIds = (exerciseRows || []).map((r) => r.id as string);
      const { data: setRows, error: setError } = await supabase
        .from('v2_session_sets')
        .select('session_exercise_id, weight, reps, rpe, performed_at')
        .in('session_exercise_id', sessionExerciseIds)
        .not('performed_at', 'is', null);

      if (setError && __DEV__) {
        devError('session-detail', setError, { userId, selectedDate, step: 'setRows' });
      }

      // For each sessionExerciseId, pick the best performed set (max weight, then max reps)
      const bestSetBySessionExercise = new Map<
        string,
        { weight: number | null; reps: number | null; rpe: number | null }
      >();
      for (const row of setRows || []) {
        const seId = row.session_exercise_id as string;
        const weight = row.weight == null ? null : Number(row.weight);
        const reps = row.reps == null ? null : Number(row.reps);
        const rpe = row.rpe == null ? null : Number(row.rpe);
        const existing = bestSetBySessionExercise.get(seId);
        if (!existing) {
          bestSetBySessionExercise.set(seId, { weight, reps, rpe });
          continue;
        }
        const wA = existing.weight ?? -1;
        const wB = weight ?? -1;
        const rA = existing.reps ?? -1;
        const rB = reps ?? -1;
        if (wB > wA || (wB === wA && rB > rA)) {
          bestSetBySessionExercise.set(seId, { weight, reps, rpe });
        }
      }

      const allExerciseIds = Array.from(exerciseIds);
      const allCustomExerciseIds = Array.from(customExerciseIds);
      let mergedExercises: Array<{ id: string; name: string }> = [];

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

      const sessionsWithExercises: SessionWithExercises[] = dateSessions.map((s) => {
        const rows = exerciseBySession.get(s.id) || [];
        const exercises = rows
          .map(({ sessionExerciseId, exerciseKey }) => {
            const name = exerciseIdToName.get(exerciseKey) || 'Exercise';
            const best = bestSetBySessionExercise.get(sessionExerciseId);
            if (!best) return { name };

            const weightStr =
              best.weight == null ? null : best.weight === 0 ? 'Bodyweight' : `${Math.round(best.weight)} ${unitsLabel}`;
            const repsStr = best.reps == null ? null : `${Math.round(best.reps)} reps`;
            const rpeStr = best.rpe == null ? null : `RPE ${Math.round(best.rpe)}`;

            const parts = [weightStr, repsStr, rpeStr].filter(Boolean) as string[];
            return { name, summary: parts.length ? parts.join(' • ') : undefined };
          })
          .slice(0, 6);
        return {
          ...s,
          exercises,
          exerciseCount: rows.length,
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

          <View style={styles.exerciseSection}>
            <Text style={styles.exerciseCount}>
              {session.exerciseCount === 1
                ? '1 exercise'
                : `${session.exerciseCount} exercises`}
            </Text>
            {session.exercises.length > 0 && (
              <View style={styles.exerciseList}>
                {session.exercises.map((ex, index) => (
                  <View key={index} style={styles.exerciseItem}>
                    <View style={styles.exerciseDot} />
                    <View style={styles.exerciseTextCol}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      {!!ex.summary && <Text style={styles.exerciseSummary}>{ex.summary}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ))}

      <Modal
        visible={!!sessionToDelete}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteConfirm}
      >
        <Pressable style={styles.deleteModalOverlay} onPress={closeDeleteConfirm}>
          <Pressable style={styles.deleteModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.deleteModalTitle}>Delete Workout</Text>
            <Text style={styles.deleteModalMessage}>
              {sessionToDelete
                ? `Are you sure you want to delete this workout (${sessionToDelete.name})? This action cannot be undone.`
                : ''}
            </Text>
            <View style={styles.deleteModalButtons}>
              <Pressable
                style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                onPress={closeDeleteConfirm}
              >
                <Text style={styles.deleteModalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteModalButton, styles.deleteModalButtonDestructive]}
                onPress={confirmDeleteSession}
                disabled={!!deletingSessionId}
              >
                <Text style={styles.deleteModalButtonTextDestructive}>
                  {deletingSessionId ? 'Deleting...' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  exerciseTextCol: {
    flex: 1,
    gap: 2,
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
  exerciseSummary: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  deleteModalCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    minWidth: 280,
    maxWidth: 360,
  },
  deleteModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  deleteModalMessage: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  deleteModalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  deleteModalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  deleteModalButtonTextCancel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  deleteModalButtonDestructive: {
    backgroundColor: colors.error,
  },
  deleteModalButtonTextDestructive: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});

