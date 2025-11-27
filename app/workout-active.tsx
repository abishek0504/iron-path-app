import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Check, Clock, Play, SkipForward, TrendingUp, TrendingDown } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ExerciseDetail {
  is_timed: boolean;
  default_duration_sec: number | null;
  description: string | null;
  equipment_needed?: string[];
}

const BODYWEIGHT_EXERCISES = [
  'Pull Up', 'Pull-Up', 'Pullup', 'Chin Up', 'Chin-Up',
  'Push Up', 'Push-Up', 'Pushup',
  'Dip', 'Dips',
  'Sit Up', 'Sit-Up', 'Situp',
  'Crunch', 'Crunches',
  'Plank', 'Planks',
  'Burpee', 'Burpees',
  'Mountain Climber', 'Mountain Climbers',
  'Bodyweight Squat', 'Air Squat',
  'Lunge', 'Lunges', // Can be bodyweight
  'Jumping Jack', 'Jumping Jacks',
  'Pistol Squat',
  'Handstand Push Up', 'Handstand Push-Up',
  'Muscle Up', 'Muscle-Up'
];

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
  const [setLogs, setSetLogs] = useState<Array<{ reps: string; weight: string; duration: string; notes: string }>>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLoggingExitConfirm, setShowLoggingExitConfirm] = useState(false);

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
            // Auto-advance to next set - use setTimeout to ensure state updates are processed
            setTimeout(() => {
              handleRestComplete();
            }, 0);
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

  const reconstructProgressFromLogs = async (
    exercises: any[],
    currentExerciseIndex: number,
    currentSetIndex: number,
    planId: number,
    day: string,
    userId: string,
    sessionId: number | null = null
  ): Promise<WorkoutProgress> => {
    // Use SQL aggregation to count sets per exercise for this session
    // This is more efficient than fetching all logs and counting in memory
    let query = supabase
      .from('workout_logs')
      .select('exercise_name')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('day', day);
    
    // Filter by session_id if provided to avoid cross-session contamination
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: logs } = await query;

    // Initialize progress structure
    const progress: WorkoutProgress = {
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
      currentExerciseIndex,
      currentSetIndex
    };

    // Count completed exercises based on logs using SQL aggregation
    // An exercise is complete if we have logs for all its sets
    if (logs) {
      // Count logs per exercise using Map (more efficient than multiple queries)
      const exerciseLogCounts = new Map<string, number>();
      logs.forEach(log => {
        const count = exerciseLogCounts.get(log.exercise_name) || 0;
        exerciseLogCounts.set(log.exercise_name, count + 1);
      });

      exercises.forEach((exercise, index) => {
        const logCount = exerciseLogCounts.get(exercise.name) || 0;
        const targetSets = exercise.target_sets || 3;
        if (logCount >= targetSets) {
          progress.exercises[index].completed = true;
          // Mark all sets as completed
          progress.exercises[index].sets.forEach(set => {
            set.completed = true;
          });
        }
      });
    }

    return progress;
  };

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

      // Load exercise details from exercises and user_exercises tables using batch queries
      const detailsMap = new Map<string, ExerciseDetail>();
      const exerciseNames = dayData.exercises.map((ex: any) => ex.name);
      
      if (exerciseNames.length > 0) {
        // Batch query all exercises from master exercises table
        const { data: masterExercises } = await supabase
          .from('exercises')
          .select('name, is_timed, default_duration_sec, description, equipment_needed')
          .in('name', exerciseNames);

        // Batch query all user exercises
        const { data: userExercises } = await supabase
          .from('user_exercises')
          .select('name, is_timed, default_duration_sec, description, equipment_needed')
          .eq('user_id', user.id)
          .in('name', exerciseNames);

        // Create maps for quick lookup
        const masterExerciseMap = new Map(
          (masterExercises || []).map(ex => [ex.name, ex])
        );
        const userExerciseMap = new Map(
          (userExercises || []).map(ex => [ex.name, ex])
        );

        // Merge results: user exercises take precedence over master exercises
        for (const exercise of dayData.exercises) {
          const userExercise = userExerciseMap.get(exercise.name);
          const masterExercise = masterExerciseMap.get(exercise.name);
          
          if (userExercise) {
            detailsMap.set(exercise.name, {
              is_timed: userExercise.is_timed || false,
              default_duration_sec: userExercise.default_duration_sec,
              description: userExercise.description,
              equipment_needed: userExercise.equipment_needed || []
            });
          } else if (masterExercise) {
            detailsMap.set(exercise.name, {
              is_timed: masterExercise.is_timed || false,
              default_duration_sec: masterExercise.default_duration_sec,
              description: masterExercise.description,
              equipment_needed: masterExercise.equipment_needed || []
            });
          } else {
            // Default values if not found in either table
            detailsMap.set(exercise.name, {
              is_timed: false,
              default_duration_sec: null,
              description: null,
              equipment_needed: []
            });
          }
        }
      }
      setExerciseDetails(detailsMap);

      // Check for existing active workout session
      const { data: existingSession, error: sessionQueryError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', parseInt(planId))
        .eq('day', day)
        .eq('status', 'active')
        .maybeSingle();

      if (sessionQueryError && sessionQueryError.code !== 'PGRST116') {
        // Only log if it's not a "table not found" error
        if (!sessionQueryError.message?.includes('schema cache') && !sessionQueryError.message?.includes('Could not find the table')) {
          console.error('Error querying session:', JSON.stringify(sessionQueryError, null, 2));
        }
      }

      // Initialize progress from plan
      const initialProgress = initializeProgress(dayData.exercises);
      
      if (existingSession) {
        setWorkoutSession(existingSession);
        // Reconstruct progress from logs and session position
        // Handle both old schema (with progress) and new schema (with current_exercise_index)
        const currentExerciseIndex = existingSession.current_exercise_index ?? 
          (existingSession.progress?.currentExerciseIndex ?? 0);
        const currentSetIndex = existingSession.current_set_index ?? 
          (existingSession.progress?.currentSetIndex ?? 0);
        
        const reconstructedProgress = await reconstructProgressFromLogs(
          dayData.exercises,
          currentExerciseIndex,
          currentSetIndex,
          parseInt(planId),
          day,
          user.id,
          existingSession.id
        );
        setProgress(reconstructedProgress);
      } else {
        // Check AsyncStorage for local progress
        const localProgress = await AsyncStorage.getItem(`workout_session_${planId}_${day}`);
        if (localProgress) {
          try {
            const parsed = JSON.parse(localProgress);
            setProgress(parsed);
          } catch {
            setProgress(initialProgress);
          }
        } else {
          // Create new workout session with minimal state
          try {
            const { data: newSession, error: sessionError } = await supabase
              .from('workout_sessions')
              .insert([{
                user_id: user.id,
                plan_id: parseInt(planId),
                day: day,
                status: 'active',
                current_exercise_index: 0,
                current_set_index: 0
              }])
              .select()
              .single();

            if (sessionError) {
              // Only log if it's not a "table not found" error (table might not exist yet)
              if (!sessionError.message?.includes('schema cache') && !sessionError.message?.includes('Could not find the table')) {
                console.error('Error creating session:', JSON.stringify(sessionError, null, 2));
              }
            } else {
              setWorkoutSession(newSession);
            }
          } catch (error: any) {
            console.error('Error creating session:', error?.message || error);
          }
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
    // Always save to AsyncStorage for fast local access
    await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(updatedProgress));
    setProgress(updatedProgress);

    // Save only current position to database (minimal state)
    if (workoutSession) {
      try {
        const { error } = await supabase
          .from('workout_sessions')
          .update({
            current_exercise_index: updatedProgress.currentExerciseIndex,
            current_set_index: updatedProgress.currentSetIndex
          })
          .eq('id', workoutSession.id);

        if (error && !error.message?.includes('schema cache') && !error.message?.includes('Could not find the table')) {
          console.error('Error saving session position:', error);
        }
      } catch (error) {
        // Silently fail - AsyncStorage is our fallback
      }
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
    const totalSets = exercise.target_sets || 3;
    const allSetsComplete = updatedProgress.exercises[exerciseIndex].sets.every(s => s.completed);
    
    // Also check if we've reached the last set (prevent going past target)
    const isLastSet = setIndex >= totalSets - 1;
    
    if (allSetsComplete || isLastSet) {
      // Show logging screen
      const lastWeight = await getLastWeight(exercise.name);
      setSetLogs(Array.from({ length: totalSets }, () => ({
        reps: '',
        weight: lastWeight ? lastWeight.toString() : '',
        duration: '',
        notes: ''
      })));
      setCompletedExerciseIndex(exerciseIndex);
      setShowLoggingScreen(true);
      setExerciseTimer(null);
    } else {
      // Move to next set and start rest timer (only if not at last set)
      const nextSetIndex = setIndex + 1;
      if (nextSetIndex < totalSets) {
        updatedProgress.currentSetIndex = nextSetIndex;
        await saveProgress(updatedProgress);
        
        // Start rest timer
        const restTime = exercise.rest_time_sec || 60;
        setRestTimer({ active: true, seconds: restTime });
        setExerciseTimer(null);
      }
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
      const logData = setLogs[i] || {};
      if (isTimed) {
        updatedProgress.exercises[completedExerciseIndex].sets[i].duration = parseInt(logData.duration) || 0;
      } else {
        updatedProgress.exercises[completedExerciseIndex].sets[i].reps = parseInt(logData.reps) || 0;
        updatedProgress.exercises[completedExerciseIndex].sets[i].weight = parseFloat(logData.weight) || null;
      }
    }

    // Save to workout_logs
    await saveSetsToLogs(exercise, updatedProgress.exercises[completedExerciseIndex].sets, setLogs);
    
    updatedProgress.exercises[completedExerciseIndex].completed = true;
    
    // Move to next exercise or finish workout
    if (completedExerciseIndex < exercises.length - 1) {
      updatedProgress.currentExerciseIndex = completedExerciseIndex + 1;
      updatedProgress.currentSetIndex = 0;
      await saveProgress(updatedProgress);
      setProgress(updatedProgress);
      setShowLoggingScreen(false);
      setCompletedExerciseIndex(null);
      setSetLogs([]);
    } else {
      // Workout complete - mark all exercises as complete
      updatedProgress.exercises.forEach(ex => ex.completed = true);
      await saveProgress(updatedProgress);
      
      if (workoutSession) {
        await supabase
          .from('workout_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            current_exercise_index: updatedProgress.currentExerciseIndex,
            current_set_index: updatedProgress.currentSetIndex
          })
          .eq('id', workoutSession.id);
      }
      
      // Clear AsyncStorage
      await AsyncStorage.removeItem(`workout_session_${planId}_${day}`);
      
      // Update state to trigger completion screen
      setProgress(updatedProgress);
      setShowLoggingScreen(false);
      setCompletedExerciseIndex(null);
      setSetLogs([]);
    }
  };


  const saveSetsToLogs = async (exercise: any, sets: SetProgress[], logs: Array<{ reps: string; weight: string; duration: string; notes: string }>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Parse target reps to get a numeric value for comparison
      // For ranges like "8-12", we'll store the minimum as scheduled_reps
      const parseTargetReps = (target: string): number | null => {
        if (!target) return null;
        if (target.includes('-')) {
          const [min] = target.split('-').map(n => parseInt(n.trim()));
          return min || null;
        }
        const parsed = parseInt(target);
        return isNaN(parsed) ? null : parsed;
      };
      
      // Parse target duration for timed exercises
      const parseTargetDuration = (target: string): number | null => {
        if (!target) return null;
        const parsed = parseInt(target);
        return isNaN(parsed) ? null : parsed;
      };
      
      const scheduledReps = exercise.is_timed ? null : parseTargetReps(exercise.target_reps || '8-12');
      // For scheduled_weight: 0 for bodyweight exercises, null for timed exercises
      // Weighted exercises will have weight logged by user, scheduled_weight is 0 to indicate "not bodyweight" or can be null
      const scheduledWeight = exercise.is_timed ? null : 0;
      const scheduledDuration = exercise.is_timed ? parseTargetDuration(exercise.target_duration || exercise.default_duration_sec?.toString()) : null;

      const dbLogs = sets
        .filter(s => s.completed)
        .map((set, index) => {
          const logData = logs[index] || {};
          const notesParts = [];
          if (logData.notes) notesParts.push(logData.notes);
          
          // For timed exercises, use duration in reps field; for others, use weight/reps
          const isTimed = exercise.is_timed || false;
          const weight = isTimed ? null : (set.weight ? parseFloat(set.weight.toString()) : (scheduledWeight ?? null));
          const reps = isTimed ? (set.duration ? parseFloat(set.duration.toString()) : (scheduledDuration ?? null)) : (set.reps ? parseFloat(set.reps.toString()) : (scheduledReps ?? null));
          
          return {
            user_id: user.id,
            exercise_name: exercise.name,
            plan_id: parseInt(planId),
            day: day,
            session_id: workoutSession?.id || null,
            // For timed exercises, duration is stored in reps field
            weight: weight,
            reps: reps,
            scheduled_reps: scheduledReps,
            scheduled_weight: scheduledWeight,
            notes: notesParts.length > 0 ? notesParts.join(' | ') : null
          };
        });

      if (dbLogs.length > 0) {
        await supabase.from('workout_logs').insert(dbLogs);
      }
    } catch (error) {
      console.error('Error saving to workout_logs:', error);
    }
  };

  const handleRestComplete = () => {
    setRestTimer(null);
    // Progress was updated in handleCompleteSet before timer started
    // Force a state update to ensure UI reflects the current set index
    setProgress(prev => ({ ...prev }));
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

  const isBodyweightExercise = (exerciseName: string, detail: ExerciseDetail | undefined): boolean => {
    // Check if exercise name matches common bodyweight exercises
    const nameMatch = BODYWEIGHT_EXERCISES.some(bw => 
      exerciseName.toLowerCase().includes(bw.toLowerCase())
    );
    
    // Check if equipment_needed is empty or only contains bodyweight-related items
    const equipment = detail?.equipment_needed || [];
    const hasNoEquipment = equipment.length === 0 || 
      equipment.every(eq => eq.toLowerCase().includes('bodyweight') || eq.toLowerCase().includes('none'));
    
    return nameMatch || hasNoEquipment;
  };

  const handleCloseWorkout = useCallback(() => {
    // Check if workout is complete - if so, just navigate back
    const allExercisesComplete = progress.exercises.length > 0 && progress.exercises.every(ex => ex.completed);
    if (allExercisesComplete) {
      router.back();
      return;
    }
    
    // Show confirmation modal
    setShowExitConfirm(true);
  }, [progress]);

  const handleConfirmExit = useCallback(async () => {
    setShowExitConfirm(false);
    try {
      // Save current progress before exiting
      await saveProgress(progress);
      
      // Ensure session status is 'active' so user can resume
      if (workoutSession) {
        const { error: updateError } = await supabase
          .from('workout_sessions')
          .update({ 
            status: 'active',
            current_exercise_index: progress.currentExerciseIndex,
            current_set_index: progress.currentSetIndex
          })
          .eq('id', workoutSession.id);
        
        if (updateError) {
          console.error('Error updating session status:', updateError);
        }
      }
      
      // Small delay to ensure database update completes
      await new Promise(resolve => setTimeout(resolve, 100));
      router.back();
    } catch (error) {
      console.error('Error saving progress on exit:', error);
      router.back();
    }
  }, [progress, router, workoutSession]);

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
    const isBodyweight = isBodyweightExercise(exercise.name, detail);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log {exercise.name}</Text>
          <View style={{ position: 'relative' }}>
            <Pressable 
              onPress={(e) => {
                e?.stopPropagation?.();
                setShowLoggingExitConfirm(true);
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={({ pressed }) => [
                { 
                  opacity: pressed ? 0.7 : 1,
                  padding: 8,
                  borderRadius: 4
                }
              ]}
            >
              <X color="#9ca3af" size={24} />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.loggingScrollView} contentContainerStyle={styles.loggingContainer}>
          <Text style={styles.loggingTitle}>All sets complete!</Text>
          <Text style={styles.loggingSubtitle}>Log your results and compare to target</Text>

          {Array.from({ length: totalSets }, (_, setIndex) => {
            const targetReps = exercise.target_reps || '8-12';
            const loggedReps = setLogs[setIndex]?.reps || '';
            const loggedWeight = setLogs[setIndex]?.weight || '';
            const loggedDuration = setLogs[setIndex]?.duration || '';
            const targetDuration = detail?.default_duration_sec || 60;
            
            // Parse target reps (handle ranges like "8-12")
            const parseTargetReps = (target: string): { min: number; max: number } => {
              if (target.includes('-')) {
                const [min, max] = target.split('-').map(n => parseInt(n.trim()));
                return { min: min || 8, max: max || 12 };
              }
              const num = parseInt(target);
              return { min: num || 8, max: num || 12 };
            };
            
            const targetRepsRange = parseTargetReps(targetReps);
            const actualReps = loggedReps ? parseInt(loggedReps) : null;
            const repsMatch = actualReps !== null && !isNaN(actualReps) && actualReps >= targetRepsRange.min && actualReps <= targetRepsRange.max;
            const actualDuration = parseInt(loggedDuration);
            const durationMatch = actualDuration >= targetDuration * 0.9 && actualDuration <= targetDuration * 1.1;

            return (
              <View key={setIndex} style={styles.setLogCard}>
                <Text style={styles.setLogTitle}>Set {setIndex + 1} of {totalSets}</Text>
                
                {/* Scheduled/Target Values */}
                <View style={styles.targetSection}>
                  <Text style={styles.targetSectionTitle}>Scheduled</Text>
                  <View style={styles.targetRow}>
                    {isTimed ? (
                      <View style={styles.targetItem}>
                        <Text style={styles.targetLabel}>Duration:</Text>
                        <Text style={styles.targetValue}>{targetDuration}s</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.targetItem}>
                          <Text style={styles.targetLabel}>Reps:</Text>
                          <Text style={styles.targetValue}>{targetReps}</Text>
                        </View>
                        <View style={styles.targetItem}>
                          <Text style={styles.targetLabel}>Weight:</Text>
                          <Text style={styles.targetValue}>
                            {isBodyweight ? 'Bodyweight' : 'Weighted'}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {/* Logged Values */}
                <View style={styles.loggedSection}>
                  <Text style={styles.loggedSectionTitle}>Logged</Text>
                  {isTimed ? (
                    <View style={styles.logInputGroup}>
                      <Text style={styles.logLabel}>Duration (seconds)</Text>
                        <View style={styles.inputWithComparison}>
                          <TextInput
                            style={[
                              styles.logInput,
                              styles.logInputFlex,
                              loggedDuration && !durationMatch && styles.logInputWarning
                            ]}
                            value={loggedDuration}
                            onChangeText={(text) => {
                              const newLogs = [...setLogs];
                              newLogs[setIndex] = { ...newLogs[setIndex], duration: text, notes: newLogs[setIndex]?.notes || '' };
                              setSetLogs(newLogs);
                            }}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#6b7280"
                          />
                          {loggedDuration && (
                            <View style={styles.comparisonBadge}>
                              {durationMatch ? (
                                <Check color="#10b981" size={16} />
                              ) : (
                                <TrendingDown color="#ef4444" size={16} />
                              )}
                              <Text style={[styles.comparisonText, durationMatch ? styles.comparisonTextGood : styles.comparisonTextBad]}>
                                {actualDuration >= targetDuration ? 'Met' : 'Below'}
                              </Text>
                            </View>
                          )}
                        </View>
                    </View>
                  ) : (
                    <View style={styles.logInputRow}>
                      <View style={styles.logInputHalf}>
                        <Text style={styles.logLabel}>Weight (lbs)</Text>
                        <TextInput
                          style={[
                            styles.logInput,
                            isBodyweight && styles.logInputDisabled
                          ]}
                          value={loggedWeight}
                          onChangeText={(text) => {
                            if (!isBodyweight) {
                              const newLogs = [...setLogs];
                              newLogs[setIndex] = { ...newLogs[setIndex], weight: text, notes: newLogs[setIndex]?.notes || '' };
                              setSetLogs(newLogs);
                            }
                          }}
                          keyboardType="numeric"
                          placeholder={isBodyweight ? "Bodyweight" : "0"}
                          placeholderTextColor="#6b7280"
                          editable={!isBodyweight}
                        />
                      </View>
                      <View style={styles.logInputHalf}>
                        <Text style={styles.logLabel}>Reps</Text>
                        <View style={styles.inputWithComparison}>
                          <TextInput
                            style={[
                              styles.logInput,
                              styles.logInputFlex
                            ]}
                            value={loggedReps}
                            onChangeText={(text) => {
                              const newLogs = [...setLogs];
                              newLogs[setIndex] = { ...newLogs[setIndex], reps: text, notes: newLogs[setIndex]?.notes || '' };
                              setSetLogs(newLogs);
                            }}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#6b7280"
                          />
                          {loggedReps && actualReps !== null && !isNaN(actualReps) && (
                            <View style={styles.comparisonBadge}>
                              {repsMatch ? (
                                <Check color="#10b981" size={16} />
                              ) : actualReps > targetRepsRange.max ? (
                                <TrendingUp color="#3b82f6" size={16} />
                              ) : (
                                <TrendingDown color="#ef4444" size={16} />
                              )}
                              <Text style={[
                                styles.comparisonText,
                                repsMatch ? styles.comparisonTextGood : 
                                actualReps > targetRepsRange.max ? styles.comparisonTextBetter : 
                                styles.comparisonTextBad
                              ]}>
                                {repsMatch ? 'Met' : actualReps > targetRepsRange.max ? 'Above' : 'Below'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                  
                  {/* Notes Input */}
                  <View style={styles.logInputGroup}>
                    <Text style={styles.logLabel}>Notes (optional)</Text>
                    <TextInput
                      style={[styles.logInput, styles.logInputMultiline]}
                      value={setLogs[setIndex]?.notes || ''}
                      onChangeText={(text) => {
                        const newLogs = [...setLogs];
                        newLogs[setIndex] = { ...newLogs[setIndex], notes: text, reps: newLogs[setIndex]?.reps || '', weight: newLogs[setIndex]?.weight || '', duration: newLogs[setIndex]?.duration || '' };
                        setSetLogs(newLogs);
                      }}
                      placeholder="How did this set feel? Any issues?"
                      placeholderTextColor="#6b7280"
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.loggingButtons}>
            <TouchableOpacity
              style={[styles.loggingButton, styles.loggingButtonPrimary]}
              onPress={handleSaveExerciseLogs}
            >
              <Text style={styles.loggingButtonText}>
                {isLastExercise ? 'Finish Workout' : 'Continue to Next Exercise'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  const isBodyweight = isBodyweightExercise(exercise.name, detail);
  
  // Check if all exercises are completed
  const allExercisesComplete = progress.exercises.every(ex => ex.completed);

  // Show completion screen if all exercises are done
  if (allExercisesComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{day} Workout</Text>
          <View style={{ position: 'relative' }}>
            <Pressable 
              onPress={(e) => {
                e?.stopPropagation?.();
                console.log('X button pressed - completion screen');
                router.back();
              }}
              onPressIn={(e) => {
                e?.stopPropagation?.();
                console.log('X button press started - completion');
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={({ pressed }) => [
                { 
                  opacity: pressed ? 0.7 : 1,
                  padding: 8,
                  borderRadius: 4
                }
              ]}
            >
              <X color="#9ca3af" size={24} />
            </Pressable>
          </View>
        </View>
        <View style={styles.completionContainer}>
          <Text style={styles.completionTitle}>Workout Complete! 🎉</Text>
          <Text style={styles.completionSubtitle}>Great job completing your workout!</Text>
          <TouchableOpacity
            style={styles.completeWorkoutButton}
            onPress={() => router.back()}
          >
            <Text style={styles.completeWorkoutButtonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Exit Workout?</Text>
            <Text style={styles.modalMessage}>Your progress will be saved. You can resume later.</Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowExitConfirm(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmExit}
              >
                <Text style={styles.modalButtonText}>Exit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logging Exit Confirmation Modal */}
      <Modal
        visible={showLoggingExitConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLoggingExitConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Exit Logging?</Text>
            <Text style={styles.modalMessage}>Your logged data will not be saved. Continue logging?</Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowLoggingExitConfirm(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={() => {
                  setShowLoggingExitConfirm(false);
                  setShowLoggingScreen(false);
                  setCompletedExerciseIndex(null);
                  setSetLogs([]);
                }}
              >
                <Text style={styles.modalButtonText}>Exit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{day} Workout</Text>
        <View style={{ position: 'relative' }}>
          <Pressable 
            onPress={(e) => {
              e?.stopPropagation?.();
              handleCloseWorkout();
            }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            style={({ pressed }) => [
              { 
                opacity: pressed ? 0.7 : 1,
                padding: 8,
                borderRadius: 4
              }
            ]}
          >
            <X color="#9ca3af" size={24} />
          </Pressable>
        </View>
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
              <Text style={styles.infoValue}>{isBodyweight ? 'Bodyweight' : 'Weighted'}</Text>
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
  loggingScrollView: {
    flex: 1,
  },
  loggingContainer: {
    padding: 24,
    paddingBottom: 40,
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  setLogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  targetSection: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  targetSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 16,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  targetValue: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  loggedSection: {
    marginTop: 8,
  },
  loggedSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
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
  logInputFlex: {
    flex: 1,
  },
  logInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  logInputWarning: {
    borderColor: '#ef4444',
  },
  inputWithComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  comparisonTextGood: {
    color: '#10b981',
  },
  comparisonTextBetter: {
    color: '#3b82f6',
  },
  comparisonTextBad: {
    color: '#ef4444',
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
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 16,
  },
  completionSubtitle: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
  },
  completeWorkoutButton: {
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  completeWorkoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logInputDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#374151',
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalButtonConfirm: {
    backgroundColor: '#2563eb',
  },
  modalButtonDanger: {
    backgroundColor: '#dc2626',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonTextCancel: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
