import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { X, Plus } from 'lucide-react-native';

export default function PlannerDayScreen() {
  const router = useRouter();
  const { day, planId } = useLocalSearchParams<{ day: string; planId: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [dayData, setDayData] = useState<any>({ focus: "Rest", exercises: [] });
  const [generating, setGenerating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userFeedback, setUserFeedback] = useState<string>('');

  useEffect(() => {
    loadUserProfile();
    loadUserFeedback();
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
        setDayData(data.plan_data.week_schedule[day]);
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

  const savePlan = async (updatedDayData: any) => {
    if (!plan || !day) return;

    const updatedPlan = { ...plan };
    updatedPlan.plan_data.week_schedule[day] = updatedDayData;

    const { error } = await supabase
      .from('workout_plans')
      .update({ plan_data: updatedPlan.plan_data })
      .eq('id', plan.id);

    if (error) {
      console.error('Error saving plan:', error);
      Alert.alert("Error", "Failed to save changes.");
    } else {
      setDayData(updatedDayData);
      setPlan(updatedPlan);
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
        exercises: updatedExercises,
        focus: dayData.focus === "Rest" ? "Generated" : dayData.focus
      };

      await savePlan(updatedDayData);
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
    savePlan(updatedDayData);
  };

  const updateExercise = (index: number, field: string, value: any) => {
    const updatedExercises = [...dayData.exercises];
    updatedExercises[index] = { ...updatedExercises[index], [field]: value };
    const updatedDayData = {
      ...dayData,
      exercises: updatedExercises
    };
    savePlan(updatedDayData);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{day}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X color="#9ca3af" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.focusCard}>
          <Text style={styles.focusLabel}>Focus</Text>
          <TextInput
            style={styles.focusInput}
            value={dayData.focus || "Rest"}
            onChangeText={(text) => {
              const updated = { ...dayData, focus: text };
              savePlan(updated);
            }}
            placeholder="e.g., Push, Pull, Legs"
            placeholderTextColor="#6b7280"
          />
        </View>

        <View style={styles.exercisesHeader}>
          <Text style={styles.sectionTitle}>Exercises ({dayData.exercises?.length || 0})</Text>
          <TouchableOpacity style={styles.addButton} onPress={addManualExercise}>
            <Plus color="#3b82f6" size={20} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {dayData.exercises?.map((exercise: any, index: number) => (
          <View key={index} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              {exercise.name === "New Exercise" ? (
                <TouchableOpacity
                  style={styles.exerciseNameContainer}
                  onPress={() => {
                    router.push({
                      pathname: '/exercise-select',
                      params: { planId: planId || '', day: day || '', exerciseIndex: index.toString() }
                    });
                  }}
                >
                  <Text style={styles.exerciseNamePlaceholder}>{exercise.name}</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={styles.exerciseName}
                  value={exercise.name}
                  onChangeText={(text) => updateExercise(index, 'name', text)}
                  placeholder="Exercise name"
                  placeholderTextColor="#6b7280"
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
                  value={exercise.target_sets?.toString() || '3'}
                  onChangeText={(text) => updateExercise(index, 'target_sets', parseInt(text) || 3)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.exerciseField}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={exercise.target_reps || '8-12'}
                  onChangeText={(text) => updateExercise(index, 'target_reps', text)}
                />
              </View>
              <View style={styles.exerciseField}>
                <Text style={styles.fieldLabel}>Rest (sec)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={exercise.rest_time_sec?.toString() || '60'}
                  onChangeText={(text) => updateExercise(index, 'rest_time_sec', parseInt(text) || 60)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TextInput
              style={styles.notesInput}
              value={exercise.notes || ''}
              onChangeText={(text) => updateExercise(index, 'notes', text)}
              placeholder="Notes (optional)"
              placeholderTextColor="#6b7280"
              multiline
            />
          </View>
        ))}

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
        </View>
      </ScrollView>

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
  contentContainer: { padding: 24, paddingTop: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6' },
  focusCard: { backgroundColor: '#1f2937', padding: 16, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#374151' },
  focusLabel: { color: '#9ca3af', fontSize: 14, marginBottom: 8 },
  focusInput: { color: 'white', fontSize: 18, fontWeight: '500' },
  exercisesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  exerciseCard: { backgroundColor: '#1f2937', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  exerciseNameContainer: { flex: 1 },
  exerciseName: { color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1 },
  exerciseNamePlaceholder: { color: '#3b82f6', fontSize: 18, fontWeight: 'bold' },
  exerciseRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  exerciseField: { flex: 1 },
  fieldLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  fieldInput: { backgroundColor: '#111827', color: 'white', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#374151' },
  notesInput: { backgroundColor: '#111827', color: 'white', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#374151', minHeight: 60 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginVertical: 24 },
  buttonContainer: { marginTop: 24, marginBottom: 40 },
  buttonPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, flexDirection: 'row' },
  buttonDisabled: { backgroundColor: '#1e40af', opacity: 0.7 },
  buttonSecondary: { borderWidth: 1, borderColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  buttonTextSecondary: { color: '#60a5fa', fontWeight: 'bold', fontSize: 16 },
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

