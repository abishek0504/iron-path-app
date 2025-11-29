import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Check, Clock, Play, SkipForward, TrendingUp, TrendingDown, Pause } from 'lucide-react-native';
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

  const safeBack = () => {
    try {
      // Use replace to prevent navigation stacking
      router.replace('/(tabs)/home');
    } catch (error) {
      router.replace('/(tabs)/home');
    }
  };
  
  const [plan, setPlan] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, ExerciseDetail>>(new Map());
  const [workoutSession, setWorkoutSession] = useState<any>(null);
  const [progress, setProgress] = useState<WorkoutProgress>({ exercises: [], currentExerciseIndex: 0, currentSetIndex: 0 });
  const [loading, setLoading] = useState(true);
  
  // Timer states
  const [restTimer, setRestTimer] = useState<{ active: boolean; seconds: number } | null>(null);
  const [exerciseTimer, setExerciseTimer] = useState<{ active: boolean; seconds: number; countdown: boolean; targetDuration: number; paused: boolean } | null>(null);
  const restTimerInterval = useRef<NodeJS.Timeout | null>(null);
  const exerciseTimerInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Exercise completion logging
  const [showLoggingScreen, setShowLoggingScreen] = useState(false);
  const [completedExerciseIndex, setCompletedExerciseIndex] = useState<number | null>(null);
  const [setLogs, setSetLogs] = useState<Array<{ reps: string; weight: string; duration: string; notes: string }>>([]);
  const [durationMinutes, setDurationMinutes] = useState<Map<number, string>>(new Map());
  const [durationSeconds, setDurationSeconds] = useState<Map<number, string>>(new Map());
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
    if (exerciseTimer?.active && !exerciseTimer?.paused) {
      exerciseTimerInterval.current = setInterval(() => {
        setExerciseTimer(prev => {
          if (!prev) return null;
          
          if (prev.countdown) {
            // 3-second countdown phase
            if (prev.seconds <= 1) {
              // Countdown finished, start exercise timer
              return {
                active: true,
                seconds: prev.targetDuration,
                countdown: false,
                targetDuration: prev.targetDuration,
                paused: false
              };
            }
            return { ...prev, seconds: prev.seconds - 1 };
          } else {
            // Exercise countdown phase
            if (prev.seconds <= 1) {
              // Timer finished - keep active but set to 0 so UI shows complete button
              return { ...prev, seconds: 0, active: true, paused: false };
            }
            return { ...prev, seconds: prev.seconds - 1 };
          }
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
  }, [exerciseTimer?.active, exerciseTimer?.paused]);

  // Ensure duration maps are initialized when logging screen is shown
  useEffect(() => {
    if (showLoggingScreen && completedExerciseIndex !== null) {
      const exercise = exercises[completedExerciseIndex];
      const detail = exerciseDetails.get(exercise.name);
      const isTimed = detail?.is_timed || false;
      
      if (isTimed) {
        const targetDuration = exercise.target_duration_sec || detail?.default_duration_sec || 60;
        const totalSets = exercise.target_sets || 3;
        
        // Check if maps need initialization
        let needsInit = false;
        for (let i = 0; i < totalSets; i++) {
          if (!durationMinutes.has(i) || !durationSeconds.has(i)) {
            needsInit = true;
            break;
          }
        }
        
        if (needsInit) {
          const minsMap = new Map(durationMinutes);
          const secsMap = new Map(durationSeconds);
          for (let i = 0; i < totalSets; i++) {
            if (!minsMap.has(i) || !secsMap.has(i)) {
              const mins = Math.floor(targetDuration / 60);
              const secs = targetDuration % 60;
              minsMap.set(i, mins.toString());
              secsMap.set(i, secs.toString());
            }
          }
          setDurationMinutes(minsMap);
          setDurationSeconds(secsMap);
        }
      }
    }
  }, [showLoggingScreen, completedExerciseIndex, exercises, exerciseDetails]);

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
        safeBack();
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
        safeBack();
        return;
      }

      setPlan(planData);
      const dayData = planData.plan_data?.week_schedule?.[day];
      if (!dayData || !dayData.exercises) {
        Alert.alert("Error", "No exercises found for this day.");
        safeBack();
        return;
      }

      setExercises(dayData.exercises);

      // Load exercise details from exercises and user_exercises tables using batch queries
      const detailsMap = new Map<string, ExerciseDetail>();
      const exerciseNames = dayData.exercises.map((ex: any) => ex.name);
      
      if (exerciseNames.length > 0) {
        // Batch query all exercises from master exercises table
        // Note: exercises table doesn't have default_duration_sec, only user_exercises does
        const { data: masterExercises } = await supabase
          .from('exercises')
          .select('name, is_timed, description, equipment_needed')
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
          // Try exact match first
          let userExercise = userExerciseMap.get(exercise.name);
          let masterExercise = masterExerciseMap.get(exercise.name);
          
          // If not found, try case-insensitive match
          if (!userExercise && !masterExercise) {
            for (const [name, ex] of userExerciseMap.entries()) {
              if (name.toLowerCase() === exercise.name.toLowerCase()) {
                userExercise = ex;
                break;
              }
            }
            if (!masterExercise) {
              for (const [name, ex] of masterExerciseMap.entries()) {
                if (name.toLowerCase() === exercise.name.toLowerCase()) {
                  masterExercise = ex;
                  break;
                }
              }
            }
          }
          
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
              default_duration_sec: null, // Master exercises table doesn't have default_duration_sec, use null (will default to 60 in code)
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
      console.log('Workout-active: Exercise details loaded:', Array.from(detailsMap.entries()));

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

    console.log(`handleStartSet - Exercise: ${exercise.name}, isTimed: ${isTimed}, detail:`, detail);
    console.log(`Exercise details map size: ${exerciseDetails.size}, keys:`, Array.from(exerciseDetails.keys()));

    if (isTimed) {
      // Start 3-second countdown, then countdown from target duration
      const targetDuration = exercise.target_duration_sec || detail?.default_duration_sec || 60;
      console.log(`Starting timer for timed exercise. Target duration: ${targetDuration}`);
      setExerciseTimer({ 
        active: true, 
        seconds: 3, // Start with 3-second countdown
        countdown: true,
        targetDuration: targetDuration,
        paused: false
      });
    } else {
      // Just mark set as complete (no logging yet)
      handleCompleteSet();
    }
  };

  const handleCompleteTimedExercise = () => {
    if (!exerciseTimer) return;
    // Timer completed - save target duration
    setExerciseTimer(null);
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
    
    // For timed exercises, save the target duration if timer completed, or 0 if skipped
    const detail = exerciseDetails.get(exercise.name);
    const isTimed = detail?.is_timed || false;
    let duration = null;
    if (isTimed && exerciseTimer) {
      if (exerciseTimer.seconds === 0 && !exerciseTimer.countdown) {
        // Timer completed - save target duration
        duration = exerciseTimer.targetDuration;
      } else {
        // Timer was skipped - save 0
        duration = 0;
      }
    } else if (isTimed) {
      // Timer was cleared (skipped) - save 0
      duration = 0;
    }
    
    updatedProgress.exercises[exerciseIndex].sets[setIndex] = {
      setIndex,
      completed: true,
      reps: null, // Will be filled in logging screen
      weight: null,
      duration: duration
    };

    // Check if all sets are complete for this exercise
    const totalSets = exercise.target_sets || 3;
    const allSetsComplete = updatedProgress.exercises[exerciseIndex].sets.every(s => s.completed);
    
    // Also check if we've reached the last set (prevent going past target)
    const isLastSet = setIndex >= totalSets - 1;
    
    if (allSetsComplete || isLastSet) {
      // Show logging screen
      const lastWeight = await getLastWeight(exercise.name);
      const detail = exerciseDetails.get(exercise.name);
      const isTimed = detail?.is_timed || false;
      
      // Initialize logs with target values (user can edit if different)
      // target_reps is now always numeric
      const targetDuration = exercise.target_duration_sec || detail?.default_duration_sec || 60;
      const targetRepsValue = typeof exercise.target_reps === 'number' 
        ? exercise.target_reps.toString() 
        : (typeof exercise.target_reps === 'string' ? (exercise.target_reps.includes('-') ? exercise.target_reps.split('-')[0].trim() : exercise.target_reps) : '10');
      
      const initialLogs = Array.from({ length: totalSets }, (_, i) => {
        return {
          reps: isTimed ? '' : targetRepsValue,
          weight: lastWeight ? lastWeight.toString() : '',
          duration: '',
          notes: ''
        };
      });
      
      setSetLogs(initialLogs);
      
      // Initialize duration minutes/seconds for timed exercises with target duration
      if (isTimed) {
        const minsMap = new Map<number, string>();
        const secsMap = new Map<number, string>();
        for (let i = 0; i < totalSets; i++) {
          // Always use target duration as default (user can edit if different)
          const mins = Math.floor(targetDuration / 60);
          const secs = targetDuration % 60;
          minsMap.set(i, mins.toString());
          secsMap.set(i, secs.toString());
        }
        setDurationMinutes(minsMap);
        setDurationSeconds(secsMap);
      }
      
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

    // Update progress with logged data - ensure all sets are marked as completed
    const updatedProgress = { ...progress };
    for (let i = 0; i < totalSets; i++) {
      const logData = setLogs[i] || {};
      if (isTimed) {
        // Convert minutes and seconds to total seconds
        const mins = durationMinutes.has(i) ? (parseInt(durationMinutes.get(i) || '0') || 0) : 0;
        const secs = durationSeconds.has(i) ? (parseInt(durationSeconds.get(i) || '0') || 0) : 0;
        const totalSeconds = mins * 60 + secs;
        updatedProgress.exercises[completedExerciseIndex].sets[i].duration = totalSeconds;
        updatedProgress.exercises[completedExerciseIndex].sets[i].completed = true; // Ensure set is marked as completed
      } else {
        const reps = parseInt(logData.reps) || 0;
        const weight = parseFloat(logData.weight) || null;
        updatedProgress.exercises[completedExerciseIndex].sets[i].reps = reps;
        updatedProgress.exercises[completedExerciseIndex].sets[i].weight = weight;
        updatedProgress.exercises[completedExerciseIndex].sets[i].completed = true; // Ensure set is marked as completed
      }
    }
    
    console.log(`Updated progress for exercise ${exercise.name}:`, updatedProgress.exercises[completedExerciseIndex].sets.map((s, i) => `Set ${i + 1}: completed=${s.completed}, duration=${s.duration}, reps=${s.reps}, weight=${s.weight}`));

    updatedProgress.exercises[completedExerciseIndex].completed = true;
    
    // Move to next exercise or finish workout
    if (completedExerciseIndex < exercises.length - 1) {
      // Save to workout_logs before moving to next exercise
      await saveSetsToLogs(exercise, updatedProgress.exercises[completedExerciseIndex].sets, setLogs);
      
      updatedProgress.currentExerciseIndex = completedExerciseIndex + 1;
      updatedProgress.currentSetIndex = 0;
      await saveProgress(updatedProgress);
      setProgress(updatedProgress);
      setShowLoggingScreen(false);
      setCompletedExerciseIndex(null);
      setSetLogs([]);
    } else {
      // Workout complete - mark session as completed FIRST, then save logs
      updatedProgress.exercises.forEach(ex => ex.completed = true);
      await saveProgress(updatedProgress);
      
      // Mark session as completed BEFORE saving logs to ensure it shows in progress
      if (workoutSession) {
        const { error: sessionError } = await supabase
          .from('workout_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            current_exercise_index: updatedProgress.currentExerciseIndex,
            current_set_index: updatedProgress.currentSetIndex
          })
          .eq('id', workoutSession.id);
        
        if (sessionError) {
          console.error('Error updating workout session:', sessionError);
        }
      }
      
      // Save to workout_logs AFTER session is marked as completed
      await saveSetsToLogs(exercise, updatedProgress.exercises[completedExerciseIndex].sets, setLogs);
      
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

      // Get exercise detail to check if timed
      const detail = exerciseDetails.get(exercise.name);
      const isTimed = detail?.is_timed || false;

      // For timed exercises: scheduled_reps contains target duration (in seconds)
      // For rep exercises: scheduled_reps contains target reps (now always numeric)
      const scheduledReps = isTimed 
        ? (exercise.target_duration_sec || detail?.default_duration_sec || 60)
        : (typeof exercise.target_reps === 'number' ? exercise.target_reps : (typeof exercise.target_reps === 'string' ? parseInt(exercise.target_reps) || null : null));
      
      // For scheduled_weight: We don't store target weight in plans, so this is always 0
      // The actual weight logged by the user is stored in the weight column
      const scheduledWeight = 0; // Always 0 since we don't have target weight in plans

      // Use session day if available, otherwise use param day
      const dayToSave = workoutSession?.day || day;
      console.log(`Saving logs - Using day: ${dayToSave} (session day: ${workoutSession?.day}, param day: ${day})`);
      
      const dbLogs = sets
        .filter(s => s.completed)
        .map((set, index) => {
          const logData = logs[index] || {};
          const notesParts = [];
          if (logData.notes) notesParts.push(logData.notes);
          
          // For timed exercises, use duration in reps field; for others, use weight/reps
          // Timed exercises are bodyweight, so weight = 0 (required by NOT NULL constraint)
          const weight = isTimed ? 0 : (set.weight ? parseFloat(set.weight.toString()) : (scheduledWeight ?? 0));
          const reps = isTimed ? (set.duration !== null && set.duration !== undefined ? parseFloat(set.duration.toString()) : (scheduledReps ?? 0)) : (set.reps ? parseFloat(set.reps.toString()) : (scheduledReps ?? 0));
          
          console.log(`Saving set ${index + 1} for ${exercise.name}: weight=${weight}, reps=${reps}, duration=${set.duration}, isTimed=${isTimed}`);
          
          return {
            user_id: user.id,
            exercise_name: exercise.name,
            plan_id: parseInt(planId),
            day: dayToSave, // Use session day if available
            session_id: workoutSession?.id || null,
            // For timed exercises, duration is stored in reps field, weight is 0
            weight: weight,
            reps: reps,
            scheduled_reps: scheduledReps,
            scheduled_weight: scheduledWeight,
            notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
            performed_at: new Date().toISOString()
          };
        });
      
      console.log(`Saving ${dbLogs.length} sets for exercise ${exercise.name}`);

      if (dbLogs.length > 0) {
        const { error: insertError } = await supabase.from('workout_logs').insert(dbLogs);
        if (insertError) {
          console.error('Error saving to workout_logs:', insertError);
          throw insertError;
        }
      }
    } catch (error) {
      console.error('Error saving to workout_logs:', error);
      throw error;
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

  const formatTime = (seconds: number | null | undefined): string => {
    if (!seconds && seconds !== 0) return '0:00';
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
    // Timed exercises are always bodyweight (planks, skipping, etc.)
    if (detail?.is_timed) return true;
    
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
      safeBack();
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
      safeBack();
    } catch (error) {
      console.error('Error saving progress on exit:', error);
      safeBack();
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
            const targetReps = typeof exercise.target_reps === 'number' ? exercise.target_reps : (typeof exercise.target_reps === 'string' ? parseInt(exercise.target_reps) || 10 : 10);
            const loggedReps = setLogs[setIndex]?.reps || '';
            const loggedWeight = setLogs[setIndex]?.weight || '';
            const targetDuration = exercise.target_duration_sec || detail?.default_duration_sec || 60;
            
            // Get duration from minutes/seconds inputs (pre-populated with target only if not in map)
            // If map has the key (even if empty string), use that value to allow user to clear and edit
            const currentMins = durationMinutes.has(setIndex) ? (durationMinutes.get(setIndex) || '') : Math.floor(targetDuration / 60).toString();
            const currentSecs = durationSeconds.has(setIndex) ? (durationSeconds.get(setIndex) || '') : (targetDuration % 60).toString();
            
            // Calculate total seconds for comparison
            const mins = currentMins ? (parseInt(currentMins) || 0) : 0;
            const secs = currentSecs ? (parseInt(currentSecs) || 0) : 0;
            const actualDuration = mins * 60 + secs;
            
            // target_reps is now always numeric (no ranges)
            const targetRepsNum = typeof exercise.target_reps === 'number' 
              ? exercise.target_reps 
              : (typeof exercise.target_reps === 'string' ? parseInt(exercise.target_reps) || 10 : 10);
            const actualReps = loggedReps ? parseInt(loggedReps) : null;
            // Met: within 10% tolerance (90% to 110%)
            const repsMatch = actualReps !== null && !isNaN(actualReps) && actualReps >= targetRepsNum * 0.9 && actualReps <= targetRepsNum * 1.1;
            // Duration match: within 10% tolerance (90% to 110%)
            const durationMatch = actualDuration > 0 && actualDuration >= targetDuration * 0.9 && actualDuration <= targetDuration * 1.1;

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
                        <Text style={styles.targetValue}>{formatTime(targetDuration)}</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.targetItem}>
                          <Text style={styles.targetLabel}>Reps:</Text>
                          <Text style={styles.targetValue}>{targetReps || 'N/A'}</Text>
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
                      <Text style={styles.logLabel}>Duration</Text>
                      <View style={styles.logInputRow}>
                        <View style={styles.logInputHalf}>
                          <Text style={styles.logLabel}>Min</Text>
                          <View style={styles.inputWithComparison}>
                            <TextInput
                              style={[
                                styles.logInput,
                                styles.logInputFlex
                              ]}
                              value={currentMins}
                              onChangeText={(text) => {
                                // Allow empty string or valid number
                                if (text === '' || (!isNaN(parseInt(text)) && parseInt(text) >= 0)) {
                                  setDurationMinutes(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(setIndex, text);
                                    return newMap;
                                  });
                                }
                              }}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#6b7280"
                            />
                          </View>
                        </View>
                        <View style={styles.logInputHalf}>
                          <Text style={styles.logLabel}>Sec</Text>
                          <View style={styles.inputWithComparison}>
                            <TextInput
                              style={[
                                styles.logInput,
                                styles.logInputFlex
                              ]}
                              value={currentSecs}
                              onChangeText={(text) => {
                                // Allow empty string or valid number (0-59)
                                if (text === '' || (!isNaN(parseInt(text)) && parseInt(text) >= 0 && parseInt(text) < 60)) {
                                  setDurationSeconds(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(setIndex, text);
                                    return newMap;
                                  });
                                }
                              }}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#6b7280"
                            />
                            {actualDuration > 0 && (
                              <View style={styles.comparisonBadge}>
                                {durationMatch ? (
                                  <Check color="#10b981" size={16} />
                                ) : actualDuration > targetDuration * 1.1 ? (
                                  <TrendingUp color="#3b82f6" size={16} />
                                ) : (
                                  <TrendingDown color="#ef4444" size={16} />
                                )}
                                <Text style={[
                                  styles.comparisonText,
                                  durationMatch ? styles.comparisonTextGood :
                                  actualDuration > targetDuration * 1.1 ? styles.comparisonTextBetter :
                                  styles.comparisonTextBad
                                ]}>
                                  {durationMatch ? 'Met' : actualDuration > targetDuration * 1.1 ? 'Above' : 'Below'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
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
                              ) : actualReps > targetRepsNum * 1.1 ? (
                                <TrendingUp color="#3b82f6" size={16} />
                              ) : (
                                <TrendingDown color="#ef4444" size={16} />
                              )}
                              <Text style={[
                                styles.comparisonText,
                                repsMatch ? styles.comparisonTextGood : 
                                actualReps > targetRepsNum * 1.1 ? styles.comparisonTextBetter : 
                                styles.comparisonTextBad
                              ]}>
                                {repsMatch ? 'Met' : actualReps > targetRepsNum * 1.1 ? 'Above' : 'Below'}
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
  
  // Debug: Log exercise details for current exercise
  console.log(`Current exercise: ${exercise.name}, isTimed: ${isTimed}, detail:`, detail);
  console.log(`Exercise details map has ${exerciseDetails.size} entries`);
  
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
                safeBack();
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
            onPress={safeBack}
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
                ? formatTime(exercise.target_duration_sec || (detail ? detail.default_duration_sec : null) || 60)
                : `${typeof exercise.target_reps === 'number' ? exercise.target_reps : (typeof exercise.target_reps === 'string' ? parseInt(exercise.target_reps) || 10 : 10)} reps`}
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

        {detail && detail.description && detail.description.trim() && (
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
              {exerciseTimer.countdown ? exerciseTimer.seconds.toString() : formatTime(exerciseTimer.seconds)}
            </Text>
            {exerciseTimer.countdown && (
              <Text style={styles.countdownLabel}>Get ready...</Text>
            )}
            {exerciseTimer.seconds === 0 && !exerciseTimer.countdown ? (
              <TouchableOpacity
                style={styles.completeTimerButton}
                onPress={handleCompleteTimedExercise}
              >
                <Text style={styles.completeTimerButtonText}>Complete Set</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.timerButtons}>
                {!exerciseTimer.countdown && (
                  <>
                    {exerciseTimer.paused ? (
                      <TouchableOpacity
                        style={[styles.timerControlButton, { backgroundColor: '#10b981' }]}
                        onPress={() => {
                          setExerciseTimer(prev => prev ? { ...prev, paused: false } : null);
                        }}
                      >
                        <Play color="white" size={20} />
                        <Text style={styles.timerControlButtonText}>Resume</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.timerControlButton, { backgroundColor: '#f59e0b' }]}
                        onPress={() => {
                          setExerciseTimer(prev => prev ? { ...prev, paused: true } : null);
                        }}
                      >
                        <Pause color="white" size={20} />
                        <Text style={styles.timerControlButtonText}>Pause</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={[styles.skipButton, { backgroundColor: '#10b981', marginLeft: 0 }]}
                  onPress={() => {
                    // Skip timer - save 0 seconds and complete the set
                    setExerciseTimer(null);
                    handleCompleteSet();
                  }}
                >
                  <SkipForward color="white" size={20} />
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
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
              <>
                {isTimed ? (
                  <TouchableOpacity
                    style={styles.completeSetButton}
                    onPress={handleStartSet}
                  >
                    <Text style={styles.completeSetButtonText}>Start Timer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.completeSetButton}
                    onPress={handleStartSet}
                  >
                    <Text style={styles.completeSetButtonText}>Complete Set</Text>
                  </TouchableOpacity>
                )}
              </>
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
  countdownLabel: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  timerControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timerControlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
