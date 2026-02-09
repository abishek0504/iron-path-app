/**
 * Active Workout Screen (Improved Flow)
 * 
 * Flow:
 * 1. Set Execution: Show minimal info, quick RPE adjustment, Complete button
 * 2. Rest Timer: Auto-starts after completing each set
 * 3. Batch Logging: After all sets complete, log weight/reps for all sets at once
 * 4. Move to next exercise
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle, ChevronRight, Info, RefreshCcw } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../../src/lib/utils/theme';
import { RestTimer } from '../../../src/components/workout/RestTimer';
import { RPESlider } from '../../../src/components/workout/RPESlider';
import { listMergedExercisesCached } from '../../../src/lib/cache/exerciseCache';
import {
  getActiveSession,
  getSessionById,
  getSessionWithSets,
  markSetComplete,
  completeWorkoutSession,
  getLastCompletedWorkoutAt,
} from '../../../src/lib/supabase/queries/workouts';
import { invalidateSessionsInRangeForUser } from '../../../src/lib/cache/sessionsCache';
import { invalidateMuscleFreshnessCache } from '../../../src/lib/cache/muscleFreshnessCache';
import { getTemplateSlotsForDay } from '../../../src/lib/supabase/queries/templates';
import { supabase } from '../../../src/lib/supabase/client';
import { useUserStore } from '../../../src/stores/userStore';
import { useToast } from '../../../src/hooks/useToast';
import { calculateWeightSuggestion } from '../../../src/lib/utils/weightSuggestions';
import { selectExerciseTargets } from '../../../src/lib/engine/targetSelection';
import { detectSessionStaleness } from '../../../src/lib/engine/sessionStaleness';
import {
  getSmartRefreshPlan,
  applySmartRefresh,
  type SmartRefreshPlan,
} from '../../../src/lib/supabase/queries/workouts_helpers';
import { SmartRefreshConfirmationSheet } from '../../../src/components/ui/SmartRefreshConfirmationSheet';

interface Exercise {
  id: string; // session_exercise_id
  name: string;
  exercise_id?: string;
  custom_exercise_id?: string;
  mode: 'reps' | 'timed';
  notes?: string;
  sets: SetData[];
}

interface SetData {
  id: string;
  set_number: number;
  reps?: number;
  weight?: number;
  duration_sec?: number;
  rpe?: number;
  completed: boolean;
}

interface SetLog {
  setNumber: number;
  weight: string;
  reps: string;
  rpe: number;
}

type WorkoutPhase = 
  | { type: 'execution'; setIndex: number } // Executing a set (minimal UI)
  | { type: 'rest'; nextSetIndex: number } // Resting between sets
  | { type: 'logging' } // Batch logging after all sets
  | { type: 'complete' }; // All exercises complete

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const toast = useToast();
  const profile = useUserStore((state) => state.profile);
  const userId = profile?.id;

  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(params.sessionId ?? null);
  const [sessionTemplateId, setSessionTemplateId] = useState<string | null>(null);
  const [sessionDayName, setSessionDayName] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>({ type: 'execution', setIndex: 0 });

  // Current set RPE tracking (during execution)
  const [currentSetRPEs, setCurrentSetRPEs] = useState<number[]>([]);

  // Batch logging state
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);

  // Weight suggestion
  const [suggestedWeight, setSuggestedWeight] = useState<string>('');

  // Exercise info modal
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);
  const [isRecalculatingTargets, setIsRecalculatingTargets] = useState(false);

  // Smart Refresh: staleness and confirmation sheet
  const [staleness, setStaleness] = useState<{
    structural: boolean;
    biomechanical: boolean;
    target: boolean;
  } | null>(null);
  const [showRefreshSheet, setShowRefreshSheet] = useState(false);
  const [refreshPlan, setRefreshPlan] = useState<SmartRefreshPlan | null>(null);
  const [isApplyingRefresh, setIsApplyingRefresh] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (userId) {
      loadActiveSession();
    }
  }, [userId, params.sessionId]);

  // Load weight suggestion when exercise changes
  useEffect(() => {
    if (exercises.length > 0 && currentExerciseIndex < exercises.length) {
      loadWeightSuggestion();
    }
  }, [currentExerciseIndex, exercises]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const loadActiveSession = async () => {
    if (!userId) return;

    setLoading(true);
    if (__DEV__) {
      const { devLog } = require('../../../src/lib/utils/logger');
      devLog('workout-active', { action: 'loadActiveSession_start', sessionId: params.sessionId });
    }
    try {
      const session = params.sessionId
        ? await getSessionById(userId, params.sessionId)
        : await getActiveSession(userId);
      if (!session) {
        toast.error(params.sessionId ? 'Workout not found' : 'No active workout found');
        goBack();
        return;
      }

      setSessionId(session.id);
      setSessionTemplateId(session.template_id ?? null);
      setSessionDayName(session.day_name ?? null);

      const sessionData = await getSessionWithSets(session.id);
      if (!sessionData) {
        toast.error('Failed to load workout data');
        return;
      }

      const exerciseIds = [
        ...new Set(
          sessionData.exercises
            .flatMap((ex) => [ex.exercise_id, ex.custom_exercise_id].filter(Boolean) as string[])
        ),
      ];
      const mergedList = exerciseIds.length > 0
        ? await listMergedExercisesCached(userId, exerciseIds)
        : [];
      const metaById = new Map(mergedList.map((m) => [m.id, m]));

      const exercisesWithMeta: Exercise[] = [];
      for (const ex of sessionData.exercises) {
        const key = ex.exercise_id || ex.custom_exercise_id;
        const meta = key ? metaById.get(key) : null;
        if (meta) {
          exercisesWithMeta.push({
            id: ex.id,
            name: meta.name,
            exercise_id: ex.exercise_id,
            custom_exercise_id: ex.custom_exercise_id,
            mode: meta.is_timed ? 'timed' : 'reps',
            notes: ex.notes,
            sets: ex.sets.map((s) => ({ ...s, completed: !!s.performed_at })),
          });
        }
      }

      setExercises(exercisesWithMeta);

      // Find first incomplete exercise
      let foundIncomplete = false;
      for (let i = 0; i < exercisesWithMeta.length; i++) {
        const incompleteSets = exercisesWithMeta[i].sets.filter(s => !s.completed);
        if (incompleteSets.length > 0) {
          setCurrentExerciseIndex(i);
          // Initialize RPEs from existing set data or default to 7
          const rpes = exercisesWithMeta[i].sets.map(s => s.rpe || 7);
          setCurrentSetRPEs(rpes);
          setWorkoutPhase({ type: 'execution', setIndex: 0 });
          foundIncomplete = true;
          break;
        }
      }

      if (!foundIncomplete && exercisesWithMeta.length > 0) {
        // All exercises complete
        setWorkoutPhase({ type: 'complete' });
      }

      // Smart Refresh: detect staleness when session has template + day
      if (session?.template_id && session?.day_name && userId) {
        try {
          const [templateSlots, lastCompletedAt] = await Promise.all([
            getTemplateSlotsForDay(session.template_id, session.day_name),
            getLastCompletedWorkoutAt(userId),
          ]);
          const result = detectSessionStaleness({
            session: {
              id: session.id,
              template_id: session.template_id,
              day_name: session.day_name,
              started_at: session.started_at,
            },
            sessionExercises: sessionData.exercises.map((e) => ({
              exercise_id: e.exercise_id,
              custom_exercise_id: e.custom_exercise_id,
              sort_order: e.sort_order,
            })),
            templateSlots: templateSlots.map((s) => ({
              exercise_id: s.exercise_id,
              custom_exercise_id: s.custom_exercise_id,
              sort_order: s.sort_order,
            })),
            lastCompletedWorkoutAt: lastCompletedAt ?? undefined,
          });
          setStaleness(result);
        } catch {
          setStaleness(null);
        }
      } else {
        setStaleness(null);
      }
      if (__DEV__) {
        const { devLog } = require('../../../src/lib/utils/logger');
        devLog('workout-active', { action: 'loadActiveSession_done', exerciseCount: exercisesWithMeta.length });
      }
    } catch (error) {
      if (__DEV__) {
        const { devError } = require('../../../src/lib/utils/logger');
        devError('workout-active', error, { action: 'loadActiveSession' });
      }
      toast.error('Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const loadWeightSuggestion = async () => {
    if (!userId) return;

    const exercise = exercises[currentExerciseIndex];
    if (!exercise || exercise.mode !== 'reps') return;

    const firstSet = exercise.sets[0];
    if (!firstSet) return;

    const suggestion = await calculateWeightSuggestion(
      exercise.exercise_id,
      exercise.custom_exercise_id,
      userId,
      firstSet.set_number,
      exercise.mode,
      firstSet.reps,
      firstSet.duration_sec
    );

    // Set suggested weight for display (use existing set weight or suggestion)
    const firstSetWeight = exercise.sets[0]?.weight;
    if (firstSetWeight !== undefined && firstSetWeight !== null) {
      setSuggestedWeight(firstSetWeight === 0 ? 'Bodyweight' : firstSetWeight.toString());
    } else if (suggestion.weight !== undefined) {
      setSuggestedWeight(suggestion.weight === 0 ? 'Bodyweight' : suggestion.weight.toString());
    } else {
      setSuggestedWeight('');
    }
    
    // Pre-fill weight for all sets in batch logging
    // Priority: 1. Existing set values (from Edit Defaults), 2. Suggestion from history/prescription
    const logs: SetLog[] = exercise.sets.map((set, idx) => ({
      setNumber: set.set_number,
      weight: set.weight !== undefined && set.weight !== null 
        ? set.weight.toString() 
        : (suggestion.weight !== undefined ? suggestion.weight.toString() : ''),
      reps: set.reps?.toString() || '',
      rpe: currentSetRPEs[idx] || set.rpe || 7,
    }));
    setSetLogs(logs);
  };

  const handleRecalculateTargets = async () => {
    if (!userId || !sessionId || exercises.length === 0) {
      return;
    }

    setIsRecalculatingTargets(true);
    try {
      let updatedSetCount = 0;
      const experience = profile?.experience_level || 'beginner';

      for (const exercise of exercises) {
        const exerciseRef = {
          exerciseId: exercise.exercise_id,
          customExerciseId: exercise.custom_exercise_id,
        };

        const target = await selectExerciseTargets(
          exerciseRef,
          userId,
          { experience },
          0
        );

        if (!target) continue;

        for (const set of exercise.sets) {
          if (set.completed) continue;

          const updatePayload: {
            reps?: number | null;
            weight?: number | null;
            duration_sec?: number | null;
          } = {};

          if (target.mode === 'reps') {
            if (target.reps !== undefined) {
              updatePayload.reps = target.reps;
            }
            if (target.weight !== undefined) {
              updatePayload.weight = target.weight;
            }
          } else {
            if (target.duration_sec !== undefined) {
              updatePayload.duration_sec = target.duration_sec;
            }
          }

          if (Object.keys(updatePayload).length === 0) {
            continue;
          }

          const { error } = await supabase
            .from('v2_session_sets')
            .update(updatePayload)
            .eq('id', set.id)
            .is('performed_at', null);

          if (!error) {
            updatedSetCount += 1;
          }
        }
      }

      if (updatedSetCount > 0) {
        toast.success(
          `Recalculated targets for ${updatedSetCount} set${updatedSetCount === 1 ? '' : 's'}`
        );
        await loadActiveSession();
      } else {
        toast.info?.('No incomplete sets to update');
      }
    } catch (error) {
      console.error('Error recalculating targets:', error);
      toast.error('Failed to recalculate targets');
    } finally {
      setIsRecalculatingTargets(false);
    }
  };

  const handleCompleteSet = async () => {
    const exercise = exercises[currentExerciseIndex];
    
    if (workoutPhase.type !== 'execution') return;

    const currentSetIdx = workoutPhase.setIndex;
    const isLastSet = currentSetIdx === exercise.sets.length - 1;

    // Update RPE for this set
    const updatedRPEs = [...currentSetRPEs];
    updatedRPEs[currentSetIdx] = currentSetRPEs[currentSetIdx] || 7;
    setCurrentSetRPEs(updatedRPEs);

    // Save set to database immediately (so progress is preserved if user exits)
    // ALWAYS mark as complete with performed_at so "Continue" button works
    const currentSet = exercise.sets[currentSetIdx];
    if (currentSet) {
      const hasValidDefaults = currentSet.weight !== null && currentSet.weight !== undefined && 
                                currentSet.reps !== null && currentSet.reps !== undefined;
      
      if (hasValidDefaults) {
        // Full save with performed_at (set is complete with defaults)
        await markSetComplete(currentSet.id, {
          weight: currentSet.weight!,
          reps: currentSet.reps!,
          rpe: updatedRPEs[currentSetIdx],
        });
      } else {
        // Save with performed_at but use placeholder values that user will adjust in batch logging
        // Use 0 as placeholder to indicate "not set yet"
        await markSetComplete(currentSet.id, {
          weight: 0,
          reps: currentSet.reps || 0,
          rpe: updatedRPEs[currentSetIdx],
        });
      }
      
      // Update local state to mark as completed
      setExercises(prev =>
        prev.map((ex, idx) =>
          idx === currentExerciseIndex
            ? {
                ...ex,
                sets: ex.sets.map((s, sIdx) =>
                  sIdx === currentSetIdx
                    ? { ...s, completed: true, rpe: updatedRPEs[currentSetIdx] }
                    : s
                ),
              }
            : ex
        )
      );
    }

    if (isLastSet) {
      // All sets done → go to batch logging (user can adjust if needed)
      setWorkoutPhase({ type: 'logging' });
    } else {
      // Start rest timer for next set
      setWorkoutPhase({ type: 'rest', nextSetIndex: currentSetIdx + 1 });
    }
  };

  const handleSaveAndContinue = async () => {
    const exercise = exercises[currentExerciseIndex];

    // Validate all inputs
    const hasErrors = setLogs.some(log => {
      if (exercise.mode === 'reps') {
        // Allow 0 weight for bodyweight exercises
        const weight = parseFloat(log.weight);
        const reps = parseInt(log.reps);
        return log.weight === '' || isNaN(weight) || weight < 0 || log.reps === '' || isNaN(reps) || reps <= 0;
      }
      return false;
    });

    if (hasErrors) {
      toast.error('Please fill in valid weight and reps');
      return;
    }

    // Save all sets to database
    for (const log of setLogs) {
      const set = exercise.sets[log.setNumber - 1];
      const success = await markSetComplete(set.id, {
        weight: parseFloat(log.weight),
        reps: parseInt(log.reps),
        rpe: log.rpe,
      });

      if (!success) {
        toast.error(`Failed to save set ${log.setNumber}`);
        return;
      }
    }

    // Update local state
    setExercises(prev =>
      prev.map((ex, idx) =>
        idx === currentExerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, sIdx) => ({
                ...s,
                weight: parseFloat(setLogs[sIdx].weight),
                reps: parseInt(setLogs[sIdx].reps),
                rpe: setLogs[sIdx].rpe,
                completed: true,
              })),
            }
          : ex
      )
    );

    // Move to next exercise
    const isLastExercise = currentExerciseIndex === exercises.length - 1;
    
    if (isLastExercise) {
      setWorkoutPhase({ type: 'complete' });
      toast.success('All exercises complete!');
    } else {
      setCurrentExerciseIndex(prev => prev + 1);
      const nextExercise = exercises[currentExerciseIndex + 1];
      // Initialize RPEs from existing set data or default to 7
      const rpes = nextExercise.sets.map(s => s.rpe || 7);
      setCurrentSetRPEs(rpes);
      setWorkoutPhase({ type: 'execution', setIndex: 0 });
    }
  };

  const handleCompleteWorkout = async () => {
    if (!sessionId) return;
    if (isCompleting) return;
    setIsCompleting(true);

    const success = await completeWorkoutSession(sessionId);
    if (success) {
      const userId = useUserStore.getState().profile?.id;
      if (userId) {
        invalidateSessionsInRangeForUser(userId);
        invalidateMuscleFreshnessCache(userId);
      }
      toast.success('Workout completed!');
      goBack();
    } else {
      setIsCompleting(false);
      toast.error('Failed to complete workout');
    }
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

  if (exercises.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No exercises in this workout</Text>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentExercise = exercises[currentExerciseIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            goBack();
          }} 
          style={styles.headerButton}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Workout</Text>
        {(() => {
          const hasDivergence =
            staleness && (staleness.structural || staleness.target || staleness.biomechanical);
          const refreshColor = staleness?.biomechanical
            ? colors.error
            : hasDivergence
              ? colors.warning
              : colors.textPrimary;
          return (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={async () => {
                if (hasDivergence && sessionId && sessionTemplateId && sessionDayName && userId) {
                  const plan = await getSmartRefreshPlan(
                    sessionId,
                    sessionTemplateId,
                    sessionDayName,
                    userId
                  );
                  setRefreshPlan(plan ?? null);
                  setShowRefreshSheet(true);
                } else {
                  await handleRecalculateTargets();
                }
              }}
              disabled={isRecalculatingTargets || isApplyingRefresh}
            >
              <RefreshCcw
                size={20}
                color={
                  isRecalculatingTargets || isApplyingRefresh
                    ? colors.textSecondary
                    : refreshColor
                }
              />
            </TouchableOpacity>
          );
        })()}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Indicator */}
        <View style={styles.progressSection}>
          <Text style={styles.progressText}>
            Exercise {currentExerciseIndex + 1} of {exercises.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Exercise Name */}
        <Text style={styles.exerciseName}>{currentExercise.name}</Text>

        {/* Exercise Notes */}
        {currentExercise.notes && (
          <View style={styles.notesContainer}>
            <Info size={16} color={colors.textSecondary} />
            <Text style={styles.notesText}>{currentExercise.notes}</Text>
          </View>
        )}

        {/* EXECUTION PHASE */}
        {workoutPhase.type === 'execution' && (
          <View style={styles.executionContainer}>
            <Text style={styles.setInfo}>
              Set {workoutPhase.setIndex + 1} of {currentExercise.sets.length}
            </Text>

            {/* Target Info */}
            <View style={styles.targetCard}>
              <Text style={styles.targetLabel}>Target</Text>
              <Text style={styles.targetValue}>
                {currentExercise.sets[workoutPhase.setIndex]?.reps || 0} reps
                {suggestedWeight && ` @ ${suggestedWeight} ${profile?.use_imperial ? 'lbs' : 'kg'}`}
              </Text>
            </View>

            {/* Exercise Info (Optional) */}
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={() => setShowExerciseInfo(!showExerciseInfo)}
            >
              <Info size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                {showExerciseInfo ? 'Hide' : 'Show'} Exercise Info
              </Text>
            </TouchableOpacity>

            {showExerciseInfo && (
              <View style={styles.exerciseInfoCard}>
                <Text style={styles.exerciseInfoTitle}>Target Muscles</Text>
                <Text style={styles.exerciseInfoText}>
                  Primary: {currentExercise.name.includes('Bicep') ? 'Biceps, Forearms' : 
                           currentExercise.name.includes('Tricep') ? 'Triceps' :
                           currentExercise.name.includes('Pull') ? 'Lats, Biceps, Upper Back' :
                           currentExercise.name.includes('Squat') ? 'Quads, Glutes, Core' :
                           currentExercise.name.includes('Press') ? 'Chest, Triceps, Front Delts' :
                           'Multiple muscle groups'}
                </Text>
                <Text style={styles.exerciseInfoTitle}>Form Tips</Text>
                <Text style={styles.exerciseInfoText}>
                  • Control the weight on both up and down phases{'\n'}
                  • Maintain proper breathing (exhale on exertion){'\n'}
                  • Focus on mind-muscle connection{'\n'}
                  • Don't sacrifice form for more weight
                </Text>
              </View>
            )}

            {/* RPE Slider */}
            <View style={styles.rpeSection}>
              <Text style={styles.inputLabel}>How hard was this set? (RPE)</Text>
              <RPESlider
                value={currentSetRPEs[workoutPhase.setIndex] || 7}
                onChange={(value) => {
                  const updated = [...currentSetRPEs];
                  updated[workoutPhase.setIndex] = value;
                  setCurrentSetRPEs(updated);
                }}
              />
            </View>

            {/* Complete Set Button */}
            <TouchableOpacity style={styles.completeSetButton} onPress={handleCompleteSet}>
              <CheckCircle size={20} color={colors.background} />
              <Text style={styles.completeSetText}>Complete Set</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* REST PHASE */}
        {workoutPhase.type === 'rest' && (
          <View style={styles.restContainer}>
            <RestTimer
              durationSec={90}
              onComplete={() => setWorkoutPhase({ type: 'execution', setIndex: workoutPhase.nextSetIndex })}
              onSkip={() => setWorkoutPhase({ type: 'execution', setIndex: workoutPhase.nextSetIndex })}
            />
            <Text style={styles.nextSetText}>
              Next: Set {workoutPhase.nextSetIndex + 1} of {currentExercise.sets.length}
            </Text>
          </View>
        )}

        {/* BATCH LOGGING PHASE */}
        {workoutPhase.type === 'logging' && (
          <View style={styles.loggingContainer}>
            <Text style={styles.loggingTitle}>Log Your Sets</Text>
            <Text style={styles.loggingSubtitle}>Enter weight and reps for each set</Text>

            {setLogs.map((log, idx) => (
              <View key={log.setNumber} style={styles.logCard}>
                <Text style={styles.logSetNumber}>Set {log.setNumber}</Text>
                
                <View style={styles.logInputRow}>
                  <View style={styles.logInputGroup}>
                    <Text style={styles.logInputLabel}>Weight ({profile?.use_imperial ? 'lbs' : 'kg'})</Text>
                    <TextInput
                      style={styles.logInput}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      returnKeyType="next"
                      value={log.weight}
                      onChangeText={(text) => {
                        const updated = [...setLogs];
                        updated[idx].weight = text;
                        setSetLogs(updated);
                      }}
                    />
                  </View>

                  <View style={styles.logInputGroup}>
                    <Text style={styles.logInputLabel}>Reps</Text>
                    <TextInput
                      style={styles.logInput}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      returnKeyType={idx === setLogs.length - 1 ? "done" : "next"}
                      value={log.reps}
                      onChangeText={(text) => {
                        const updated = [...setLogs];
                        updated[idx].reps = text;
                        setSetLogs(updated);
                      }}
                      onSubmitEditing={() => {
                        if (idx === setLogs.length - 1) {
                          Keyboard.dismiss();
                        }
                      }}
                    />
                  </View>

                  <View style={styles.logInputGroupSmall}>
                    <Text style={styles.logInputLabel}>RPE</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        // Toggle between RPE values or open inline slider
                        const updated = [...setLogs];
                        updated[idx].rpe = updated[idx].rpe < 10 ? updated[idx].rpe + 1 : 5;
                        setSetLogs(updated);
                      }}
                    >
                      <Text style={styles.rpeDisplayValue}>{log.rpe}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* RPE Slider for this set */}
                <View style={styles.rpeSliderContainer}>
                  <RPESlider
                    value={log.rpe}
                    onChange={(value) => {
                      const updated = [...setLogs];
                      updated[idx].rpe = value;
                      setSetLogs(updated);
                    }}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAndContinue}>
              {currentExerciseIndex === exercises.length - 1 ? (
                <Text style={styles.saveButtonText}>Save & Finish</Text>
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save & Continue</Text>
                  <ChevronRight size={20} color={colors.background} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* COMPLETE PHASE */}
        {workoutPhase.type === 'complete' && (
          <View style={styles.completeContainer}>
            <CheckCircle size={64} color={colors.success} />
            <Text style={styles.completeTitle}>Workout Complete!</Text>
            <Text style={styles.completeText}>Great job today!</Text>

            {isCompleting ? (
              <View style={styles.finishButton}>
                <ActivityIndicator size="small" color={colors.background} />
                <Text style={styles.finishText}>Saving…</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.finishButton} onPress={handleCompleteWorkout} disabled={isCompleting}>
                <CheckCircle size={24} color={colors.background} />
                <Text style={styles.finishText}>Finish Workout</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <SmartRefreshConfirmationSheet
        visible={showRefreshSheet}
        plan={refreshPlan}
        onClose={() => {
          setShowRefreshSheet(false);
          setRefreshPlan(null);
        }}
        onApply={async () => {
          if (!sessionId || !sessionTemplateId || !sessionDayName || !userId) return;
          setIsApplyingRefresh(true);
          try {
            const success = await applySmartRefresh(
              sessionId,
              sessionTemplateId,
              sessionDayName,
              userId,
              profile?.experience_level || 'beginner'
            );
            if (success) {
              toast.success('Workout updated from plan');
              await loadActiveSession();
              setShowRefreshSheet(false);
              setRefreshPlan(null);
            } else {
              toast.error('Failed to apply updates');
            }
          } catch (error) {
            console.error('Smart Refresh apply error:', error);
            toast.error('Failed to apply updates');
          } finally {
            setIsApplyingRefresh(false);
          }
        }}
        applying={isApplyingRefresh}
      />
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
  headerButton: {
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    textAlign: 'center',
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  exerciseName: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  notesText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  executionContainer: {
    gap: spacing.md,
  },
  setInfo: {
    fontSize: typography.sizes.xl,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  targetCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    alignItems: 'center',
  },
  targetLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  targetValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  rpeSection: {
    marginTop: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  completeSetButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  completeSetText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
  restContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  nextSetText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  loggingContainer: {
    gap: spacing.md,
  },
  loggingTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  loggingSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  logSetNumber: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  logInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logInputGroup: {
    flex: 1,
  },
  logInputGroupSmall: {
    width: 80,
    alignItems: 'center',
  },
  logInputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: typography.sizes.lg,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  rpeDisplayValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  rpeSliderContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseInfoCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: spacing.sm,
  },
  exerciseInfoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  exerciseInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.background,
  },
  completeContainer: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  completeTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  completeText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  finishButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    minWidth: '80%',
  },
  finishText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.background,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
