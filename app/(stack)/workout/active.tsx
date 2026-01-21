/**
 * Active Workout Screen
 * 
 * Displays the active workout session with swipe-to-complete set logging
 * Features:
 * - FlashList for performant rendering
 * - Swipe right to mark sets complete
 * - Tap to edit set values
 * - Real-time progress tracking
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../../src/lib/utils/theme';
import { ActiveSetCard, SetData } from '../../../src/components/workout/ActiveSetCard';
import { getMergedExercise } from '../../../src/lib/supabase/queries/exercises';
import {
  getActiveSession,
  getSessionWithSets,
  markSetComplete,
  saveSessionSet,
  completeWorkoutSession,
} from '../../../src/lib/supabase/queries/workouts';
import { useUserStore } from '../../../src/stores/userStore';
import { useToast } from '../../../src/hooks/useToast';

interface ExerciseWithSets {
  id: string;
  name: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  sort_order: number;
  mode: 'reps' | 'timed';
  sets: SetData[];
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const toast = useToast();
  const profile = useUserStore((state) => state.profile);
  const userId = profile?.id;

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);

  useEffect(() => {
    if (userId) {
      loadActiveSession();
    }
  }, [userId]);

  const loadActiveSession = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Get active session
      const session = await getActiveSession(userId);
      if (!session) {
        toast.error('No active workout found');
        router.back();
        return;
      }

      setSessionId(session.id);

      // Get session with exercises and sets
      const sessionData = await getSessionWithSets(session.id);
      if (!sessionData) {
        toast.error('Failed to load workout data');
        return;
      }

      // Load exercise metadata
      const exercisesWithMeta: ExerciseWithSets[] = [];
      for (const ex of sessionData.exercises) {
        const exerciseRef = {
          exerciseId: ex.exercise_id,
          customExerciseId: ex.custom_exercise_id,
        };
        const meta = await getMergedExercise(exerciseRef, userId);
        if (meta) {
          exercisesWithMeta.push({
            id: ex.id,
            name: meta.name,
            exercise_id: ex.exercise_id,
            custom_exercise_id: ex.custom_exercise_id,
            sort_order: ex.sort_order,
            mode: meta.is_timed ? 'timed' : 'reps',
            sets: ex.sets.map(s => ({ ...s, completed: false })),
          });
        }
      }

      setExercises(exercisesWithMeta);
    } catch (error) {
      console.error('Error loading active session:', error);
      toast.error('Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const handleSetComplete = async (
    exerciseId: string,
    setId: string,
    values: { reps?: number; weight?: number; duration_sec?: number; rpe?: number }
  ) => {
    // Optimistic update
    setExercises(prev =>
      prev.map(ex =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map(s =>
                s.id === setId ? { ...s, ...values, completed: true } : s
              ),
            }
          : ex
      )
    );

    // Save to database
    const success = await markSetComplete(setId, values);
    if (!success) {
      toast.error('Failed to save set');
      // Revert optimistic update
      setExercises(prev =>
        prev.map(ex =>
          ex.id === exerciseId
            ? {
                ...ex,
                sets: ex.sets.map(s =>
                  s.id === setId ? { ...s, completed: false } : s
                ),
              }
            : ex
        )
      );
    }
  };

  const handleSetUpdate = async (exerciseId: string, setId: string, values: Partial<SetData>) => {
    // Optimistic update
    setExercises(prev =>
      prev.map(ex =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map(s => (s.id === setId ? { ...s, ...values } : s)),
            }
          : ex
      )
    );

    // Save to database
    const savedSet = await saveSessionSet(exerciseId, values.set_number!, {
      reps: values.reps,
      weight: values.weight,
      duration_sec: values.duration_sec,
      rpe: values.rpe,
      rir: values.rir,
    });

    if (!savedSet) {
      toast.error('Failed to save changes');
    }
  };

  const handleCompleteWorkout = async () => {
    if (!sessionId) return;

    const success = await completeWorkoutSession(sessionId);
    if (success) {
      toast.success('Workout completed!');
      router.back();
    } else {
      toast.error('Failed to complete workout');
    }
  };

  const renderExerciseSection = ({ item: exercise }: { item: ExerciseWithSets }) => {
    return (
      <View style={styles.exerciseSection}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <View style={styles.setsContainer}>
          {exercise.sets.map(set => (
            <ActiveSetCard
              key={set.id}
              set={set}
              mode={exercise.mode}
              onComplete={(setId, values) => handleSetComplete(exercise.id, setId, values)}
              onUpdate={(setId, values) => handleSetUpdate(exercise.id, setId, values)}
              useImperial={profile?.use_imperial ?? true}
            />
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Workout</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Exercise List */}
      <FlashList
        data={exercises}
        renderItem={renderExerciseSection}
        estimatedItemSize={200}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No exercises in this workout</Text>
          </View>
        }
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleCompleteWorkout}
        >
          <CheckCircle size={20} color={colors.background} />
          <Text style={styles.completeButtonText}>Complete Workout</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
  },
  exerciseSection: {
    marginBottom: spacing.xl,
  },
  exerciseName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  setsContainer: {
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  completeButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  completeButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});

