import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, TextInput, Modal, Platform, FlatList, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { X, Plus, ArrowLeft, ChevronUp, ChevronDown, GripVertical } from 'lucide-react-native';

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

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [planId])
  );


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
      router.back();
    } else if (data) {
      setPlan(data);
      if (day && data.plan_data?.week_schedule?.[day]) {
        const loadedDayData = data.plan_data.week_schedule[day];
        setDayData(loadedDayData);
      }
    }
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
    "target_reps": "8-12",
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
        const newIndex = Math.max(0, Math.min(dayData.exercises.length - 1, draggedIndex + offset));
        
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
          const newIndex = Math.max(0, Math.min(dayData.exercises.length - 1, draggedIndex + offset));
          
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
      const [draggedItem] = exercises.splice(draggedIndex, 1);
      
      // When dragging downward, adjust the insertion index to account for the removed item
      let insertIndex = dragOverIndex;
      if (draggedIndex < dragOverIndex) {
        insertIndex = dragOverIndex - 1;
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
    router.push({
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

  const renderExerciseCard = (item: any, index: number, drag?: () => void, isActive?: boolean) => {
    const isDragging = draggedIndex === index;
    
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
              <GripVertical color={(isActive || isDragging) ? "#3b82f6" : "#6b7280"} size={22} />
            </TouchableOpacity>
          ) : Platform.OS === 'web' ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onMouseDown={(e: any) => {
                e.stopPropagation();
                e.preventDefault();
                dragAllowedRef.current = index;
                handleWebTouchStart(index, e);
              }}
              onTouchStart={(e: any) => {
                e.stopPropagation();
                dragAllowedRef.current = index;
                handleWebTouchStart(index, e);
              }}
              style={styles.dragHandleContainer}
            >
              <GripVertical color={(isActive || isDragging) ? "#3b82f6" : "#6b7280"} size={22} />
            </TouchableOpacity>
          ) : (
            <View style={styles.dragHandleContainer}>
              <GripVertical color={(isActive || isDragging) ? "#3b82f6" : "#6b7280"} size={22} />
            </View>
          )}
          {item.name === "New Exercise" ? (
            <TouchableOpacity
              style={styles.exerciseNameContainer}
              onPress={() => {
                router.push({
                  pathname: '/exercise-select',
                  params: { planId: planId || '', day: day || '', exerciseIndex: index.toString() }
                });
              }}
            >
              <Text style={styles.exerciseNamePlaceholder}>{item.name}</Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              style={styles.exerciseName}
              value={item.name}
              onChangeText={(text) => updateExercise(index, 'name', text)}
              placeholder="Exercise name"
              placeholderTextColor="#6b7280"
              editable={!isActive}
              onFocus={() => {
                // Prevent drag when focusing on input
                if (Platform.OS === 'web') {
                  dragAllowedRef.current = null;
                  setDraggedIndex(null);
                }
              }}
            />
          )}
          <TouchableOpacity onPress={() => removeExercise(index)}>
            <X color="#ef4444" size={20} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.exerciseRow}>
          <View style={styles.exerciseField}>
            <Text style={styles.fieldLabel}>Sets</Text>
            <TextInput
              style={styles.fieldInput}
              value={item.target_sets?.toString() || ''}
              onChangeText={(text) => {
                if (text === '') {
                  updateExercise(index, 'target_sets', null);
                } else {
                  const num = parseInt(text);
                  if (!isNaN(num)) {
                    updateExercise(index, 'target_sets', num);
                  }
                }
              }}
              keyboardType="numeric"
              editable={!isActive}
              placeholder="3"
              placeholderTextColor="#6b7280"
            />
          </View>
          <View style={styles.exerciseField}>
            <Text style={styles.fieldLabel}>Reps</Text>
            <TextInput
              style={styles.fieldInput}
              value={item.target_reps || ''}
              onChangeText={(text) => updateExercise(index, 'target_reps', text || null)}
              editable={!isActive}
              placeholder="8-12"
              placeholderTextColor="#6b7280"
            />
          </View>
          <View style={styles.exerciseField}>
            <Text style={styles.fieldLabel}>Rest (sec)</Text>
            <TextInput
              style={styles.fieldInput}
              value={item.rest_time_sec?.toString() || ''}
              onChangeText={(text) => {
                if (text === '') {
                  updateExercise(index, 'rest_time_sec', null);
                } else {
                  const num = parseInt(text);
                  if (!isNaN(num)) {
                    updateExercise(index, 'rest_time_sec', num);
                  }
                }
              }}
              keyboardType="numeric"
              editable={!isActive}
              placeholder="60"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>

        <TextInput
          style={styles.notesInput}
          value={item.notes || ''}
          onChangeText={(text) => updateExercise(index, 'notes', text)}
          placeholder="Notes (optional)"
          placeholderTextColor="#6b7280"
          multiline
          editable={!isActive}
          onFocus={() => {
            // Prevent drag when focusing on input
            if (Platform.OS === 'web') {
              dragAllowedRef.current = null;
              setDraggedIndex(null);
            }
          }}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#9ca3af" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{day}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.exercisesHeader}>
        <Text style={styles.sectionTitle}>Exercises ({dayData.exercises?.length || 0})</Text>
        <TouchableOpacity style={styles.addButton} onPress={addManualExercise}>
          <Plus color="#3b82f6" size={20} />
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
          onPress={() => router.back()}
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
          ListFooterComponent={renderFooter}
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
  container: { flex: 1, backgroundColor: '#111827' },
  listContent: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  headerSection: { marginBottom: 0 },
  footerSection: { marginTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backButton: { marginRight: 16 },
  headerSpacer: { width: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', flex: 1 },
  exercisesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  exerciseCard: { 
    backgroundColor: '#1f2937', 
    padding: 16, 
    borderRadius: 8, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#374151',
    ...(Platform.OS === 'web' ? { userSelect: 'none' as any, WebkitUserSelect: 'none' as any } : {})
  },
  exerciseCardActive: { opacity: 0.8, transform: [{ scale: 1.03 }], borderColor: '#3b82f6' },
  insertLine: { height: 3, backgroundColor: '#3b82f6', marginVertical: 4, marginHorizontal: 0, borderRadius: 2 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  dragHandleContainer: { padding: 8, marginLeft: -8, marginRight: 4, justifyContent: 'center', alignItems: 'center' },
  exerciseNameContainer: { flex: 1 },
  exerciseName: { color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1 },
  exerciseNamePlaceholder: { color: '#3b82f6', fontSize: 18, fontWeight: 'bold' },
  exerciseRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  exerciseField: { flex: 1 },
  fieldLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  fieldInput: { backgroundColor: '#111827', color: 'white', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#374151' },
  notesInput: { backgroundColor: '#111827', color: 'white', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#374151', minHeight: 60 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginVertical: 24 },
  buttonContainer: { marginTop: 24, marginBottom: 40, gap: 12 },
  buttonPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, flexDirection: 'row' },
  buttonDisabled: { backgroundColor: '#1e40af', opacity: 0.7 },
  buttonSecondary: { borderWidth: 1, borderColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonDone: { backgroundColor: '#374151', padding: 16, borderRadius: 8, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  buttonTextSecondary: { color: '#60a5fa', fontWeight: 'bold', fontSize: 16 },
  buttonTextDone: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1f2937', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#374151' },
  modalTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { color: '#9ca3af', fontSize: 14, marginBottom: 16 },
  feedbackInput: { backgroundColor: '#111827', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#374151', minHeight: 120, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalButtonSecondary: { flex: 1, borderWidth: 1, borderColor: '#374151', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonPrimary: { flex: 1, backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonTextSecondary: { color: '#9ca3af', fontWeight: 'bold' },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
});

