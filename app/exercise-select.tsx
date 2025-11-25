import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search, X, Plus } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';

export default function ExerciseSelectScreen() {
  const router = useRouter();
  const { planId, day, exerciseIndex } = useLocalSearchParams<{ planId: string; day: string; exerciseIndex?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [masterExercises, setMasterExercises] = useState<string[]>([]);
  const [customExercises, setCustomExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseDescription, setNewExerciseDescription] = useState('');

  useEffect(() => {
    loadMasterExercises();
    loadCustomExercises();
  }, []);

  const loadMasterExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('name')
      .order('name', { ascending: true });

    if (!error && data) {
      setMasterExercises(data.map(ex => ex.name));
    } else {
      console.error('Error loading master exercises:', error);
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
    exercise.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomExercises = (customExercises || []).filter((exercise: any) =>
    exercise?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddExercise = async (exerciseName: string) => {
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

      // Add new exercise
      const newExercise = {
        name: exerciseName,
        target_sets: 3,
        target_reps: "8-12",
        rest_time_sec: 60,
        notes: ""
      };

      dayData.exercises = [...(dayData.exercises || []), newExercise];
      updatedPlan.plan_data.week_schedule[day] = dayData;

      // Save plan
      const { error: updateError } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', plan.id);

      if (updateError) {
        throw updateError;
      }

      Alert.alert("Success", "Exercise added!");
      router.back();
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
            default_reps: "8-12",
            default_rest_sec: 60
          }
        ])
        .select()
        .single();

      if (createError) {
        throw createError;
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
      const dayData = updatedPlan.plan_data.week_schedule[day] || { exercises: [] };

      const newExercise = {
        name: newCustomExercise.name,
        target_sets: newCustomExercise.default_sets || 3,
        target_reps: newCustomExercise.default_reps || "8-12",
        rest_time_sec: newCustomExercise.default_rest_sec || 60,
        notes: newCustomExercise.description || ""
      };

      if (exerciseIndex !== undefined) {
        const index = parseInt(exerciseIndex);
        dayData.exercises[index] = newExercise;
      } else {
        dayData.exercises = [...(dayData.exercises || []), newExercise];
      }
      updatedPlan.plan_data.week_schedule[day] = dayData;

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
      Alert.alert("Success", "Custom exercise created and added!");
      router.back();
    } catch (error: any) {
      console.error('Error creating custom exercise:', error);
      Alert.alert("Error", error.message || "Failed to create custom exercise.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomExercise = async (exercise: any) => {
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

      // Add custom exercise
      const newExercise = {
        name: exercise.name,
        target_sets: exercise.default_sets || 3,
        target_reps: exercise.default_reps || "8-12",
        rest_time_sec: exercise.default_rest_sec || 60,
        notes: exercise.description || ""
      };

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
      router.back();
    } catch (error: any) {
      console.error('Error adding custom exercise:', error);
      Alert.alert("Error", error.message || "Failed to add exercise.");
    } finally {
      setLoading(false);
    }
  };

  const allExercises = [
    ...filteredMasterExercises.map(name => ({ name, type: 'master' })),
    ...filteredCustomExercises.map((ex: any) => ({ name: ex.name, ...ex, type: 'custom' }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Exercise</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X color="#9ca3af" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={styles.createCustomButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Plus color="#3b82f6" size={20} />
        <Text style={styles.createCustomButtonText}>Create Custom Exercise</Text>
      </TouchableOpacity>

      <FlatList
        data={allExercises}
        keyExtractor={(item, index) => `${item.type}-${item.name}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.exerciseItem}>
            <Text style={styles.exerciseName}>{item.name}</Text>
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
                <X color="#9ca3af" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.modalLabel}>Exercise Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                placeholder="e.g., Dave's Special Curl"
                placeholderTextColor="#6b7280"
              />

              <Text style={styles.modalLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={newExerciseDescription}
                onChangeText={setNewExerciseDescription}
                placeholder="Exercise description or notes..."
                placeholderTextColor="#6b7280"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 8, padding: 16, marginHorizontal: 24, marginBottom: 16, borderWidth: 1, borderColor: '#374151' },
  searchInput: { flex: 1, marginLeft: 12, color: 'white', fontSize: 16 },
  exerciseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937', padding: 16, borderRadius: 8, marginBottom: 12, marginHorizontal: 24, borderWidth: 1, borderColor: '#374151' },
  exerciseName: { color: 'white', fontSize: 18, fontWeight: '500', flex: 1 },
  addButton: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  addCustomButton: { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  addCustomButtonText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  listContainer: { paddingBottom: 20 },
  createCustomButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937', padding: 16, borderRadius: 8, marginHorizontal: 24, marginBottom: 16, borderWidth: 1, borderColor: '#3b82f6', gap: 8 },
  createCustomButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1f2937', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#374151', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  modalLabel: { color: '#9ca3af', fontSize: 14, marginBottom: 8, marginTop: 16 },
  modalInput: { backgroundColor: '#111827', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#374151', fontSize: 16 },
  modalTextArea: { minHeight: 100, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalButtonSecondary: { flex: 1, borderWidth: 1, borderColor: '#374151', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonPrimary: { flex: 1, backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonDisabled: { backgroundColor: '#1e40af', opacity: 0.5 },
  modalButtonTextSecondary: { color: '#9ca3af', fontWeight: 'bold' },
  modalButtonTextPrimary: { color: 'white', fontWeight: 'bold' },
});

