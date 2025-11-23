import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Check, Clock, Play, SkipForward } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ExerciseDetail {
  is_timed: boolean;
  default_duration_sec: number | null;
  description: string | null;
}

interface SetProgress {
  setIndex: number;
  completed: boolean;
  reps: number | null;
  weight: number | null;
  duration: number | null;
}

interface ExerciseProgress {
  exerciseIndex: number;
  name: string;
  completed: boolean;
  sets: SetProgress[];
}

interface WorkoutProgress {
  exercises: ExerciseProgress[];
  currentExerciseIndex: number;
  currentSetIndex: number;
}

export default function WorkoutActiveScreen() {
  const router = useRouter();
  const { day, planId } = useLocalSearchParams<{ day: string; planId: string }>();
  
  const [plan, setPlan] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, ExerciseDetail>>(new Map());
  const [workoutSession, setWorkoutSession] = useState<any>(null);
  const [progress, setProgress] = useState<WorkoutProgress>({ exercises: [], currentExerciseIndex: 0, currentSetIndex: 0 });
  const [loading, setLoading] = useState(true);
  
  // Timer states
  const [restTimer, setRestTimer] = useState<{ active: boolean; seconds: number } | null>(null);
  const [exerciseTimer, setExerciseTimer] = useState<{ active: boolean; seconds: number } | null>(null);
  const restTimerInterval = useRef<NodeJS.Timeout | null>(null);
  const exerciseTimerInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Exercise completion logging
  const [showLoggingScreen, setShowLoggingScreen] = useState(false);
  const [completedExerciseIndex, setCompletedExerciseIndex] = useState<number | null>(null);
  const [setLogs, setSetLogs] = useState<Array<{ reps: string; weight: string; duration: string }>>([]);

  useEffect(() => {
    loadWorkoutData();
    return () => {
      if (restTimerInterval.current) clearInterval(restTimerInterval.current);
      if (exerciseTimerInterval.current) clearInterval(exerciseTimerInterval.current);
    };
  }, []);

  useEffect(() => {
    if (restTimer?.active) {
      restTimerInterval.current = setInterval(() => {
        setRestTimer(prev => {
          if (!prev) return null;
          if (prev.seconds <= 1) {
            if (restTimerInterval.current) clearInterval(restTimerInterval.current);
            // Auto-advance to next set
            handleRestComplete();
            return null;
          }
          return { ...prev, seconds: prev.seconds - 1 };
        });
      }, 1000);
    } else {
      if (restTimerInterval.current) {
        clearInterval(restTimerInterval.current);
        restTimerInterval.current = null;
      }
    }
    return () => {
      if (restTimerInterval.current) clearInterval(restTimerInterval.current);
    };
  }, [restTimer?.active]);

  useEffect(() => {
    if (exerciseTimer?.active) {
      exerciseTimerInterval.current = setInterval(() => {
        setExerciseTimer(prev => {
          if (!prev) return null;
          return { ...prev, seconds: prev.seconds + 1 };
        });
      }, 1000);
    } else {
      if (exerciseTimerInterval.current) {
        clearInterval(exerciseTimerInterval.current);
        exerciseTimerInterval.current = null;
      }
    }
    return () => {
      if (exerciseTimerInterval.current) clearInterval(exerciseTimerInterval.current);
    };
  }, [exerciseTimer?.active]);

  const loadWorkoutData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        router.back();
        return;
      }

      // Load workout plan
      const { data: planData, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', parseInt(planId))
        .single();

      if (planError || !planData) {
        Alert.alert("Error", "Failed to load workout plan.");
        router.back();
        return;
      }

      setPlan(planData);
      const dayData = planData.plan_data?.week_schedule?.[day];
      if (!dayData || !dayData.exercises) {
        Alert.alert("Error", "No exercises found for this day.");
        router.back();
        return;
      }

      setExercises(dayData.exercises);

      // Load exercise details from exercises and user_exercises tables
      const detailsMap = new Map<string, ExerciseDetail>();
      for (const exercise of dayData.exercises) {
        // Try exercises table first
        const { data: exerciseData } = await supabase
          .from('exercises')
          .select('is_timed, default_duration_sec, description')
          .eq('name', exercise.name)
          .single();

        if (exerciseData) {
          detailsMap.set(exercise.name, {
            is_timed: exerciseData.is_timed || false,
            default_duration_sec: exerciseData.default_duration_sec,
            description: exerciseData.description
          });
        } else {
          // Try user_exercises table
          const { data: userExerciseData } = await supabase
            .from('user_exercises')
            .select('is_timed, default_duration_sec, description')
            .eq('name', exercise.name)
            .eq('user_id', user.id)
            .single();

          if (userExerciseData) {
            detailsMap.set(exercise.name, {
              is_timed: userExerciseData.is_timed || false,
              default_duration_sec: userExerciseData.default_duration_sec,
              description: userExerciseData.description
            });
          } else {
            // Default values
            detailsMap.set(exercise.name, {
              is_timed: false,
              default_duration_sec: null,
              description: null
            });
          }
        }
      }
      setExerciseDetails(detailsMap);

      // Check for existing active workout session
      const { data: existingSession } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', parseInt(planId))
        .eq('day', day)
        .eq('status', 'active')
        .single();

      if (existingSession && existingSession.progress) {
        setWorkoutSession(existingSession);
        setProgress(existingSession.progress);
      } else {
        // Create new workout session
        const initialProgress = initializeProgress(dayData.exercises);
        try {
          const { data: newSession, error: sessionError } = await supabase
            .from('workout_sessions')
            .insert([{
              user_id: user.id,
              plan_id: parseInt(planId),
              day: day,
              status: 'active',
              progress: initialProgress
            }])
            .select()
            .single();

          if (sessionError) {
            console.error('Error creating session:', sessionError);
            // Fallback to AsyncStorage
            await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(initialProgress));
            setProgress(initialProgress);
          } else {
            setWorkoutSession(newSession);
            setProgress(initialProgress);
          }
        } catch (error) {
          console.error('Error creating session:', error);
          await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(initialProgress));
          setProgress(initialProgress);
        }
      }
    } catch (error: any) {
      console.error('Error loading workout:', error);
      Alert.alert("Error", "Failed to load workout data.");
    } finally {
      setLoading(false);
    }
  };

  const initializeProgress = (exercises: any[]): WorkoutProgress => {
    return {
      exercises: exercises.map((exercise, index) => ({
        exerciseIndex: index,
        name: exercise.name,
        completed: false,
        sets: Array.from({ length: exercise.target_sets || 3 }, (_, setIndex) => ({
          setIndex,
          completed: false,
          reps: null,
          weight: null,
          duration: null
        }))
      })),
      currentExerciseIndex: 0,
      currentSetIndex: 0
    };
  };

  const saveProgress = async (updatedProgress: WorkoutProgress) => {
    if (!workoutSession) {
      // Try to save to AsyncStorage
      await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(updatedProgress));
      setProgress(updatedProgress);
      return;
    }

    try {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ progress: updatedProgress })
        .eq('id', workoutSession.id);

      if (error) {
        console.error('Error saving progress:', error);
        await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(updatedProgress));
      } else {
        setProgress(updatedProgress);
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(updatedProgress));
    }
  };

  const getLastWeight = async (exerciseName: string): Promise<number | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('workout_logs')
        .select('weight')
        .eq('user_id', user.id)
        .eq('exercise_name', exerciseName)
        .order('performed_at', { ascending: false })
        .limit(1)
        .single();

      return data?.weight ? Number(data.weight) : null;
    } catch {
      return null;
    }
  };

  const handleStartSet = () => {
    const exerciseIndex = progress.currentExerciseIndex;
    const exercise = exercises[exerciseIndex];
    const detail = exerciseDetails.get(exercise.name);
    const isTimed = detail?.is_timed || false;

    if (isTimed) {
      // Start exercise timer
      setExerciseTimer({ active: true, seconds: 0 });
    } else {
      // Just mark set as complete (no logging yet)
      handleCompleteSet();
    }
  };

  const handleCompleteTimedExercise = () => {
    if (!exerciseTimer) return;
    setExerciseTimer(null);
    // Mark set as complete
    handleCompleteSet();
  };

  const handleCompleteSet = async () => {
    const exerciseIndex = progress.currentExerciseIndex;
    const setIndex = progress.currentSetIndex;
    const exercise = exercises[exerciseIndex];

    // Update progress - mark set as complete (without logging data yet)
    const updatedProgress = { ...progress };
    if (!updatedProgress.exercises[exerciseIndex]) {
      updatedProgress.exercises[exerciseIndex] = {
        exerciseIndex,
        name: exercise.name,
        completed: false,
        sets: Array.from({ length: exercise.target_sets || 3 }, (_, idx) => ({
          setIndex: idx,
          completed: false,
          reps: null,
          weight: null,
          duration: null
        }))
      };
    }
    
    updatedProgress.exercises[exerciseIndex].sets[setIndex] = {
      setIndex,
      completed: true,
      reps: null, // Will be filled in logging screen
      weight: null,
      duration: exerciseTimer ? exerciseTimer.seconds : null
    };

    // Check if all sets are complete for this exercise
    const allSetsComplete = updatedProgress.exercises[exerciseIndex].sets.every(s => s.completed);
    
    if (allSetsComplete) {
      // Show logging screen
      const totalSets = exercise.target_sets || 3;
      const lastWeight = await getLastWeight(exercise.name);
      setSetLogs(Array.from({ length: totalSets }, () => ({
        reps: '',
        weight: lastWeight ? lastWeight.toString() : '',
        duration: ''
      })));
      setCompletedExerciseIndex(exerciseIndex);
      setShowLoggingScreen(true);
      setExerciseTimer(null);
    } else {
      // Move to next set and start rest timer
      updatedProgress.currentSetIndex = setIndex + 1;
      await saveProgress(updatedProgress);
      
      // Start rest timer
      const restTime = exercise.rest_time_sec || 60;
      setRestTimer({ active: true, seconds: restTime });
      setExerciseTimer(null);
    }
  };

  const handleSaveExerciseLogs = async () => {
    if (completedExerciseIndex === null) return;
    
    const exercise = exercises[completedExerciseIndex];
    const detail = exerciseDetails.get(exercise.name);
    const isTimed = detail?.is_timed || false;
    const totalSets = exercise.target_sets || 3;

    // Update progress with logged data
    const updatedProgress = { ...progress };
    for (let i = 0; i < totalSets; i++) {
      if (isTimed) {
        updatedProgress.exercises[completedExerciseIndex].sets[i].duration = parseInt(setLogs[i].duration) || 0;
      } else {
        updatedProgress.exercises[completedExerciseIndex].sets[i].reps = parseInt(setLogs[i].reps) || 0;
        updatedProgress.exercises[completedExerciseIndex].sets[i].weight = parseFloat(setLogs[i].weight) || null;
      }
    }

    // Save to workout_logs
    await saveSetsToLogs(exercise, updatedProgress.exercises[completedExerciseIndex].sets);
    
    updatedProgress.exercises[completedExerciseIndex].completed = true;
    
    // Move to next exercise or finish workout
    if (completedExerciseIndex < exercises.length - 1) {
      updatedProgress.currentExerciseIndex = completedExerciseIndex + 1;
      updatedProgress.currentSetIndex = 0;
      await saveProgress(updatedProgress);
      setShowLoggingScreen(false);
      setCompletedExerciseIndex(null);
      setSetLogs([]);
    } else {
      // Workout complete
      if (workoutSession) {
        await supabase
          .from('workout_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            progress: updatedProgress
          })
          .eq('id', workoutSession.id);
      }
      setShowLoggingScreen(false);
      Alert.alert("Workout Complete!", "Great job completing your workout!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    }
  };

  const saveSetsToLogs = async (exercise: any, sets: SetProgress[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const logs = sets
        .filter(s => s.completed)
        .map(set => ({
          user_id: user.id,
          exercise_name: exercise.name,
          weight: set.weight || 0,
          reps: set.reps || 0,
          notes: set.duration ? `Duration: ${set.duration}s` : undefined
        }));

      if (logs.length > 0) {
        await supabase.from('workout_logs').insert(logs);
      }
    } catch (error) {
      console.error('Error saving to workout_logs:', error);
    }
  };

  const handleRestComplete = () => {
    setRestTimer(null);
    // Progress already updated, component will re-render showing next set
  };

  const handleStartRestTimer = () => {
    const exerciseIndex = progress.currentExerciseIndex;
    const exercise = exercises[exerciseIndex];
    const restTime = exercise.rest_time_sec || 60;
    setRestTimer({ active: true, seconds: restTime });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentExercise = () => {
    if (exercises.length === 0 || progress.exercises.length === 0) return null;
    const exerciseIndex = progress.currentExerciseIndex;
    if (exerciseIndex >= exercises.length) return null;
    return {
      exercise: exercises[exerciseIndex],
      exerciseIndex,
      progress: progress.exercises[exerciseIndex],
      detail: exerciseDetails.get(exercises[exerciseIndex].name)
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show logging screen if exercise is complete
  if (showLoggingScreen && completedExerciseIndex !== null) {
    const exercise = exercises[completedExerciseIndex];
    const detail = exerciseDetails.get(exercise.name);
    const isTimed = detail?.is_timed || false;
    const totalSets = exercise.target_sets || 3;
    const isLastExercise = completedExerciseIndex === exercises.length - 1;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log {exercise.name}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X color="#9ca3af" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.loggingContainer}>
          <Text style={styles.loggingTitle}>All sets complete!</Text>
          <Text style={styles.loggingSubtitle}>Log your results for each set</Text>

          {Array.from({ length: totalSets }, (_, setIndex) => (
            <View key={setIndex} style={styles.setLogCard}>
              <Text style={styles.setLogTitle}>Set {setIndex + 1}</Text>
              {isTimed ? (
                <View style={styles.logInputGroup}>
                  <Text style={styles.logLabel}>Duration (seconds)</Text>
                  <TextInput
                    style={styles.logInput}
                    value={setLogs[setIndex]?.duration || ''}
                    onChangeText={(text) => {
                      const newLogs = [...setLogs];
                      newLogs[setIndex] = { ...newLogs[setIndex], duration: text };
                      setSetLogs(newLogs);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#6b7280"
                  />
                  {detail?.default_duration_sec && (
                    <Text style={styles.targetHint}>Target: {detail.default_duration_sec}s</Text>
                  )}
                </View>
              ) : (
                <View style={styles.logInputRow}>
                  <View style={styles.logInputHalf}>
                    <Text style={styles.logLabel}>Weight (lbs)</Text>
                    <TextInput
                      style={styles.logInput}
                      value={setLogs[setIndex]?.weight || ''}
                      onChangeText={(text) => {
                        const newLogs = [...setLogs];
                        newLogs[setIndex] = { ...newLogs[setIndex], weight: text };
                        setSetLogs(newLogs);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#6b7280"
                    />
                  </View>
                  <View style={styles.logInputHalf}>
                    <Text style={styles.logLabel}>Reps</Text>
                    <TextInput
                      style={styles.logInput}
                      value={setLogs[setIndex]?.reps || ''}
                      onChangeText={(text) => {
                        const newLogs = [...setLogs];
                        newLogs[setIndex] = { ...newLogs[setIndex], reps: text };
                        setSetLogs(newLogs);
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#6b7280"
                    />
                    {exercise.target_reps && (
                      <Text style={styles.targetHint}>Target: {exercise.target_reps}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}

          <View style={styles.loggingButtons}>
            {!isLastExercise && (
              <TouchableOpacity
                style={[styles.loggingButton, styles.loggingButtonPrimary]}
                onPress={handleSaveExerciseLogs}
              >
                <Text style={styles.loggingButtonText}>Continue to Next Exercise</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.loggingButton,
                isLastExercise ? styles.loggingButtonPrimary : styles.loggingButtonSecondary
              ]}
              onPress={handleSaveExerciseLogs}
            >
              <Text style={[
                styles.loggingButtonText,
                !isLastExercise && styles.loggingButtonTextSecondary
              ]}>
                {isLastExercise ? 'Finish Workout' : 'Save & Finish Workout'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const current = getCurrentExercise();
  if (!current) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No exercises found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { exercise, exerciseIndex, progress: exerciseProgress, detail } = current;
  const setIndex = progress.currentSetIndex;
  const totalSets = exercise.target_sets || 3;
  const currentSet = exerciseProgress?.sets[setIndex];
  const isSetComplete = currentSet?.completed || false;
  const isTimed = detail?.is_timed || false;
  const allSetsComplete = exerciseProgress?.sets.every(s => s.completed) || false;
  const restTime = exercise.rest_time_sec || 60;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{day} Workout</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X color="#9ca3af" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressBar}>
        <Text style={styles.progressText}>
          Exercise {exerciseIndex + 1} of {exercises.length}
        </Text>
        <View style={styles.progressBarFill}>
          <View 
            style={[
              styles.progressBarInner, 
              { width: `${((exerciseIndex + 1) / exercises.length) * 100}%` }
            ]} 
          />
        </View>
      </View>

      <View style={styles.exerciseContainer}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.setNumber}>Set {setIndex + 1} of {totalSets}</Text>

        <View style={styles.exerciseInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Target:</Text>
            <Text style={styles.infoValue}>
              {isTimed 
                ? `${detail?.default_duration_sec || 60}s` 
                : `${exercise.target_reps || '8-12'} reps`}
            </Text>
          </View>
          {!isTimed && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Weight:</Text>
              <Text style={styles.infoValue}>Bodyweight</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rest:</Text>
            <Text style={styles.infoValue}>{restTime} seconds</Text>
          </View>
        </View>

        {exercise.notes && (
          <View style={styles.instructionsSection}>
            <Text style={styles.instructionsTitle}>Focus:</Text>
            <Text style={styles.instructionsText}>{exercise.notes}</Text>
          </View>
        )}

        {detail?.description && (
          <View style={styles.instructionsSection}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instructionsText}>{detail.description}</Text>
          </View>
        )}

        {/* Exercise Timer */}
        {exerciseTimer?.active && (
          <View style={styles.exerciseTimerContainer}>
            <Clock color="#10b981" size={32} />
            <Text style={styles.exerciseTimerText}>
              {formatTime(exerciseTimer.seconds)}
            </Text>
            <TouchableOpacity
              style={styles.completeTimerButton}
              onPress={handleCompleteTimedExercise}
            >
              <Text style={styles.completeTimerButtonText}>Complete Exercise</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rest Timer */}
        {restTimer && restTimer.active && (
          <View style={styles.restTimerContainer}>
            <Clock color="#3b82f6" size={32} />
            <Text style={styles.restTimerText}>
              Rest: {formatTime(restTimer.seconds)}
            </Text>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                setRestTimer(null);
                handleRestComplete();
              }}
            >
              <SkipForward color="#3b82f6" size={20} />
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        {!exerciseTimer?.active && !restTimer?.active && !allSetsComplete && (
          <View style={styles.actionButtons}>
            {!isSetComplete && (
              <TouchableOpacity
                style={styles.completeSetButton}
                onPress={handleStartSet}
              >
                <Text style={styles.completeSetButtonText}>Complete Set</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  progressBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  progressText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#1f2937',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  exerciseContainer: {
    flex: 1,
    padding: 24,
  },
  exerciseName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  setNumber: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: '600',
    marginBottom: 24,
  },
  exerciseInfo: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 16,
  },
  infoValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsSection: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  instructionsTitle: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseTimerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#065f46',
    borderRadius: 16,
    marginBottom: 16,
  },
  exerciseTimerText: {
    color: '#10b981',
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  completeTimerButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  completeTimerButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  restTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#1e3a8a',
    borderRadius: 16,
    marginBottom: 16,
  },
  restTimerText: {
    color: '#60a5fa',
    fontSize: 32,
    fontWeight: 'bold',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  completeSetButton: {
    backgroundColor: '#2563eb',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeSetButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loggingContainer: {
    flex: 1,
    padding: 24,
  },
  loggingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
  },
  loggingSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 24,
  },
  setLogCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  setLogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  logInputGroup: {
    marginBottom: 0,
  },
  logInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  logInputHalf: {
    flex: 1,
  },
  logLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  logInput: {
    backgroundColor: '#111827',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 16,
  },
  targetHint: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  loggingButtons: {
    marginTop: 'auto',
    paddingTop: 24,
    gap: 12,
  },
  loggingButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggingButtonPrimary: {
    backgroundColor: '#2563eb',
  },
  loggingButtonSecondary: {
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  loggingButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  loggingButtonTextSecondary: {
    color: '#3b82f6',
  },
});
