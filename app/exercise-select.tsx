import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, X, Plus } from 'lucide-react-native';
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
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    loadMasterExercises();
    loadCustomExercises();
  }, []);

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

  const filteredMasterExercises = masterExercises.filter((exercise) =>
    exercise?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomExercises = (customExercises || []).filter((exercise: any) =>
    exercise?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            muscle_groups: [],
            equipment_needed: [],
            is_timed: false,
            default_duration_sec: null,
            default_sets: 3,
            default_reps: "10",
            default_rest_sec: 60
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
        // Parse default_reps (could be "8-12" or a number) and use first number for sets
        const defaultRepsStr = newCustomExercise.default_reps || "8-12";
        const defaultRepsNum = typeof defaultRepsStr === 'number' 
          ? defaultRepsStr 
          : (typeof defaultRepsStr === 'string' && Number.isFinite(Number(defaultRepsStr.split('-')[0])))
          ? parseInt(defaultRepsStr.split('-')[0], 10)
          : 8;
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

      // Refresh custom exercises list
      await loadCustomExercises();
      
      setShowCreateModal(false);
      setNewExerciseName('');
      setNewExerciseDescription('');
      
      if (context === 'progress') {
        safeBack(newCustomExercise.name);
      } else {
        setToastMessage("Custom exercise created and added!");
        setToastVisible(true);
        setTimeout(() => {
          safeBack();
        }, 500);
      }
    } catch (error: any) {
      console.error('Error creating custom exercise:', error);
      Alert.alert("Error", error.message || "Failed to create custom exercise.");
    } finally {
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

  const allExercises = [
    ...filteredMasterExercises.map(ex => ({ name: ex?.name || '', difficulty: ex?.difficulty || ex?.difficulty_level || null, type: 'master' })),
    // Note: user_exercises (custom) does NOT have difficulty_level, only exercises table does
    ...filteredCustomExercises.map((ex: any) => ({ name: ex?.name || '', difficulty: null, ...ex, type: 'custom' }))
  ].filter(ex => ex.name).sort((a, b) => a.name.localeCompare(b.name));

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
          <View style={styles.exerciseItem}>
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseNameContainer}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                {renderDifficultyIndicator(item.difficulty)}
              </View>
            </View>
            {item.type === 'master' ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleAddExercise(item.name)}
                disabled={loading}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.addCustomButton}
                onPress={() => handleAddCustomExercise(item)}
                disabled={loading}
              >
                <Text style={styles.addCustomButtonText}>Add Custom</Text>
              </TouchableOpacity>
            )}
          </View>
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
              }}>
                <X color="#a1a1aa" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.modalLabel}>Exercise Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                placeholder="e.g., Dave's Special Curl"
                placeholderTextColor="#71717a"
              />

              <Text style={styles.modalLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={newExerciseDescription}
                onChangeText={setNewExerciseDescription}
                placeholder="Exercise description or notes..."
                placeholderTextColor="#71717a"
                multiline
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
  addButton: { backgroundColor: '#a3e635', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 }, // lime-400, rounded-2xl
  addButtonText: { color: '#09090b', fontWeight: 'bold', fontSize: 14 }, // zinc-950 for contrast
  addCustomButton: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#a3e635', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 }, // zinc-900, lime-400, rounded-2xl
  addCustomButtonText: { color: '#a3e635', fontWeight: 'bold', fontSize: 14 }, // lime-400
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
});

