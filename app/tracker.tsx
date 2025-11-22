import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function TrackerScreen() {
  const { exercise } = useLocalSearchParams();
  const router = useRouter();
  
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logSet = async () => {
    if (!weight || !reps) {
      Alert.alert("Missing Data", "Please enter both weight and reps.");
      return;
    }

    setIsSubmitting(true);

    // 1. GET CURRENT USER
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Error", "You must be logged in to save data.");
      setIsSubmitting(false);
      router.replace('/'); // Kick them back to login if session expired
      return;
    }

    try {
      // 2. INSERT DATA WITH USER_ID
      const { error } = await supabase
        .from('workout_logs')
        .insert([
          { 
            user_id: user.id,
            exercise: exercise,
            weight: Number(weight), 
            reps: Number(reps) 
          }
        ]);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Success", "Set logged!");
        setWeight('');
        setReps('');
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>{exercise}</Text>
        <Text style={styles.subtitle}>Log your working set</Text>

        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <Text style={styles.label}>Weight (lbs)</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#999"
              value={weight}
              onChangeText={setWeight}
            />
          </View>

          <View style={styles.inputHalf}>
            <Text style={styles.label}>Reps</Text>
            <TextInput 
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#999"
              value={reps}
              onChangeText={setReps}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.buttonPrimary, isSubmitting && styles.buttonDisabled]}
          onPress={logSet}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Saving...' : 'Log Set'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.buttonSecondary}
        >
          <Text style={styles.buttonTextSecondary}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  contentContainer: { padding: 24, paddingTop: 60, justifyContent: 'center', flexGrow: 1 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#9ca3af', textAlign: 'center', marginBottom: 32 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  inputHalf: { width: '48%' },
  label: { color: '#9ca3af', marginBottom: 8, fontSize: 16 },
  input: { backgroundColor: '#1f2937', color: 'white', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#374151', fontSize: 20, textAlign: 'center' },
  buttonPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  buttonDisabled: { backgroundColor: '#1e40af' },
  buttonSecondary: { borderWidth: 1, borderColor: '#2563eb', padding: 16, borderRadius: 8 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
  buttonTextSecondary: { color: '#60a5fa', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
});