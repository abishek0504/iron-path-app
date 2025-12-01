import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, Modal, ActivityIndicator, RefreshControl, TextInput, Alert, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, Clock, TrendingUp, Edit2, Save, X, Trash2, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/lib/supabase';
import { ProgressSkeleton } from '../../src/components/skeletons/ProgressSkeleton';

type ViewMode = 'week' | 'month' | 'timeline';

interface WorkoutLog {
  id: number;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  performed_at: string;
  session_id: number | null;
  plan_id: number | null;
  day: string | null;
  notes: string | null;
  scheduled_reps: number | null;
  scheduled_weight: number | null;
}

interface WorkoutSession {
  id: number | null;
  plan_id: number;
  day: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
}

interface WorkoutData {
  date: string;
  sessions: Array<{
    session: WorkoutSession;
    exercises: Array<{
      name: string;
      sets: Array<{
        id: number | null; // Log ID for updates
        weight: number | null;
        reps: number | null;
        duration: number | null; // Duration in seconds for timed exercises
        notes: string | null;
        scheduled_reps: number | null; // For timed exercises: target duration (in seconds), for rep exercises: target reps
        scheduled_weight: number | null; // Target weight (always 0, we don't store target weight)
        scheduled_duration: number | null; // For timed exercises, this is the same as scheduled_reps (for convenience)
      }>;
    }>;
    duration: number | null;
    totalVolume: number;
  }>;
}

interface DayWorkout {
  date: Date;
  workoutCount: number;
  totalVolume: number;
  exercises: string[];
}

