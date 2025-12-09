import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, TextInput, Modal, Platform, FlatList, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { X, Plus, ArrowLeft, GripVertical, Edit2 } from 'lucide-react-native';
import { PlannerDaySkeleton } from '../src/components/skeletons/PlannerDaySkeleton';
import { Toast } from '../src/components/Toast';
import { buildSupplementaryPrompt } from '../src/lib/aiPrompts';
import { extractJSON, JSONParseError } from '../src/lib/jsonParser';
import { validateAndNormalizeExercises } from '../src/lib/workoutValidation';
import { getCachedModel, clearModelCache } from '../src/lib/geminiModels';
import { getExercisePR, saveExercisePR, type PersonalRecord } from '../src/lib/personalRecord';
import { estimateExerciseDuration } from '../src/lib/timeEstimation';
import { computeExerciseHistoryMetrics, WorkoutLogLike } from '../src/lib/progressionMetrics';
import { computeProgressionSuggestion } from '../src/lib/progressionEngine';
import { applyVolumeTemplate } from '../src/lib/volumeTemplates';
import { filterExercisesByEquipment } from '../src/lib/equipmentFilter';
import { generateDaySessionWithAI } from '../src/lib/adaptiveWorkoutEngine';
import { calculateAllMuscleRecovery } from '../src/lib/muscleRecovery';

// Import draggable list for all platforms
let DraggableFlatList: any = null;
let ScaleDecorator: any = null;

try {
  const draggableModule = require('react-native-draggable-flatlist');
  DraggableFlatList = draggableModule.default || draggableModule;
  ScaleDecorator = draggableModule.ScaleDecorator || (({ children }: any) => children);
} catch (e) {
  console.warn('Failed to load draggable flatlist:', e);
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
  'Lunge', 'Lunges',
  'Jumping Jack', 'Jumping Jacks',
  'Pistol Squat',
  'Handstand Push Up', 'Handstand Push-Up',
  'Muscle Up', 'Muscle-Up'
];

const isBodyweightExercise = (exerciseName: string, detail: { is_timed?: boolean } | undefined): boolean => {
  // Timed exercises are always bodyweight
  if (detail?.is_timed) return true;
  
  // Check if exercise name matches common bodyweight exercises
  const nameMatch = BODYWEIGHT_EXERCISES.some(bw => 
    exerciseName.toLowerCase().includes(bw.toLowerCase())
  );
  
  return nameMatch;
};

