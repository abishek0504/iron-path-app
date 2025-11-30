import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, TextInput, Modal, Platform, FlatList, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { X, Plus, ArrowLeft, ChevronUp, ChevronDown, GripVertical, Edit2 } from 'lucide-react-native';

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

export default function PlannerDayScreen() {
  const router = useRouter();
  const { day, planId } = useLocalSearchParams<{ day: string; planId: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [dayData, setDayData] = useState<any>({ exercises: [] });
  const [generating, setGenerating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userFeedback, setUserFeedback] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, { is_timed: boolean; default_duration_sec: number | null; difficulty: string | null }>>(new Map());
  const [durationMinutes, setDurationMinutes] = useState<Map<number, string>>(new Map());
  const [durationSeconds, setDurationSeconds] = useState<Map<number, string>>(new Map());
  const dragAllowedRef = React.useRef<number | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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
      updatedPlan.plan_data.week_schedule[day] = updatedDayData;
      setPlan(updatedPlan);
      savePlan(updatedDayData, true, false);
    }
    // Use exerciseDetails.size and exercise count/length to detect changes
    // Avoid JSON.stringify in dependency array as it creates new objects on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseDetails.size, day, plan?.id, dayData?.exercises?.length]);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [planId])
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
    if (!planId) return;

    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', parseInt(planId))
      .single();

    if (error) {
      console.error('Error loading plan:', error);
      Alert.alert("Error", "Failed to load workout plan.");
      handleBack();
    } else if (data) {
      setPlan(data);
      if (day && data.plan_data?.week_schedule?.[day]) {
        const loadedDayData = data.plan_data.week_schedule[day];
        
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
          
          // Save migrated data back to database
          const updatedPlan = { ...data };
          updatedPlan.plan_data.week_schedule[day] = migratedDayData;
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
        }
        
        // Load exercise details
        await loadExerciseDetails(loadedDayData.exercises || []);
      }
    }
  };

  const loadExerciseDetails = async (exercises: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !exercises.length) return;

    const exerciseNames = exercises.map((ex: any) => ex.name).filter(Boolean);
    if (exerciseNames.length === 0) return;

    const detailsMap = new Map<string, { is_timed: boolean; default_duration_sec: number | null; difficulty: string | null }>();

    // Batch query all exercises from master exercises table
    // Note: exercises table doesn't have default_duration_sec, only user_exercises does
    const { data: masterExercises, error: masterError } = await supabase
      .from('exercises')
      .select('name, is_timed, difficulty_level')
      .in('name', exerciseNames);

    if (masterError) {
      console.error('Error loading master exercises:', masterError);
    }

    // Batch query all user exercises
    // Note: user_exercises table does NOT have difficulty_level column (only exercises table has it)
    const { data: userExercises, error: userError } = await supabase
      .from('user_exercises')
      .select('name, is_timed, default_duration_sec')
      .eq('user_id', user.id)
      .in('name', exerciseNames);

    if (userError) {
      console.error('Error loading user exercises:', userError);
    }

    // Create maps for quick lookup
    const masterExerciseMap = new Map(
      (masterExercises || []).map((ex: any) => [ex.name, ex])
    );
    const userExerciseMap = new Map(
      (userExercises || []).map((ex: any) => [ex.name, ex])
    );

    // Merge results: user exercises take precedence over master exercises
    for (const exercise of exercises) {
      if (!exercise.name) continue;
      
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
        // User exercises don't have difficulty_level, so get it from master exercises if available
        const difficulty = masterExercise?.difficulty_level || null;
        detailsMap.set(exercise.name, {
          is_timed: userExercise.is_timed || false,
          default_duration_sec: userExercise.default_duration_sec,
          difficulty: difficulty
        });
      } else if (masterExercise) {
        detailsMap.set(exercise.name, {
          is_timed: masterExercise.is_timed || false,
          default_duration_sec: null, // Master exercises table doesn't have default_duration_sec, use null (will default to 60 in code)
          difficulty: masterExercise.difficulty_level || null
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
    if (!plan || !day) return;

    // Update local state immediately for instant UI feedback (unless skipping for focus input)
    if (!skipStateUpdate) {
      setDayData(updatedDayData);
      const updatedPlan = { ...plan };
      updatedPlan.plan_data.week_schedule[day] = updatedDayData;
      setPlan(updatedPlan);
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce database save - only save after user stops typing for 1 second
    const performSave = async () => {
      const updatedPlan = { ...plan };
      updatedPlan.plan_data.week_schedule[day] = updatedDayData;
      
      const { error } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', plan.id);

      if (error) {
        console.error('Error saving plan:', error);
        // Don't show alert on every keystroke - only log error
      } else {
        // Only update state after successful save to avoid re-render issues
        if (skipStateUpdate) {
          setDayData(updatedDayData);
          setPlan(updatedPlan);
        }
      }
    };

    if (immediate) {
      // Save immediately for actions like delete, reorder, etc.
      await performSave();
    } else {
      // Debounce for text input changes
      saveTimeoutRef.current = setTimeout(performSave, 1000);
    }
  };

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

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const existingExercises = dayData.exercises || [];
      const existingNames = existingExercises.map((e: any) => e.name).join(', ');

      const feedbackContext = userFeedback ? `\n\nUser feedback to consider: ${userFeedback}` : '';

      const prompt = `Generate supplementary exercises for ${day} workout. The user is a ${userProfile.age}-year-old ${userProfile.gender || 'person'} with goal: ${userProfile.goal}, training ${userProfile.days_per_week} days per week, equipment: ${userProfile.equipment_access?.join(', ') || 'Gym'}.

IMPORTANT: The user already has these exercises for this day: ${existingNames || 'None'}. Generate exercises that COMPLEMENT these existing exercises and work well together. DO NOT duplicate or replace existing exercises. Only add supplementary exercises that make sense.

${feedbackContext}

The response must be STRICTLY valid JSON array in this exact format:
[
  {
    "name": "Exercise Name",
    "target_sets": 3,
    "target_reps": 10,
    "rest_time_sec": 90,
    "notes": "Form tips"
  }
]

Return ONLY the JSON array, no other text.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text().trim();
      
      // Extract JSON from response
      if (text.startsWith('```')) {
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const newExercises = JSON.parse(text);
      
      if (!Array.isArray(newExercises)) {
        throw new Error('Invalid response format');
      }

      // Add new exercises to existing ones (user preference - don't overwrite)
      const updatedExercises = [...existingExercises, ...newExercises];
      const updatedDayData = {
        ...dayData,
        exercises: updatedExercises
      };

      await savePlan(updatedDayData, true);
      // Reload exercise details after adding new exercises
      await loadExerciseDetails(updatedExercises);
      setHasGenerated(true);
      Alert.alert("Success", `Added ${newExercises.length} supplementary exercise${newExercises.length !== 1 ? 's' : ''}!`);
    } catch (error: any) {
      console.error('Error generating exercises:', error);
      Alert.alert("Error", error.message || "Failed to generate exercises. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const removeExercise = (index: number) => {
    const updatedExercises = dayData.exercises.filter((_: any, i: number) => i !== index);
    const updatedDayData = {
      ...dayData,
      exercises: updatedExercises
    };
    // Immediate save for delete action
    savePlan(updatedDayData, true);
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
    // Only allow drag end if drag was started from grip handle
    if (dragAllowedRef.current !== null) {
      const updatedDayData = {
        ...dayData,
        exercises: data
      };
      // Immediate save for drag action
      savePlan(updatedDayData, true);
    }
    dragAllowedRef.current = null;
  };

  // Web drag handlers using touch/mouse events (React Native Responder System)
  const handleWebTouchStart = (index: number, e: any) => {
    if (Platform.OS === 'web') {
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
    router.replace({
      pathname: '/exercise-select',
      params: { planId: planId || '', day: day || '' }
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

  const renderExerciseCard = (item: any, index: number, drag?: () => void, isActive?: boolean) => {
    const isDragging = draggedIndex === index;
    const detail = exerciseDetails.get(item.name);
    const isTimed = detail?.is_timed || false;
    const defaultDuration = detail?.default_duration_sec || 60;
    const difficulty = item.difficulty || detail?.difficulty || dayData?.difficulty || null;
    
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
          {Platform.OS !== 'web' && drag ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => {
                dragAllowedRef.current = index;
                drag();
              }}
              delayLongPress={400}
              disabled={isActive}
              style={styles.dragHandleContainer}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <GripVertical color={(isActive || isDragging) ? "#a3e635" : "#71717a"} size={22} />
            </TouchableOpacity>
          ) : Platform.OS === 'web' ? (
            <View
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e: any) => {
                e.stopPropagation();
                dragAllowedRef.current = index;
                handleWebTouchStart(index, e);
              }}
              style={styles.dragHandleContainer}
            >
              <GripVertical color={(isActive || isDragging) ? "#a3e635" : "#71717a"} size={22} />
            </View>
          ) : (
            <View style={styles.dragHandleContainer}>
              <GripVertical color={(isActive || isDragging) ? "#a3e635" : "#71717a"} size={22} />
            </View>
          )}
          {item.name === "New Exercise" ? (
            <TouchableOpacity
              style={styles.exerciseNameContainer}
              onPress={() => {
                router.replace({
                  pathname: '/exercise-select',
                  params: { planId: planId || '', day: day || '', exerciseIndex: index.toString() }
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
                router.replace({
                  pathname: '/workout-sets',
                  params: { planId: planId || '', day: day || '', exerciseIndex: index.toString() }
                });
              }}
              style={styles.editButton}
            >
              <Edit2 color="#a3e635" size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeExercise(index)}>
              <X color="#ef4444" size={20} />
            </TouchableOpacity>
          </View>
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
                  <Text style={styles.setValue}>
                    {set.duration !== null && set.duration !== undefined
                      ? `${getDurationMinutes(set.duration)}:${getDurationSeconds(set.duration).toString().padStart(2, '0')}`
                      : '—'}
                  </Text>
                ) : (
                  <Text style={styles.setValue}>
                    {set.reps !== null && set.reps !== undefined ? `${set.reps} reps` : '—'}
                  </Text>
                )}
                <Text style={styles.setValue}>
                  {set.rest_time_sec !== null && set.rest_time_sec !== undefined ? `${set.rest_time_sec}s rest` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {item.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
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
    </View>
  );

  const renderFooter = () => (
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
              <Text style={styles.buttonText}>Generate Supplementary Exercises</Text>
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
  );

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS === 'web' ? (
        // Web: Use FlatList with custom drag handlers
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
          keyExtractor={(item: any, index: number) => `exercise-${index}`}
          activationDistance={10000}
          simultaneousHandlers={[]}
          renderItem={({ item, index, drag, isActive }: any) => {
            // Store the drag function in a ref so we can call it only from the grip handle
            const dragRef = React.useRef(drag);
            dragRef.current = drag;
            
            // Create a no-op drag function that only works if explicitly allowed
            const conditionalDrag = () => {
              // Only allow drag if it was explicitly initiated from the grip handle
              if (dragAllowedRef.current === index) {
                dragRef.current();
              }
            };
            
            return (
              <ScaleDecorator>
                <View>
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <View style={styles.insertLine} />
                  )}
                  <View 
                    style={{ pointerEvents: isActive ? 'none' : 'auto' }}
                  >
                    {renderExerciseCard(item, index, conditionalDrag, isActive)}
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
  setsContainer: { marginBottom: 12 },
  setsTitle: { color: '#a1a1aa', fontSize: 12, marginBottom: 8, fontWeight: '600' }, // zinc-400
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' },
  setNumber: { color: 'white', fontSize: 14, fontWeight: '600' },
  setValue: { color: '#a1a1aa', fontSize: 14 }, // zinc-400
  noSetsText: { color: '#71717a', fontSize: 14, fontStyle: 'italic', marginBottom: 12 }, // zinc-500
  notesContainer: { marginTop: 8, marginBottom: 12 },
  notesLabel: { color: '#a1a1aa', fontSize: 12, marginBottom: 4, fontWeight: '600' }, // zinc-400
  notesText: { color: '#a1a1aa', fontSize: 14 }, // zinc-400
});

