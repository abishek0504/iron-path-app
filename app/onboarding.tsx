import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function OnboardingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Profile Data State
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState('Strength');
  const [days, setDays] = useState('3');
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  const completeSetup = async () => {
    if (!age || !gender || !weight || !height) {
      Alert.alert("Missing Info", "Please fill in all fields to continue.");
      return;
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      Alert.alert("Invalid Age", "Please enter a valid age.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({
          age: ageNum,
          gender: gender,
          current_weight: Number(weight),
          height: Number(height),
          goal: goal,
          days_per_week: Number(days),
          equipment_access: ['Gym'], // Default for MVP
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        router.replace('/(tabs)/home');
      }
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Final Step</Text>
      <Text style={styles.subtitle}>Let's calibrate your workout plan.</Text>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Age</Text>
          <TextInput 
            style={styles.input}
            value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="25" placeholderTextColor="#666"
          />
        </View>
        <View style={styles.halfInput}>
           <Text style={styles.label}>Gender</Text>
           <TouchableOpacity 
             style={styles.input} 
             onPress={() => setShowGenderPicker(true)}
           >
             <Text style={[styles.inputText, !gender && styles.placeholderText]}>
               {gender || 'Select'}
             </Text>
           </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Weight (lbs)</Text>
          <TextInput 
            style={styles.input}
            value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="150" placeholderTextColor="#666"
          />
        </View>
        <View style={styles.halfInput}>
           <Text style={styles.label}>Height (cm)</Text>
           <TextInput 
            style={styles.input}
            value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="175" placeholderTextColor="#666"
          />
        </View>
      </View>

      <Text style={styles.label}>Days per Week</Text>
      <View style={styles.optionRow}>
        {['3', '4', '5'].map((d) => (
          <TouchableOpacity 
            key={d} 
            onPress={() => setDays(d)}
            style={[styles.optionButton, days === d && styles.optionSelected]}
          >
            <Text style={[styles.optionText, days === d && styles.textSelected]}>{d} Days</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Primary Goal</Text>
      <View style={styles.optionRow}>
        {['Strength', 'Hypertrophy'].map((g) => (
          <TouchableOpacity 
            key={g} 
            onPress={() => setGoal(g)}
            style={[styles.optionButton, goal === g && styles.optionSelected]}
          >
            <Text style={[styles.optionText, goal === g && styles.textSelected]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.buttonPrimary} onPress={completeSetup} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Saving..." : "Finish Setup"}</Text>
      </TouchableOpacity>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.genderOption}
                onPress={() => { setGender(g); setShowGenderPicker(false); }}
              >
                <Text style={styles.genderOptionText}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowGenderPicker(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#111827', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', marginBottom: 8 },
  subtitle: { color: '#9ca3af', marginBottom: 32 },
  label: { color: 'white', fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  halfInput: { width: '48%' },
  input: { backgroundColor: '#1f2937', color: 'white', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#374151', height: 56, justifyContent: 'center' },
  inputText: { color: 'white' },
  placeholderText: { color: '#666' },
  optionRow: { flexDirection: 'row', marginBottom: 24, backgroundColor: '#1f2937', borderRadius: 8, padding: 4 },
  optionButton: { flex: 1, padding: 12, borderRadius: 6 },
  optionSelected: { backgroundColor: '#2563eb' },
  optionText: { color: '#9ca3af', textAlign: 'center', fontWeight: 'bold' },
  textSelected: { color: 'white' },
  buttonPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, marginTop: 16 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1f2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  genderOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#374151' },
  genderOptionText: { color: 'white', fontSize: 16 },
  cancelButton: { marginTop: 20, padding: 16, backgroundColor: '#374151', borderRadius: 8 },
  cancelButtonText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }
});