export default function PlannerDayScreen() {
  const router = useRouter();
  const { day, planId, date, weekStart, exerciseAdded } = useLocalSearchParams<{ 
    day: string; 
    planId: string; 
    date?: string;
    weekStart?: string;
    exerciseAdded?: string;
  }>();
  const [plan, setPlan] = useState<any>(null);
  const [dayData, setDayData] = useState<any>({ exercises: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userFeedback, setUserFeedback] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, { is_timed: boolean; default_duration_sec: number | null; difficulty: string | null; user_seconds_per_rep_override: number | null; base_seconds_per_rep: number | null }>>(new Map());
  const [durationMinutes, setDurationMinutes] = useState<Map<number, string>>(new Map());
  const [durationSeconds, setDurationSeconds] = useState<Map<number, string>>(new Map());
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const dragAllowedRef = React.useRef<number | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [targetDurationMin, setTargetDurationMin] = useState<number | null>(null);
  const [estimatedDurationSec, setEstimatedDurationSec] = useState<number | null>(null);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const durationPickerScrollRef = React.useRef<ScrollView>(null);
  const [exercisePRs, setExercisePRs] = useState<Map<string, PersonalRecord | null>>(new Map());
  const [exerciseEstimatedTimes, setExerciseEstimatedTimes] = useState<Map<string, number>>(new Map());
  const [editingPR, setEditingPR] = useState<{ exerciseName: string; pr: PersonalRecord | null } | null>(null);
  const [prEditWeight, setPrEditWeight] = useState<string>('');
  const [prEditReps, setPrEditReps] = useState<string>('');

  useEffect(() => {
    loadUserProfile();
    loadUserFeedback();
    
    // Cleanup: save any pending changes when component unmounts
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Migrate timed exercises that have target_reps instead of target_duration_sec
  useEffect(() => {
    if (!day || !plan || !dayData?.exercises || exerciseDetails.size === 0) {
      return;
    }
    
    let needsMigration = false;
    const updatedExercises = dayData.exercises.map((ex: any, index: number) => {
      if (!ex.name) return ex;
      const detail = exerciseDetails.get(ex.name);
      const isTimed = detail?.is_timed || false;
      
      if (isTimed && ex.target_reps && !ex.target_duration_sec) {
        needsMigration = true;
        return {
          ...ex,
          target_reps: null,
          target_duration_sec: detail?.default_duration_sec || 60
        };
      }
      return ex;
    });
    
    if (needsMigration) {
        const updatedDayData = {
          ...dayData,
          exercises: updatedExercises
        };
        setDayData(updatedDayData);
        const updatedPlan = { ...plan };
        
        // Initialize plan_data structure if needed
        if (!updatedPlan.plan_data) {
          updatedPlan.plan_data = { week_schedule: {}, weeks: {} };
        }
        if (!updatedPlan.plan_data.weeks) {
          updatedPlan.plan_data.weeks = {};
        }
        
        // Save to week-specific location if weekStart is provided
        if (weekStart) {
          if (!updatedPlan.plan_data.weeks[weekStart]) {
            updatedPlan.plan_data.weeks[weekStart] = { week_schedule: {} };
          }
          updatedPlan.plan_data.weeks[weekStart].week_schedule[day] = updatedDayData;
        } else {
          if (!updatedPlan.plan_data.week_schedule) {
            updatedPlan.plan_data.week_schedule = {};
          }
          updatedPlan.plan_data.week_schedule[day] = updatedDayData;
        }
        
        setPlan(updatedPlan);
        savePlan(updatedDayData, true, false);
    }
    // Use exerciseDetails.size and exercise count/length to detect changes
    // Avoid JSON.stringify in dependency array as it creates new objects on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseDetails.size, day, plan?.id, dayData?.exercises?.length]);

  useFocusEffect(
    useCallback(() => {
      // Reload plan when returning to screen (e.g., after editing sets in workout-sets)
      // This ensures estimation recalculates with latest data
      loadPlan();
      if (exerciseAdded === 'true') {
        setToastMessage('Exercise added!');
        setToastVisible(true);
      }
    }, [planId, exerciseAdded])
  );

  const handleBack = () => {
    // Use replace to prevent navigation stacking
    try {
      router.replace('/(tabs)/planner');
    } catch (error) {
      router.replace('/(tabs)/planner');
    }
  };

  // Migrate rep ranges to single numeric values
  const migrateRepRange = (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Parse range like "8-12" -> 8 (minimum)
      if (value.includes('-')) {
        const [min] = value.split('-').map(n => parseInt(n.trim()));
        return isNaN(min) ? null : min;
      }
      // Parse single number
      const parsed = parseInt(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const loadPlan = async () => {
    if (!planId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', parseInt(planId))
      .single();

    if (error) {
      console.error('Error loading plan:', error);
      setIsLoading(false);
      Alert.alert("Error", "Failed to load workout plan.");
      handleBack();
    } else if (data) {
      setPlan(data);
      
      // Load duration mode from plan
      // Duration mode removed - using constraint-based approach
      
      if (day) {
        let loadedDayData: any = null;
        
        // Only use week-specific data (no template fallback)
        if (weekStart && data.plan_data?.weeks?.[weekStart]?.week_schedule?.[day]) {
          loadedDayData = data.plan_data.weeks[weekStart].week_schedule[day];
        }
        
        if (loadedDayData) {
          // Migrate rep ranges to numeric values
          let needsMigration = false;
          const migratedExercises = (loadedDayData.exercises || []).map((ex: any) => {
            if (ex.target_reps && typeof ex.target_reps === 'string') {
              needsMigration = true;
              return { ...ex, target_reps: migrateRepRange(ex.target_reps) };
            }
            return ex;
          });
          
          if (needsMigration) {
            const migratedDayData = { ...loadedDayData, exercises: migratedExercises };
            setDayData(migratedDayData);
            setTargetDurationMin(
              typeof migratedDayData.target_duration_min === 'number'
                ? migratedDayData.target_duration_min
                : null,
            );
            
            // Save migrated data back to database
            const updatedPlan = { ...data };
            if (weekStart && updatedPlan.plan_data.weeks?.[weekStart]) {
              updatedPlan.plan_data.weeks[weekStart].week_schedule[day] = migratedDayData;
            } else {
              updatedPlan.plan_data.week_schedule[day] = migratedDayData;
            }
            setPlan(updatedPlan);
            
            // Save to database
            const { error: saveError } = await supabase
              .from('workout_plans')
              .update({ plan_data: updatedPlan.plan_data })
              .eq('id', parseInt(planId));
            
            if (saveError) {
              console.error('Error saving migrated plan:', saveError);
            }
          } else {
            setDayData(loadedDayData);
            setTargetDurationMin(
              typeof loadedDayData.target_duration_min === 'number'
                ? loadedDayData.target_duration_min
                : null,
            );
          }
          
          // Load exercise details and PRs
          await loadExerciseDetails(loadedDayData.exercises || []);
          await loadExercisePRs(loadedDayData.exercises || []);
        } else {
          // No data found, use empty exercises
          setDayData({ exercises: [] });
          setTargetDurationMin(null);
        }
        
        // Check for active workout session
        const { data: { user } } = await supabase.auth.getUser();
        if (user && day) {
          const { data: activeSession } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', parseInt(planId))
            .eq('day', day)
            .eq('status', 'active')
            .maybeSingle();
          
          setHasActiveWorkout(!!activeSession);
        } else {
          setHasActiveWorkout(false);
        }
      }
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  };

  const loadExerciseDetails = async (exercises: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !exercises.length) return;

    const exerciseNames = exercises.map((ex: any) => ex.name).filter(Boolean);
    if (exerciseNames.length === 0) return;

    const detailsMap = new Map<string, { is_timed: boolean; default_duration_sec: number | null; difficulty: string | null; user_seconds_per_rep_override: number | null; base_seconds_per_rep: number | null }>();

    // Batch query all exercises from master exercises table
    // Note: exercises table doesn't have default_duration_sec, only user_exercises does
    const { data: masterExercises, error: masterError } = await supabase
      .from('exercises')
      .select('name, is_timed, difficulty_level, base_seconds_per_rep')
      .in('name', exerciseNames);

    if (masterError) {
      console.error('Error loading master exercises:', masterError);
    }

    // Batch query all user exercises
    // Note: user_exercises table does NOT have difficulty_level column (only exercises table has it)
    const { data: userExercises, error: userError } = await supabase
      .from('user_exercises')
      .select('name, is_timed, default_duration_sec, user_seconds_per_rep_override')
      .eq('user_id', user.id)
      .in('name', exerciseNames);

    if (userError) {
      console.error('Error loading user exercises:', userError);
    }

    // Create maps for quick lookup (both exact and lowercase for case-insensitive matching)
    const masterExerciseMap = new Map(
      (masterExercises || []).map((ex: any) => [ex.name, ex])
    );
    const masterExerciseMapLower = new Map(
      (masterExercises || []).map((ex: any) => [ex.name.toLowerCase(), ex])
    );
    const userExerciseMap = new Map(
      (userExercises || []).map((ex: any) => [ex.name, ex])
    );
    const userExerciseMapLower = new Map(
      (userExercises || []).map((ex: any) => [ex.name.toLowerCase(), ex])
    );

    // Merge results: user exercises take precedence over master exercises
    for (const exercise of exercises) {
      if (!exercise.name) continue;
      
      // Try exact match first
      let userExercise = userExerciseMap.get(exercise.name);
      let masterExercise = masterExerciseMap.get(exercise.name);
      
      // If not found, try case-insensitive match using pre-built lowercase maps
      if (!userExercise && !masterExercise) {
        const exerciseNameLower = exercise.name.toLowerCase();
        userExercise = userExerciseMapLower.get(exerciseNameLower);
        masterExercise = masterExerciseMapLower.get(exerciseNameLower);
      }
      
      if (userExercise) {
        // User exercises don't have difficulty_level, so get it from master exercises if available
        const difficulty = masterExercise?.difficulty_level || null;
        detailsMap.set(exercise.name, {
          is_timed: userExercise.is_timed || false,
          default_duration_sec: userExercise.default_duration_sec,
          difficulty: difficulty,
          user_seconds_per_rep_override: userExercise.user_seconds_per_rep_override || null,
          base_seconds_per_rep: masterExercise?.base_seconds_per_rep || null,
        });
      } else if (masterExercise) {
        detailsMap.set(exercise.name, {
          is_timed: masterExercise.is_timed || false,
          default_duration_sec: null, // Master exercises table doesn't have default_duration_sec, use null (will default to 60 in code)
          difficulty: masterExercise.difficulty_level || null,
          user_seconds_per_rep_override: null,
          base_seconds_per_rep: masterExercise.base_seconds_per_rep || null,
        });
      } else {
        // Default values if not found in either table
        detailsMap.set(exercise.name, {
          is_timed: false,
          default_duration_sec: null,
          difficulty: null
        });
      }
    }

    setExerciseDetails(detailsMap);
  };

  const loadExercisePRs = async (exercises: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !exercises.length) return;

    const prsMap = new Map<string, PersonalRecord | null>();
    
    for (const exercise of exercises) {
      if (!exercise.name) continue;
      
      try {
        const pr = await getExercisePR(user.id, exercise.name);
        prsMap.set(exercise.name, pr);
      } catch (error) {
        if (__DEV__) {
          console.error(`[planner-day] Error loading PR for ${exercise.name}:`, error);
        }
        prsMap.set(exercise.name, null);
      }
    }
    
    setExercisePRs(prsMap);
  };

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setUserProfile(data);
    }
  };

  const loadUserFeedback = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('workout_feedback')
      .eq('id', user.id)
      .single();

    if (!error && data?.workout_feedback) {
      setUserFeedback(data.workout_feedback);
    }
  };

  const savePlan = async (updatedDayData: any, immediate: boolean = false, skipStateUpdate: boolean = false) => {
    if (!plan || !day) {
      console.error('savePlan: Missing plan or day', { plan: !!plan, day });
      return;
    }

    try {
      // Helper function to safely get or create nested structure
      const ensureStructure = (planObj: any) => {
        if (!planObj.plan_data) {
          planObj.plan_data = { week_schedule: {}, weeks: {} };
        }
        if (!planObj.plan_data.weeks) {
          planObj.plan_data.weeks = {};
        }
        if (!planObj.plan_data.week_schedule) {
          planObj.plan_data.week_schedule = {};
        }
        
        if (weekStart) {
          if (!planObj.plan_data.weeks[weekStart]) {
            planObj.plan_data.weeks[weekStart] = { week_schedule: {} };
          }
          if (!planObj.plan_data.weeks[weekStart].week_schedule) {
            planObj.plan_data.weeks[weekStart].week_schedule = {};
          }
        }
      };

      // Prepare the updated plan structure
      // Deep copy to avoid mutating the original plan
      let updatedPlan;
      try {
        updatedPlan = JSON.parse(JSON.stringify(plan));
      } catch (copyError) {
        console.error('Error deep copying plan:', copyError);
        Alert.alert("Error", "Failed to update plan. Please try again.");
        return;
      }
      
      ensureStructure(updatedPlan);
      
      // Save to week-specific location if weekStart is provided, otherwise save to template
      if (weekStart) {
        updatedPlan.plan_data.weeks[weekStart].week_schedule[day] = updatedDayData;
      } else {
        updatedPlan.plan_data.week_schedule[day] = updatedDayData;
      }

      // Update local state immediately for instant UI feedback (unless skipping for focus input)
      if (!skipStateUpdate) {
        setDayData(updatedDayData);
        setPlan(updatedPlan);
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce database save - only save after user stops typing for 1 second
      const performSave = async () => {
        try {
          const { error } = await supabase
            .from('workout_plans')
            .update({ plan_data: updatedPlan.plan_data })
            .eq('id', plan.id);

          if (error) {
            console.error('Error saving plan:', error);
            Alert.alert("Error", "Failed to save changes. Please try again.");
            throw error;
          } else {
            // Only update state after successful save if we skipped it earlier
            if (skipStateUpdate) {
              setDayData(updatedDayData);
              setPlan(updatedPlan);
            }
          }
        } catch (saveError: any) {
          console.error('Error in performSave:', saveError);
          throw saveError;
        }
      };

      if (immediate) {
        // Save immediately for actions like delete, reorder, etc.
        await performSave();
      } else {
        // Debounce for text input changes
        saveTimeoutRef.current = setTimeout(performSave, 1000);
      }
    } catch (error: any) {
      console.error('Error in savePlan:', error);
      Alert.alert("Error", error.message || "Failed to save changes. Please try again.");
    }
  };

  const updateTargetDuration = (minutes: number) => {
    const current = dayData || { exercises: [] };
    const updatedDayData = {
      ...current,
      target_duration_min: minutes,
    };
    setTargetDurationMin(minutes);
    savePlan(updatedDayData, true);
  };

  const estimateSessionDuration = useCallback(
    (exercises: any[]): number => {
      if (!Array.isArray(exercises) || exercises.length === 0) return 0;
      let total = 0;

      exercises.forEach((ex: any, idx: number) => {
        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        const isTimed = sets.some((s: any) => s.duration != null);

        if (isTimed) {
          sets.forEach((s: any) => {
            const duration = typeof s.duration === 'number' ? s.duration : 0;
            const rest = typeof s.rest_time_sec === 'number' ? s.rest_time_sec : ex.rest_time_sec || 0;
            total += duration + rest;
          });
        } else {
          const targetSets =
            typeof ex.target_sets === 'number' && ex.target_sets > 0
              ? ex.target_sets
              : sets.length > 0
              ? sets.length
              : 3;
          const targetReps =
            typeof ex.target_reps === 'number'
              ? ex.target_reps
              : typeof sets[0]?.reps === 'number'
              ? sets[0].reps
              : 8;

          const estimation = estimateExerciseDuration({
            targetSets,
            targetReps,
            movementPattern: ex.movement_pattern || null,
            tempoCategory: ex.tempo_category || null,
            setupBufferSec: ex.setup_buffer_sec || null,
            isUnilateral: ex.is_unilateral || false,
            positionIndex: idx,
          });

          const restPerSet =
            typeof ex.rest_time_sec === 'number'
              ? ex.rest_time_sec
              : typeof sets[0]?.rest_time_sec === 'number'
              ? sets[0].rest_time_sec
              : 60;

          total += estimation.estimatedDurationSec + restPerSet * targetSets;
        }
      });

      return total;
    },
    [],
  );

  // Calculate estimated time per exercise and total session duration
  useEffect(() => {
    const exercises = dayData.exercises || [];
    const timesMap = new Map<string, number>();
    let total = 0;

    exercises.forEach((ex: any, idx: number) => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      const isTimed = sets.some((s: any) => s.duration != null);

      let exerciseTime = 0;

      if (isTimed) {
        sets.forEach((s: any) => {
          const duration = typeof s.duration === 'number' ? s.duration : 0;
          const rest = typeof s.rest_time_sec === 'number' ? s.rest_time_sec : ex.rest_time_sec || 0;
          exerciseTime += duration + rest;
        });
      } else {
        const targetSets =
          typeof ex.target_sets === 'number' && ex.target_sets > 0
            ? ex.target_sets
            : sets.length > 0
            ? sets.length
            : 3;
        const targetReps =
          typeof ex.target_reps === 'number'
            ? ex.target_reps
            : typeof sets[0]?.reps === 'number'
            ? sets[0].reps
            : 8;

        const detail = exerciseDetails.get(ex.name);
        const estimation = estimateExerciseDuration({
          targetSets,
          targetReps,
          movementPattern: ex.movement_pattern || null,
          tempoCategory: ex.tempo_category || null,
          setupBufferSec: ex.setup_buffer_sec || null,
          isUnilateral: ex.is_unilateral || false,
          positionIndex: idx,
          userSecondsPerRepOverride: detail?.user_seconds_per_rep_override || null,
          baseSecondsPerRep: detail?.base_seconds_per_rep || null,
        });

        const restPerSet =
          typeof ex.rest_time_sec === 'number'
            ? ex.rest_time_sec
            : typeof sets[0]?.rest_time_sec === 'number'
            ? sets[0].rest_time_sec
            : 60;

        exerciseTime = estimation.estimatedDurationSec + restPerSet * targetSets;
      }

      if (ex.name) {
        timesMap.set(ex.name, exerciseTime);
      }
      total += exerciseTime;
    });

    setExerciseEstimatedTimes(timesMap);
    setEstimatedDurationSec(total || null);
  }, [dayData.exercises]);

  const generateForDay = async () => {
    if (!userProfile) {
      Alert.alert("Error", "Please complete your profile setup first.");
      return;
    }

    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        setGenerating(false);
        return;
      }

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        Alert.alert("Error", "AI API key not configured.");
        setGenerating(false);
        return;
      }

      const existingExercises = dayData.exercises || [];

      // Load available exercises from database with equipment_needed
      const { data: masterExercises } = await supabase
        .from('exercises')
        .select('name, is_timed, equipment_needed, muscle_groups')
        .order('name', { ascending: true });

      const { data: userExercises } = await supabase
        .from('user_exercises')
        .select('name, is_timed, equipment_needed, muscle_groups')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      // Filter exercises by user's available equipment
      const userEquipment = userProfile.equipment_access || [];
      const filteredMasterExercises = filterExercisesByEquipment(
        (masterExercises || []) as any,
        userEquipment
      );
      const filteredUserExercises = filterExercisesByEquipment(
        (userExercises || []) as any,
        userEquipment
      );

      const availableExerciseNames = [
        ...(filteredMasterExercises || []).map((ex: any) => ex.name),
        ...(filteredUserExercises || []).map((ex: any) => ex.name)
      ].filter(Boolean);

      // Fetch workout_logs for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: fetchedLogs } = await supabase
        .from('workout_logs')
        .select('exercise_name, weight, reps, scheduled_weight, scheduled_reps, performed_at')
        .eq('user_id', user.id)
        .gte('performed_at', thirtyDaysAgo.toISOString())
        .order('performed_at', { ascending: false });

      const recentLogs = fetchedLogs || [];

      // Build exercise history map (for prompt context)
      const exerciseHistory = new Map<string, Array<{ weight: number; reps: number; performed_at: string }>>();
      recentLogs.forEach((log: any) => {
        if (!log.exercise_name) return;
        const history = exerciseHistory.get(log.exercise_name) || [];
        history.push({
          weight: log.weight,
          reps: log.reps,
          performed_at: log.performed_at,
        });
        exerciseHistory.set(log.exercise_name, history);
      });

      // Sort and limit history per exercise
      exerciseHistory.forEach((history, exerciseName) => {
        history.sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
        exerciseHistory.set(exerciseName, history.slice(0, 10));
      });

      // Fetch user_exercises for PRs
      const { data: userExercisesWithPR } = await supabase
        .from('user_exercises')
        .select('name, pr_weight, pr_reps')
        .eq('user_id', user.id)
        .not('pr_weight', 'is', null);

      const exercisePRs = new Map<string, { weight: number; reps: number | null }>();
      if (userExercisesWithPR) {
        userExercisesWithPR.forEach((ue: any) => {
          if (ue.pr_weight && ue.pr_weight > 0) {
            exercisePRs.set(ue.name, {
              weight: ue.pr_weight,
              reps: ue.pr_reps || null,
            });
          }
        });
      }

      // Calculate muscle recovery (handle empty logs)
      // Convert logs to format expected by calculateAllMuscleRecovery
      let muscleRecovery = new Map();
      
      if (recentLogs.length > 0) {
        // Group logs by workout session (performed_at date, rounded to day)
        const logsBySession = new Map<string, typeof recentLogs>();
        recentLogs.forEach((log: any) => {
          if (!log.performed_at) return;
          // Group by date (YYYY-MM-DD) to treat all logs on same day as one workout
          const date = new Date(log.performed_at);
          const sessionKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const sessionLogs = logsBySession.get(sessionKey) || [];
          sessionLogs.push(log);
          logsBySession.set(sessionKey, sessionLogs);
        });

        // Fetch muscle_groups for exercises
        const allExerciseNames = new Set<string>();
        recentLogs.forEach((log: any) => {
          if (log.exercise_name) allExerciseNames.add(log.exercise_name);
        });

        const { data: exerciseMetadata } = await supabase
          .from('exercises')
          .select('name, muscle_groups')
          .in('name', Array.from(allExerciseNames));

        const { data: userExerciseMetadata } = await supabase
          .from('user_exercises')
          .select('name, muscle_groups')
          .eq('user_id', user.id)
          .in('name', Array.from(allExerciseNames));

        const exerciseMuscleGroups = new Map<string, string[]>();
        [...(exerciseMetadata || []), ...(userExerciseMetadata || [])].forEach((ex: any) => {
          if (ex.muscle_groups && Array.isArray(ex.muscle_groups)) {
            exerciseMuscleGroups.set(ex.name, ex.muscle_groups);
          }
        });

        // Convert to workout history format
        const workoutHistoryForRecovery: Array<{
          sets: Array<{
            weight: number | null;
            reps: number | null;
            muscleGroups?: string[] | null;
          }>;
          performedAt: Date;
        }> = [];

        logsBySession.forEach((sessionLogs, sessionKey) => {
          const sets = sessionLogs.map((log: any) => ({
            weight: log.weight,
            reps: log.reps,
            muscleGroups: exerciseMuscleGroups.get(log.exercise_name) || null,
          }));

          // Use the date from the session key
          const [year, month, day] = sessionKey.split('-').map(Number);
          workoutHistoryForRecovery.push({
            sets,
            performedAt: new Date(year, month - 1, day),
          });
        });

        muscleRecovery = calculateAllMuscleRecovery(workoutHistoryForRecovery);
      }
      // If empty logs, muscleRecovery stays as empty Map (all muscles treated as 100% recovered)

      // Fetch current plan for context (if exists)
      let currentWeekSchedule: any = null;
      if (planId) {
        const { data: currentPlan } = await supabase
          .from('workout_plans')
          .select('plan_data')
          .eq('id', planId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (currentPlan?.plan_data) {
          // Get current week's schedule
          const today = new Date();
          const dayOfWeek = today.getDay();
          const diff = today.getDate() - dayOfWeek;
          const weekStart = new Date(today);
          weekStart.setDate(diff);
          weekStart.setHours(0, 0, 0, 0);
          
          const year = weekStart.getFullYear();
          const month = String(weekStart.getMonth() + 1).padStart(2, '0');
          const day = String(weekStart.getDate()).padStart(2, '0');
          const weekKey = `${year}-${month}-${day}`;

          if (currentPlan.plan_data.weeks?.[weekKey]?.week_schedule) {
            currentWeekSchedule = currentPlan.plan_data.weeks[weekKey].week_schedule;
          } else if (currentPlan.plan_data.week_schedule) {
            currentWeekSchedule = currentPlan.plan_data.week_schedule;
          }
        }
      }

      // Call the new engine
      const result = await generateDaySessionWithAI({
        profile: userProfile,
        day: day || '',
        existingExercises: existingExercises,
        timeConstraintMin: targetDurationMin || 45,
        availableExercises: availableExerciseNames,
        recentLogs: recentLogs,
        personalRecords: exercisePRs,
        muscleRecovery: muscleRecovery,
        exerciseHistory: exerciseHistory,
        currentWeekSchedule: currentWeekSchedule,
        apiKey: apiKey,
      });

      // Update day data with result
      const updatedDayData = {
        ...dayData,
        exercises: result.session.exercises,
      };

      await savePlan(updatedDayData, true);
      // Reload exercise details after adding new exercises
      await loadExerciseDetails(result.session.exercises);
      setHasGenerated(true);
      
      const newExerciseCount = result.session.exercises.length - existingExercises.length;
      let message = `Added ${newExerciseCount} exercise${newExerciseCount !== 1 ? 's' : ''}!`;
      if (result.wasCompressed) {
        message += ` (Compressed to fit ${targetDurationMin || 45} min)`;
      }
      setToastMessage(message);
      setToastVisible(true);
    } catch (error: any) {
      if (__DEV__) {
        console.error('Error generating exercises:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      // If it's a model not found error, clear the cache to try a different model next time
      if (error.message && (error.message.includes('not found') || error.message.includes('404'))) {
        clearModelCache();
        if (__DEV__) {
          console.log('Cleared model cache due to model not found error');
        }
      }
      
      // Provide user-friendly error messages
      let errorMessage = "Failed to generate exercises. Please try again.";
      if (error.message) {
        if (error.message.includes('parse') || error.message.includes('JSON')) {
          errorMessage = "The AI response was in an unexpected format. Please try generating again.";
        } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
          errorMessage = "The generated exercises had validation issues. Please try generating again.";
        } else if (error.message.includes('not found') || error.message.includes('404')) {
          errorMessage = "The AI model is not available. Please try again in a moment.";
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const removeExercise = async (index: number) => {
    try {
      if (!dayData || !dayData.exercises || !Array.isArray(dayData.exercises)) {
        console.error('Invalid dayData or exercises array');
        Alert.alert("Error", "Cannot delete exercise: invalid data structure.");
        return;
      }
      
      if (index < 0 || index >= dayData.exercises.length) {
        console.error('Invalid index:', index, 'Array length:', dayData.exercises.length);
        Alert.alert("Error", "Cannot delete exercise: invalid index.");
        return;
      }
      
      const updatedExercises = dayData.exercises.filter((_: any, i: number) => i !== index);
      const updatedDayData = {
        ...dayData,
        exercises: updatedExercises
      };
      
      // Immediate save for delete action
      await savePlan(updatedDayData, true);
    } catch (error: any) {
      console.error('Error removing exercise:', error);
      Alert.alert("Error", error.message || "Failed to delete exercise. Please try again.");
    }
  };

  const updateExercise = (index: number, field: string, value: any) => {
    const updatedExercises = [...dayData.exercises];
    updatedExercises[index] = { ...updatedExercises[index], [field]: value };
    const updatedDayData = {
      ...dayData,
      exercises: updatedExercises
    };
    // Debounced save - updates local state immediately, saves to DB after 1 second of inactivity
    savePlan(updatedDayData, false);
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const exercises = [...dayData.exercises];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= exercises.length) return;
    
    [exercises[index], exercises[newIndex]] = [exercises[newIndex], exercises[index]];
    const updatedDayData = {
      ...dayData,
      exercises
    };
    // Immediate save for reorder action
    savePlan(updatedDayData, true);
  };

  const handleDragEnd = ({ data }: { data: any[] }) => {
    // Don't allow drag if workout is active
    if (hasActiveWorkout) {
      dragAllowedRef.current = null;
      return;
    }
    // Only allow drag end if drag was started from grip handle
    if (dragAllowedRef.current !== null && plan && day) {
      // Update state immediately and synchronously
      const updatedDayData = {
        ...dayData,
        exercises: data
      };
      
      // Update state synchronously before any async operations
      setDayData(updatedDayData);
      
      // Save to database (async, but state is already updated)
      // Let savePlan handle the structure updates properly
      savePlan(updatedDayData, true, false); // Don't skip state update, let savePlan handle it
    }
    dragAllowedRef.current = null;
  };

  // Web drag handlers using touch/mouse events (React Native Responder System)
  const handleWebTouchStart = (index: number, e: any) => {
    if (Platform.OS === 'web') {
      // Don't allow drag if workout is active
      if (hasActiveWorkout) {
        return;
      }
      // Only allow drag if initiated from grip handle
      if (dragAllowedRef.current !== index) {
        return;
      }
      const touch = e.nativeEvent?.touches?.[0] || e.nativeEvent || e;
      setDraggedIndex(index);
      setDragStartY(touch.clientY || touch.pageY || 0);
    }
  };

  const handleWebTouchMove = (index: number, e: any) => {
    if (Platform.OS === 'web' && draggedIndex !== null && draggedIndex === index) {
      const touch = e.nativeEvent?.touches?.[0] || e.nativeEvent || e;
      const currentY = touch.clientY || touch.pageY || 0;
      
      // Find which card we're over based on position
      // This is a simplified approach - in production you'd use refs to get element positions
      if (Math.abs(currentY - dragStartY) > 20) {
        // Only update if we've moved significantly
        const cardHeight = 150; // Approximate card height
        const offset = Math.round((currentY - dragStartY) / cardHeight);
        // Allow index to be up to exercises.length (for placing at the end)
        const newIndex = Math.max(0, Math.min(dayData.exercises.length, draggedIndex + offset));
        
        if (newIndex !== draggedIndex && newIndex !== dragOverIndex) {
          setDragOverIndex(newIndex);
        }
      }
    }
  };
  
  // Add global mouse move handler for web drag
  useEffect(() => {
    if (Platform.OS === 'web' && draggedIndex !== null) {
      const handleMouseMove = (e: MouseEvent) => {
        const currentY = e.clientY;
        if (Math.abs(currentY - dragStartY) > 20) {
          const cardHeight = 150;
          const offset = Math.round((currentY - dragStartY) / cardHeight);
          // Allow index to be up to exercises.length (for placing at the end)
          const newIndex = Math.max(0, Math.min(dayData.exercises.length, draggedIndex + offset));
          
          if (newIndex !== draggedIndex && newIndex !== dragOverIndex) {
            setDragOverIndex(newIndex);
          }
        }
      };
      
      const handleMouseUp = () => {
        handleWebTouchEnd();
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [Platform.OS, draggedIndex, dragStartY, dragOverIndex, dayData.exercises.length]);

  const handleWebTouchEnd = () => {
    if (Platform.OS === 'web' && draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const exercises = [...dayData.exercises];
      const originalLength = exercises.length;
      const [draggedItem] = exercises.splice(draggedIndex, 1);
      
      // Calculate insertion index
      let insertIndex = dragOverIndex;
      if (draggedIndex < dragOverIndex) {
        // When dragging downward, adjust the insertion index to account for the removed item
        // If dragOverIndex was the last position (originalLength), append to end
        if (dragOverIndex === originalLength) {
          insertIndex = exercises.length; // Append to end after removal
        } else {
          insertIndex = dragOverIndex - 1;
        }
      }
      
      exercises.splice(insertIndex, 0, draggedItem);
      
      const updatedDayData = {
        ...dayData,
        exercises
      };
      // Immediate save for drag action
      savePlan(updatedDayData, true);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragStartY(0);
  };

  const addManualExercise = () => {
    const dateString = date ? date : (day ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` : '');
    router.replace({
      pathname: '/exercise-select',
      params: { 
        planId: planId || '', 
        day: day || '',
        weekStart: weekStart || '',
        date: dateString
      }
    });
  };

  const saveFeedback = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updatedFeedback = userFeedback 
      ? `${userFeedback}\n\n${new Date().toLocaleDateString()}: ${feedback}`
      : `${new Date().toLocaleDateString()}: ${feedback}`;

    const { error } = await supabase
      .from('profiles')
      .update({ workout_feedback: updatedFeedback })
      .eq('id', user.id);

    if (error) {
      Alert.alert("Error", "Failed to save feedback.");
    } else {
      setUserFeedback(updatedFeedback);
      setFeedback('');
      setShowFeedback(false);
      Alert.alert("Success", "Feedback saved! This will be considered in future generations.");
    }
  };

  const getDurationMinutes = (seconds: number | null | undefined): number => {
    if (!seconds && seconds !== 0) return 0;
    return Math.floor(seconds / 60);
  };

  const getDurationSeconds = (seconds: number | null | undefined): number => {
    if (!seconds && seconds !== 0) return 0;
    return seconds % 60;
  };

  const getDifficultyInfo = (difficulty: string | null | undefined) => {
    if (!difficulty) return null;
    
    const difficultyLower = String(difficulty).toLowerCase().trim();
    if (difficultyLower === 'beginner') {
      return { label: 'Easy', color: '#a3e635', activeBars: 1 }; // lime-400
    } else if (difficultyLower === 'intermediate') {
      return { label: 'Medium', color: '#22d3ee', activeBars: 2 }; // cyan-400
    } else if (difficultyLower === 'advanced') {
      return { label: 'Hard', color: '#f87171', activeBars: 3 }; // red-400
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

  const renderExerciseCard = useCallback((item: any, index: number | undefined, drag?: () => void, isActive?: boolean) => {
    // Ensure index is valid
    if (index === undefined || index === null || isNaN(index)) {
      console.error('renderExerciseCard: Invalid index', index);
      return null;
    }
    const isDragging = draggedIndex === index;
    const detail = exerciseDetails.get(item.name);
    const isTimed = detail?.is_timed || false;
    const defaultDuration = detail?.default_duration_sec || 60;
    const difficulty = item.difficulty || detail?.difficulty || dayData?.difficulty || null;
    const pr = exercisePRs.get(item.name) || null;
    const estimatedTimeSec = exerciseEstimatedTimes.get(item.name) || 0;
    const estimatedTimeMin = Math.round(estimatedTimeSec / 60);
    
    // Check if exercise has sets with different values per set
    const hasSets = Array.isArray(item.sets) && item.sets.length > 0;
    const numSets = item.target_sets || (hasSets ? item.sets.length : 0);
    
    // For timed exercises, use target_duration_sec if available, otherwise use default_duration_sec
    const currentDuration = item.target_duration_sec !== undefined 
      ? item.target_duration_sec 
      : (isTimed ? defaultDuration : null);
    
    return (
      <View
          style={[
            styles.exerciseCard, 
            (isActive || isDragging) && styles.exerciseCardActive
          ]}
          // Only allow drag from grip handle, not entire card
          onStartShouldSetResponder={Platform.OS === 'web' ? () => false : () => false}
          onMoveShouldSetResponder={Platform.OS === 'web' ? () => false : () => false}
        >
        <View style={styles.exerciseHeader}>
          {!hasActiveWorkout && drag ? (
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={() => {
                dragAllowedRef.current = index;
                drag();
              }}
              disabled={isActive}
              style={styles.dragHandleContainer}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <GripVertical color={(isActive || isDragging) ? "#a3e635" : "#71717a"} size={22} />
            </TouchableOpacity>
          ) : (
            <View style={styles.dragHandleContainer}>
              <GripVertical color={hasActiveWorkout ? "#3f3f46" : ((isActive || isDragging) ? "#a3e635" : "#71717a")} size={22} />
            </View>
          )}
          {item.name === "New Exercise" ? (
            <TouchableOpacity
              style={styles.exerciseNameContainer}
              onPress={() => {
                const dateString = date ? date : (day ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` : '');
                router.replace({
                  pathname: '/exercise-select',
                  params: { 
                    planId: planId || '', 
                    day: day || '', 
                    exerciseIndex: (index ?? 0).toString(),
                    weekStart: weekStart || '',
                    date: dateString
                  }
                });
              }}
            >
              <Text style={styles.exerciseNamePlaceholder}>{item.name}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.exerciseNameContainer}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              {renderDifficultyIndicator(difficulty)}
            </View>
          )}
          <View style={styles.exerciseHeaderActions}>
            <TouchableOpacity
              onPress={() => {
                const dateString = date ? date : (day ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` : '');
                router.replace({
                  pathname: '/workout-sets',
                  params: { 
                    planId: planId || '', 
                    day: day || '', 
                    exerciseIndex: (index ?? 0).toString(),
                    weekStart: weekStart || '',
                    date: dateString
                  }
                });
              }}
              style={styles.editButton}
            >
              <Edit2 color="#a3e635" size={18} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                // Find the index from the item if index is not available
                let exerciseIndex = index;
                if (exerciseIndex === undefined || exerciseIndex === null || isNaN(exerciseIndex)) {
                  exerciseIndex = (dayData.exercises || []).findIndex((ex: any) => 
                    ex === item || (ex.name === item.name && ex.target_sets === item.target_sets)
                  );
                }
                
                console.log('Delete button pressed', { index, exerciseIndex, itemName: item.name });
                
                if (exerciseIndex !== undefined && exerciseIndex !== null && exerciseIndex !== -1) {
                  removeExercise(exerciseIndex);
                } else {
                  console.error('Invalid index for delete:', { index, exerciseIndex, item });
                  Alert.alert("Error", "Cannot delete exercise: invalid index.");
                }
              }}
            >
              <X color="#ef4444" size={20} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Estimated time and PR row */}
        <View style={styles.exerciseMetaRow}>
          {estimatedTimeMin > 0 && (
            <View style={styles.exerciseMetaItem}>
              <Text style={styles.exerciseMetaLabel}>Est. time</Text>
              <Text style={styles.exerciseMetaValue}>~{estimatedTimeMin}m</Text>
            </View>
          )}
          {!isTimed && (
            <TouchableOpacity
              style={styles.exerciseMetaItem}
              onPress={() => {
                setEditingPR({ exerciseName: item.name, pr });
                setPrEditWeight(pr ? String(pr.weight) : '');
                setPrEditReps(pr && pr.reps ? String(pr.reps) : '');
              }}
            >
              <Text style={styles.exerciseMetaLabel}>PR</Text>
              <Text style={styles.exerciseMetaValue}>
                {pr && pr.weight > 0 ? `${pr.weight} lbs${pr.reps ? ` × ${pr.reps}` : ''}` : 'Set PR'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!hasSets && (
          <View style={styles.exerciseRow}>
            <View style={styles.exerciseField}>
              <Text style={styles.fieldLabel}>Sets</Text>
              <Text style={styles.fieldValue}>{numSets}</Text>
            </View>
            {isTimed ? (
              <View style={styles.exerciseField}>
                <Text style={styles.fieldLabel}>Duration</Text>
                <Text style={styles.fieldValue}>
                  {currentDuration !== null 
                    ? `${getDurationMinutes(currentDuration)}:${getDurationSeconds(currentDuration).toString().padStart(2, '0')}`
                    : '—'}
                </Text>
              </View>
            ) : (
              <View style={styles.exerciseField}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <Text style={styles.fieldValue}>
                  {typeof item.target_reps === 'number' ? item.target_reps : (item.target_reps || '—')}
                </Text>
              </View>
            )}
            <View style={styles.exerciseField}>
              <Text style={styles.fieldLabel}>Rest (sec)</Text>
              <Text style={styles.fieldValue}>{item.rest_time_sec || '—'}</Text>
            </View>
          </View>
        )}

        {hasSets && (
          <View style={styles.setsContainer}>
            <Text style={styles.setsTitle}>Sets Configuration</Text>
            {item.sets.map((set: any, setIdx: number) => (
              <View key={setIdx} style={styles.setRow}>
                <Text style={styles.setNumber}>Set {set.index || setIdx + 1}:</Text>
                {isTimed ? (
                  <>
                    <Text style={styles.setValue}>
                      {set.duration !== null && set.duration !== undefined
                        ? `${getDurationMinutes(set.duration)}:${getDurationSeconds(set.duration).toString().padStart(2, '0')}`
                        : '—'}
                    </Text>
                    {set.rest_time_sec !== null && set.rest_time_sec !== undefined && (
                      <>
                        <Text style={styles.setValue}> | </Text>
                        <Text style={styles.setValue}>
                          {set.rest_time_sec}s rest
                        </Text>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.setValue}>
                      {set.reps !== null && set.reps !== undefined ? `${set.reps} reps` : '—'}
                    </Text>
                    <Text style={styles.setValue}> | </Text>
                    <Text style={styles.setValue}>
                      {(() => {
                        const isBodyweight = isBodyweightExercise(item.name, detail);
                        if (set.weight !== null && set.weight !== undefined) {
                          return set.weight === 0 ? 'BW' : `${set.weight} lbs`;
                        } else if (isBodyweight) {
                          return 'BW';
                        } else {
                          return '—';
                        }
                      })()}
                    </Text>
                    <Text style={styles.setValue}> | </Text>
                    <Text style={styles.setValue}>
                      {set.rest_time_sec !== null && set.rest_time_sec !== undefined ? `${set.rest_time_sec}s rest` : '—'}
                    </Text>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }, [draggedIndex, exerciseDetails, dayData?.difficulty, exercisePRs, exerciseEstimatedTimes, removeExercise, router, planId, day, weekStart, date, isBodyweightExercise, hasActiveWorkout]);

  const renderHeader = useCallback(() => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => handleBack()} style={styles.backButton}>
          <ArrowLeft color="#a1a1aa" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{day}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.exercisesHeader}>
        <Text style={styles.sectionTitle}>Exercises ({dayData.exercises?.length || 0})</Text>
        <TouchableOpacity style={styles.addButton} onPress={addManualExercise}>
          <Plus color="#a3e635" size={20} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.durationTargetRow}>
        <View style={styles.durationHeader}>
          <Text style={styles.durationTargetLabel}>
            Time Constraint
          </Text>
          <Text style={styles.durationTargetValue}>{targetDurationMin || 45} min</Text>
        </View>
        
        {/* Explanation Text */}
        <Text style={styles.durationModeExplanation}>
          Maximum workout duration - workout will be compressed if it exceeds this time
        </Text>
        
        <TouchableOpacity
          style={styles.durationPickerButton}
          onPress={() => setShowDurationPicker(true)}
        >
          <Text style={styles.durationPickerButtonText}>
            {targetDurationMin || 45} min
          </Text>
        </TouchableOpacity>
      </View>

      {estimatedDurationSec !== null && estimatedDurationSec > 0 && (
        <Text style={styles.durationEstimateText}>
          Estimated session:{' '}
          {Math.round(estimatedDurationSec / 60)} min
          {targetDurationMin ? ` · Target ${targetDurationMin} min` : ''}
        </Text>
      )}
    </View>
  ), [day, dayData.exercises?.length, handleBack, addManualExercise, targetDurationMin, estimatedDurationSec, updateTargetDuration]);

  const renderFooter = useCallback(() => (
    <View style={styles.footerSection}>
      {dayData.exercises?.length === 0 && (
        <Text style={styles.emptyText}>No exercises yet. Add manually or generate some!</Text>
      )}

      <View style={styles.buttonContainer}>
        {!hasGenerated ? (
          <TouchableOpacity
            style={[styles.buttonPrimary, generating && styles.buttonDisabled]}
            onPress={generateForDay}
            disabled={generating}
          >
            {generating ? (
              <>
                <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Generating...</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>Generate Exercises</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => setShowFeedback(true)}
          >
            <Text style={styles.buttonTextSecondary}>Provide Feedback</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.buttonDone}
          onPress={() => handleBack()}
        >
          <Text style={styles.buttonTextDone}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [dayData.exercises?.length, hasGenerated, generating, handleBack, generateForDay, setShowFeedback]);

  if (isLoading) {
    return <PlannerDaySkeleton exerciseCount={dayData?.exercises?.length} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        {Platform.OS === 'web' ? (
        // Web: Use FlatList with custom drag handlers (disabled if workout is active)
        <FlatList
          data={dayData.exercises || []}
          keyExtractor={(item: any, index: number) => `exercise-${index}`}
          renderItem={({ item, index }: { item: any; index: number }) => (
            <View>
              {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                <View style={styles.insertLine} />
              )}
              {renderExerciseCard(item, index)}
            </View>
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={() => (
            <View>
              {dragOverIndex === dayData.exercises.length && draggedIndex !== null && (
                <View style={styles.insertLine} />
              )}
              {renderFooter()}
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : DraggableFlatList ? (
        // Native: Use DraggableFlatList with gesture-handler
        <DraggableFlatList
          data={dayData.exercises || []}
          onDragEnd={handleDragEnd}
          keyExtractor={(item: any, index: number) => {
            // Use a stable key that includes both name and index to handle reordering
            const nameKey = item.name || `new-${index}`;
            return `exercise-${nameKey}-${index}`;
          }}
          activationDistance={0}
          dragItemOverflow={false}
          containerStyle={{ flex: 1 }}
          renderItem={({ item, index: itemIndex, drag, isActive, getIndex }: any) => {
            // Get index from getIndex if available, otherwise use itemIndex
            // If both are undefined, find the index from the data array
            let index = getIndex ? getIndex() : itemIndex;
            
            if (index === undefined || index === null || isNaN(index)) {
              // Fallback: find index in the data array
              const foundIndex = (dayData.exercises || []).findIndex((ex: any) => ex === item || (ex.name === item.name && ex.target_sets === item.target_sets));
              if (foundIndex !== -1) {
                index = foundIndex;
              } else {
                console.error('DraggableFlatList renderItem: Invalid index', { itemIndex, getIndex: !!getIndex, item, exercisesLength: (dayData.exercises || []).length });
                return null;
              }
            }
            
            // Store the drag function in a ref so we can call it only from the grip handle
            const dragRef = React.useRef(drag);
            dragRef.current = drag;
            
            return (
              <ScaleDecorator>
                <View>
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <View style={styles.insertLine} />
                  )}
                  <View 
                    style={{ pointerEvents: isActive ? 'none' : 'auto' }}
                  >
                    {renderExerciseCard(item, index, drag, isActive)}
                  </View>
                </View>
              </ScaleDecorator>
            );
          }}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        // Fallback: Regular FlatList
        <FlatList
          data={dayData.exercises || []}
          keyExtractor={(item: any, index: number) => `exercise-${index}`}
          renderItem={({ item, index }: { item: any; index: number }) => renderExerciseCard(item, index)}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
        />
      )}
      </Animated.View>

      <Modal visible={showFeedback} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Workout Feedback</Text>
            <Text style={styles.modalSubtitle}>
              Share your thoughts (e.g., "too hard", "avoid shoulder exercises", "need more cardio")
            </Text>
            <TextInput
              style={styles.feedbackInput}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Your feedback..."
              placeholderTextColor="#6b7280"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setShowFeedback(false);
                  setFeedback('');
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={saveFeedback}
              >
                <Text style={styles.modalButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        duration={2000}
      />

      {/* PR Edit Modal */}
      <Modal visible={editingPR !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Personal Record</Text>
            <Text style={styles.modalSubtitle}>{editingPR?.exerciseName}</Text>
            
            <View style={styles.modalInputRow}>
              <View style={styles.modalInputField}>
                <Text style={styles.modalInputLabel}>Weight (lbs)</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={prEditWeight}
                  onChangeText={setPrEditWeight}
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.modalInputField}>
                <Text style={styles.modalInputLabel}>Reps</Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={prEditReps}
                  onChangeText={setPrEditReps}
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setEditingPR(null);
                  setPrEditWeight('');
                  setPrEditReps('');
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={async () => {
                  if (!editingPR) return;
                  
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;

                  const weight = parseFloat(prEditWeight);
                  const reps = prEditReps ? parseInt(prEditReps, 10) : null;

                  if (weight > 0) {
                    const newPR: PersonalRecord = {
                      exerciseName: editingPR.exerciseName,
                      weight,
                      reps,
                      performedAt: new Date().toISOString(),
                      sessionId: null,
                    };

                    const success = await saveExercisePR(user.id, editingPR.exerciseName, newPR);
                    if (success) {
                      setExercisePRs((prev) => {
                        const updated = new Map(prev);
                        updated.set(editingPR.exerciseName, newPR);
                        return updated;
                      });
                      setToastMessage('PR updated!');
                      setToastVisible(true);
                    } else {
                      Alert.alert('Error', 'Failed to save PR');
                    }
                  } else {
                    // Clear PR
                    const { data: existing } = await supabase
                      .from('user_exercises')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('name', editingPR.exerciseName)
                      .maybeSingle();

                    if (existing) {
                      await supabase
                        .from('user_exercises')
                        .update({ pr_weight: null, pr_reps: null, pr_performed_at: null })
                        .eq('id', existing.id);
                    }

                    setExercisePRs((prev) => {
                      const updated = new Map(prev);
                      updated.set(editingPR.exerciseName, null);
                      return updated;
                    });
                    setToastMessage('PR cleared');
                    setToastVisible(true);
                  }

                  setEditingPR(null);
                  setPrEditWeight('');
                  setPrEditReps('');
                }}
              >
                <Text style={styles.modalButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Duration Picker Modal */}
      <Modal
        visible={showDurationPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDurationPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDurationPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Duration</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDurationPicker(false);
                  if (targetDurationMin) {
                    updateTargetDuration(targetDurationMin);
                  }
                }}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.nativePickerRow}>
              {Platform.OS === 'web' ? (
                <View style={styles.webPickerContainer}>
                  <ScrollView
                    ref={durationPickerScrollRef}
                    style={styles.webPickerScrollView}
                    contentContainerStyle={styles.webPickerContent}
                    showsVerticalScrollIndicator={false}
                    onLayout={() => {
                      // Scroll to selected item when picker opens
                      if (Platform.OS === 'web' && durationPickerScrollRef.current) {
                        const currentValue = targetDurationMin || 45;
                        const selectedIndex = Math.floor((currentValue - 15) / 5);
                        const itemHeight = 40; // minHeight from webPickerItem
                        const scrollOffset = selectedIndex * itemHeight - 88; // Center it (88 is paddingVertical)
                        durationPickerScrollRef.current.scrollTo({
                          y: Math.max(0, scrollOffset),
                          animated: false,
                        });
                      }
                    }}
                  >
                    {Array.from({ length: 28 }, (_, i) => 15 + (i * 5)).map((minValue) => (
                      <TouchableOpacity
                        key={minValue}
                        style={[
                          styles.webPickerItem,
                          (targetDurationMin || 45) === minValue && styles.webPickerItemSelected,
                        ]}
                        onPress={() => setTargetDurationMin(minValue)}
                      >
                        <Text
                          style={[
                            styles.webPickerItemText,
                            (targetDurationMin || 45) === minValue && styles.webPickerItemTextSelected,
                          ]}
                        >
                          {minValue}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <Picker
                  selectedValue={(targetDurationMin || 45).toString()}
                  onValueChange={(itemValue) => setTargetDurationMin(parseInt(itemValue, 10))}
                  style={[styles.nativePicker, { flex: 1 }]}
                  itemStyle={{ color: '#ffffff' }}
                >
                  {Array.from({ length: 28 }, (_, i) => 15 + (i * 5)).map((minValue) => (
                    <Picker.Item key={minValue} label={minValue.toString()} value={minValue.toString()} color="#ffffff" />
                  ))}
                </Picker>
              )}
              <View style={styles.pickerUnitLabel}>
                <Text style={styles.pickerUnitText}>min</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' }, // zinc-950
  listContent: { padding: 24, paddingTop: 20, paddingBottom: Platform.OS === 'web' ? 40 : 120 }, // Extra padding for native tab bar
  headerSection: { marginBottom: 0 },
  footerSection: { marginTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backButton: { marginRight: 16 },
  headerSpacer: { width: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#a3e635', flex: 1 }, // lime-400
  exercisesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { color: '#a3e635', fontSize: 16, fontWeight: '600' }, // lime-400
  exerciseCard: { 
    backgroundColor: '#18181b', // zinc-900
    padding: 32, // p-8
    paddingBottom: 20, // Reduced bottom padding
    borderRadius: 24, // rounded-3xl
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#27272a', // zinc-800
    ...(Platform.OS === 'web' ? { userSelect: 'none' as any, WebkitUserSelect: 'none' as any } : {})
  },
  exerciseCardActive: { opacity: 0.8, transform: [{ scale: 1.03 }], borderColor: '#a3e635' }, // lime-400
  insertLine: { height: 3, backgroundColor: '#a3e635', marginVertical: 4, marginHorizontal: 0, borderRadius: 2 }, // lime-400
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  dragHandleContainer: { padding: 8, marginLeft: -8, marginRight: 4, justifyContent: 'center', alignItems: 'center' },
  exerciseNameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  exerciseName: { color: 'white', fontSize: 18, fontWeight: 'bold', flexShrink: 1 },
  exerciseNamePlaceholder: { color: '#a3e635', fontSize: 18, fontWeight: 'bold' }, // lime-400
  exerciseHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editButton: { padding: 4 },
  difficultyContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  difficultyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  difficultyBar: { borderRadius: 2 },
  difficultyBar1: { width: 6, height: 8 },
  difficultyBar2: { width: 6, height: 12 },
  difficultyBar3: { width: 6, height: 16 },
  difficultyText: { fontSize: 14, fontWeight: '600' },
  exerciseMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 12, alignItems: 'center' },
  exerciseMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseMetaLabel: { color: '#71717a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }, // zinc-500
  exerciseMetaValue: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' }, // zinc-400
  exerciseRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  exerciseField: { flex: 1 },
  fieldLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4 }, // zinc-400
  fieldValue: { color: 'white', fontSize: 16, fontWeight: '600' },
  fieldInput: { backgroundColor: '#09090b', color: 'white', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', fontSize: 16 }, // zinc-950, rounded-3xl, zinc-800
  notesInput: { backgroundColor: '#09090b', color: 'white', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', minHeight: 60, fontSize: 16, textAlignVertical: 'top' }, // zinc-950, rounded-3xl, zinc-800
  emptyText: { color: '#a1a1aa', textAlign: 'center', marginVertical: 24 }, // zinc-400
  buttonContainer: { marginTop: 24, marginBottom: 40, gap: 12 },
  buttonPrimary: { backgroundColor: '#a3e635', padding: 20, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 56, flexDirection: 'row' }, // lime-400, rounded-3xl
  buttonDisabled: { backgroundColor: '#84cc16', opacity: 0.7 }, // lime-500
  buttonSecondary: { borderWidth: 1, borderColor: '#a3e635', padding: 20, borderRadius: 24, alignItems: 'center', minHeight: 56, justifyContent: 'center' }, // lime-400, rounded-3xl
  buttonDone: { backgroundColor: '#27272a', padding: 20, borderRadius: 24, alignItems: 'center', minHeight: 56, justifyContent: 'center' }, // zinc-800, rounded-3xl
  buttonText: { color: '#09090b', fontWeight: 'bold', fontSize: 16 }, // zinc-950 for contrast on lime
  buttonTextSecondary: { color: '#a3e635', fontWeight: 'bold', fontSize: 16 }, // lime-400
  buttonTextDone: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#18181b', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#27272a' }, // zinc-900, rounded-3xl, zinc-800
  modalTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { color: '#a1a1aa', fontSize: 14, marginBottom: 16 }, // zinc-400
  feedbackInput: { backgroundColor: '#09090b', color: 'white', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', minHeight: 120, textAlignVertical: 'top', fontSize: 16 }, // zinc-950, rounded-3xl, zinc-800
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalButtonSecondary: { flex: 1, borderWidth: 1, borderColor: '#27272a', padding: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, // zinc-800, rounded-3xl
  modalButtonPrimary: { flex: 1, backgroundColor: '#a3e635', padding: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, // lime-400, rounded-3xl
  modalButtonTextSecondary: { color: '#a1a1aa', fontWeight: 'bold' }, // zinc-400
  modalButtonTextPrimary: { color: '#09090b', fontWeight: 'bold' }, // zinc-950 for contrast
  setsButtonRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  setsButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#a3e635' }, // lime-400
  setsButtonText: { color: '#a3e635', fontWeight: '600', fontSize: 14 }, // lime-400
  setsContainer: { marginBottom: 0 },
  setsTitle: { color: '#a1a1aa', fontSize: 12, marginBottom: 8, fontWeight: '600' }, // zinc-400
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' },
  setNumber: { color: 'white', fontSize: 14, fontWeight: '600' },
  setValue: { color: '#a1a1aa', fontSize: 14 }, // zinc-400
  noSetsText: { color: '#71717a', fontSize: 14, fontStyle: 'italic', marginBottom: 12 }, // zinc-500
  notesContainer: { marginTop: 8, marginBottom: 12 },
  notesLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4, fontWeight: '600' }, // zinc-400
  notesText: { color: '#a1a1aa', fontSize: 14 }, // zinc-400
  durationTargetRow: { marginTop: 8, marginBottom: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#18181b', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#27272a' }, // zinc-900, rounded-3xl, zinc-800
  modalTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { color: '#a1a1aa', fontSize: 14, marginBottom: 16 }, // zinc-400
  modalInputRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  modalInputField: { flex: 1 },
  modalInputLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4, fontWeight: '600' }, // zinc-400
  modalInput: { backgroundColor: '#09090b', color: 'white', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', fontSize: 16 }, // zinc-950, rounded-3xl, zinc-800
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalButtonSecondary: { flex: 1, borderWidth: 1, borderColor: '#27272a', padding: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, // zinc-800, rounded-3xl
  modalButtonPrimary: { flex: 1, backgroundColor: '#a3e635', padding: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, // lime-400, rounded-3xl
  modalButtonTextSecondary: { color: '#a1a1aa', fontWeight: 'bold' }, // zinc-400
  modalButtonTextPrimary: { color: '#09090b', fontWeight: 'bold' }, // zinc-950 for contrast
  durationTargetLabel: { color: '#a1a1aa', fontSize: 12, fontWeight: '600' },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  durationTargetValue: {
    color: '#a3e635',
    fontSize: 14,
    fontWeight: '700',
  },
  durationModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(39, 39, 42, 0.5)', // zinc-800/50
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  durationModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationModeButtonActive: {
    backgroundColor: '#a3e635', // lime-400
  },
  durationModeButtonText: {
    color: '#a1a1aa', // zinc-400
    fontSize: 12,
    fontWeight: '600',
  },
  durationModeButtonTextActive: {
    color: '#09090b', // zinc-950
  },
  durationModeExplanation: {
    color: '#71717a', // zinc-500
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  durationPickerButton: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  durationPickerButtonText: {
    color: '#a3e635', // lime-400
    fontSize: 18,
    fontWeight: '700',
  },
  durationEstimateText: { color: '#a1a1aa', fontSize: 12, marginTop: 6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.8)', // zinc-950/80
    justifyContent: 'flex-end',
  },
  nativePickerModal: {
    backgroundColor: '#18181b', // zinc-900
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  nativePicker: {
    height: 216,
    backgroundColor: '#18181b', // zinc-900
  },
  nativePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b', // zinc-900
  },
  webPickerContainer: {
    flex: 1,
    height: 216,
    backgroundColor: '#18181b',
  },
  webPickerScrollView: {
    flex: 1,
  },
  webPickerContent: {
    paddingVertical: 88,
  },
  webPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  webPickerItemSelected: {
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
  },
  webPickerItemText: {
    color: '#71717a', // zinc-500
    fontSize: 18,
    fontWeight: '400',
  },
  webPickerItemTextSelected: {
    color: '#a3e635', // lime-400
    fontWeight: '700',
  },
  pickerUnitLabel: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerUnitText: {
    fontSize: 18,
    color: '#71717a', // zinc-500
    fontWeight: '400',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  pickerDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a3e635', // lime-400
  },
});

