import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, Switch, Modal, FlatList, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';

const TOTAL_STEPS = 6;

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const FITNESS_GOALS = [
  'Lift heavier',
  'Build muscle',
  'Get lean and defined',
  'Lose weight'
];

const TRAINING_ROUTINE = [
  "I've never had a consistent routine",
  'I struggle with consistency',
  "I'm returning from a break",
  'I strength train regularly'
];

const EXPERIENCE_LEVELS = [
  'I am brand new to strength training',
  'Less than 1 year',
  '1–2 years',
  '2–4 years',
  '4+ years'
];

const WORKOUT_LOCATIONS = [
  { label: 'Large Gym', description: 'Full fitness clubs such as Anytime, Planet Fitness, Golds, 24-Hour, Equinox.' },
  { label: 'Small Gym', description: 'Compact public gyms with limited equipment.' },
  { label: 'Garage Gym', description: 'Barbells, squat rack, dumbbells, etc.' },
  { label: 'At Home', description: 'Limited equipment such as bands and dumbbells.' },
  { label: 'Without Equipment', description: 'Workout anywhere with bodyweight-only exercises.' },
  { label: 'Custom', description: 'Start from scratch and build your own equipment list.' }
];

const DAYS_OF_WEEK = [
  { label: 'Monday', short: 'Mon' },
  { label: 'Tuesday', short: 'Tue' },
  { label: 'Wednesday', short: 'Wed' },
  { label: 'Thursday', short: 'Thu' },
  { label: 'Friday', short: 'Fri' },
  { label: 'Saturday', short: 'Sat' },
  { label: 'Sunday', short: 'Sun' },
];

const lbsToKg = (lbs: number): number => lbs * 0.453592;
const kgToLbs = (kg: number): number => kg / 0.453592;