export default function ProgressScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selectedExercise?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  
  // Animation for the sliding indicator
  const indicatorPosition = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  
  // Store button positions
  const [buttonLayouts, setButtonLayouts] = useState<{
    week: { x: number; width: number } | null;
    month: { x: number; width: number } | null;
    timeline: { x: number; width: number } | null;
  }>({
    week: null,
    month: null,
    timeline: null,
  });
  
  // Update indicator position when view mode changes
  useEffect(() => {
    const layout = buttonLayouts[viewMode];
    if (layout) {
      indicatorPosition.value = withTiming(layout.x, {
        duration: 300,
      });
      indicatorWidth.value = withTiming(layout.width, {
        duration: 300,
      });
    }
  }, [viewMode, buttonLayouts, indicatorPosition, indicatorWidth]);
  
  // Handle button layout
  const handleButtonLayout = (mode: ViewMode) => (event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setButtonLayouts(prev => ({
      ...prev,
      [mode]: { x, width },
    }));
  };
  
  // Animated style for the indicator
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
    width: indicatorWidth.value,
  }));
  const [workoutData, setWorkoutData] = useState<WorkoutData[]>([]);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, { is_timed: boolean; difficulty_level: string | null }>>(new Map());
  const [planData, setPlanData] = useState<Map<number, any>>(new Map()); // Store plan data to get target values
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutData | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = useState<'set' | 'workout'>('set');
  const [deleteConfirmData, setDeleteConfirmData] = useState<{sessionIdx?: number; exerciseIdx?: number; setIdx?: number; setId?: number | null; sessionId?: number | null} | null>(null);
  const [unsavedChangesVisible, setUnsavedChangesVisible] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<Map<string, string>>(new Map()); // Key: "sessionIdx-exIdx-setIdx"
  const [durationSeconds, setDurationSeconds] = useState<Map<string, string>>(new Map()); // Key: "sessionIdx-exIdx-setIdx"
  const [bodyweightFlags, setBodyweightFlags] = useState<Map<string, boolean>>(new Map()); // Key: "sessionIdx-exIdx-setIdx"
  
  // Week view state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });

  // Month view state
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Refs
  const lastProcessedExerciseRef = useRef<string | null>(null);

  useEffect(() => {
    // Only load on initial mount
    if (!hasInitiallyLoaded) {
      loadWorkoutData(undefined, undefined, true);
    }
  }, [hasInitiallyLoaded]);

  const handleExerciseSelected = useCallback(async (exerciseName: string) => {
    // Avoid re-processing the same exercise
    if (lastProcessedExerciseRef.current === exerciseName) {
      router.setParams({ selectedExercise: undefined });
      return;
    }
    
    lastProcessedExerciseRef.current = exerciseName;
    
    // Restore state from AsyncStorage
    try {
      const storedEditing = await AsyncStorage.getItem('progress_editing_workout');
      const storedSelected = await AsyncStorage.getItem('progress_selected_workout');
      const wasEditing = await AsyncStorage.getItem('progress_was_editing');
      
      let workoutToEdit: WorkoutData | null = null;
      let workoutToSelect: WorkoutData | null = null;
      
      if (storedEditing) {
        workoutToEdit = JSON.parse(storedEditing);
        await AsyncStorage.removeItem('progress_editing_workout');
      }
      if (storedSelected) {
        workoutToSelect = JSON.parse(storedSelected);
        await AsyncStorage.removeItem('progress_selected_workout');
      }
      if (wasEditing) {
        await AsyncStorage.removeItem('progress_was_editing');
      }
      
      // Restore selectedWorkout first (needed for modal to show correct workout)
      if (workoutToSelect) {
        setSelectedWorkout(workoutToSelect);
      }
      
      // Determine which workout to edit
      const workoutToUpdate = workoutToEdit || workoutToSelect;
      
      if (workoutToUpdate && workoutToUpdate.sessions.length > 0) {
        const updated = JSON.parse(JSON.stringify(workoutToUpdate));
        const firstSession = updated.sessions[0];
        
        // Check if exercise already exists
        let exerciseEntry = firstSession.exercises.find((e: any) => e.name === exerciseName.trim());
        if (!exerciseEntry) {
          exerciseEntry = {
            name: exerciseName.trim(),
            sets: []
          };
          firstSession.exercises.push(exerciseEntry);
        }
        // Add an empty set to the exercise
        exerciseEntry.sets.push({
          id: null,
          weight: null,
          reps: null,
          duration: null,
          notes: null,
          scheduled_reps: null,
          scheduled_weight: null,
          scheduled_duration: null
        });
        
        // Update both editingWorkout and ensure selectedWorkout is set
        setEditingWorkout(updated);
        if (!workoutToSelect && workoutToEdit) {
          // If we only had editingWorkout, use it as selectedWorkout too
          setSelectedWorkout(workoutToEdit);
        }
        
        // Set editing mode
        setIsEditing(true);
        
        // Reopen modal after a short delay to ensure state is set
        setTimeout(() => {
          setModalVisible(true);
        }, 200);
      }
    } catch (e) {
      console.error('Error restoring workout state:', e);
      // Fallback: try with current state
      if (editingWorkout && editingWorkout.sessions.length > 0) {
        const updated = JSON.parse(JSON.stringify(editingWorkout));
        const firstSession = updated.sessions[0];
        
        let exerciseEntry = firstSession.exercises.find((e: any) => e.name === exerciseName.trim());
        if (!exerciseEntry) {
          exerciseEntry = {
            name: exerciseName.trim(),
            sets: []
          };
          firstSession.exercises.push(exerciseEntry);
        }
        exerciseEntry.sets.push({
          id: null,
          weight: null,
          reps: null,
          duration: null,
          notes: null,
          scheduled_reps: null,
          scheduled_weight: null,
          scheduled_duration: null
        });
        setEditingWorkout(updated);
        setIsEditing(true);
        setTimeout(() => {
          setModalVisible(true);
        }, 200);
      }
    }
    
    // Clear the param
    router.setParams({ selectedExercise: undefined });
    
    // Reset the ref after a delay to allow processing again if needed
    setTimeout(() => {
      lastProcessedExerciseRef.current = null;
    }, 1000);
  }, [router, editingWorkout]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh data on focus if we've already loaded, don't show loading
      if (hasInitiallyLoaded) {
        loadWorkoutData(undefined, undefined, false);
      }
    }, [hasInitiallyLoaded])
  );

  // Handle returning from exercise-select
  useFocusEffect(
    useCallback(() => {
      const checkForSelectedExercise = async () => {
        // Check AsyncStorage first (more reliable than params from Modal)
        const selectedExercise = await AsyncStorage.getItem('progress_selected_exercise');
        if (selectedExercise) {
          await AsyncStorage.removeItem('progress_selected_exercise');
          handleExerciseSelected(selectedExercise);
          return;
        }
        
        // Fallback to params
        if (params.selectedExercise) {
          handleExerciseSelected(params.selectedExercise);
        }
      };
      
      checkForSelectedExercise();
    }, [params.selectedExercise, handleExerciseSelected])
  );

  const loadExerciseDetails = async (logs: WorkoutLog[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const exerciseNames = [...new Set(logs.map(log => log.exercise_name).filter(Boolean))];
    if (exerciseNames.length === 0) return;

    const detailsMap = new Map<string, { is_timed: boolean; difficulty_level: string | null }>();

    // Batch query all exercises from master exercises table
    // Note: difficulty_level only exists in exercises table, NOT in user_exercises
    const { data: masterExercises } = await supabase
      .from('exercises')
      .select('name, is_timed, difficulty_level')
      .in('name', exerciseNames);

    // Batch query all user exercises (for is_timed and default_duration_sec)
    const { data: userExercises } = await supabase
      .from('user_exercises')
      .select('name, is_timed')
      .eq('user_id', user.id)
      .in('name', exerciseNames);

    // Create maps for quick lookup
    const masterExerciseMap = new Map(
      (masterExercises || []).map((ex: any) => [ex.name, ex])
    );
    const userExerciseMap = new Map(
      (userExercises || []).map((ex: any) => [ex.name, ex])
    );

    // Merge results: user exercises take precedence for is_timed, but difficulty_level comes from master exercises only
    for (const exerciseName of exerciseNames) {
      // Try exact match first
      let userExercise = userExerciseMap.get(exerciseName);
      let masterExercise = masterExerciseMap.get(exerciseName);
      
      // If not found, try case-insensitive match
      if (!userExercise && !masterExercise) {
        for (const [name, ex] of userExerciseMap.entries()) {
          if (name.toLowerCase() === exerciseName.toLowerCase()) {
            userExercise = ex;
            break;
          }
        }
        if (!masterExercise) {
          for (const [name, ex] of masterExerciseMap.entries()) {
            if (name.toLowerCase() === exerciseName.toLowerCase()) {
              masterExercise = ex;
              break;
            }
          }
        }
      }
      
      if (userExercise) {
        // User exercises don't have difficulty_level, get it from master exercises
        const difficulty = masterExercise?.difficulty_level || null;
        detailsMap.set(exerciseName, {
          is_timed: userExercise.is_timed || false,
          difficulty_level: difficulty
        });
      } else if (masterExercise) {
        detailsMap.set(exerciseName, {
          is_timed: masterExercise.is_timed || false,
          difficulty_level: masterExercise.difficulty_level || null
        });
      } else {
        // Default values if not found in either table
        detailsMap.set(exerciseName, {
          is_timed: false,
          difficulty_level: null
        });
      }
    }

    setExerciseDetails(detailsMap);
  };

  const loadWorkoutData = async (startDate?: Date, endDate?: Date, showLoading: boolean = true) => {
    // Only show loading if explicitly requested (initial load)
    const shouldShowLoading = showLoading && !hasInitiallyLoaded;
    if (shouldShowLoading) {
      setLoading(true);
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (shouldShowLoading) {
          setLoading(false);
        }
        setHasInitiallyLoaded(true);
        return;
      }

      // Determine date range based on view mode
      let start: Date;
      let end: Date = new Date();
      end.setHours(23, 59, 59, 999);

      if (viewMode === 'week') {
        start = new Date(currentWeekStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (viewMode === 'month') {
        start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        // Timeline: last 90 days
        start = new Date();
        start.setDate(start.getDate() - 90);
        start.setHours(0, 0, 0, 0);
      }

      if (startDate) start = startDate;
      if (endDate) end = endDate;

      // Fetch workout logs
      const { data: logs, error: logsError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('performed_at', start.toISOString())
        .lte('performed_at', end.toISOString())
        .order('performed_at', { ascending: false });

      if (logsError) {
        console.error('Error loading logs:', logsError);
        if (shouldShowLoading) {
          setLoading(false);
        }
        setHasInitiallyLoaded(true);
        return;
      }

      // Fetch completed sessions
      const { data: completedSessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', start.toISOString())
        .lte('completed_at', end.toISOString())
        .order('completed_at', { ascending: false });

      // Fetch active sessions to filter out their logs
      const { data: activeSessions, error: activeSessionsError } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Get list of active session IDs to filter out
      const activeSessionIds = new Set((activeSessions || []).map(s => s.id));

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError);
      }
      if (activeSessionsError) {
        console.error('Error loading active sessions:', activeSessionsError);
      }

      // Filter out logs from active sessions - only show completed workouts
      const filteredLogs = (logs || []).filter(log => {
        // Include logs without a session_id (standalone logs)
        if (!log.session_id) return true;
        // Exclude logs from active sessions
        return !activeSessionIds.has(log.session_id);
      });

      // Load exercise details to determine which exercises are timed
      await loadExerciseDetails(filteredLogs);
      
      // Get exercise details for aggregation (will be available after loadExerciseDetails)
      const detailsMap = new Map<string, { is_timed: boolean; difficulty_level: string | null }>();
      const exerciseNames = [...new Set(filteredLogs.map(log => log.exercise_name).filter(Boolean))];
      
      if (exerciseNames.length > 0) {
        const { data: masterExercises } = await supabase
          .from('exercises')
          .select('name, is_timed, difficulty_level')
          .in('name', exerciseNames);

        const { data: userExercises } = await supabase
          .from('user_exercises')
          .select('name, is_timed')
          .eq('user_id', user.id)
          .in('name', exerciseNames);

        const masterExerciseMap = new Map(
          (masterExercises || []).map((ex: any) => [ex.name, ex])
        );
        const userExerciseMap = new Map(
          (userExercises || []).map((ex: any) => [ex.name, ex])
        );

        for (const exerciseName of exerciseNames) {
          const userExercise = userExerciseMap.get(exerciseName);
          const masterExercise = masterExerciseMap.get(exerciseName);
          
          if (userExercise) {
            // User exercises don't have difficulty_level, get it from master exercises
            const difficulty = masterExercise?.difficulty_level || null;
            detailsMap.set(exerciseName, { 
              is_timed: userExercise.is_timed || false,
              difficulty_level: difficulty
            });
          } else if (masterExercise) {
            detailsMap.set(exerciseName, { 
              is_timed: masterExercise.is_timed || false,
              difficulty_level: masterExercise.difficulty_level || null
            });
          } else {
            detailsMap.set(exerciseName, { 
              is_timed: false,
              difficulty_level: null
            });
          }
        }
      }

      // Fetch workout plans to get exercise order and target values
      const planIds = [...new Set((completedSessions || []).map(s => s.plan_id).filter(Boolean))];
      const planExerciseOrder = new Map<number, Map<string, string[]>>();
      const planDataMap = new Map<number, any>();
      
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from('workout_plans')
          .select('id, plan_data')
          .in('id', planIds);
        
        if (plans) {
          plans.forEach((plan: any) => {
            planDataMap.set(plan.id, plan.plan_data);
            const dayOrderMap = new Map<string, string[]>();
            if (plan.plan_data?.week_schedule) {
              Object.keys(plan.plan_data.week_schedule).forEach((day: string) => {
                const dayData = plan.plan_data.week_schedule[day];
                if (dayData?.exercises) {
                  dayOrderMap.set(day, dayData.exercises.map((ex: any) => ex.name).filter(Boolean));
                }
              });
            }
            planExerciseOrder.set(plan.id, dayOrderMap);
          });
        }
      }
      
      setPlanData(planDataMap);

      // Aggregate data by date (only completed sessions and standalone logs)
      const aggregated = aggregateWorkoutData(filteredLogs, completedSessions || [], detailsMap, planExerciseOrder);
      setWorkoutData(aggregated);
    } catch (error) {
      console.error('Error loading workout data:', error);
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
      setRefreshing(false);
      setHasInitiallyLoaded(true);
    }
  };

  const aggregateWorkoutData = (logs: WorkoutLog[], sessions: WorkoutSession[], exerciseDetailsMap: Map<string, { is_timed: boolean; difficulty_level: string | null }>, planExerciseOrder: Map<number, Map<string, string[]>>): WorkoutData[] => {
    const dataMap = new Map<string, WorkoutData>();

    // Group logs by date and session
    logs.forEach(log => {
      const date = new Date(log.performed_at);
      // Use local date instead of UTC to avoid timezone issues
      // If workout was done Friday evening local time but Saturday UTC, it should show as Friday
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, {
          date: dateKey,
          sessions: []
        });
      }

      const dayData = dataMap.get(dateKey)!;
      const sessionId = log.session_id;

      // Find or create session entry
      let sessionEntry: any = null;
      
      if (sessionId) {
        // Log with session_id - find or create entry for that session
        sessionEntry = dayData.sessions.find(s => s.session.id === sessionId);
        if (!sessionEntry) {
          const session = sessions.find(s => s.id === sessionId);
          if (session) {
            sessionEntry = {
              session,
              exercises: [],
              duration: null,
              totalVolume: 0
            };
            dayData.sessions.push(sessionEntry);

            // Calculate duration
            if (session.completed_at && session.started_at) {
              const start = new Date(session.started_at);
              const end = new Date(session.completed_at);
              sessionEntry.duration = Math.round((end.getTime() - start.getTime()) / 1000 / 60); // minutes
            }
          }
        }
      } else {
        // Standalone log without session - group all standalone logs for this date into one entry
        sessionEntry = dayData.sessions.find(s => s.session.id === null);
        if (!sessionEntry) {
          const dummySession: WorkoutSession = {
            id: null, // Use null to indicate no real session
            plan_id: log.plan_id || -1,
            day: log.day || null,
            started_at: log.performed_at,
            completed_at: null,
            status: 'completed'
          };
          sessionEntry = {
            session: dummySession,
            exercises: [],
            duration: null,
            totalVolume: 0
          };
          dayData.sessions.push(sessionEntry);
        }
      }

      if (sessionEntry) {
        // Find or create exercise entry
        let exerciseEntry = sessionEntry.exercises.find((e: any) => e.name === log.exercise_name);
        if (!exerciseEntry) {
          exerciseEntry = {
            name: log.exercise_name,
            sets: []
          };
          sessionEntry.exercises.push(exerciseEntry);
        }

        // Check if exercise is timed
        const isTimed = exerciseDetailsMap.get(log.exercise_name)?.is_timed || false;
        
        // For timed exercises, reps field contains duration in seconds
        // Only add sets with valid data (at least weight, reps, or duration for timed)
        if (log.weight !== null || log.reps !== null) {
          exerciseEntry.sets.push({
            id: log.id,
            weight: isTimed ? null : log.weight,
            reps: isTimed ? null : log.reps,
            duration: isTimed ? log.reps : null, // For timed exercises, reps field stores duration
            notes: log.notes,
            scheduled_reps: log.scheduled_reps, // For timed exercises: target duration (in seconds), for rep exercises: target reps
            scheduled_weight: log.scheduled_weight, // Always 0 (we don't store target weight in plans)
            scheduled_duration: isTimed ? log.scheduled_reps : null // For timed exercises, scheduled_reps IS the target duration
          });

          // Calculate volume (only if both weight and reps are present, and not timed)
          if (!isTimed && log.weight && log.reps) {
            sessionEntry.totalVolume += log.weight * log.reps;
          }
        }
      }
    });

    // Sort exercises within each session by their order in the workout plan
    dataMap.forEach((workout) => {
      workout.sessions.forEach((session) => {
        if (session.session.plan_id && session.session.day) {
          // Get exercise order from plan if available
          const planId = session.session.plan_id;
          const day = session.session.day;
          
          const planOrder = planExerciseOrder.get(planId);
          if (planOrder) {
            const dayOrder = planOrder.get(day);
            if (dayOrder && dayOrder.length > 0) {
              // Sort exercises by their order in the plan
              session.exercises.sort((a, b) => {
                const indexA = dayOrder.indexOf(a.name);
                const indexB = dayOrder.indexOf(b.name);
                // If not found in plan, keep original order (put at end)
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              });
            }
          }
        }
        
        // Sort sets within each exercise by their order (they should already be in order from logs)
        session.exercises.forEach((exercise) => {
          // Sets are already in order from logs, but ensure they're sorted by id or performed_at if available
          exercise.sets.sort((a, b) => {
            if (a.id && b.id) return a.id - b.id;
            return 0;
          });
        });
      });
    });

    // Sort by date descending
    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkoutData(undefined, undefined, false).then(() => {
      setRefreshing(false);
    });
  }, [viewMode, currentWeekStart, currentMonth, hasInitiallyLoaded]);

  useEffect(() => {
    // Only reload data when view changes if we've already loaded initially
    if (hasInitiallyLoaded) {
      loadWorkoutData(undefined, undefined, false);
    }
  }, [viewMode, currentWeekStart, currentMonth, hasInitiallyLoaded]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds && seconds !== 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getMonthDays = (): DayWorkout[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: DayWorkout[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        date: new Date(year, month, -i),
        workoutCount: 0,
        totalVolume: 0,
        exercises: []
      });
    }

    // Add days of the month
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const date = new Date(year, month, dayNum);
      // Use local date instead of UTC
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dateDay = String(date.getDate()).padStart(2, '0');
      const dateKey = `${dateYear}-${dateMonth}-${dateDay}`;
      const workout = workoutData.find(w => w.date === dateKey);

      days.push({
        date,
        workoutCount: workout ? workout.sessions.length : 0,
        totalVolume: workout ? workout.sessions.reduce((sum, s) => sum + s.totalVolume, 0) : 0,
        exercises: workout ? workout.sessions.flatMap(s => s.exercises.map(e => e.name)) : []
      });
    }

    return days;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newDate);
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isToday = (date: Date) => {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    };

    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <ChevronLeft color="#a3e635" size={24} />
          </TouchableOpacity>
          <View style={styles.weekTitleContainer}>
            <Text style={styles.weekTitle}>
              {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
              {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.weekSubtitle}>{currentWeekStart.getFullYear()}</Text>
          </View>
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <ChevronRight color="#a3e635" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.weekScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.weekScrollContent}
        >
          {weekDays.map((day, index) => {
            // Use local date instead of UTC
            const year = day.getFullYear();
            const month = String(day.getMonth() + 1).padStart(2, '0');
            const dayNum = String(day.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${dayNum}`;
            const workout = workoutData.find(w => w.date === dateKey);
            const hasWorkout = !!workout && workout.sessions.length > 0;
            const today = isToday(day);
            const totalExercises = workout ? workout.sessions.reduce((sum, s) => sum + s.exercises.length, 0) : 0;
            const totalVolume = workout ? workout.sessions.reduce((sum, s) => sum + s.totalVolume, 0) : 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDayCard,
                  hasWorkout && styles.weekDayCardWithWorkout,
                  today && styles.weekDayCardToday
                ]}
                onPress={() => {
                  if (workout) {
                    setSelectedWorkout(workout);
                    setEditingWorkout(JSON.parse(JSON.stringify(workout))); // Deep copy for editing
                    setIsEditing(false);
                    setModalVisible(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.weekDayLeft}>
                  <View style={styles.weekDayDateContainer}>
                    <Text style={[styles.weekDayName, today && styles.weekDayNameToday]}>
                      {shortDayNames[day.getDay()]}
                    </Text>
                    <Text style={[styles.weekDayNumber, today && styles.weekDayNumberToday]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  {today && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>Today</Text>
                    </View>
                  )}
                </View>

                {hasWorkout ? (
                  <View style={styles.weekDayWorkoutInfo}>
                    <View style={styles.weekDayWorkoutStats}>
                      <View style={styles.weekDayStatItem}>
                        <TrendingUp color="#a3e635" size={16} />
                        <Text style={styles.weekDayStatText}>{workout.sessions.length} workout{workout.sessions.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.weekDayStatItem}>
                        <Text style={styles.weekDayStatText}>{totalExercises} exercises</Text>
                      </View>
                      {totalVolume > 0 && (
                        <View style={styles.weekDayStatItem}>
                          <Text style={styles.weekDayStatText}>{Math.round(totalVolume)} lbs</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.weekDayArrow}>
                      <ChevronRight color="#9ca3af" size={20} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.weekDayEmpty}>
                    <Text style={styles.weekDayEmptyText}>No workout</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderMonthView = () => {
    const days = getMonthDays();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <View style={styles.monthContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <ChevronLeft color="#a3e635" size={24} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <ChevronRight color="#a3e635" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.monthStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {workoutData.reduce((sum, w) => sum + w.sessions.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Math.round(workoutData.reduce((sum, w) => sum + w.sessions.reduce((s, ses) => s + ses.totalVolume, 0), 0))}
            </Text>
            <Text style={styles.statLabel}>Total Volume</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.calendarScroll}
          contentContainerStyle={styles.calendarScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.calendarGrid}>
            {dayNames.map(day => (
              <View key={day} style={styles.calendarHeaderCell}>
                <Text style={styles.calendarHeaderText}>{day}</Text>
              </View>
            ))}
            {days.map((dayWorkout, index) => {
              // Use local date instead of UTC
              const date = dayWorkout.date;
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const dayNum = String(date.getDate()).padStart(2, '0');
              const dateKey = `${year}-${month}-${dayNum}`;
              const isCurrentMonth = dayWorkout.date.getMonth() === currentMonth.getMonth();
              const hasWorkout = dayWorkout.workoutCount > 0;
              const workout = workoutData.find(w => w.date === dateKey);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.calendarCell,
                    !isCurrentMonth && styles.calendarCellOtherMonth,
                    hasWorkout && styles.calendarCellWithWorkout
                  ]}
                  onPress={() => {
                    if (workout && hasWorkout) {
                      setSelectedWorkout(workout);
                      setEditingWorkout(JSON.parse(JSON.stringify(workout))); // Deep copy for editing
                      setIsEditing(false);
                      setModalVisible(true);
                    }
                  }}
                  disabled={!hasWorkout}
                >
                  <Text style={[
                    styles.calendarDayText,
                    !isCurrentMonth && styles.calendarDayTextOtherMonth,
                    hasWorkout && styles.calendarDayTextWithWorkout
                  ]}>
                    {dayWorkout.date.getDate()}
                  </Text>
                  {hasWorkout && (
                    <View style={styles.calendarWorkoutIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderTimelineView = () => {
    return (
      <FlatList
        data={workoutData}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.timelineCard}
            onPress={() => {
              setSelectedWorkout(item);
              setEditingWorkout(JSON.parse(JSON.stringify(item))); // Deep copy for editing
              setIsEditing(false);
              setModalVisible(true);
            }}
          >
            <View style={styles.timelineHeader}>
              <View style={styles.timelineDateContainer}>
                <Calendar color="#a3e635" size={20} />
                <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
              </View>
              {item.sessions[0]?.session.completed_at && (
                <View style={styles.timelineTimeContainer}>
                  <Clock color="#9ca3af" size={16} />
                  <Text style={styles.timelineTime}>{formatTime(item.sessions[0].session.completed_at)}</Text>
                </View>
              )}
            </View>

            {item.sessions.map((session, idx) => (
              <View key={idx} style={styles.timelineSession}>
                {session.session.day && (
                  <Text style={styles.timelineDay}>{session.session.day}</Text>
                )}
                <View style={styles.timelineExercises}>
                  {session.exercises.map((exercise, exIdx) => {
                    const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
                    // Filter out sets with no valid data
                    const validSets = exercise.sets.filter(set => {
                      if (isTimed) {
                        return set.duration !== null && set.duration !== undefined;
                      }
                      return (set.weight !== null && set.weight !== undefined) || 
                             (set.reps !== null && set.reps !== undefined);
                    });
                    
                    if (validSets.length === 0) return null;
                    
                    // Get first valid set for preview
                    const firstSet = validSets[0];
                    const hasWeightAndReps = !isTimed && firstSet.weight !== null && firstSet.reps !== null;
                    const hasDuration = isTimed && firstSet.duration !== null;

                    // Build a single summary string for the sets line
                    let setsSummary = `${validSets.length} set${validSets.length !== 1 ? 's' : ''}`;
                    if (hasWeightAndReps) {
                      setsSummary += ` • ${firstSet.weight}lbs × ${firstSet.reps}`;
                    }
                    if (hasDuration) {
                      setsSummary += ` • ${formatDuration(firstSet.duration)}`;
                    }
                    
                    return (
                      <View key={exIdx} style={styles.timelineExercise}>
                        <Text style={styles.timelineExerciseName}>{exercise.name}</Text>
                        <Text style={styles.timelineExerciseSets}>{setsSummary}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.timelineFooter}>
                  {session.duration && (
                    <Text style={styles.timelineDuration}>{session.duration} min</Text>
                  )}
                  {session.totalVolume > 0 && (
                    <Text style={styles.timelineVolume}>{Math.round(session.totalVolume)} lbs volume</Text>
                  )}
                </View>
              </View>
            ))}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No workouts found</Text>
            <Text style={styles.emptySubtext}>Complete a workout to see your progress here</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      />
    );
  };

  const handleEdit = () => {
    if (!selectedWorkout) return;
    const workoutCopy = JSON.parse(JSON.stringify(selectedWorkout));
    setEditingWorkout(workoutCopy);
    setDeletedSetIds(new Set());
    setValidationErrors(new Map());
    setIsEditing(true);
    
    // Initialize duration minutes/seconds maps for timed exercises
    const minsMap = new Map<string, string>();
    const secsMap = new Map<string, string>();
    
    const bwFlagsMap = new Map<string, boolean>();
    
    workoutCopy.sessions.forEach((session: any, sessionIdx: number) => {
      session.exercises.forEach((exercise: any, exIdx: number) => {
        const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
        const isBodyweight = isBodyweightExercise(exercise.name);
        
        exercise.sets.forEach((set: any, setIdx: number) => {
          const key = `${sessionIdx}-${exIdx}-${setIdx}`;
          
          if (isTimed) {
            if (set.duration !== null && set.duration !== undefined) {
              minsMap.set(key, Math.floor(set.duration / 60).toString());
              secsMap.set(key, (set.duration % 60).toString());
            }
          } else {
            // Initialize bodyweight flag only if:
            // 1. Exercise is inherently bodyweight (push-ups, pull-ups, etc.)
            // 2. OR set already exists (has id) and weight is 0
            // Don't auto-check for new sets (no id) unless exercise is inherently bodyweight
            if (isBodyweight || (set.id && (set.weight === 0 || set.weight === null))) {
              bwFlagsMap.set(key, true);
            }
          }
        });
      });
    });
    
    setDurationMinutes(minsMap);
    setDurationSeconds(secsMap);
    setBodyweightFlags(bwFlagsMap);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDeletedSetIds(new Set()); // Clear deleted sets tracking
    if (selectedWorkout) {
      setEditingWorkout(JSON.parse(JSON.stringify(selectedWorkout)));
    }
  };

  // Helper to check if exercise is bodyweight (no weight needed, can be 0)
  const isBodyweightExercise = (exerciseName: string): boolean => {
    // Check if exercise is timed (timed exercises are bodyweight)
    const isTimed = exerciseDetails.get(exerciseName)?.is_timed || false;
    if (isTimed) return true;
    
    // Common bodyweight exercises (matches workout-active.tsx list)
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
    
    // Check if exercise name matches common bodyweight exercises
    const nameMatch = BODYWEIGHT_EXERCISES.some(bw => 
      exerciseName.toLowerCase().includes(bw.toLowerCase())
    );
    
    // Note: exerciseDetails doesn't include equipment_needed in progress.tsx
    // The name-based matching should be sufficient for identifying bodyweight exercises
    
    return nameMatch;
  };

  const getDifficultyInfo = (difficulty: string | null | undefined) => {
    if (!difficulty) return null;
    
    const difficultyLower = String(difficulty).toLowerCase().trim();
    if (difficultyLower === 'beginner') {
      return { label: 'Easy', color: '#22c55e', activeBars: 1 };
    } else if (difficultyLower === 'intermediate') {
      return { label: 'Medium', color: '#f97316', activeBars: 2 };
    } else if (difficultyLower === 'advanced') {
      return { label: 'Hard', color: '#ef4444', activeBars: 3 };
    }
    return null;
  };

  const renderDifficultyIndicator = (difficulty: string | null | undefined) => {
    if (!difficulty) {
      return null;
    }
    
    const difficultyInfo = getDifficultyInfo(difficulty);
    if (!difficultyInfo) {
      return null;
    }

    return (
      <View style={styles.difficultyContainer}>
        <View style={styles.difficultyBars}>
          <View style={[styles.difficultyBar, styles.difficultyBar1, { backgroundColor: difficultyInfo.activeBars >= 1 ? difficultyInfo.color : '#27272a' }]} />
          <View style={[styles.difficultyBar, styles.difficultyBar2, { backgroundColor: difficultyInfo.activeBars >= 2 ? difficultyInfo.color : '#27272a' }]} />
          <View style={[styles.difficultyBar, styles.difficultyBar3, { backgroundColor: difficultyInfo.activeBars >= 3 ? difficultyInfo.color : '#27272a' }]} />
        </View>
        <Text style={[styles.difficultyText, { color: difficultyInfo.color }]}>{difficultyInfo.label}</Text>
      </View>
    );
  };

  const validateWorkoutData = (): boolean => {
    const errors = new Map<string, string>();
    
    if (!editingWorkout) {
      return false;
    }

    editingWorkout.sessions.forEach((session, sessionIdx) => {
      session.exercises.forEach((exercise, exIdx) => {
        const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
        const isBodyweight = isBodyweightExercise(exercise.name);
        
        exercise.sets.forEach((set, setIdx) => {
          // Skip sets that are marked for deletion
          if (set.id && deletedSetIds.has(set.id)) {
            return;
          }
          
          // Validate both new and existing sets
          if (isTimed) {
            // For timed exercises, duration is required
            if (set.duration === null || set.duration === undefined || set.duration === 0) {
              const errorKey = `${sessionIdx}-${exIdx}-${setIdx}-duration`;
              errors.set(errorKey, 'Duration cannot be blank');
            }
          } else {
            // For non-timed exercises:
            // - Reps is always required (must be > 0, not null/undefined)
            // - Weight is required UNLESS it's a bodyweight exercise (then can be 0 or null)
            // Note: We allow 0 reps to be saved (converted from null), but validation requires > 0
            const hasReps = set.reps !== null && set.reps !== undefined && set.reps > 0;
            const hasWeight = set.weight !== null && set.weight !== undefined && set.weight !== 0;
            
            if (!hasReps) {
              const repsErrorKey = `${sessionIdx}-${exIdx}-${setIdx}-reps`;
              errors.set(repsErrorKey, 'Reps must be greater than 0');
            }
            
            // Weight validation: if not bodyweight (and not marked as bodyweight via checkbox), weight must be provided
            const bodyweightKey = `${sessionIdx}-${exIdx}-${setIdx}`;
            const isMarkedBodyweight = bodyweightFlags.get(bodyweightKey) || false;
            if (!isBodyweight && !isMarkedBodyweight && !hasWeight) {
              const weightErrorKey = `${sessionIdx}-${exIdx}-${setIdx}-weight`;
              errors.set(weightErrorKey, 'Weight is required or check Bodyweight');
            }
          }
        });
      });
    });

    setValidationErrors(errors);
    return errors.size === 0;
  };

  const handleSaveEdit = async () => {
    if (!editingWorkout) {
      Alert.alert("Error", "No workout data to save.");
      return;
    }

    // Validate before saving
    if (!validateWorkoutData()) {
      Alert.alert("Validation Error", "Please fill in all required fields. Empty sets cannot be saved.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to save changes.");
        setSaving(false);
        return;
      }

      // Ensure selectedWorkout is set (use editingWorkout if not available)
      if (!selectedWorkout && editingWorkout) {
        setSelectedWorkout(editingWorkout);
      }

      // Collect all sets that need to be updated and new sets that need to be created
      const updates: Array<{ id: number; weight: number | null; reps: number | null; notes: string | null }> = [];
      const newSets: Array<{ sessionIdx: number; exerciseName: string; weight: number | null; reps: number | null; notes: string | null; sessionId: number | null; planId: number | null; day: string | null; performedAt: string; scheduledReps: number | null; scheduledWeight: number | null }> = [];

      editingWorkout.sessions.forEach((session, sessionIdx) => {
        session.exercises.forEach(exercise => {
          const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
          exercise.sets.forEach(set => {
            // Skip sets that are marked for deletion
            if (set.id && deletedSetIds.has(set.id)) {
              return;
            }
            
            // For timed exercises, use duration in reps field; for others, use weight/reps
            const weight = isTimed ? null : set.weight;
            const reps = isTimed ? set.duration : set.reps;
            
            if (set.id) {
              // Existing set - update it
              // Weight is required (NOT NULL), so use 0 if null (for bodyweight exercises or as fallback)
              // Reps is also required (NOT NULL), but validation ensures it's > 0, so we should have a valid value here
              // If somehow we still have null/undefined after validation, use 0 as fallback (shouldn't happen)
              const finalWeight = (weight !== null && weight !== undefined) ? weight : 0;
              const finalReps = (reps !== null && reps !== undefined && reps > 0) ? reps : 0;
              
              updates.push({
                id: set.id,
                weight: finalWeight,
                reps: finalReps,
                notes: set.notes !== null && set.notes !== undefined ? set.notes : null
              });
            } else {
              // New set - only create if it has valid data (validation already passed)
              // Use the workout date from selectedWorkout or editingWorkout, ensuring it's a date string (YYYY-MM-DD)
              // If not available, use today's date in local timezone
              let workoutDateStr: string;
              if (selectedWorkout?.date) {
                workoutDateStr = selectedWorkout.date;
              } else if (editingWorkout?.date) {
                workoutDateStr = editingWorkout.date;
              } else {
                // Use local date, not UTC
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                workoutDateStr = `${year}-${month}-${day}`;
              }
              
              // Get day from session, or try to get from plan data if session day is missing
              let dayToUse = session.session.day;
              if (!dayToUse && session.session.plan_id && planData.has(session.session.plan_id)) {
                // Try to find the day from the plan data based on exercise name
                const plan = planData.get(session.session.plan_id);
                if (plan?.week_schedule) {
                  for (const [day, dayData] of Object.entries(plan.week_schedule)) {
                    if (dayData && typeof dayData === 'object' && 'exercises' in dayData && Array.isArray(dayData.exercises) && dayData.exercises.some((ex: any) => ex.name === exercise.name)) {
                      dayToUse = day;
                      break;
                    }
                  }
                }
              }
              
              // Get scheduled values from plan data if available
              let scheduledReps: number | null = null;
              let scheduledWeight: number | null = null;
              
              if (session.session.plan_id && dayToUse && planData.has(session.session.plan_id)) {
                const plan = planData.get(session.session.plan_id);
                const dayData = plan?.week_schedule?.[dayToUse];
                if (dayData?.exercises) {
                  const exerciseData = dayData.exercises.find((ex: any) => ex.name === exercise.name);
                  if (exerciseData) {
                    if (isTimed) {
                      // For timed exercises, scheduled_reps contains target duration
                      scheduledReps = exerciseData.target_duration_sec || null;
                      scheduledWeight = 0; // Timed exercises are bodyweight
                    } else {
                      // For rep exercises, scheduled_reps contains target reps
                      scheduledReps = typeof exerciseData.target_reps === 'number' 
                        ? exerciseData.target_reps 
                        : (typeof exerciseData.target_reps === 'string' 
                            ? parseInt(exerciseData.target_reps) || null 
                            : null);
                      // Get scheduled weight from set configuration if available
                      const setIndex = exercise.sets.indexOf(set);
                      const setConfig = exerciseData.sets && Array.isArray(exerciseData.sets) && exerciseData.sets[setIndex]
                        ? exerciseData.sets[setIndex]
                        : null;
                      scheduledWeight = setConfig?.weight !== null && setConfig?.weight !== undefined
                        ? setConfig.weight
                        : 0;
                    }
                  }
                }
              }
              
              newSets.push({
                sessionIdx,
                exerciseName: exercise.name,
                weight: weight,
                reps: reps,
                notes: set.notes || null,
                sessionId: session.session.id,
                planId: session.session.plan_id,
                day: dayToUse,
                performedAt: workoutDateStr,
                scheduledReps,
                scheduledWeight
              });
            }
          });
        });
      });

      // Delete sets that were marked for deletion
      if (deletedSetIds.size > 0) {
        for (const setId of deletedSetIds) {
          const { error } = await supabase
            .from('workout_logs')
            .delete()
            .eq('id', setId)
            .eq('user_id', user.id);

          if (error) {
            console.error('Error deleting set:', error);
            Alert.alert("Error", `Failed to delete set: ${error.message || JSON.stringify(error)}`);
            setSaving(false);
            return;
          }
        }
      }

      // Update existing log entries
      for (const update of updates) {
        const updateData: any = {};
        
        // Weight is required (NOT NULL) - use stored value or 0 (already handled in updates array)
        updateData.weight = update.weight;
        
        // Reps is required (NOT NULL) - use stored value or 0 (already handled in updates array)
        updateData.reps = update.reps;
        
        // Notes is optional - only include if it has a value
        if (update.notes !== null && update.notes !== undefined && update.notes !== '') {
          updateData.notes = update.notes;
        } else {
          // Explicitly set to null if empty string
          updateData.notes = null;
        }
        
        // Note: We do NOT update the day field - it should remain as it was originally saved
        // This ensures that Friday's workout stays as Friday even if the session day is wrong

        const { error, data } = await supabase
          .from('workout_logs')
          .update(updateData)
          .eq('id', update.id)
          .eq('user_id', user.id)
          .select();

        if (error) {
          console.error('Error updating log:', error);
          Alert.alert("Error", `Failed to update set: ${error.message || error.details || JSON.stringify(error)}`);
          setSaving(false);
          return;
        }
      }

      // Create new log entries
      if (newSets.length > 0) {
        const inserts = newSets.map(newSet => {
          // Weight is required (NOT NULL), so use 0 if null (for bodyweight exercises or as fallback)
          const finalWeight = (newSet.weight !== null && newSet.weight !== undefined) ? newSet.weight : 0;
          
          // Convert date string (YYYY-MM-DD) to ISO string with local time at noon to avoid timezone issues
          // This ensures the date is preserved correctly regardless of timezone
          const dateStr = newSet.performedAt; // Should be in format YYYY-MM-DD
          const [year, month, day] = dateStr.split('-').map(Number);
          const localDate = new Date(year, month - 1, day, 12, 0, 0); // Noon local time
          
          return {
            user_id: user.id,
            exercise_name: newSet.exerciseName,
            weight: finalWeight,
            reps: (newSet.reps !== null && newSet.reps !== undefined && newSet.reps > 0) ? newSet.reps : 0,
            notes: newSet.notes,
            performed_at: localDate.toISOString(), // Convert to ISO but based on local date
            session_id: newSet.sessionId,
            plan_id: newSet.planId,
            day: newSet.day,
            scheduled_reps: newSet.scheduledReps,
            scheduled_weight: newSet.scheduledWeight
          };
        });

        const { error: insertError } = await supabase
          .from('workout_logs')
          .insert(inserts);

        if (insertError) {
          console.error('Error creating new logs:', insertError);
          Alert.alert("Error", `Failed to create new sets: ${insertError.message || JSON.stringify(insertError)}`);
          setSaving(false);
          return;
        }
      }

      // Reload data and exit edit mode
      await loadWorkoutData(undefined, undefined, false);
      setIsEditing(false);
      setDeletedSetIds(new Set()); // Clear deleted sets tracking
      setValidationErrors(new Map()); // Clear validation errors
      setSelectedWorkout(editingWorkout);
      Alert.alert("Success", "Workout updated successfully!");
    } catch (error: any) {
      console.error('Error saving edits:', error);
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const updateSetValue = (sessionIdx: number, exerciseIdx: number, setIdx: number, field: 'weight' | 'reps' | 'notes' | 'duration', value: string) => {
    if (!editingWorkout) return;

    const updated = JSON.parse(JSON.stringify(editingWorkout));
    const set = updated.sessions[sessionIdx].exercises[exerciseIdx].sets[setIdx];
    
    if (field === 'weight' || field === 'reps' || field === 'duration') {
      set[field] = value === '' ? null : (field === 'weight' ? parseFloat(value) : parseInt(value));
    } else {
      set[field] = value;
    }

    // Clear validation errors for this field when user types
    const errorKey = `${sessionIdx}-${exerciseIdx}-${setIdx}-${field}`;
    const newErrors = new Map(validationErrors);
    newErrors.delete(errorKey);
    
    // Also clear related field errors if validation passes
    if (field === 'weight' || field === 'reps') {
      const otherField = field === 'weight' ? 'reps' : 'weight';
      const otherErrorKey = `${sessionIdx}-${exerciseIdx}-${setIdx}-${otherField}`;
      const isTimed = exerciseDetails.get(updated.sessions[sessionIdx].exercises[exerciseIdx].name)?.is_timed || false;
      
      if (!isTimed) {
        const hasWeight = set.weight !== null && set.weight !== undefined && set.weight !== 0;
        const hasReps = set.reps !== null && set.reps !== undefined && set.reps !== 0;
        
        if (hasWeight || hasReps) {
          newErrors.delete(errorKey);
          newErrors.delete(otherErrorKey);
        }
      }
    }
    
    setValidationErrors(newErrors);

    // Recalculate total volume for the session
    let totalVolume = 0;
    updated.sessions[sessionIdx].exercises.forEach((ex: any) => {
      ex.sets.forEach((s: any) => {
        if (s.weight && s.reps) {
          totalVolume += s.weight * s.reps;
        }
      });
    });
    updated.sessions[sessionIdx].totalVolume = totalVolume;

    setEditingWorkout(updated);
  };

  const [deletedSetIds, setDeletedSetIds] = useState<Set<number>>(new Set());
  const wasEditingRef = useRef(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  const handleAddExercise = async () => {
    if (!editingWorkout || editingWorkout.sessions.length === 0) return;
    
    // Store that we were editing before navigating
    wasEditingRef.current = isEditing;
    
    // Store the current editing state in AsyncStorage so we can restore it
    await AsyncStorage.setItem('progress_editing_workout', JSON.stringify(editingWorkout));
    if (selectedWorkout) {
      await AsyncStorage.setItem('progress_selected_workout', JSON.stringify(selectedWorkout));
    }
    await AsyncStorage.setItem('progress_was_editing', isEditing ? 'true' : 'false');
    
    // Close modal first to allow navigation
    setModalVisible(false);
    
    // Small delay to ensure modal closes, then navigate
    setTimeout(() => {
      router.replace({
        pathname: '/exercise-select',
        params: { context: 'progress' }
      });
    }, 300);
  };


  const handleDeleteSet = async (sessionIdx: number, exerciseIdx: number, setIdx: number, setId: number | null) => {
    if (!setId) return;

    setDeleteConfirmType('set');
    setDeleteConfirmData({ sessionIdx, exerciseIdx, setIdx, setId });
    setDeleteConfirmVisible(true);
  };

  const performDeleteSet = async () => {
    if (!deleteConfirmData || !deleteConfirmData.setId) return;
    const { sessionIdx, exerciseIdx, setId } = deleteConfirmData;
    if (sessionIdx === undefined || exerciseIdx === undefined || !setId) return;

    if (isEditing) {
      // In edit mode: just mark for deletion and update local state
      setDeletedSetIds(prev => new Set(prev).add(setId));
      
      if (editingWorkout) {
        const updated = JSON.parse(JSON.stringify(editingWorkout));
        const session = updated.sessions[sessionIdx];
        if (session && session.exercises[exerciseIdx]) {
          // Remove the deleted set from local state
          session.exercises[exerciseIdx].sets = session.exercises[exerciseIdx].sets.filter((s: any) => s.id !== setId);
          
          // Remove exercise if no sets remain
          if (session.exercises[exerciseIdx].sets.length === 0) {
            session.exercises = session.exercises.filter((_: any, idx: number) => idx !== exerciseIdx);
          } else {
            // Recalculate total volume
            session.totalVolume = 0;
            session.exercises.forEach((ex: any) => {
              ex.sets.forEach((s: any) => {
                if (s.weight && s.reps) {
                  session.totalVolume += s.weight * s.reps;
                }
              });
            });
          }
          
          // Remove session if no exercises remain
          if (session.exercises.length === 0) {
            updated.sessions = updated.sessions.filter((_: any, idx: number) => idx !== sessionIdx);
          }
          
          setEditingWorkout(updated);
        }
      }
      
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
    } else {
      // Not in edit mode: delete immediately from database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert("Error", "You must be logged in to delete sets.");
          setDeleteConfirmVisible(false);
          setDeleteConfirmData(null);
          return;
        }

        const { error } = await supabase
          .from('workout_logs')
          .delete()
          .eq('id', setId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting set:', error);
          Alert.alert("Error", `Failed to delete set: ${error.message}`);
          setDeleteConfirmVisible(false);
          setDeleteConfirmData(null);
          return;
        }

        // Update local state immediately
        if (selectedWorkout) {
          const updatedWorkout = JSON.parse(JSON.stringify(selectedWorkout));
          const session = updatedWorkout.sessions[sessionIdx];
          if (session && session.exercises[exerciseIdx]) {
            // Remove the deleted set
            session.exercises[exerciseIdx].sets = session.exercises[exerciseIdx].sets.filter((s: any) => s.id !== setId);
            
            // Remove exercise if no sets remain
            if (session.exercises[exerciseIdx].sets.length === 0) {
              session.exercises = session.exercises.filter((_: any, idx: number) => idx !== exerciseIdx);
            } else {
              // Recalculate total volume
              session.totalVolume = 0;
              session.exercises.forEach((ex: any) => {
                ex.sets.forEach((s: any) => {
                  if (s.weight && s.reps) {
                    session.totalVolume += s.weight * s.reps;
                  }
                });
              });
            }
            
            // Remove session if no exercises remain
            if (session.exercises.length === 0) {
              updatedWorkout.sessions = updatedWorkout.sessions.filter((_: any, idx: number) => idx !== sessionIdx);
            }
            
            setSelectedWorkout(updatedWorkout);
          }
        }

        // Reload data in background
        loadWorkoutData(undefined, undefined, false);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
      } catch (error: any) {
        console.error('Error deleting set:', error);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        Alert.alert("Error", "Failed to delete set.");
      }
    }
  };

  const handleDeleteWorkout = async (sessionId: number | null) => {
    if (!selectedWorkout) return;

    setDeleteConfirmType('workout');
    setDeleteConfirmData({ sessionId });
    setDeleteConfirmVisible(true);
  };

  const performDeleteStandalone = async () => {
    if (!deleteConfirmData || !selectedWorkout) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to delete workouts.");
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Collect all log IDs from this workout
      const logIds: number[] = [];
      selectedWorkout.sessions.forEach(session => {
        session.exercises.forEach(exercise => {
          exercise.sets.forEach(set => {
            if (set.id) logIds.push(set.id);
          });
        });
      });

      if (logIds.length === 0) {
        Alert.alert("Error", "No sets to delete.");
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      const { error } = await supabase
        .from('workout_logs')
        .delete()
        .in('id', logIds)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting workout:', error);
        Alert.alert("Error", `Failed to delete workout: ${error.message}`);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Close modal and reload data
      setModalVisible(false);
      setSelectedWorkout(null);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      await loadWorkoutData(undefined, undefined, false);
      Alert.alert("Success", "Workout deleted successfully!");
    } catch (error: any) {
      console.error('Error deleting workout:', error);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      Alert.alert("Error", "Failed to delete workout.");
    }
  };

  const performDeleteSession = async () => {
    if (!deleteConfirmData || !deleteConfirmData.sessionId) return;
    const sessionId = deleteConfirmData.sessionId;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to delete workouts.");
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Delete all logs for this session
      const { error: logsError } = await supabase
        .from('workout_logs')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (logsError) {
        console.error('Error deleting workout logs:', logsError);
        Alert.alert("Error", `Failed to delete workout logs: ${logsError.message}`);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Delete the session
      const { error: sessionError } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (sessionError) {
        console.error('Error deleting session:', sessionError);
        Alert.alert("Error", `Failed to delete workout session: ${sessionError.message}`);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Close modal and reload data
      setModalVisible(false);
      setSelectedWorkout(null);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      await loadWorkoutData(undefined, undefined, false);
      Alert.alert("Success", "Workout deleted successfully!");
    } catch (error: any) {
      console.error('Error deleting workout:', error);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      Alert.alert("Error", "Failed to delete workout.");
    }
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmType === 'set') {
      performDeleteSet();
    } else {
      // Workout deletion
      if (!deleteConfirmData || !deleteConfirmData.sessionId) {
        performDeleteStandalone();
      } else {
        performDeleteSession();
      }
    }
  };

  const renderWorkoutDetail = () => {
    if (!selectedWorkout) return null;
    const displayWorkout = isEditing ? editingWorkout : selectedWorkout;
    if (!displayWorkout) return null;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (isEditing) {
            setUnsavedChangesVisible(true);
          } else {
            setModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{formatDate(selectedWorkout.date)}</Text>
              <View style={styles.modalHeaderActions}>
                {!isEditing ? (
                  <>
                    <TouchableOpacity onPress={handleEdit} style={styles.modalActionButton}>
                      <Edit2 color="#a3e635" size={20} />
                    </TouchableOpacity>
                    {displayWorkout.sessions.length > 0 && (
                      <TouchableOpacity 
                        onPress={() => {
                          handleDeleteWorkout(displayWorkout.sessions[0].session.id);
                        }}
                        style={styles.modalActionButton}
                        activeOpacity={0.7}
                      >
                        <Trash2 color="#ef4444" size={20} />
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <TouchableOpacity 
                    onPress={handleSaveEdit} 
                    style={[styles.modalActionButton, styles.modalSaveButton]}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#a3e635" />
                    ) : (
                      <Save color="#a3e635" size={20} />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    if (isEditing) {
                      setUnsavedChangesVisible(true);
                    } else {
                      setModalVisible(false);
                    }
                  }}
                  style={styles.modalActionButton}
                  activeOpacity={0.7}
                >
                  <X color="#9ca3af" size={24} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalScroll}>
              {displayWorkout.sessions.map((session, idx) => (
                <View key={idx} style={styles.modalSession}>
                  {session.session.day && (
                    <Text style={styles.modalDay}>{session.session.day}</Text>
                  )}
                  {session.duration && (
                    <View style={styles.modalStats}>
                      <Clock color="#9ca3af" size={16} />
                      <Text style={styles.modalStatText}>{session.duration} minutes</Text>
                    </View>
                  )}
                  {session.totalVolume > 0 && (
                    <View style={styles.modalStats}>
                      <TrendingUp color="#9ca3af" size={16} />
                      <Text style={styles.modalStatText}>{Math.round(session.totalVolume)} lbs total volume</Text>
                    </View>
                  )}

                  {session.exercises.map((exercise, exIdx) => {
                    const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
                    // Get target values from plan data
                    const planId = session.session.plan_id;
                    const day = session.session.day;
                    let targetReps: string | null = null;
                    let targetDuration: number | null = null;
                    let targetWeight: number | null = null;
                    
                    if (planId && day && planData.has(planId)) {
                      const plan = planData.get(planId);
                      const dayData = plan?.week_schedule?.[day];
                      if (dayData?.exercises) {
                        const exerciseData = dayData.exercises.find((ex: any) => ex.name === exercise.name);
                        if (exerciseData) {
                          if (isTimed) {
                            targetDuration = exerciseData.target_duration_sec || null;
                          } else {
                            targetReps = exerciseData.target_reps || null;
                            // Note: target_weight is not stored in plan, so we'll show "BW" or actual weight
                          }
                        }
                      }
                    }
                    
                    // Filter out deleted sets for display
                    const visibleSets = isEditing 
                      ? exercise.sets.filter((set: any) => !set.id || !deletedSetIds.has(set.id))
                      : exercise.sets;
                    
                    // Get exercise metadata from plan data
                    let exerciseRestTime: number | null = null;
                    let exerciseNotes: string | null = null;
                    const difficulty = exerciseDetails.get(exercise.name)?.difficulty_level || null;
                    
                    if (planId && day && planData.has(planId)) {
                      const plan = planData.get(planId);
                      const dayData = plan?.week_schedule?.[day];
                      if (dayData?.exercises) {
                        const exerciseData = dayData.exercises.find((ex: any) => ex.name === exercise.name);
                        if (exerciseData) {
                          exerciseRestTime = exerciseData.rest_time_sec || null;
                          exerciseNotes = exerciseData.notes || null;
                        }
                      }
                    }
                    
                    return (
                      <View key={exIdx} style={styles.modalExercise}>
                        <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                        {renderDifficultyIndicator(difficulty)}
                        {exerciseRestTime !== null && (
                          <View style={styles.modalExerciseMeta}>
                            <Text style={styles.modalExerciseMetaText}>Rest: {exerciseRestTime} sec</Text>
                          </View>
                        )}
                        {exerciseNotes && exerciseNotes.trim() && !isEditing && (
                          <View style={styles.modalExerciseNotes}>
                            <Text style={styles.modalExerciseNotesText}>{exerciseNotes}</Text>
                          </View>
                        )}
                        {visibleSets.map((set, displayIdx) => {
                          // Find the original index in the full sets array for updates
                          const originalSetIdx = exercise.sets.findIndex((s: any) => s === set);
                          return (
                            <View key={set.id || displayIdx} style={styles.modalSet}>
                            {isEditing ? (
                              <View style={styles.modalSetEdit}>
                                <View style={styles.modalSetEditHeader}>
                                  <Text style={styles.modalSetLabel}>Set {displayIdx + 1}</Text>
                                  {set.id && (
                                    <TouchableOpacity 
                                      onPress={() => {
                                        handleDeleteSet(idx, exIdx, originalSetIdx, set.id);
                                      }}
                                      style={styles.modalDeleteSetButton}
                                      activeOpacity={0.7}
                                    >
                                      <Trash2 color="#ef4444" size={16} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <View style={styles.modalSetInputs}>
                                  {!isTimed && (
                                    <>
                                      <View style={styles.modalSetInputGroup}>
                                        <View style={styles.modalSetInputLabelRow}>
                                          <Text style={styles.modalSetInputLabel}>Weight (lbs)</Text>
                                          <View style={styles.bodyweightCheckboxContainer}>
                                            <Text style={styles.bodyweightCheckboxLabel}>Bodyweight</Text>
                                            <TouchableOpacity
                                              style={styles.bodyweightCheckbox}
                                              onPress={() => {
                                                const key = `${idx}-${exIdx}-${originalSetIdx}`;
                                                const isChecked = bodyweightFlags.get(key) || false;
                                                setBodyweightFlags(prev => {
                                                  const newMap = new Map(prev);
                                                  newMap.set(key, !isChecked);
                                                  return newMap;
                                                });
                                                // Set weight to 0 if checked, clear if unchecked
                                                if (!isChecked) {
                                                  updateSetValue(idx, exIdx, originalSetIdx, 'weight', '0');
                                                } else {
                                                  updateSetValue(idx, exIdx, originalSetIdx, 'weight', '');
                                                }
                                              }}
                                              activeOpacity={0.7}
                                            >
                                              <View style={[
                                                styles.checkbox,
                                                bodyweightFlags.get(`${idx}-${exIdx}-${originalSetIdx}`) && styles.checkboxChecked
                                              ]}>
                                                {bodyweightFlags.get(`${idx}-${exIdx}-${originalSetIdx}`) && (
                                                  <Text style={styles.checkboxCheckmark}>✓</Text>
                                                )}
                                              </View>
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                        <TextInput
                                          style={[
                                            styles.modalSetInput,
                                            bodyweightFlags.get(`${idx}-${exIdx}-${originalSetIdx}`) && styles.modalSetInputDisabled,
                                            !set.id && validationErrors.has(`${idx}-${exIdx}-${originalSetIdx}-weight`) && styles.modalSetInputError
                                          ]}
                                          value={set.weight?.toString() || ''}
                                          onChangeText={(value) => {
                                            // If user types a value, uncheck bodyweight
                                            if (value && value !== '0') {
                                              const key = `${idx}-${exIdx}-${originalSetIdx}`;
                                              setBodyweightFlags(prev => {
                                                const newMap = new Map(prev);
                                                newMap.set(key, false);
                                                return newMap;
                                              });
                                            }
                                            updateSetValue(idx, exIdx, originalSetIdx, 'weight', value);
                                          }}
                                          keyboardType="numeric"
                                          placeholder={bodyweightFlags.get(`${idx}-${exIdx}-${originalSetIdx}`) ? "BW" : "0"}
                                          placeholderTextColor="#6b7280"
                                          editable={!bodyweightFlags.get(`${idx}-${exIdx}-${originalSetIdx}`)}
                                        />
                                        {(() => {
                                          if (set.id) return null;
                                          const errorMsg = validationErrors.get(`${idx}-${exIdx}-${originalSetIdx}-weight`);
                                          return errorMsg ? <Text style={styles.modalSetErrorText}>{errorMsg}</Text> : null;
                                        })()}
                                      </View>
                                      <View style={styles.modalSetInputGroup}>
                                        <View style={styles.modalSetInputLabelRow}>
                                          <Text style={styles.modalSetInputLabel}>Reps</Text>
                                          <View style={styles.modalSetInputLabelSpacer} />
                                        </View>
                                        <TextInput
                                          style={[
                                            styles.modalSetInput,
                                            !set.id && validationErrors.has(`${idx}-${exIdx}-${originalSetIdx}-reps`) && styles.modalSetInputError
                                          ]}
                                          value={set.reps?.toString() || ''}
                                          onChangeText={(value) => updateSetValue(idx, exIdx, originalSetIdx, 'reps', value)}
                                          keyboardType="numeric"
                                          placeholder="0"
                                          placeholderTextColor="#6b7280"
                                        />
                                        {(() => {
                                          if (set.id) return null;
                                          const errorMsg = validationErrors.get(`${idx}-${exIdx}-${originalSetIdx}-reps`);
                                          return errorMsg ? <Text style={styles.modalSetErrorText}>{errorMsg}</Text> : null;
                                        })()}
                                      </View>
                                    </>
                                  )}
                                  {isTimed && (
                                    <View style={styles.modalSetInputGroup}>
                                      <Text style={styles.modalSetInputLabel}>Duration</Text>
                                      <View style={styles.modalSetInputRow}>
                                        <View style={styles.modalSetInputHalf}>
                                          <Text style={styles.modalSetInputLabel}>Min</Text>
                                          <TextInput
                                            style={[
                                              styles.modalSetInput,
                                              !set.id && validationErrors.has(`${idx}-${exIdx}-${originalSetIdx}-duration`) && styles.modalSetInputError
                                            ]}
                                            value={durationMinutes.get(`${idx}-${exIdx}-${originalSetIdx}`) ?? (set.duration ? Math.floor(set.duration / 60).toString() : '')}
                                            onChangeText={(text) => {
                                              if (text === '' || (!isNaN(parseInt(text)) && parseInt(text) >= 0)) {
                                                setDurationMinutes(prev => {
                                                  const newMap = new Map(prev);
                                                  newMap.set(`${idx}-${exIdx}-${originalSetIdx}`, text);
                                                  return newMap;
                                                });
                                                const mins = text === '' ? 0 : parseInt(text) || 0;
                                                const secsKey = `${idx}-${exIdx}-${originalSetIdx}`;
                                                const secs = durationSeconds.has(secsKey) ? (parseInt(durationSeconds.get(secsKey) || '0') || 0) : (set.duration ? set.duration % 60 : 0);
                                                const totalSeconds = mins * 60 + secs;
                                                updateSetValue(idx, exIdx, originalSetIdx, 'duration', totalSeconds.toString());
                                              }
                                            }}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#6b7280"
                                          />
                                        </View>
                                        <View style={styles.modalSetInputHalf}>
                                          <Text style={styles.modalSetInputLabel}>Sec</Text>
                                          <TextInput
                                            style={[
                                              styles.modalSetInput,
                                              !set.id && validationErrors.has(`${idx}-${exIdx}-${originalSetIdx}-duration`) && styles.modalSetInputError
                                            ]}
                                            value={durationSeconds.get(`${idx}-${exIdx}-${originalSetIdx}`) ?? (set.duration ? (set.duration % 60).toString() : '')}
                                            onChangeText={(text) => {
                                              if (text === '' || (!isNaN(parseInt(text)) && parseInt(text) >= 0 && parseInt(text) < 60)) {
                                                setDurationSeconds(prev => {
                                                  const newMap = new Map(prev);
                                                  newMap.set(`${idx}-${exIdx}-${originalSetIdx}`, text);
                                                  return newMap;
                                                });
                                                const secs = text === '' ? 0 : parseInt(text) || 0;
                                                const minsKey = `${idx}-${exIdx}-${originalSetIdx}`;
                                                const mins = durationMinutes.has(minsKey) ? (parseInt(durationMinutes.get(minsKey) || '0') || 0) : (set.duration ? Math.floor(set.duration / 60) : 0);
                                                const totalSeconds = mins * 60 + secs;
                                                updateSetValue(idx, exIdx, originalSetIdx, 'duration', totalSeconds.toString());
                                              }
                                            }}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#6b7280"
                                          />
                                        </View>
                                      </View>
                                      {(() => {
                                        if (set.id) return null;
                                        const errorMsg = validationErrors.get(`${idx}-${exIdx}-${originalSetIdx}-duration`);
                                        return errorMsg ? <Text style={styles.modalSetErrorText}>{errorMsg}</Text> : null;
                                      })()}
                                    </View>
                                  )}
                                </View>
                                <View style={styles.modalSetInputGroup}>
                                  <Text style={styles.modalSetInputLabel}>Notes</Text>
                                  <TextInput
                                    style={[styles.modalSetInput, styles.modalSetNotesInput]}
                                    value={set.notes || ''}
                                    onChangeText={(value) => updateSetValue(idx, exIdx, originalSetIdx, 'notes', value)}
                                    placeholder="Optional notes..."
                                    placeholderTextColor="#6b7280"
                                    multiline
                                  />
                                </View>
                              </View>
                            ) : (
                              <View style={styles.modalSetRow}>
                                <View style={styles.modalSetContent}>
                                  <Text style={styles.modalSetText}>
                                    {isTimed ? (
                                      `Set ${displayIdx + 1}: ${formatDuration(set.duration)}${targetDuration ? ` / Target: ${formatDuration(targetDuration)}` : ''}`
                                    ) : (
                                      `Set ${displayIdx + 1}: ${set.weight ? `${set.weight}lbs` : 'BW'} × ${set.reps || 'N/A'} reps${targetReps ? ` / Target: ${targetReps}` : ''}`
                                    )}
                                  </Text>
                                  {set.notes && (
                                    <Text style={styles.modalNotes}>{set.notes}</Text>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            
            {/* Add Exercise Button - Only shown in edit mode */}
            {isEditing && displayWorkout.sessions.length > 0 && (
              <View style={styles.modalAddExerciseContainer}>
                <TouchableOpacity
                  style={styles.modalAddExerciseButton}
                  onPress={handleAddExercise}
                  activeOpacity={0.7}
                >
                  <Plus color="#a3e635" size={20} />
                  <Text style={styles.modalAddExerciseText}>Add Exercise</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          

          {/* Unsaved Changes Confirmation Overlay - Rendered inside workout detail modal */}
          {unsavedChangesVisible && (
            <View style={styles.deleteConfirmOverlay}>
              <View style={styles.deleteConfirmContent}>
                <Text style={styles.deleteConfirmTitle}>Unsaved Changes</Text>
                <Text style={styles.deleteConfirmMessage}>
                  You have unsaved changes. Are you sure you want to close?
                </Text>
                <View style={styles.deleteConfirmButtons}>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonCancel]}
                    onPress={() => {
                      setUnsavedChangesVisible(false);
                    }}
                  >
                    <Text style={styles.deleteConfirmButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonDelete]}
                    onPress={() => {
                      handleCancelEdit();
                      setUnsavedChangesVisible(false);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={styles.deleteConfirmButtonDeleteText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Delete Confirmation Overlay - Rendered inside workout detail modal */}
          {deleteConfirmVisible && (
            <View style={styles.deleteConfirmOverlay}>
              <View style={styles.deleteConfirmContent}>
                <Text style={styles.deleteConfirmTitle}>
                  {deleteConfirmType === 'set' ? 'Delete Set' : 'Delete Workout'}
                </Text>
                <Text style={styles.deleteConfirmMessage}>
                  {deleteConfirmType === 'set' 
                    ? isEditing 
                      ? 'Are you sure you want to delete this set? You can undo this by canceling your edits.'
                      : 'Are you sure you want to delete this set?'
                    : deleteConfirmData?.sessionId
                      ? 'Are you sure you want to delete this entire workout? This will delete all sets and the workout session.'
                      : 'Are you sure you want to delete all sets from this workout?'}
                </Text>
                <View style={styles.deleteConfirmButtons}>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonCancel]}
                    onPress={() => {
                      setDeleteConfirmVisible(false);
                      setDeleteConfirmData(null);
                    }}
                  >
                    <Text style={styles.deleteConfirmButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonDelete]}
                    onPress={handleConfirmDelete}
                  >
                    <Text style={styles.deleteConfirmButtonDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.viewModeSelector}>
          <Animated.View style={[styles.viewModeIndicator, indicatorStyle]} />
          <TouchableOpacity
            style={styles.viewModeButton}
            onPress={() => setViewMode('week')}
            onLayout={handleButtonLayout('week')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewModeButton}
            onPress={() => setViewMode('month')}
            onLayout={handleButtonLayout('month')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewModeButton}
            onPress={() => setViewMode('timeline')}
            onLayout={handleButtonLayout('timeline')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewModeText, viewMode === 'timeline' && styles.viewModeTextActive]}>Timeline</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <ProgressSkeleton />
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'timeline' && renderTimelineView()}
        </Animated.View>
      )}

      {renderWorkoutDetail()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
    backgroundColor: '#09090b', // zinc-950
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#a3e635', // lime-400
    marginBottom: 16,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 20,
    padding: 4,
    gap: 4,
    position: 'relative',
  },
  viewModeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: '#a3e635', // lime-400
    borderRadius: 16,
    shadowColor: '#a3e635', // lime-400
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    zIndex: 1,
  },
  viewModeText: {
    color: '#a1a1aa', // zinc-400
    fontWeight: '600',
    fontSize: 14,
  },
  viewModeTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Week View
  weekContainer: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  weekTitleContainer: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  weekSubtitle: {
    fontSize: 12,
    color: '#a1a1aa', // zinc-400
    marginTop: 2,
  },
  navButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  weekScroll: {
    flex: 1,
  },
  weekScrollContent: {
    paddingBottom: 120, // Extra padding to clear floating tab bar
    padding: 16,
    paddingTop: 8,
  },
  weekDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    minHeight: 80,
  },
  weekDayCardWithWorkout: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
    borderWidth: 2,
  },
  weekDayCardToday: {
    borderColor: '#60a5fa',
    backgroundColor: '#1e3a5f',
  },
  weekDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekDayDateContainer: {
    alignItems: 'center',
    minWidth: 50,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa', // zinc-400
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  weekDayNameToday: {
    color: '#60a5fa',
  },
  weekDayNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  weekDayNumberToday: {
    color: '#a3e635', // lime-400
  },
  todayBadge: {
    backgroundColor: '#a3e635', // lime-400
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 24, // rounded-3xl
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  weekDayWorkoutInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 16,
  },
  weekDayWorkoutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
  },
  weekDayStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekDayStatText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
  },
  weekDayArrow: {
    marginLeft: 8,
  },
  weekDayEmpty: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  weekDayEmptyText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // Month View
  monthContainer: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  monthTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  calendarScroll: {
    flex: 1,
  },
  calendarScrollContent: {
    paddingBottom: 16,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  calendarHeaderCell: {
    width: '14.28%',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa', // zinc-400
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 8,
    margin: 2,
    minHeight: 50,
  },
  calendarCellOtherMonth: {
    opacity: 0.25,
  },
  calendarCellWithWorkout: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  calendarDayText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  calendarDayTextOtherMonth: {
    color: '#6b7280',
  },
  calendarDayTextWithWorkout: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  calendarWorkoutIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a3e635', // lime-400
  },
  monthStats: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#a3e635', // lime-400
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#a1a1aa', // zinc-400
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Timeline View
  timelineCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  timelineDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineDate: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  timelineTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#09090b', // zinc-950
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timelineTime: {
    fontSize: 13,
    color: '#a1a1aa', // zinc-400
    fontWeight: '500',
  },
  timelineSession: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  timelineDay: {
    fontSize: 15,
    fontWeight: '700',
    color: '#a3e635', // lime-400
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineExercises: {
    gap: 12,
  },
  timelineExercise: {
    marginBottom: 12,
    backgroundColor: '#09090b', // zinc-950
    padding: 12,
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  timelineExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 6,
  },
  timelineExerciseSets: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    lineHeight: 20,
  },
  timelineFooter: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  timelineDuration: {
    fontSize: 13,
    color: '#a1a1aa', // zinc-400
    fontWeight: '500',
  },
  timelineVolume: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#09090b', // zinc-950
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalActionButton: {
    padding: 8,
    borderRadius: 16,
  },
  modalSaveButton: {
    backgroundColor: '#1e3a5f',
  },
  modalClose: {
    fontSize: 28,
    color: '#a1a1aa', // zinc-400
    fontWeight: '300',
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
    marginLeft: 8,
  },
  modalScroll: {
    padding: 20,
  },
  modalSession: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  modalDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#a3e635', // lime-400
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 12,
    borderRadius: 16,
  },
  modalStatText: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    fontWeight: '500',
  },
  modalExercise: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  modalExerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  difficultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  difficultyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  difficultyBar: {
    borderRadius: 2,
  },
  difficultyBar1: {
    width: 6,
    height: 8,
  },
  difficultyBar2: {
    width: 6,
    height: 12,
  },
  difficultyBar3: {
    width: 6,
    height: 16,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalExerciseMeta: {
    marginBottom: 8,
  },
  modalExerciseMetaText: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
  },
  modalExerciseNotes: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#09090b', // zinc-950
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  modalExerciseNotesText: {
    fontSize: 13,
    color: '#d1d5db',
    fontStyle: 'italic',
  },
  modalSet: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#374151',
  },
  modalSetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalSetContent: {
    flex: 1,
  },
  modalDeleteSetButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalSetText: {
    fontSize: 15,
    color: '#a1a1aa', // zinc-400
    lineHeight: 22,
  },
  modalSetEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSetEdit: {
    marginTop: 8,
  },
  modalSetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a1a1aa', // zinc-400
    marginBottom: 8,
  },
  modalSetInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalSetInputGroup: {
    flex: 1,
  },
  modalSetInputLabel: {
    fontSize: 12,
    color: '#a1a1aa', // zinc-400
    marginBottom: 6,
    fontWeight: '500',
  },
  modalSetInputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 20,
  },
  modalSetInputLabelSpacer: {
    width: 1,
  },
  modalSetInput: {
    backgroundColor: '#09090b', // zinc-950
    color: 'white',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    fontSize: 15,
  },
  modalSetInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalSetInputHalf: {
    flex: 1,
  },
  modalSetInputError: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  modalSetErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  bodyweightCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bodyweightCheckboxLabel: {
    fontSize: 12,
    color: '#a1a1aa', // zinc-400
  },
  bodyweightCheckbox: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#6b7280',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#a3e635', // lime-400
    borderColor: '#a3e635', // lime-400
  },
  checkboxCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalSetInputDisabled: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    opacity: 0.5,
  },
  modalSetNotesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 0,
  },
  modalNotes: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 6,
    paddingLeft: 8,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    textAlign: 'center',
  },
  // Delete Confirmation Overlay (rendered inside workout detail modal)
  deleteConfirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  deleteConfirmContent: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  deleteConfirmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  deleteConfirmMessage: {
    fontSize: 16,
    color: '#a1a1aa', // zinc-400
    lineHeight: 24,
    marginBottom: 24,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  deleteConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 100,
    alignItems: 'center',
  },
  deleteConfirmButtonCancel: {
    backgroundColor: 'rgba(39, 39, 42, 0.8)', // zinc-800/80
  },
  deleteConfirmButtonDelete: {
    backgroundColor: '#ef4444',
  },
  deleteConfirmButtonCancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButtonDeleteText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Add Exercise Button
  modalAddExerciseContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#09090b', // zinc-950
  },
  modalAddExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 16,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#3b82f6',
    gap: 8,
  },
  modalAddExerciseText: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
  },
});

