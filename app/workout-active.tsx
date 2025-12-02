import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Check, Clock, Play, SkipForward, TrendingUp, TrendingDown, Pause } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutActiveSkeleton } from '../src/components/skeletons/WorkoutActiveSkeleton';

interface ExerciseDetail {
  is_timed: boolean;
  default_duration_sec: number | null;
  description: string | null;
  how_to?: string[] | null;
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
      router.replace('/(tabs)');
    } catch (error) {
      router.replace('/(tabs)');
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
              // Get duration from set if available, otherwise use target_duration_sec or default
              const set = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[i] 
                ? exercise.sets[i] 
                : null;
              const setDuration = set?.duration !== null && set?.duration !== undefined 
                ? set.duration 
                : null;
              const targetDuration = setDuration || exercise.target_duration_sec || detail?.default_duration_sec || 60;
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
      
      // Get current week start date (Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek;
      const weekStart = new Date(today);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      
      // Format week key (YYYY-MM-DD)
      const year = weekStart.getFullYear();
      const month = String(weekStart.getMonth() + 1).padStart(2, '0');
      const dayNum = String(weekStart.getDate()).padStart(2, '0');
      const weekKey = `${year}-${month}-${dayNum}`;
      
      // Check week-specific data first, then fall back to template
      let dayData = null;
      if (planData.plan_data?.weeks?.[weekKey]?.week_schedule?.[day]) {
        dayData = planData.plan_data.weeks[weekKey].week_schedule[day];
      } else if (planData.plan_data?.week_schedule?.[day]) {
        // Fallback to template week_schedule for backward compatibility
        dayData = planData.plan_data.week_schedule[day];
      }
      
      if (!dayData || !dayData.exercises || dayData.exercises.length === 0) {
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
          .select('name, is_timed, description, how_to, equipment_needed')
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
              how_to: masterExercise.how_to || null,
              equipment_needed: masterExercise.equipment_needed || []
            });
          } else {
            // Default values if not found in either table
            detailsMap.set(exercise.name, {
              is_timed: false,
              default_duration_sec: null,
              description: null,
              how_to: null,
              equipment_needed: []
            });
          }
        }
      }
      setExerciseDetails(detailsMap);

      // Check for existing workout session (active or completed)
      const { data: existingSession, error: sessionQueryError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', parseInt(planId))
        .eq('day', day)
        .in('status', ['active', 'completed'])
        .order('started_at', { ascending: false })
        .limit(1)
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
        // Reconstruct progress from logs and session position
        // Handle both old schema (with progress) and new schema (with current_exercise_index)
        const currentExerciseIndex = existingSession.current_exercise_index ?? 
          (existingSession.progress?.currentExerciseIndex ?? 0);
        const currentSetIndex = existingSession.current_set_index ?? 
          (existingSession.progress?.currentSetIndex ?? 0);
        
        // First, determine which exercises were in the original workout by checking logs
        const { data: loggedExercises } = await supabase
          .from('workout_logs')
          .select('exercise_name')
          .eq('user_id', user.id)
          .eq('session_id', existingSession.id)
          .eq('day', day);
        
        const loggedExerciseNames = new Set(loggedExercises?.map(log => log.exercise_name) || []);
        
        // Build a map of exercise name to its index in the full dayData.exercises array
        const exerciseIndexMap = new Map<string, number>();
        dayData.exercises.forEach((exercise: any, index: number) => {
          exerciseIndexMap.set(exercise.name, index);
        });
        
        // Separate original exercises (have logs) from new exercises (no logs)
        const originalExercises: any[] = [];
        const newExercises: any[] = [];
        
        dayData.exercises.forEach((exercise: any) => {
          if (loggedExerciseNames.has(exercise.name)) {
            originalExercises.push(exercise);
          } else {
            newExercises.push(exercise);
          }
        });
        
        // Reconstruct progress only for original exercises
        const originalProgress = await reconstructProgressFromLogs(
          originalExercises,
          currentExerciseIndex,
          currentSetIndex,
          parseInt(planId),
          day,
          user.id,
          existingSession.id
        );
        
        // Fix exercise indices to match full dayData.exercises array
        originalProgress.exercises.forEach((exProgress) => {
          const globalIndex = exerciseIndexMap.get(exProgress.name);
          if (globalIndex !== undefined) {
            exProgress.exerciseIndex = globalIndex;
          }
        });
        
        // Check if all original exercises are completed
        const allOriginalCompleted = originalExercises.length > 0 && originalProgress.exercises.every(ex => ex.completed);
        
        // Reactivate session if it was completed and there are new exercises
        if (existingSession.status === 'completed' && newExercises.length > 0) {
          const { data: reactivatedSession, error: reactivateError } = await supabase
            .from('workout_sessions')
            .update({
              status: 'active',
              completed_at: null
            })
            .eq('id', existingSession.id)
            .select()
            .single();
          
          if (!reactivateError && reactivatedSession) {
            setWorkoutSession(reactivatedSession);
          } else {
            setWorkoutSession(existingSession);
          }
        } else {
          setWorkoutSession(existingSession);
        }
        
        // Add new exercises to progress with correct indices
        if (newExercises.length > 0) {
          newExercises.forEach((exercise) => {
            const globalIndex = exerciseIndexMap.get(exercise.name);
            if (globalIndex !== undefined) {
              originalProgress.exercises.push({
                exerciseIndex: globalIndex,
                name: exercise.name,
                completed: false,
                sets: Array.from({ length: exercise.target_sets || 3 }, (_, setIndex) => ({
                  setIndex,
                  completed: false,
                  reps: null,
                  weight: null,
                  duration: null
                }))
              });
            }
          });
          
          // Sort exercises by their global index to maintain order
          originalProgress.exercises.sort((a, b) => a.exerciseIndex - b.exerciseIndex);
          
          // If all original exercises are completed, start from first new exercise
          if (allOriginalCompleted) {
            const firstNewExerciseIndex = newExercises.length > 0 
              ? exerciseIndexMap.get(newExercises[0].name) 
              : originalProgress.exercises.length;
            if (firstNewExerciseIndex !== undefined) {
              originalProgress.currentExerciseIndex = firstNewExerciseIndex;
              originalProgress.currentSetIndex = 0;
            }
          }
          // Otherwise, keep current position (workout in progress continues from where it was)
          // But ensure currentExerciseIndex is valid
          if (originalProgress.currentExerciseIndex >= originalProgress.exercises.length) {
            // If current index is out of bounds, find the first incomplete exercise
            const firstIncomplete = originalProgress.exercises.findIndex(ex => !ex.completed);
            if (firstIncomplete !== -1) {
              originalProgress.currentExerciseIndex = originalProgress.exercises[firstIncomplete].exerciseIndex;
              originalProgress.currentSetIndex = 0;
            }
          }
        }
        
        setProgress(originalProgress);
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

  const saveProgress = async (updatedProgress: WorkoutProgress, skipStateUpdate: boolean = false) => {
    // Always save to AsyncStorage for fast local access
    await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(updatedProgress));
    
    // Only update state if not skipping (to allow manual state updates)
    if (!skipStateUpdate) {
      setProgress(updatedProgress);
    }

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
    const setIndex = progress.currentSetIndex;
    const exercise = exercises[exerciseIndex];
    const detail = exerciseDetails.get(exercise.name);
    const isTimed = detail?.is_timed || false;

    if (isTimed) {
      // Get duration from current set if available, otherwise use target_duration_sec or default
      const currentSet = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[setIndex] 
        ? exercise.sets[setIndex] 
        : null;
      const setDuration = currentSet?.duration !== null && currentSet?.duration !== undefined 
        ? currentSet.duration 
        : null;
      const targetDuration = setDuration || exercise.target_duration_sec || detail?.default_duration_sec || 60;
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
      const initialLogs = Array.from({ length: totalSets }, (_, i) => {
        // Get per-set configuration if available
        const set = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[i] 
          ? exercise.sets[i] 
          : null;
        
        // For rep exercises: use per-set reps if available, otherwise exercise-level target_reps
        const setReps = set?.reps !== null && set?.reps !== undefined ? set.reps : null;
        const targetRepsValue = setReps !== null 
          ? setReps.toString()
          : (typeof exercise.target_reps === 'number' 
              ? exercise.target_reps.toString() 
              : (typeof exercise.target_reps === 'string' 
                  ? (exercise.target_reps.includes('-') ? exercise.target_reps.split('-')[0].trim() : exercise.target_reps) 
                  : '10'));
        
        // Get target weight from set configuration if available, otherwise use last logged weight
        const setWeight = set?.weight !== null && set?.weight !== undefined ? set.weight : null;
        const targetWeight = setWeight !== null ? setWeight : (lastWeight || 0);
        const isBodyweight = isBodyweightExercise(exercise.name, detail);
        return {
          reps: isTimed ? '' : targetRepsValue,
          weight: (isBodyweight && (targetWeight === null || targetWeight === 0)) ? '0' : (targetWeight > 0 ? targetWeight.toString() : ''),
          duration: '',
          notes: ''
        };
      });
      
      setSetLogs(initialLogs);
      
      // Initialize duration minutes/seconds for timed exercises with duration from sets
      if (isTimed) {
        const minsMap = new Map<number, string>();
        const secsMap = new Map<number, string>();
        for (let i = 0; i < totalSets; i++) {
          // Get duration from set if available, otherwise use target_duration_sec or default
          const set = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[i] 
            ? exercise.sets[i] 
            : null;
          const setDuration = set?.duration !== null && set?.duration !== undefined 
            ? set.duration 
            : null;
          const targetDuration = setDuration || exercise.target_duration_sec || detail?.default_duration_sec || 60;
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
        
        // Start rest timer - use per-set rest time if available, otherwise exercise-level rest time
        const currentSet = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[setIndex] 
          ? exercise.sets[setIndex] 
          : null;
        const setRestTime = currentSet?.rest_time_sec !== null && currentSet?.rest_time_sec !== undefined 
          ? currentSet.rest_time_sec 
          : null;
        const restTime = setRestTime || exercise.rest_time_sec || 60;
        setRestTimer({ active: true, seconds: restTime });
        setExerciseTimer(null);
      }
    }
  };

  const handleReopenLogging = (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex];
    const detail = exerciseDetails.get(exercise.name);
    const isTimed = detail?.is_timed || false;
    const totalSets = exercise.target_sets || 3;
    const exerciseProgress = progress.exercises[exerciseIndex];

    // Load saved data from progress
    const loadedLogs: Array<{ reps: string; weight: string; duration: string; notes: string }> = [];
    const minsMap = new Map<number, string>();
    const secsMap = new Map<number, string>();

    for (let i = 0; i < totalSets; i++) {
      const set = exerciseProgress?.sets?.[i];
      if (isTimed) {
        const duration = set?.duration ?? 0;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        minsMap.set(i, mins.toString());
        secsMap.set(i, secs.toString());
        loadedLogs.push({
          reps: '',
          weight: '',
          duration: duration.toString(),
          notes: set?.notes || '',
        });
      } else {
        loadedLogs.push({
          reps: set?.reps?.toString() || '',
          weight: set?.weight?.toString() || '',
          duration: '',
          notes: set?.notes || '',
        });
      }
    }

    setSetLogs(loadedLogs);
    setDurationMinutes(minsMap);
    setDurationSeconds(secsMap);
    setCompletedExerciseIndex(exerciseIndex);
    setShowLoggingScreen(true);
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

    updatedProgress.exercises[completedExerciseIndex].completed = true;
    
    // Move to next exercise or finish workout
    if (completedExerciseIndex < exercises.length - 1) {
      // Save to workout_logs before moving to next exercise
      await saveSetsToLogs(exercise, updatedProgress.exercises[completedExerciseIndex].sets, setLogs);
      
      const nextExerciseIndex = completedExerciseIndex + 1;
      
      // Ensure next exercise is initialized in progress
      if (!updatedProgress.exercises[nextExerciseIndex]) {
        const nextExercise = exercises[nextExerciseIndex];
        updatedProgress.exercises[nextExerciseIndex] = {
          exerciseIndex: nextExerciseIndex,
          name: nextExercise.name,
          completed: false,
          sets: Array.from({ length: nextExercise.target_sets || 3 }, (_, setIndex) => ({
            setIndex,
            completed: false,
            reps: null,
            weight: null,
            duration: null
          }))
        };
      } else {
        // Reset the next exercise if it was previously completed (don't auto-show logging screen)
        const nextExercise = updatedProgress.exercises[nextExerciseIndex];
        if (nextExercise.completed) {
          nextExercise.completed = false;
          // Reset all sets to incomplete
          nextExercise.sets.forEach(set => {
            set.completed = false;
          });
        }
      }
      
      updatedProgress.currentExerciseIndex = nextExerciseIndex;
      updatedProgress.currentSetIndex = 0;
      
      // Ensure next exercise is initialized but DON'T mark sets as completed
      // The logging screen should only show when user actually completes the last set
      const nextExercise = exercises[nextExerciseIndex];
      if (!updatedProgress.exercises[nextExerciseIndex].sets || updatedProgress.exercises[nextExerciseIndex].sets.length !== (nextExercise.target_sets || 3)) {
        updatedProgress.exercises[nextExerciseIndex].sets = Array.from({ length: nextExercise.target_sets || 3 }, (_, setIndex) => ({
          setIndex,
          completed: false, // Don't mark as completed - user needs to actually complete sets
          reps: null,
          weight: null,
          duration: null
        }));
      }
      
      // Don't mark the next exercise as completed - let user complete it naturally
      updatedProgress.exercises[nextExerciseIndex].completed = false;
      
      // CRITICAL: Save to AsyncStorage FIRST to ensure state is persisted
      await AsyncStorage.setItem(`workout_session_${planId}_${day}`, JSON.stringify(updatedProgress));
      
      // Update progress state - this must happen synchronously
      setProgress(updatedProgress);
      
      // Close logging screen and return to workout view for next exercise
      setShowLoggingScreen(false);
      setCompletedExerciseIndex(null);
      setSetLogs([]);
      setDurationMinutes(new Map());
      setDurationSeconds(new Map());
      
      // Save progress to database (skip state update since we already set it)
      // Don't await this - let it run in background so state updates aren't blocked
      saveProgress(updatedProgress, true).catch(err => {
        console.error('Error saving progress:', err);
      });
      
      if (__DEV__) {
        console.log('[Continue to Next Exercise] State updated:', {
          nextExerciseIndex,
          currentExerciseIndex: updatedProgress.currentExerciseIndex,
          currentSetIndex: updatedProgress.currentSetIndex,
          nextExerciseCompleted: updatedProgress.exercises[nextExerciseIndex]?.completed,
          showLoggingScreen: true,
          completedExerciseIndex: nextExerciseIndex
        });
      }
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

      // Check if this exercise has already been logged for this session
      if (workoutSession?.id) {
        const { data: existingLogs } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_id', workoutSession.id)
          .eq('exercise_name', exercise.name)
          .limit(1);
        
        // If exercise already has logs for this session, skip saving
        if (existingLogs && existingLogs.length > 0) {
          if (__DEV__) {
            console.log(`[saveSetsToLogs] Skipping ${exercise.name} - already logged for this session`);
          }
          return;
        }
      }

      // Get exercise detail to check if timed
      const detail = exerciseDetails.get(exercise.name);
      const isTimed = detail?.is_timed || false;

      // Use session day if available, otherwise use param day
      const dayToSave = workoutSession?.day || day;
      
      const dbLogs = sets
        .filter(s => s.completed)
        .map((set, index) => {
          const logData = logs[index] || {};
          const notesParts = [];
          if (logData.notes) notesParts.push(logData.notes);
          
          // Get target values from set configuration if available, otherwise use exercise-level defaults
          const setConfig = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[index] 
            ? exercise.sets[index] 
            : null;
          
          // For timed exercises: scheduled_reps contains target duration (in seconds)
          // For rep exercises: scheduled_reps contains target reps (now always numeric)
          const scheduledReps = isTimed 
            ? (setConfig?.duration !== null && setConfig?.duration !== undefined 
                ? setConfig.duration 
                : (exercise.target_duration_sec || detail?.default_duration_sec || 60))
            : (setConfig?.reps !== null && setConfig?.reps !== undefined
                ? setConfig.reps
                : (typeof exercise.target_reps === 'number' 
                    ? exercise.target_reps 
                    : (typeof exercise.target_reps === 'string' 
                        ? parseInt(exercise.target_reps) || null 
                        : null)));
          
          // For scheduled_weight: Use weight from set configuration if available, otherwise 0
          // For timed exercises, weight is always 0 (bodyweight)
          const scheduledWeight = isTimed 
            ? 0 
            : (setConfig?.weight !== null && setConfig?.weight !== undefined 
                ? setConfig.weight 
                : 0);
          
          // For timed exercises, use duration in reps field; for others, use weight/reps
          // Timed exercises are bodyweight, so weight = 0 (required by NOT NULL constraint)
          const weight = isTimed ? 0 : (set.weight ? parseFloat(set.weight.toString()) : (scheduledWeight ?? 0));
            const reps = isTimed 
            ? (set.duration !== null && set.duration !== undefined ? parseFloat(set.duration.toString()) : (scheduledReps ?? 0)) 
            : (set.reps ? parseFloat(set.reps.toString()) : (scheduledReps ?? 0));
          
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
    const setIndex = progress.currentSetIndex;
    const exercise = exercises[exerciseIndex];
    // Use per-set rest time if available, otherwise exercise-level rest time
    const currentSet = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[setIndex] 
      ? exercise.sets[setIndex] 
      : null;
    const setRestTime = currentSet?.rest_time_sec !== null && currentSet?.rest_time_sec !== undefined 
      ? currentSet.rest_time_sec 
      : null;
    const restTime = setRestTime || exercise.rest_time_sec || 60;
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
    return <WorkoutActiveSkeleton />;
  }

  // Show logging screen if exercise is complete
  // Check both showLoggingScreen flag AND that the exercise at completedExerciseIndex exists
  if (showLoggingScreen && completedExerciseIndex !== null && completedExerciseIndex < exercises.length && exercises[completedExerciseIndex]) {
    const exercise = exercises[completedExerciseIndex];
    
    if (__DEV__) {
      console.log('[Render] Showing logging screen for exercise:', {
        completedExerciseIndex,
        exerciseName: exercise.name,
        showLoggingScreen,
        exercisesLength: exercises.length
      });
    }
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
            // Get per-set configuration if available
            const set = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[setIndex] 
              ? exercise.sets[setIndex] 
              : null;
            
            // For rep exercises: use per-set reps if available, otherwise exercise-level target_reps
            const setReps = set?.reps !== null && set?.reps !== undefined ? set.reps : null;
            const targetReps = setReps !== null 
              ? setReps 
              : (typeof exercise.target_reps === 'number' ? exercise.target_reps : (typeof exercise.target_reps === 'string' ? parseInt(exercise.target_reps) || 10 : 10));
            
            const loggedReps = setLogs[setIndex]?.reps || '';
            const loggedWeight = setLogs[setIndex]?.weight || '';
            
            // For timed exercises: get duration from set if available, otherwise use target_duration_sec or default
            const setDuration = set?.duration !== null && set?.duration !== undefined 
              ? set.duration 
              : null;
            const targetDuration = setDuration || exercise.target_duration_sec || detail?.default_duration_sec || 60;
            // Get target weight from set configuration if available, otherwise use the initial weight from setLogs (which was pre-populated with last logged weight or set weight)
            // We need to get the last logged weight again to calculate target weight correctly
            const setWeight = set?.weight !== null && set?.weight !== undefined ? set.weight : null;
            // If set has weight, use it; otherwise, the initial weight in setLogs was set from lastWeight during initialization
            // So we can use the initial value from setLogs as the target (before user edits)
            const initialWeight = setLogs[setIndex]?.weight ? parseFloat(setLogs[setIndex].weight) : null;
            const targetWeight = setWeight !== null ? setWeight : (initialWeight !== null && initialWeight > 0 ? initialWeight : null);
            
            // Get duration from minutes/seconds inputs (pre-populated with target only if not in map)
            // If map has the key (even if empty string), use that value to allow user to clear and edit
            const currentMins = durationMinutes.has(setIndex) ? (durationMinutes.get(setIndex) || '') : Math.floor(targetDuration / 60).toString();
            const currentSecs = durationSeconds.has(setIndex) ? (durationSeconds.get(setIndex) || '') : (targetDuration % 60).toString();
            
            // Calculate total seconds for comparison
            const mins = currentMins ? (parseInt(currentMins) || 0) : 0;
            const secs = currentSecs ? (parseInt(currentSecs) || 0) : 0;
            const actualDuration = mins * 60 + secs;
            
            // Use per-set reps if available, otherwise exercise-level target_reps (now always numeric, no ranges)
            const targetRepsNum = setReps !== null 
              ? setReps 
              : (typeof exercise.target_reps === 'number' 
                  ? exercise.target_reps 
                  : (typeof exercise.target_reps === 'string' 
                      ? parseInt(exercise.target_reps) || 10 
                      : 10));
            const actualReps = loggedReps ? parseInt(loggedReps) : null;
            // Met: exact match
            const repsMatch = actualReps !== null && !isNaN(actualReps) && actualReps === targetRepsNum;
            // Duration match: exact match
            const durationMatch = actualDuration > 0 && actualDuration === targetDuration;

            return (
              <View key={setIndex} style={styles.setLogCard}>
                <Text style={styles.setLogTitle}>Set {setIndex + 1} of {totalSets}</Text>
                
                {/* Scheduled/Target Values */}
                <View style={styles.targetSection}>
                  <Text style={styles.targetSectionTitle}>Scheduled</Text>
                  <View style={styles.targetRow}>
                    {isTimed ? (
                      <View style={styles.targetItemFull}>
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
                            {(isBodyweight || (targetWeight !== null && targetWeight === 0)) 
                              ? 'Bodyweight' 
                              : (targetWeight !== null && targetWeight > 0 ? `${targetWeight} lbs` : 'N/A')}
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
                          <Text style={styles.logSubLabel}>Min</Text>
                          <View style={styles.inputWithComparison}>
                            <TextInput
                              style={styles.logInput}
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
                          <Text style={styles.logSubLabel}>Sec</Text>
                          <View style={styles.inputWithComparison}>
                            <TextInput
                              style={styles.logInput}
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
                                ) : actualDuration > targetDuration ? (
                                  <TrendingUp color="#3b82f6" size={16} />
                                ) : (
                                  <TrendingDown color="#ef4444" size={16} />
                                )}
                                <Text style={[
                                  styles.comparisonText,
                                  durationMatch ? styles.comparisonTextGood :
                                  actualDuration > targetDuration ? styles.comparisonTextBetter :
                                  styles.comparisonTextBad
                                ]}>
                                  {durationMatch ? 'Met' : actualDuration > targetDuration ? 'Above' : 'Below'}
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
                            (isBodyweight && (targetWeight === null || targetWeight === 0)) && styles.logInputDisabled
                          ]}
                          value={loggedWeight}
                          onChangeText={(text) => {
                            if (!(isBodyweight && (targetWeight === null || targetWeight === 0))) {
                              const newLogs = [...setLogs];
                              newLogs[setIndex] = { ...newLogs[setIndex], weight: text, notes: newLogs[setIndex]?.notes || '' };
                              setSetLogs(newLogs);
                            }
                          }}
                          keyboardType="numeric"
                          placeholder={(isBodyweight && (targetWeight === null || targetWeight === 0)) ? "Bodyweight" : "0"}
                          placeholderTextColor="#6b7280"
                          editable={!(isBodyweight && (targetWeight === null || targetWeight === 0))}
                        />
                      </View>
                      <View style={styles.logInputHalf}>
                        <Text style={styles.logLabel}>Reps</Text>
                        <View style={styles.inputWithComparison}>
                          <TextInput
                            style={styles.logInput}
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
                              ) : actualReps > targetRepsNum ? (
                                <TrendingUp color="#3b82f6" size={16} />
                              ) : (
                                <TrendingDown color="#ef4444" size={16} />
                              )}
                              <Text style={[
                                styles.comparisonText,
                                repsMatch ? styles.comparisonTextGood : 
                                actualReps > targetRepsNum ? styles.comparisonTextBetter : 
                                styles.comparisonTextBad
                              ]}>
                                {repsMatch ? 'Met' : actualReps > targetRepsNum ? 'Above' : 'Below'}
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
                    safeBack();
                  }}
                >
                  <Text style={styles.modalButtonText}>Exit</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  // Use per-set rest time if available, otherwise exercise-level rest time
  const setConfig = exercise.sets && Array.isArray(exercise.sets) && exercise.sets[setIndex] 
    ? exercise.sets[setIndex] 
    : null;
  const setRestTime = setConfig?.rest_time_sec !== null && setConfig?.rest_time_sec !== undefined 
    ? setConfig.rest_time_sec 
    : null;
  const restTime = setRestTime || exercise.rest_time_sec || 60;
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
                safeBack();
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

      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
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

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.exerciseContainer}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.setNumber}>Set {setIndex + 1} of {totalSets}</Text>

        <View style={styles.exerciseInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Target:</Text>
            <Text style={styles.infoValue}>
              {isTimed 
                ? (() => {
                    const setDuration = setConfig?.duration !== null && setConfig?.duration !== undefined 
                      ? setConfig.duration 
                      : null;
                    const targetDuration = setDuration || exercise.target_duration_sec || (detail ? detail.default_duration_sec : null) || 60;
                    return formatTime(targetDuration);
                  })()
                : (() => {
                    const setReps = setConfig?.reps !== null && setConfig?.reps !== undefined 
                      ? setConfig.reps 
                      : null;
                    const targetReps = setReps !== null 
                      ? setReps 
                      : (typeof exercise.target_reps === 'number' 
                          ? exercise.target_reps 
                          : (typeof exercise.target_reps === 'string' 
                              ? parseInt(exercise.target_reps) || 10 
                              : 10));
                    return `${targetReps} reps`;
                  })()}
            </Text>
          </View>
          {!isTimed && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Weight:</Text>
              <Text style={styles.infoValue}>
                {isBodyweight 
                  ? 'Bodyweight' 
                  : (() => {
                      const setWeight = setConfig?.weight !== null && setConfig?.weight !== undefined 
                        ? setConfig.weight 
                        : null;
                      if (setWeight !== null && setWeight > 0) {
                        return `${setWeight} lbs`;
                      }
                      return 'N/A';
                    })()}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rest:</Text>
            <Text style={styles.infoValue}>{restTime} seconds</Text>
          </View>
        </View>

        {detail && detail.how_to && Array.isArray(detail.how_to) && detail.how_to.length > 0 && (
          <View style={styles.instructionsSection}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            {detail.how_to.map((step: string, idx: number) => (
              <View key={idx} style={styles.howToStep}>
                <Text style={styles.howToStepNumber}>{idx + 1}.</Text>
                <Text style={styles.instructionsText}>{step}</Text>
              </View>
            ))}
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
                <Text style={styles.completeTimerButtonText}>
                  {setIndex === totalSets - 1 ? 'Complete and Log Sets' : 'Complete Set'}
                </Text>
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

      </ScrollView>

      {/* Floating Rest Timer */}
      {restTimer && restTimer.active && (
        <View style={styles.floatingButtonContainer}>
          <View style={styles.floatingRestTimerContainer}>
            <View style={styles.floatingRestTimerLeftContent}>
              <View style={styles.floatingRestTimerIconContainer}>
                <Clock color="#ffffff" size={32} />
                <Text style={styles.floatingRestTimerLabel}>Rest</Text>
              </View>
            </View>
            <View style={styles.floatingRestTimerCenterContent}>
              <Text style={styles.floatingRestTimerText}>
                {formatTime(restTimer.seconds)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.floatingRestTimerSkipButton}
              onPress={() => {
                setRestTimer(null);
                handleRestComplete();
              }}
            >
              <SkipForward color="#ffffff" size={20} />
              <Text style={styles.floatingRestTimerSkipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Complete Set Button */}
      {!exerciseTimer?.active && !restTimer?.active && !allSetsComplete && !isSetComplete && (
        <View style={styles.floatingButtonContainer}>
          {isTimed ? (
            <TouchableOpacity
              style={styles.floatingCompleteSetButton}
              onPress={handleStartSet}
            >
              <Text style={styles.floatingCompleteSetButtonText}>Start Timer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.floatingCompleteSetButton}
              onPress={handleStartSet}
            >
              <Text style={styles.floatingCompleteSetButtonText}>
                {setIndex === totalSets - 1 ? 'Complete and Log Sets' : 'Complete Set'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a1a1aa', // zinc-400
    marginTop: 16,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  progressBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  progressText: {
    color: '#a1a1aa', // zinc-400
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: '#a3e635', // lime-400
    borderRadius: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  exerciseContainer: {
    paddingBottom: 120, // Space for floating button
    padding: 24,
  },
  exerciseName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  setNumber: {
    fontSize: 18,
    color: '#a3e635', // lime-400
    fontWeight: '700',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  exerciseInfo: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  instructionsSection: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  instructionsTitle: {
    color: '#a3e635', // lime-400
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  instructionsText: {
    color: '#e4e4e7', // zinc-200
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  howToStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  howToStepNumber: {
    color: '#a3e635', // lime-400
    fontSize: 14,
    fontWeight: '700',
    minWidth: 24,
  },
  exerciseTimerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
    borderRadius: 24, // rounded-3xl
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(163, 230, 53, 0.3)', // lime-400/30
  },
  exerciseTimerText: {
    color: '#a3e635', // lime-400
    fontSize: 56,
    fontWeight: '700',
    marginVertical: 20,
    fontFamily: 'monospace',
  },
  countdownLabel: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  timerControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  timerControlButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  completeTimerButton: {
    backgroundColor: '#a3e635', // lime-400
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24, // rounded-3xl
  },
  completeTimerButtonText: {
    color: '#09090b', // zinc-950
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  restTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.1)', // cyan-500/10
    borderRadius: 24, // rounded-3xl
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)', // cyan-500/30
  },
  restTimerLeftContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0,
  },
  restTimerCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerLabel: {
    color: '#71717a', // zinc-500 - less prominent
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  restTimerText: {
    color: '#22d3ee', // cyan-400
    fontSize: 40,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(34, 211, 238, 0.2)', // cyan-400/20
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)', // cyan-400/40
    flexShrink: 0,
  },
  skipButtonText: {
    color: '#22d3ee', // cyan-400
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionButtons: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  completeSetButton: {
    backgroundColor: '#a3e635', // lime-400
    padding: 24,
    borderRadius: 24, // rounded-3xl
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeSetButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  floatingCompleteSetButton: {
    backgroundColor: '#a3e635', // lime-400
    padding: 20,
    borderRadius: 24, // rounded-3xl
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingCompleteSetButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  floatingRestTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#06b6d4', // cyan-500 solid
    borderRadius: 24, // rounded-3xl
    padding: 20,
    borderWidth: 2,
    borderColor: '#06b6d4', // cyan-500
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingRestTimerLeftContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0,
  },
  floatingRestTimerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRestTimerLabel: {
    color: '#ffffff', // white for contrast on solid cyan
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  floatingRestTimerCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingRestTimerText: {
    color: '#ffffff', // white for contrast on solid cyan
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  floatingRestTimerSkipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // white/20 for contrast
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)', // white/40
    flexShrink: 0,
  },
  floatingRestTimerSkipText: {
    color: '#ffffff', // white for contrast on solid cyan
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  loggingSubtitle: {
    fontSize: 16,
    color: '#a1a1aa', // zinc-400
    marginBottom: 32,
  },
  setLogCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  setLogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
  },
  targetSection: {
    backgroundColor: '#09090b', // zinc-950
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  targetSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a', // zinc-500
    marginBottom: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  targetRow: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
  },
  targetItemFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  targetLabel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
  },
  targetValue: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '700',
  },
  loggedSection: {
    marginTop: 20,
  },
  loggedSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a', // zinc-500
    marginBottom: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  logInputGroup: {
    marginBottom: 0,
    marginTop: 16,
  },
  logInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  logInputHalf: {
    flex: 1,
    minHeight: 88,
  },
  logLabel: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    minHeight: 20,
    letterSpacing: 0.5,
  },
  logSubLabel: {
    color: '#71717a', // zinc-500
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    minHeight: 16,
    letterSpacing: 0.5,
  },
  logInput: {
    backgroundColor: '#09090b', // zinc-950
    color: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    fontSize: 16,
    minHeight: 48,
    flex: 1,
    minWidth: 0,
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
    flex: 1,
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#09090b', // zinc-950
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    minHeight: 36,
    justifyContent: 'center',
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  comparisonTextGood: {
    color: '#a3e635', // lime-400
  },
  comparisonTextBetter: {
    color: '#22d3ee', // cyan-400
  },
  comparisonTextBad: {
    color: '#ef4444', // red-500
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
    backgroundColor: '#a3e635', // lime-400
  },
  loggingButtonSecondary: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderWidth: 2,
    borderColor: '#a3e635', // lime-400
  },
  loggingButtonText: {
    color: '#09090b', // zinc-950
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  loggingButtonTextSecondary: {
    color: '#a3e635', // lime-400
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completionTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#a3e635', // lime-400
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  completionSubtitle: {
    fontSize: 18,
    color: '#a1a1aa', // zinc-400
    textAlign: 'center',
    marginBottom: 40,
  },
  completeWorkoutButton: {
    backgroundColor: '#a3e635', // lime-400
    padding: 20,
    borderRadius: 24, // rounded-3xl
    minWidth: 240,
    alignItems: 'center',
  },
  completeWorkoutButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logInputDisabled: {
    backgroundColor: '#27272a', // zinc-800
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.8)', // zinc-950/80
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'rgba(24, 24, 27, 0.95)', // zinc-900/95
    borderRadius: 24, // rounded-3xl
    padding: 32,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  modalMessage: {
    color: '#a1a1aa', // zinc-400
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  modalButtonConfirm: {
    backgroundColor: '#a3e635', // lime-400
  },
  modalButtonDanger: {
    backgroundColor: '#ef4444', // red-500
  },
  modalButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalButtonTextCancel: {
    color: '#a1a1aa', // zinc-400
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
