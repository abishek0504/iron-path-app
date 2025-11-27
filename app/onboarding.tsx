import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet, Modal, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import Slider from '@react-native-community/slider';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const GOALS = ['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss', 'General Fitness'];

const lbsToKg = (lbs: number): number => lbs * 0.453592;
const kgToLbs = (kg: number): number => kg / 0.453592;

const ftInToCm = (feet: number, inches: number): number => (feet * 30.48) + (inches * 2.54);
const cmToFtIn = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [useImperial, setUseImperial] = useState(true);
  
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [goal, setGoal] = useState('Strength');
  const [days, setDays] = useState(3);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const completeSetup = async () => {
    if (!age || !gender || !weight) {
      Alert.alert("Missing Info", "Please fill in all fields to continue.");
      return;
    }
    
    if (useImperial && (!heightFeet || !heightInches)) {
      Alert.alert("Missing Info", "Please enter your height.");
      return;
    }
    
    if (!useImperial && !heightFeet) {
      Alert.alert("Missing Info", "Please enter your height.");
      return;
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      Alert.alert("Invalid Age", "Please enter a valid age.");
      return;
    }

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert("Invalid Weight", "Please enter a valid weight.");
      return;
    }

    let heightCm: number;
    if (useImperial) {
      const feet = parseInt(heightFeet, 10);
      const inches = parseInt(heightInches, 10);
      if (isNaN(feet) || isNaN(inches) || feet < 0 || inches < 0 || inches >= 12) {
        Alert.alert("Invalid Height", "Please enter a valid height.");
        return;
      }
      heightCm = ftInToCm(feet, inches);
    } else {
      const cm = parseFloat(heightFeet);
      if (isNaN(cm) || cm <= 0) {
        Alert.alert("Invalid Height", "Please enter a valid height.");
        return;
      }
      heightCm = cm;
    }

    const weightKg = useImperial ? lbsToKg(weightNum) : weightNum;

    let goalWeightKg: number | null = null;
    if (goalWeight) {
      const goalWeightNum = parseFloat(goalWeight);
      if (isNaN(goalWeightNum) || goalWeightNum <= 0) {
        Alert.alert("Invalid Goal Weight", "Please enter a valid goal weight.");
        return;
      }
      goalWeightKg = useImperial ? lbsToKg(goalWeightNum) : goalWeightNum;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({
          age: ageNum,
          gender: gender,
          current_weight: weightKg,
          goal_weight: goalWeightKg,
          height: heightCm,
          goal: goal,
          days_per_week: days,
          use_imperial: useImperial,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        router.push('/onboarding-equipment');
      }
    }
    setLoading(false);
  };

  const displayWeight = (kg: number | null): string => {
    if (kg === null || kg === undefined) return '';
    return useImperial ? kgToLbs(kg).toFixed(1) : kg.toFixed(1);
  };

  const displayHeight = (cm: number | null): { feet: string; inches: string } | { cm: string } => {
    if (cm === null || cm === undefined) {
      return useImperial ? { feet: '', inches: '' } : { cm: '' };
    }
    if (useImperial) {
      const { feet, inches } = cmToFtIn(cm);
      return { feet: feet.toString(), inches: inches.toString() };
    }
    return { cm: cm.toFixed(1) };
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Final Step</Text>
      <Text style={styles.subtitle}>Let's calibrate your workout plan.</Text>

      <View style={styles.unitToggleContainer}>
        <Text style={styles.unitToggleLabel}>Units</Text>
        <View style={styles.unitToggleRow}>
          <Text style={[styles.unitToggleText, !useImperial && styles.unitToggleTextActive]}>Metric</Text>
          <Switch
            value={useImperial}
            onValueChange={(value) => {
              const newUseImperial = value;
              
              if (weight) {
                const weightValue = parseFloat(weight);
                if (useImperial && !newUseImperial) {
                  setWeight(lbsToKg(weightValue).toFixed(1));
                } else if (!useImperial && newUseImperial) {
                  setWeight(kgToLbs(weightValue).toFixed(1));
                }
              }
              
              if (useImperial && !newUseImperial) {
                const feet = parseInt(heightFeet, 10);
                const inches = parseInt(heightInches, 10);
                if (!isNaN(feet) && !isNaN(inches)) {
                  const cm = ftInToCm(feet, inches);
                  setHeightFeet(cm.toFixed(1));
                  setHeightInches('');
                }
              } else if (!useImperial && newUseImperial) {
                const cm = parseFloat(heightFeet);
                if (!isNaN(cm)) {
                  const { feet, inches } = cmToFtIn(cm);
                  setHeightFeet(feet.toString());
                  setHeightInches(inches.toString());
                }
              }
              
              setUseImperial(newUseImperial);
            }}
            trackColor={{ false: '#374151', true: '#3b82f6' }}
            thumbColor="#ffffff"
          />
          <Text style={[styles.unitToggleText, useImperial && styles.unitToggleTextActive]}>Imperial</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Age</Text>
          <TextInput 
            style={styles.input}
            value={age} 
            onChangeText={setAge} 
            keyboardType="number-pad" 
            placeholder="25" 
            placeholderTextColor="#666"
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
          <Text style={styles.label}>Current Weight {useImperial ? '(lbs)' : '(kg)'}</Text>
          <TextInput 
            style={styles.input}
            value={weight} 
            onChangeText={setWeight} 
            keyboardType="numeric" 
            placeholder={useImperial ? "150" : "68"} 
            placeholderTextColor="#666"
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Goal Weight {useImperial ? '(lbs)' : '(kg)'}</Text>
          <TextInput 
            style={styles.input}
            value={goalWeight} 
            onChangeText={setGoalWeight} 
            keyboardType="numeric" 
            placeholder={useImperial ? "140" : "64"} 
            placeholderTextColor="#666"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Height {useImperial ? '(ft/in)' : '(cm)'}</Text>
          {useImperial ? (
            <View style={styles.heightRow}>
              <TextInput 
                style={[styles.input, styles.heightInput]}
                value={heightFeet} 
                onChangeText={setHeightFeet} 
                keyboardType="number-pad" 
                placeholder="5" 
                placeholderTextColor="#666"
              />
              <Text style={styles.heightSeparator}>ft</Text>
              <TextInput 
                style={[styles.input, styles.heightInput]}
                value={heightInches} 
                onChangeText={setHeightInches} 
                keyboardType="number-pad" 
                placeholder="10" 
                placeholderTextColor="#666"
              />
              <Text style={styles.heightSeparator}>in</Text>
            </View>
          ) : (
            <TextInput 
              style={styles.input}
              value={heightFeet} 
              onChangeText={setHeightFeet} 
              keyboardType="numeric" 
              placeholder="175" 
              placeholderTextColor="#666"
            />
          )}
        </View>
      </View>

      <View style={styles.sliderContainer}>
        <Text style={styles.label}>Days per Week: {days}</Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={7}
          step={1}
          value={days}
          onValueChange={setDays}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#374151"
          thumbTintColor="#3b82f6"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>1</Text>
          <Text style={styles.sliderLabel}>2</Text>
          <Text style={styles.sliderLabel}>3</Text>
          <Text style={styles.sliderLabel}>4</Text>
          <Text style={styles.sliderLabel}>5</Text>
          <Text style={styles.sliderLabel}>6</Text>
          <Text style={styles.sliderLabel}>7</Text>
        </View>
      </View>

      <Text style={styles.label}>Primary Goal</Text>
      <TouchableOpacity 
        style={styles.input} 
        onPress={() => setShowGoalPicker(true)}
      >
        <Text style={[styles.inputText, !goal && styles.placeholderText]}>
          {goal || 'Select'}
        </Text>
      </TouchableOpacity>

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

      {/* Goal Picker Modal */}
      <Modal
        visible={showGoalPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Goal</Text>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.genderOption}
                onPress={() => { setGoal(g); setShowGoalPicker(false); }}
              >
                <Text style={styles.genderOptionText}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowGoalPicker(false)}>
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
  heightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heightInput: { flex: 1, minWidth: 60 },
  heightSeparator: { color: '#9ca3af', fontSize: 14 },
  unitToggleContainer: { 
    backgroundColor: '#1f2937', 
    padding: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#374151',
    marginBottom: 24 
  },
  unitToggleLabel: { 
    color: 'white', 
    fontWeight: 'bold', 
    marginBottom: 12,
    fontSize: 16 
  },
  unitToggleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  unitToggleText: { 
    color: '#9ca3af', 
    fontSize: 16 
  },
  unitToggleTextActive: { 
    color: '#3b82f6', 
    fontWeight: '600' 
  },
  sliderContainer: { marginBottom: 24 },
  slider: { width: '100%', height: 40, marginBottom: 8 },
  sliderLabels: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 4 
  },
  sliderLabel: { 
    color: '#9ca3af', 
    fontSize: 12 
  },
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
