import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, X, Plus, ChevronRight, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/lib/supabase';
import { Toast } from '../src/components/Toast';

export default function ExerciseSelectScreen() {
  const router = useRouter();
  const { planId, day, exerciseIndex, context, weekStart, date } = useLocalSearchParams<{ 
    planId?: string; 
    day?: string; 
    exerciseIndex?: string; 
    context?: string;
    weekStart?: string;
    date?: string;
  }>();

  const safeBack = async (selectedExerciseName?: string) => {
    try {
      if (context === 'progress' && selectedExerciseName) {
        // Store in AsyncStorage for reliable passing back
        await AsyncStorage.setItem('progress_selected_exercise', selectedExerciseName);
        
        // Navigate back to progress tab using replace to prevent stacking
        router.replace({
          pathname: '/(tabs)/progress',
          params: { selectedExercise: selectedExerciseName }
        });
        return;
      }
      // For planner context, if planId and day are present, navigate to planner-day screen
      if (planId && day) {
        const params: any = { planId: planId, day: day };
        if (weekStart) params.weekStart = weekStart;
        if (date) params.date = date;
        router.replace({
          pathname: '/planner-day',
          params
        });
      } else {
        // Otherwise, navigate to planner tab
        router.replace('/(tabs)/planner');
      }
    } catch (error) {
      if (context === 'progress') {
        if (selectedExerciseName) {
          await AsyncStorage.setItem('progress_selected_exercise', selectedExerciseName);
        }
        router.replace({
          pathname: '/(tabs)/progress',
          params: selectedExerciseName ? { selectedExercise: selectedExerciseName } : {}
        });
      } else if (planId && day) {
        const params: any = { planId: planId, day: day };
        if (weekStart) params.weekStart = weekStart;
        if (date) params.date = date;
        router.replace({
          pathname: '/planner-day',
          params
        });
      } else {
        router.replace('/(tabs)/planner');
      }
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [masterExercises, setMasterExercises] = useState<any[]>([]);
  const [customExercises, setCustomExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseDescription, setNewExerciseDescription] = useState('');
  const [newExerciseIsTimed, setNewExerciseIsTimed] = useState<boolean>(false);
  const [newExerciseDefaultDuration, setNewExerciseDefaultDuration] = useState<string>('');
  const [newExerciseDefaultSets, setNewExerciseDefaultSets] = useState<string>('');
  const [newExerciseDefaultReps, setNewExerciseDefaultReps] = useState<string>('');
  const [newExerciseDefaultRest, setNewExerciseDefaultRest] = useState<string>('');
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(new Set());
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [showMuscleGroupsDropdown, setShowMuscleGroupsDropdown] = useState(false);
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [availableMuscleGroups, setAvailableMuscleGroups] = useState<string[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const getSearchMatchScore = (name: string, query: string): number => {
    if (!name || !query) return 0;

    const queryTrimmed = query.trim().toLowerCase();
    if (!queryTrimmed) return 0;

    const nameLower = String(name).toLowerCase();
    const normalizedName = nameLower.replace(/[\s-]/g, '');
    const normalizedQuery = queryTrimmed.replace(/[\s-]/g, '');

    // Exact match ignoring spaces and hyphens
    if (normalizedName === normalizedQuery) {
      return 100;
    }

    let score = 0;
    const words = nameLower.split(/[\s-]+/);

    words.forEach((word, index) => {
      const positionBoost = Math.max(0, 10 - index); // earlier words get slightly higher score

      if (word === queryTrimmed) {
        // Full word match
        score = Math.max(score, 90 + positionBoost);
      } else if (word.startsWith(queryTrimmed)) {
        // Word prefix match
        score = Math.max(score, 80 + positionBoost);
      } else if (word.includes(queryTrimmed)) {
        // Word contains query
        score = Math.max(score, 60 + positionBoost);
      }
    });

    // Generic substring match across the whole name as a fallback
    if (score === 0 && nameLower.includes(queryTrimmed)) {
      score = 40;
    }

    return score;
  };

  useEffect(() => {
    loadMasterExercises();
    loadCustomExercises();
    loadMuscleGroups();
    loadEquipment();
  }, []);

  const loadMuscleGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('muscle_groups')
        .not('muscle_groups', 'is', null);

      if (!error && data) {
        const allGroups = new Set<string>();
        data.forEach(ex => {
          if (ex.muscle_groups && Array.isArray(ex.muscle_groups)) {
            ex.muscle_groups.forEach((mg: string) => {
              if (mg) allGroups.add(mg);
            });
          }
        });
        setAvailableMuscleGroups(Array.from(allGroups).sort());
      }
    } catch (err) {
      console.error('Error loading muscle groups:', err);
    }
  };

  const loadEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('equipment_needed')
        .not('equipment_needed', 'is', null);

      if (!error && data) {
        const allEquipment = new Set<string>();
        data.forEach(ex => {
          if (ex.equipment_needed && Array.isArray(ex.equipment_needed)) {
            ex.equipment_needed.forEach((eq: string) => {
              if (eq) allEquipment.add(eq);
            });
          }
        });
        setAvailableEquipment(Array.from(allEquipment).sort());
      }
    } catch (err) {
      console.error('Error loading equipment:', err);
    }
  };

  const loadMasterExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('name, difficulty_level')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading master exercises with difficulty:', error);
        // Fallback: try loading just name if difficulty_level field doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('exercises')
          .select('name')
          .order('name', { ascending: true });
        
        if (fallbackError) {
          console.error('Error loading master exercises (fallback):', fallbackError);
          setMasterExercises([]);
          return;
        }

        if (fallbackData && Array.isArray(fallbackData)) {
          setMasterExercises(fallbackData.map(ex => ({
            name: ex.name || '',
            difficulty: null // Fallback query only selects name, so difficulty_level is not available
          })));
        } else {
          setMasterExercises([]);
        }
        return;
      }

      if (data && Array.isArray(data)) {
        setMasterExercises(data.map(ex => ({
          name: ex.name || '',
          difficulty: ex.difficulty_level || null
        })));
      } else {
        setMasterExercises([]);
      }
    } catch (err) {
      console.error('Error in loadMasterExercises:', err);
      setMasterExercises([]);
    }
  };

  const loadCustomExercises = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_exercises')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (!error && data) {
      setCustomExercises(data);
    } else {
      setCustomExercises([]);
    }
  };

  const trimmedSearchQuery = searchQuery.trim();
  const hasSearchQuery = trimmedSearchQuery.length > 0;

  const scoredMasterExercises = masterExercises.map((exercise: any) => {
    const name = exercise?.name || '';
    const base = {
      name,
      difficulty: exercise?.difficulty || exercise?.difficulty_level || null,
      type: 'master' as const,
    };

    if (!hasSearchQuery) {
      return { ...base, matchScore: 0 };
    }

    const matchScore = getSearchMatchScore(name, trimmedSearchQuery);
    return { ...base, matchScore };
  });

  const scoredCustomExercises = (customExercises || []).map((exercise: any) => {
    const name = exercise?.name || '';
    const base = {
      name,
      difficulty: null,
      type: 'custom' as const,
      ...exercise,
    };

    if (!hasSearchQuery) {
      return { ...base, matchScore: 0 };
    }

    const matchScore = getSearchMatchScore(name, trimmedSearchQuery);
    return { ...base, matchScore };
  });

  const handleAddExercise = async (exerciseName: string) => {
    if (context === 'progress') {
      safeBack(exerciseName);
      return;
    }

    if (!planId || !day) {
      Alert.alert("Error", "Missing plan or day information.");
      return;
    }

    setLoading(true);

    try {
      // Check if exercise is timed
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not found');
      }

      // Check user exercises first, then master exercises
      const { data: userExercise } = await supabase
        .from('user_exercises')
        .select('is_timed, default_duration_sec')
        .eq('user_id', user.id)
        .eq('name', exerciseName)
        .maybeSingle();

      // Note: exercises table doesn't have default_duration_sec, only user_exercises does
      const { data: masterExercise } = await supabase
        .from('exercises')
        .select('is_timed')
        .eq('name', exerciseName)
        .maybeSingle();

      const exerciseDetail = userExercise || masterExercise;
      const isTimed = exerciseDetail?.is_timed || false;
      // user_exercises has default_duration_sec, but exercises table doesn't - use 60 as default
      const defaultDuration = (userExercise?.default_duration_sec) || 60;

      // Load current plan
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', parseInt(planId))
        .single();

      if (planError || !plan) {
        throw new Error('Failed to load plan');
      }

      const updatedPlan = { ...plan };
      
      // Initialize plan_data structure if needed
      if (!updatedPlan.plan_data) {
        updatedPlan.plan_data = { weeks: {} };
      }
      if (!updatedPlan.plan_data.weeks) {
        updatedPlan.plan_data.weeks = {};
      }
      
      // Use week-specific structure if weekStart is provided
      let dayData: any;
      if (weekStart) {
        if (!updatedPlan.plan_data.weeks[weekStart]) {
          updatedPlan.plan_data.weeks[weekStart] = { week_schedule: {} };
        }
        dayData = updatedPlan.plan_data.weeks[weekStart].week_schedule[day] || { exercises: [] };
      } else {
        // Fallback to old structure for backward compatibility
        if (!updatedPlan.plan_data.week_schedule) {
          updatedPlan.plan_data.week_schedule = {};
        }
        dayData = updatedPlan.plan_data.week_schedule[day] || { exercises: [] };
      }

      // Add new exercise - use target_duration_sec for timed exercises, target_reps for others
      const newExercise: any = {
        name: exerciseName,
        target_sets: 3,
        rest_time_sec: 60,
        notes: ""
      };

      // Check if exercise is bodyweight
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
      const isBodyweight = isTimed || BODYWEIGHT_EXERCISES.some(bw => 
        exerciseName.toLowerCase().includes(bw.toLowerCase())
      );

      if (isTimed) {
        newExercise.target_duration_sec = defaultDuration;
        // Pre-initialize 3 sets with duration=60 (1 min, 0 sec), rest=60
        newExercise.sets = [
          { index: 1, duration: 60, rest_time_sec: 60 },
          { index: 2, duration: 60, rest_time_sec: 60 },
          { index: 3, duration: 60, rest_time_sec: 60 },
        ];
      } else {
        newExercise.target_reps = 10;
        // Pre-initialize 3 sets with reps=10, weight=0 for bodyweight, rest=60
        newExercise.sets = [
          { index: 1, reps: 10, weight: isBodyweight ? 0 : null, rest_time_sec: 60 },
          { index: 2, reps: 10, weight: isBodyweight ? 0 : null, rest_time_sec: 60 },
          { index: 3, reps: 10, weight: isBodyweight ? 0 : null, rest_time_sec: 60 },
        ];
      }

      // Handle adding or replacing exercise
      if (exerciseIndex !== undefined) {
        const index = parseInt(exerciseIndex);
        if (!isNaN(index) && dayData.exercises && index >= 0 && index < dayData.exercises.length) {
          dayData.exercises[index] = newExercise;
        } else {
          dayData.exercises = [...(dayData.exercises || []), newExercise];
        }
      } else {
        dayData.exercises = [...(dayData.exercises || []), newExercise];
      }
      
      // Save to the correct location
      if (weekStart) {
        updatedPlan.plan_data.weeks[weekStart].week_schedule[day] = dayData;
      } else {
        updatedPlan.plan_data.week_schedule[day] = dayData;
      }

      // Save plan
      const { error: updateError } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', plan.id);

      if (updateError) {
        throw updateError;
      }

      setToastMessage("Exercise added!");
      setToastVisible(true);
      setTimeout(() => {
        safeBack();
      }, 500);
    } catch (error: any) {
      console.error('Error adding exercise:', error);
      Alert.alert("Error", error.message || "Failed to add exercise.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMuscleGroup = (group: string) => {
    const newSelected = new Set(selectedMuscleGroups);
    if (newSelected.has(group)) {
      newSelected.delete(group);
    } else {
      newSelected.add(group);
    }
    setSelectedMuscleGroups(newSelected);
  };

  const toggleEquipment = (equipment: string) => {
    const newSelected = new Set(selectedEquipment);
    if (newSelected.has(equipment)) {
      newSelected.delete(equipment);
    } else {
      newSelected.add(equipment);
    }
    setSelectedEquipment(newSelected);
  };

  const addExerciseToPlan = async (newCustomExercise: any) => {
    if (!planId || !day) {
      return;
    }

    setLoading(true);

    try {
      // Add to workout plan
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', parseInt(planId))
        .single();

      if (planError || !plan) {
        throw new Error('Failed to load plan');
      }

      const updatedPlan = { ...plan };
      
      // Initialize plan_data structure if needed
      if (!updatedPlan.plan_data) {
        updatedPlan.plan_data = { weeks: {} };
      }
      if (!updatedPlan.plan_data.weeks) {
        updatedPlan.plan_data.weeks = {};
      }
      
      // Use week-specific structure if weekStart is provided
      let dayData: any;
      if (weekStart) {
        if (!updatedPlan.plan_data.weeks[weekStart]) {
          updatedPlan.plan_data.weeks[weekStart] = { week_schedule: {} };
        }
        dayData = updatedPlan.plan_data.weeks[weekStart].week_schedule[day] || { exercises: [] };
      } else {
        // Fallback to old structure for backward compatibility
        if (!updatedPlan.plan_data.week_schedule) {
          updatedPlan.plan_data.week_schedule = {};
        }
        dayData = updatedPlan.plan_data.week_schedule[day] || { exercises: [] };
      }

      const newExercise: any = {
        name: newCustomExercise.name,
        target_sets: newCustomExercise.default_sets || 3,
        target_reps: typeof newCustomExercise.default_reps === 'number' ? newCustomExercise.default_reps : (parseInt(newCustomExercise.default_reps || '10') || 10),
        rest_time_sec: newCustomExercise.default_rest_sec || 60,
        notes: newCustomExercise.description || ""
      };

      // Pre-initialize sets
      if (newCustomExercise.is_timed) {
        // Pre-initialize sets with duration=60 (1 min, 0 sec), rest=60
        const numSets = newCustomExercise.default_sets || 3;
        const restSec = newCustomExercise.default_rest_sec || 60;
        newExercise.target_duration_sec = newCustomExercise.default_duration_sec || 60;
        newExercise.sets = [];
        for (let i = 0; i < numSets; i++) {
          newExercise.sets.push({
            index: i + 1,
            duration: 60,
            rest_time_sec: restSec,
          });
        }
      } else {
        // Parse default_reps as a single number
        const defaultRepsStr = newCustomExercise.default_reps || "10";
        const defaultRepsNum = typeof defaultRepsStr === 'number' 
          ? defaultRepsStr 
          : (typeof defaultRepsStr === 'string' && Number.isFinite(Number(defaultRepsStr)))
          ? parseInt(defaultRepsStr, 10)
          : 10;
        newExercise.target_reps = defaultRepsNum;
        const numSets = newCustomExercise.default_sets || 3;
        const restSec = newCustomExercise.default_rest_sec || 60;
        
        // Check if exercise is bodyweight
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
        const isBodyweight = BODYWEIGHT_EXERCISES.some(bw => 
          newCustomExercise.name.toLowerCase().includes(bw.toLowerCase())
        );
        
        newExercise.sets = [];
        for (let i = 0; i < numSets; i++) {
          newExercise.sets.push({
            index: i + 1,
            weight: isBodyweight ? 0 : null,
            reps: defaultRepsNum,
            rest_time_sec: restSec,
          });
        }
      }

      if (exerciseIndex !== undefined) {
        const index = parseInt(exerciseIndex);
        if (!isNaN(index) && dayData.exercises && index >= 0 && index < dayData.exercises.length) {
          dayData.exercises[index] = newExercise;
        } else {
          dayData.exercises = [...(dayData.exercises || []), newExercise];
        }
      } else {
        dayData.exercises = [...(dayData.exercises || []), newExercise];
      }
      
      // Save to the correct location
      if (weekStart) {
        updatedPlan.plan_data.weeks[weekStart].week_schedule[day] = dayData;
      } else {
        updatedPlan.plan_data.week_schedule[day] = dayData;
      }

      const { error: updateError } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', plan.id);

      if (updateError) {
        throw updateError;
      }

      setToastMessage("Custom exercise created and added!");
      setToastVisible(true);
      setTimeout(() => {
        safeBack();
      }, 500);
    } catch (error: any) {
      console.error('Error adding exercise to plan:', error);
      Alert.alert("Error", error.message || "Failed to add exercise to plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert("Error", "Please enter an exercise name.");
      return;
    }

    if (!planId || !day) {
      Alert.alert("Error", "Missing plan or day information.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not found');
      }

      // Create custom exercise in database
      const { data: newCustomExercise, error: createError } = await supabase
        .from('user_exercises')
        .insert([
          {
            user_id: user.id,
            name: newExerciseName.trim(),
            description: newExerciseDescription.trim() || null,
            muscle_groups: selectedMuscleGroups.size > 0 ? Array.from(selectedMuscleGroups) : null,
            equipment_needed: selectedEquipment.size > 0 ? Array.from(selectedEquipment) : null,
            is_timed: newExerciseIsTimed,
            default_duration_sec: newExerciseDefaultDuration.trim() ? parseInt(newExerciseDefaultDuration.trim()) : null,
            default_sets: newExerciseDefaultSets.trim() ? parseInt(newExerciseDefaultSets.trim()) : null,
            default_reps: newExerciseDefaultReps.trim() || null,
            default_rest_sec: newExerciseDefaultRest.trim() ? parseInt(newExerciseDefaultRest.trim()) : null
          }
        ])
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Defensive check: ensure newCustomExercise is not null/undefined
      // .single() should return a single object, but check for safety
      if (!newCustomExercise) {
        throw new Error('Failed to create exercise: no data returned');
      }

      // Refresh custom exercises list
      await loadCustomExercises();
      
      // Reset form
      setShowCreateModal(false);
      setNewExerciseName('');
      setNewExerciseDescription('');
      setNewExerciseIsTimed(false);
      setNewExerciseDefaultDuration('');
      setNewExerciseDefaultSets('');
      setNewExerciseDefaultReps('');
      setNewExerciseDefaultRest('');
      setSelectedMuscleGroups(new Set());
      setSelectedEquipment(new Set());
      setShowMuscleGroupsDropdown(false);
      setShowEquipmentDropdown(false);
      
      setLoading(false);

      // Ask if they want to add it to the workout plan
      if (context === 'progress') {
        safeBack(newCustomExercise.name);
      } else if (planId && day) {
        Alert.alert(
          "Exercise Created",
          "Would you like to add this exercise to your workout plan?",
          [
            {
              text: "No",
              style: "cancel",
              onPress: () => {
                setToastMessage("Custom exercise created!");
                setToastVisible(true);
              }
            },
            {
              text: "Yes",
              onPress: async () => {
                await addExerciseToPlan(newCustomExercise);
              }
            }
          ]
        );
      } else {
        setToastMessage("Custom exercise created!");
        setToastVisible(true);
      }
    } catch (error: any) {
      console.error('Error creating custom exercise:', error);
      Alert.alert("Error", error.message || "Failed to create custom exercise.");
      setLoading(false);
    }
  };

  const handleAddCustomExercise = async (exercise: any) => {
    if (context === 'progress') {
      safeBack(exercise.name);
      return;
    }

    if (!planId || !day) {
      Alert.alert("Error", "Missing plan or day information.");
      return;
    }

    setLoading(true);

    try {
      // Load current plan
      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', parseInt(planId))
        .single();

      if (planError || !plan) {
        throw new Error('Failed to load plan');
      }

      const updatedPlan = { ...plan };
      const dayData = updatedPlan.plan_data.week_schedule[day] || { exercises: [] };

      // Add custom exercise - use target_duration_sec for timed exercises, target_reps for others
      const isTimed = exercise.is_timed || false;
      const newExercise: any = {
        name: exercise.name,
        target_sets: exercise.default_sets || 3,
        rest_time_sec: exercise.default_rest_sec || 60,
        notes: exercise.description || ""
      };

      if (isTimed) {
        newExercise.target_duration_sec = exercise.default_duration_sec || 60;
        // Pre-initialize sets with duration=60 (1 min, 0 sec), rest=60
        const numSets = exercise.default_sets || 3;
        const restSec = exercise.default_rest_sec || 60;
        newExercise.sets = [];
        for (let i = 0; i < numSets; i++) {
          newExercise.sets.push({
            index: i + 1,
            duration: 60,
            rest_time_sec: restSec,
          });
        }
      } else {
        const defaultReps = typeof exercise.default_reps === 'number' ? exercise.default_reps : (parseInt(exercise.default_reps || '10') || 10);
        newExercise.target_reps = defaultReps;
        // Pre-initialize sets with reps and rest
        const numSets = exercise.default_sets || 3;
        const restSec = exercise.default_rest_sec || 60;
        newExercise.sets = [];
        for (let i = 0; i < numSets; i++) {
          newExercise.sets.push({
            index: i + 1,
            reps: defaultReps,
            rest_time_sec: restSec,
          });
        }
      }

      if (exerciseIndex !== undefined) {
        // Replace existing exercise
        const index = parseInt(exerciseIndex);
        dayData.exercises[index] = newExercise;
      } else {
        // Add new exercise
        dayData.exercises = [...(dayData.exercises || []), newExercise];
      }
      updatedPlan.plan_data.week_schedule[day] = dayData;

      // Save plan
      const { error: updateError } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', plan.id);

      if (updateError) {
        throw updateError;
      }

      Alert.alert("Success", "Custom exercise added!");
      safeBack();
    } catch (error: any) {
      console.error('Error adding custom exercise:', error);
      Alert.alert("Error", error.message || "Failed to add exercise.");
    } finally {
      setLoading(false);
    }
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

  const allExercises = (() => {
    const combined = [
      ...scoredMasterExercises,
      ...scoredCustomExercises,
    ].filter(ex => ex.name);

    if (!hasSearchQuery) {
      const sortedByName = combined.sort((a, b) => a.name.localeCompare(b.name));

      if (__DEV__) {
        console.log('[ExerciseSelect] search (empty query)', {
          query: trimmedSearchQuery,
          resultCount: sortedByName.length,
        });
      }

      return sortedByName;
    }

    const filteredByScore = combined.filter(ex => ex.matchScore && ex.matchScore > 0);

    const sortedByScore = filteredByScore.sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return (b.matchScore || 0) - (a.matchScore || 0);
      }
      return a.name.localeCompare(b.name);
    });

    if (__DEV__) {
      console.log('[ExerciseSelect] search', {
        query: trimmedSearchQuery,
        resultCount: sortedByScore.length,
        topResults: sortedByScore.slice(0, 3).map(ex => ({
          name: ex.name,
          matchScore: ex.matchScore,
          type: ex.type,
        })),
      });
    }

    return sortedByScore;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Exercise</Text>
        <TouchableOpacity onPress={() => safeBack()}>
          <X color="#a1a1aa" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#a1a1aa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor="#a1a1aa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={styles.createCustomButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Plus color="#a3e635" size={20} />
        <Text style={styles.createCustomButtonText}>Create Custom Exercise</Text>
      </TouchableOpacity>

      <FlatList
        data={allExercises}
        keyExtractor={(item, index) => `${item.type}-${item.name}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.exerciseItem}
            onPress={() => {
              if (context === 'progress') {
                safeBack(item.name);
                return;
              }
              const dateString = date ? date : (day ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` : '');
              router.replace({
                pathname: '/exercise-detail',
                params: {
                  exerciseName: item.name,
                  exerciseType: item.type,
                  planId: planId || '',
                  day: day || '',
                  exerciseIndex: exerciseIndex || '',
                  weekStart: weekStart || '',
                  date: dateString,
                  context: context || ''
                }
              });
            }}
            activeOpacity={0.7}
            disabled={loading}
          >
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseNameContainer}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                {renderDifficultyIndicator(item.difficulty)}
              </View>
            </View>
            <ChevronRight color="#a1a1aa" size={24} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            No exercises found matching "{searchQuery}"
          </Text>
        )}
        contentContainerStyle={styles.listContainer}
      />

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Custom Exercise</Text>
              <TouchableOpacity onPress={() => {
                setShowCreateModal(false);
                setNewExerciseName('');
                setNewExerciseDescription('');
                setNewExerciseIsTimed(false);
                setNewExerciseDefaultDuration('');
                setNewExerciseDefaultSets('');
                setNewExerciseDefaultReps('');
                setNewExerciseDefaultRest('');
                setSelectedMuscleGroups(new Set());
                setSelectedEquipment(new Set());
                setShowMuscleGroupsDropdown(false);
                setShowEquipmentDropdown(false);
              }}>
                <X color="#a1a1aa" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.modalLabel}>Exercise Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                placeholder="e.g., Dave's Special Curl"
                placeholderTextColor="#71717a"
              />

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={newExerciseDescription}
                onChangeText={setNewExerciseDescription}
                placeholder="Exercise description or notes..."
                placeholderTextColor="#71717a"
                multiline
              />

              <Text style={styles.modalLabel}>Muscle Groups</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowMuscleGroupsDropdown(!showMuscleGroupsDropdown)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedMuscleGroups.size > 0 
                    ? `${selectedMuscleGroups.size} selected` 
                    : 'Select muscle groups...'}
                </Text>
                {showMuscleGroupsDropdown ? (
                  <ChevronUp color="#a1a1aa" size={20} />
                ) : (
                  <ChevronDown color="#a1a1aa" size={20} />
                )}
              </TouchableOpacity>
              {showMuscleGroupsDropdown && (
                <View style={styles.dropdownContainer}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {availableMuscleGroups.map((group) => (
                      <TouchableOpacity
                        key={group}
                        style={styles.dropdownItem}
                        onPress={() => toggleMuscleGroup(group)}
                      >
                        <View style={[
                          styles.checkbox,
                          selectedMuscleGroups.has(group) && styles.checkboxChecked
                        ]}>
                          {selectedMuscleGroups.has(group) && (
                            <Check size={14} color="#09090b" />
                          )}
                        </View>
                        <Text style={styles.dropdownItemText}>{group}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.modalLabel}>Equipment Needed</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowEquipmentDropdown(!showEquipmentDropdown)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedEquipment.size > 0 
                    ? `${selectedEquipment.size} selected` 
                    : 'Select equipment...'}
                </Text>
                {showEquipmentDropdown ? (
                  <ChevronUp color="#a1a1aa" size={20} />
                ) : (
                  <ChevronDown color="#a1a1aa" size={20} />
                )}
              </TouchableOpacity>
              {showEquipmentDropdown && (
                <View style={styles.dropdownContainer}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {availableEquipment.map((equipment) => (
                      <TouchableOpacity
                        key={equipment}
                        style={styles.dropdownItem}
                        onPress={() => toggleEquipment(equipment)}
                      >
                        <View style={[
                          styles.checkbox,
                          selectedEquipment.has(equipment) && styles.checkboxChecked
                        ]}>
                          {selectedEquipment.has(equipment) && (
                            <Check size={14} color="#09090b" />
                          )}
                        </View>
                        <Text style={styles.dropdownItemText}>{equipment}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.modalLabel}>Is Timed Exercise</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    newExerciseIsTimed === true && styles.toggleOptionSelected
                  ]}
                  onPress={() => setNewExerciseIsTimed(true)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    newExerciseIsTimed === true && styles.toggleOptionTextSelected
                  ]}>
                    Yes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    newExerciseIsTimed === false && styles.toggleOptionSelected
                  ]}
                  onPress={() => setNewExerciseIsTimed(false)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    newExerciseIsTimed === false && styles.toggleOptionTextSelected
                  ]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>

              {newExerciseIsTimed === true && (
                <>
                  <Text style={styles.modalLabel}>Default Duration (seconds)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newExerciseDefaultDuration}
                    onChangeText={setNewExerciseDefaultDuration}
                    placeholder="e.g., 60"
                    placeholderTextColor="#71717a"
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.modalLabel}>Default Sets</Text>
              <TextInput
                style={styles.modalInput}
                value={newExerciseDefaultSets}
                onChangeText={setNewExerciseDefaultSets}
                placeholder="e.g., 3"
                placeholderTextColor="#71717a"
                keyboardType="numeric"
              />

              {newExerciseIsTimed !== true && (
                <>
                  <Text style={styles.modalLabel}>Default Reps</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newExerciseDefaultReps}
                    onChangeText={setNewExerciseDefaultReps}
                    placeholder="e.g., 10"
                    placeholderTextColor="#71717a"
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={styles.modalLabel}>Default Rest (seconds)</Text>
              <TextInput
                style={styles.modalInput}
                value={newExerciseDefaultRest}
                onChangeText={setNewExerciseDefaultRest}
                placeholder="e.g., 60"
                placeholderTextColor="#71717a"
                keyboardType="numeric"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewExerciseName('');
                    setNewExerciseDescription('');
                  }}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButtonPrimary, !newExerciseName && styles.modalButtonDisabled]}
                  onPress={handleCreateCustomExercise}
                  disabled={!newExerciseName || loading}
                >
                  <Text style={styles.modalButtonTextPrimary}>Create & Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        duration={2000}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' }, // zinc-950
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 32, paddingTop: 60 }, // p-8
  title: { fontSize: 32, fontWeight: 'bold', color: '#a3e635' }, // lime-400
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 24, padding: 20, marginHorizontal: 24, marginBottom: 16, borderWidth: 1, borderColor: '#27272a' }, // zinc-900, rounded-3xl, zinc-800
  searchInput: { flex: 1, marginLeft: 12, color: 'white', fontSize: 16 },
  exerciseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#18181b', padding: 24, borderRadius: 24, marginBottom: 12, marginHorizontal: 24, borderWidth: 1, borderColor: '#27272a' }, // zinc-900, rounded-3xl, p-6, zinc-800
  exerciseInfo: { flex: 1, marginRight: 12 },
  exerciseNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  exerciseName: { color: 'white', fontSize: 18, fontWeight: '500', flex: 1 },
  difficultyContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  difficultyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  difficultyBar: { borderRadius: 2 },
  difficultyBar1: { width: 6, height: 8 },
  difficultyBar2: { width: 6, height: 12 },
  difficultyBar3: { width: 6, height: 16 },
  difficultyText: { fontSize: 14, fontWeight: '600' },
  emptyText: { color: '#a1a1aa', textAlign: 'center', marginTop: 40 }, // zinc-400
  listContainer: { paddingBottom: Platform.OS === 'web' ? 20 : 120 }, // Extra padding for native tab bar
  createCustomButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#18181b', padding: 20, borderRadius: 24, marginHorizontal: 24, marginBottom: 16, borderWidth: 1, borderColor: '#a3e635', gap: 8, minHeight: 56 }, // zinc-900, rounded-3xl, lime-400
  createCustomButtonText: { color: '#a3e635', fontSize: 16, fontWeight: 'bold' }, // lime-400
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#18181b', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#27272a', maxHeight: '80%' }, // zinc-900, rounded-3xl, zinc-800
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  modalLabel: { color: '#a1a1aa', fontSize: 14, marginBottom: 8, marginTop: 16 }, // zinc-400
  modalInput: { backgroundColor: '#09090b', color: 'white', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#27272a', fontSize: 16 }, // zinc-950, rounded-3xl, zinc-800
  modalTextArea: { minHeight: 100, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalButtonSecondary: { flex: 1, borderWidth: 1, borderColor: '#27272a', padding: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, // zinc-800, rounded-3xl
  modalButtonPrimary: { flex: 1, backgroundColor: '#a3e635', padding: 16, borderRadius: 24, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, // lime-400, rounded-3xl
  modalButtonDisabled: { backgroundColor: '#84cc16', opacity: 0.5 }, // lime-500
  modalButtonTextSecondary: { color: '#a1a1aa', fontWeight: 'bold' }, // zinc-400
  modalButtonTextPrimary: { color: '#09090b', fontWeight: 'bold' }, // zinc-950 for contrast
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#09090b',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 8,
  },
  dropdownButtonText: {
    color: '#a1a1aa',
    fontSize: 16,
  },
  dropdownContainer: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
    maxHeight: 200,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    gap: 12,
  },
  dropdownItemText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#71717a',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#a3e635',
    borderColor: '#a3e635',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleOption: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#09090b',
    alignItems: 'center',
  },
  toggleOptionSelected: {
    borderColor: '#a3e635',
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  toggleOptionText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleOptionTextSelected: {
    color: '#a3e635',
  },
});