export default function OnboardingScreen() {
  const router = useRouter();
  const { step } = useLocalSearchParams<{ step?: string }>();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Handle step parameter from equipment page
  useEffect(() => {
    if (step) {
      const stepNum = parseInt(step, 10);
      if (!isNaN(stepNum) && stepNum >= 0 && stepNum < TOTAL_STEPS) {
        setCurrentStep(stepNum);
      }
    }
  }, [step]);
  
  // Questionnaire answers
  const [fitnessGoal, setFitnessGoal] = useState<string>('');
  const [trainingRoutine, setTrainingRoutine] = useState<string>('');
  const [experienceLevel, setExperienceLevel] = useState<string>('');
  const [workoutLocation, setWorkoutLocation] = useState<string>('');
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3);
  const [workoutScheduleMode, setWorkoutScheduleMode] = useState<'count' | 'days' | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  
  // Personal info
  const [age, setAge] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [heightFeet, setHeightFeet] = useState<string>('');
  const [heightInches, setHeightInches] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [useMetric, setUseMetric] = useState<boolean>(false);
  
  // Picker modals
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      // If they selected "Custom" for workout location, go to equipment page
      if (currentStep === 4 && workoutLocation === 'Custom') {
        router.push('/onboarding-equipment');
        return;
      }
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep === 5 && workoutScheduleMode !== null) {
      // If on step 5 (days per week) and a mode is selected, go back to mode selection
      setWorkoutScheduleMode(null);
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSkip = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      // Move to next question
      setCurrentStep(currentStep + 1);
    } else {
      // On last step, complete the onboarding
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Map answers to database fields
      let goal = 'Strength';
      if (fitnessGoal === 'Lift heavier') goal = 'Strength';
      else if (fitnessGoal === 'Build muscle') goal = 'Hypertrophy';
      else if (fitnessGoal === 'Get lean and defined') goal = 'Hypertrophy';
      else if (fitnessGoal === 'Lose weight') goal = 'Weight Loss';

      // Determine days_per_week based on mode
      let finalDaysPerWeek = daysPerWeek;
      if (workoutScheduleMode === 'days') {
        finalDaysPerWeek = selectedDays.size;
      }

      // Store workout days if specific days were selected
      const workoutDays = workoutScheduleMode === 'days' ? Array.from(selectedDays) : null;

      // Calculate height in cm (for storage)
      let heightInCm: number | null = null;
      if (useMetric) {
        heightInCm = parseFloat(heightCm) || null;
      } else {
        const feet = parseFloat(heightFeet) || 0;
        const inches = parseFloat(heightInches) || 0;
        heightInCm = feet * 30.48 + inches * 2.54;
      }

      // Convert weight to kg if imperial
      let weightInKg: number | null = null;
      if (useMetric) {
        weightInKg = parseFloat(weight) || null;
      } else {
        weightInKg = lbsToKg(parseFloat(weight) || 0) || null;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          goal: goal,
          days_per_week: finalDaysPerWeek,
          workout_days: workoutDays,
          equipment_access: workoutLocation === 'Custom' ? [] : [workoutLocation],
          age: age ? parseInt(age) : null,
          weight_kg: weightInKg,
          height_cm: heightInCm,
          gender: gender,
          use_metric: useMetric,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
      } else {
        router.replace('/(tabs)');
      }
    }
    setLoading(false);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return fitnessGoal !== '';
      case 1: return trainingRoutine !== '';
      case 2: return experienceLevel !== '';
      case 3: {
        // Personal info step
        if (!age || !weight || !gender) return false;
        if (useMetric) {
          return heightCm !== '';
        } else {
          return heightFeet !== '' && heightInches !== '';
        }
      }
      case 4: return workoutLocation !== '';
      case 5: {
        if (workoutScheduleMode === 'count') {
          return daysPerWeek > 0;
        } else if (workoutScheduleMode === 'days') {
          return selectedDays.size > 0;
        }
        return false;
      }
      default: return false;
    }
  };

  const renderQuestion = () => {
    switch (currentStep) {
      case 0:
        return {
          title: "What is your top fitness goal?",
          options: FITNESS_GOALS,
          selected: fitnessGoal,
          onSelect: setFitnessGoal
        };
      case 1:
        return {
          title: "Which best describes your current strength training routine?",
          options: TRAINING_ROUTINE,
          selected: trainingRoutine,
          onSelect: setTrainingRoutine
        };
      case 2:
        return {
          title: "How much strength training experience do you have?",
          options: EXPERIENCE_LEVELS,
          selected: experienceLevel,
          onSelect: setExperienceLevel
        };
      case 3:
        return {
          title: "Tell us about yourself",
          isPersonalInfo: true,
        };
      case 4:
        return {
          title: "Where do you usually work out?",
          options: WORKOUT_LOCATIONS.map(loc => loc.label),
          descriptions: WORKOUT_LOCATIONS.map(loc => loc.description),
          selected: workoutLocation,
          onSelect: setWorkoutLocation
        };
      case 5:
        return {
          title: "How many days per week do you want to work out?",
          mode: workoutScheduleMode,
          onModeSelect: setWorkoutScheduleMode,
          daysPerWeek: daysPerWeek,
          onDaysPerWeekSelect: setDaysPerWeek,
          selectedDays: selectedDays,
          onSelectedDaysChange: setSelectedDays,
        };
      default:
        return null;
    }
  };

  const question = renderQuestion();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${progress}%` }
              ]} 
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>{question?.title}</Text>
        
        {question?.descriptions ? (
          <Text style={styles.questionSubtitle}>
            IronPath will compile a starter equipment list based on the location you pick.
          </Text>
        ) : null}

        {currentStep === 3 ? (
          // Personal info step - special rendering
          <View style={styles.personalInfoContainer}>
            <View style={styles.unitToggleContainer}>
              <Text style={styles.unitLabel}>Metric</Text>
              <Switch
                value={!useMetric}
                onValueChange={(value) => setUseMetric(!value)}
                trackColor={{ false: '#27272a', true: '#a3e635' }}
                thumbColor={!useMetric ? '#ffffff' : '#a1a1aa'}
                ios_backgroundColor="#27272a"
              />
              <Text style={styles.unitLabel}>Imperial</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Age</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowAgePicker(true)}
              >
                <Text style={[styles.pickerButtonText, !age && styles.pickerButtonPlaceholder]}>
                  {age || 'Select age'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight ({useMetric ? 'kg' : 'lbs'})</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowWeightPicker(true)}
              >
                <Text style={[styles.pickerButtonText, !weight && styles.pickerButtonPlaceholder]}>
                  {weight ? `${weight} ${useMetric ? 'kg' : 'lbs'}` : `Select weight (${useMetric ? 'kg' : 'lbs'})`}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Height</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowHeightPicker(true)}
              >
                <Text style={[styles.pickerButtonText, (!heightCm && !heightFeet) && styles.pickerButtonPlaceholder]}>
                  {useMetric 
                    ? (heightCm ? `${heightCm} cm` : 'Select height (cm)')
                    : (heightFeet || heightInches ? `${heightFeet || 0}' ${heightInches || 0}"` : "Select height (ft'in\")")
                  }
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowGenderPicker(true)}
              >
                <Text style={[styles.pickerButtonText, !gender && styles.pickerButtonPlaceholder]}>
                  {gender || 'Select gender'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : currentStep === 5 ? (
          // Days per week step - special rendering
          <View style={styles.optionsContainer}>
            {question?.mode === null ? (
              // Show mode selection
              <>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    question?.mode === 'count' && styles.optionCardSelected
                  ]}
                  onPress={() => question?.onModeSelect?.('count')}
                >
                  <View style={[
                    styles.checkbox,
                    question?.mode === 'count' && styles.checkboxSelected
                  ]}>
                    {question?.mode === 'count' && <Check size={16} color="#09090b" />}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionText,
                      question?.mode === 'count' && styles.optionTextSelected
                    ]}>
                      Number of days
                    </Text>
                    <Text style={styles.optionDescription}>
                      Choose how many days per week you want to work out
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    question?.mode === 'days' && styles.optionCardSelected
                  ]}
                  onPress={() => question?.onModeSelect?.('days')}
                >
                  <View style={[
                    styles.checkbox,
                    question?.mode === 'days' && styles.checkboxSelected
                  ]}>
                    {question?.mode === 'days' && <Check size={16} color="#09090b" />}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionText,
                      question?.mode === 'days' && styles.optionTextSelected
                    ]}>
                      Specific days
                    </Text>
                    <Text style={styles.optionDescription}>
                      Choose which days of the week you want to work out
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : question?.mode === 'count' ? (
              // Show number of days selection
              DAYS_OF_WEEK.slice(0, 7).map((_, index) => {
                const numDays = index + 1;
                const isSelected = question?.daysPerWeek === numDays;
                return (
                  <TouchableOpacity
                    key={numDays}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected
                    ]}
                    onPress={() => question?.onDaysPerWeekSelect?.(numDays)}
                  >
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Check size={16} color="#09090b" />}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected
                      ]}>
                        {numDays} {numDays === 1 ? 'Day' : 'Days'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Show specific days selection
              DAYS_OF_WEEK.map((day) => {
                const isSelected = question?.selectedDays?.has(day.label) || false;
                return (
                  <TouchableOpacity
                    key={day.label}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected
                    ]}
                    onPress={() => {
                      const currentDays = question?.selectedDays || new Set<string>();
                      const newSelectedDays = new Set<string>(currentDays);
                      if (newSelectedDays.has(day.label)) {
                        newSelectedDays.delete(day.label);
                      } else {
                        newSelectedDays.add(day.label);
                      }
                      question?.onSelectedDaysChange?.(newSelectedDays);
                    }}
                  >
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Check size={16} color="#09090b" />}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected
                      ]}>
                        {day.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          // Regular question rendering
          <View style={styles.optionsContainer}>
            {question?.options?.map((option, index) => {
              const isSelected = question.selected === option;
              const description = question.descriptions?.[index];
              
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected
                  ]}
                  onPress={() => question?.onSelect?.(option)}
                >
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected
                  ]}>
                    {isSelected && <Check size={16} color="#09090b" />}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected
                    ]}>
                      {option}
                    </Text>
                    {description && (
                      <Text style={styles.optionDescription}>{description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.nextButton,
          (!canProceed() || loading) && styles.nextButtonDisabled
        ]}
        onPress={handleNext}
        disabled={!canProceed() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#09090b" />
        ) : (
          <Text style={styles.nextButtonText}>
            {currentStep === TOTAL_STEPS - 1 ? 'Complete' : 'Next'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Gender</Text>
              <TouchableOpacity
                onPress={() => setShowGenderPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={styles.nativePicker}
            >
              {GENDERS.map((genderOption) => (
                <Picker.Item key={genderOption} label={genderOption} value={genderOption} />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Age Picker Modal */}
      <Modal
        visible={showAgePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAgePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAgePicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Age</Text>
              <TouchableOpacity
                onPress={() => setShowAgePicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={age}
              onValueChange={(itemValue) => setAge(itemValue)}
              style={styles.nativePicker}
            >
              {Array.from({ length: 150 }, (_, i) => i + 1).map((ageValue) => (
                <Picker.Item key={ageValue} label={ageValue.toString()} value={ageValue.toString()} />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Weight Picker Modal */}
      <Modal
        visible={showWeightPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWeightPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWeightPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Weight</Text>
              <TouchableOpacity
                onPress={() => setShowWeightPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.nativePickerRow}>
              <Picker
                selectedValue={weight}
                onValueChange={(itemValue) => setWeight(itemValue)}
                style={[styles.nativePicker, { flex: 1 }]}
              >
                {Array.from({ length: useMetric ? 301 : 601 }, (_, i) => i).map((weightValue) => (
                  <Picker.Item key={weightValue} label={weightValue.toString()} value={weightValue.toString()} />
                ))}
              </Picker>
              <View style={styles.pickerUnitLabel}>
                <Text style={styles.pickerUnitText}>{useMetric ? 'kg' : 'lbs'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Height Picker Modal */}
      <Modal
        visible={showHeightPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHeightPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeightPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Height</Text>
              <TouchableOpacity
                onPress={() => setShowHeightPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            {useMetric ? (
              <View style={styles.nativePickerRow}>
                <Picker
                  selectedValue={heightCm}
                  onValueChange={(itemValue) => setHeightCm(itemValue)}
                  style={[styles.nativePicker, { flex: 1 }]}
                >
                  {Array.from({ length: 301 }, (_, i) => i).map((cmValue) => (
                    <Picker.Item key={cmValue} label={cmValue.toString()} value={cmValue.toString()} />
                  ))}
                </Picker>
                <View style={styles.pickerUnitLabel}>
                  <Text style={styles.pickerUnitText}>cm</Text>
                </View>
              </View>
            ) : (
              <View style={styles.nativePickerRow}>
                <Picker
                  selectedValue={heightFeet}
                  onValueChange={(itemValue) => setHeightFeet(itemValue)}
                  style={[styles.nativePicker, { flex: 1 }]}
                >
                  {Array.from({ length: 9 }, (_, i) => i).map((feetValue) => (
                    <Picker.Item key={feetValue} label={feetValue.toString()} value={feetValue.toString()} />
                  ))}
                </Picker>
                <View style={styles.pickerUnitLabel}>
                  <Text style={styles.pickerUnitText}>ft</Text>
                </View>
                <Picker
                  selectedValue={heightInches}
                  onValueChange={(itemValue) => setHeightInches(itemValue)}
                  style={[styles.nativePicker, { flex: 1 }]}
                >
                  {Array.from({ length: 12 }, (_, i) => i).map((inchesValue) => (
                    <Picker.Item key={inchesValue} label={inchesValue.toString()} value={inchesValue.toString()} />
                  ))}
                </Picker>
                <View style={styles.pickerUnitLabel}>
                  <Text style={styles.pickerUnitText}>in</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: '#27272a', // zinc-800
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff', // white
    borderRadius: 1,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 120, // Space for floating button
  },
  questionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  questionSubtitle: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    marginBottom: 32,
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    position: 'relative',
  },
  optionCardSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#71717a', // zinc-500
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  checkboxSelected: {
    borderColor: '#a3e635', // lime-400
    backgroundColor: '#a3e635', // lime-400
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  optionTextSelected: {
    color: '#09090b', // zinc-950
  },
  optionDescription: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    marginTop: 8,
    lineHeight: 20,
  },
  nextButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#a3e635', // lime-400
    borderRadius: 36, // rounded-3xl capsule shape
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  personalInfoContainer: {
    gap: 24,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    gap: 16,
  },
  unitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  inputGroup: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  input: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    color: '#ffffff',
    fontSize: 16,
  },
  heightInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heightInputHalf: {
    flex: 1,
  },
  pickerButton: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    justifyContent: 'center',
    minHeight: 56,
  },
  pickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  pickerButtonPlaceholder: {
    color: '#71717a', // zinc-500
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#18181b', // zinc-900
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
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
  pickerScrollView: {
    maxHeight: 400,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  pickerNumberOption: {
    paddingVertical: 12,
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
  },
  pickerOptionText: {
    fontSize: 18,
    color: '#ffffff',
  },
  pickerOptionTextSelected: {
    color: '#a3e635', // lime-400
    fontWeight: '600',
  },
  pickerSelectedValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a3e635', // lime-400
  },
});
