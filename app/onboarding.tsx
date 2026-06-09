/**
 * Multi-step Onboarding Flow
 * Step 1: About you (name, DOB)
 * Step 2: Body & units (weight, units, gender)
 * Step 3: Experience & training (experience, days slider + preferred days)
 * Step 4: Equipment
 * Step 5: Review
 */

import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { supabase } from '../src/lib/supabase/client';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { useUserStore } from '../src/stores/userStore';
import {
  createUserProfile,
  updateUserProfile,
} from '../src/lib/supabase/queries/users';
import { getUserProfileCached, invalidateProfileCache, invalidateWeightCache } from '../src/lib/cache/dashboardStatsCache';
import { insertWeightLog } from '../src/lib/supabase/queries/weight';
import {
  getUserTemplates,
  createTemplate,
  ensureTemplateHasWeekDays,
} from '../src/lib/supabase/queries/templates';
import { invalidateTemplates, invalidateTemplate } from '../src/lib/cache/templateCache';
import { devLog, devError } from '../src/lib/utils/logger';
import { rescheduleRemindersAfterProfileWorkoutDays } from '../src/lib/utils/notifications';
import { useToast } from '../src/hooks/useToast';
import { validateDateOfBirth, calculateAge, formatDateOfBirth } from '../src/lib/utils/date';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BottomSheet } from '../src/components/ui/BottomSheet';
import { DatePicker } from '../src/components/ui/DatePicker';

const EXPERIENCE_OPTIONS = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT_OPTIONS = ['Full gym', 'Dumbbells', 'Bands', 'Bodyweight only'];
const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const WEEKDAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TOTAL_STEPS = 5;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const toast = useToast();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [useImperial, setUseImperial] = useState(true);
  const [currentWeight, setCurrentWeight] = useState<number>(70);
  const [gender, setGender] = useState<string>('');
  const [experience, setExperience] = useState<string>('');
  const [daysPerWeekSlider, setDaysPerWeekSlider] = useState<number>(0);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setErrorText('Please log in to continue.');
        router.replace('/login');
        return;
      }

      const userId = session.user.id;
      const profile = await getUserProfileCached(userId);

      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        if (profile.date_of_birth) {
          setDateOfBirth(new Date(profile.date_of_birth));
        }
        setUseImperial(profile.use_imperial ?? true);
        setCurrentWeight(profile.current_weight != null ? profile.current_weight : 70);
        setGender(profile.gender || '');
        setExperience(profile.experience_level || '');
        setDaysPerWeekSlider(profile.days_per_week ?? 0);
        setWorkoutDays(profile.workout_days || []);
        setEquipment(profile.equipment_access || []);
        setProfile(profile);
      }
    } catch (error) {
      if (__DEV__) {
        devError('onboarding-load', error);
      }
      setErrorText('Unable to load your profile.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEquipment = (value: string) => {
    setEquipment((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      return [...prev, value];
    });
  };

  const handleDaysPerWeekSliderChange = (value: number) => {
    const n = Math.round(value);
    const wasAllSeven = daysPerWeekSlider === 7 && workoutDays.length === WEEKDAY_OPTIONS.length;
    setDaysPerWeekSlider(n);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (n === 7) {
      setWorkoutDays([...WEEKDAY_OPTIONS]);
    } else if (wasAllSeven) {
      setWorkoutDays([]);
    } else if (n < workoutDays.length) {
      setWorkoutDays((prev) => prev.slice(0, n));
    }
  };

  const toggleWorkoutDay = (day: string) => {
    const max = daysPerWeekSlider;
    setWorkoutDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      if (prev.length >= max) return prev;
      return [...prev, day];
    });
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!firstName.trim()) errors.firstName = 'Enter your first name.';
      const dobValidation = validateDateOfBirth(dateOfBirth);
      if (!dobValidation.isValid) {
        errors.dateOfBirth = dobValidation.error || 'Enter your date of birth.';
      }
    } else if (step === 2) {
      if (!currentWeight || currentWeight <= 0) {
        errors.currentWeight = 'Enter your current weight.';
      }
    } else if (step === 3) {
      if (!experience) errors.experience = 'Select your experience level.';
      if (daysPerWeekSlider < 1 || daysPerWeekSlider > 7) {
        errors.daysPerWeek = 'Slide to choose 1–7 training days per week.';
      } else if (workoutDays.length !== daysPerWeekSlider) {
        errors.workoutDays = `Select exactly ${daysPerWeekSlider} day${daysPerWeekSlider === 1 ? '' : 's'}.`;
      }
    } else if (step === 4) {
      if (!equipment.length) errors.equipment = 'Select at least one option.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (__DEV__) {
      devLog('onboarding-step', { step: currentStep, action: 'next' });
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      setFieldErrors({});
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      if (__DEV__) {
        devLog('onboarding-step', { step: currentStep, action: 'back' });
      }
      setCurrentStep(currentStep - 1);
      setFieldErrors({});
    }
  };

  const handleSubmit = async () => {
    setErrorText(null);

    if (
      !validateStep(1) ||
      !validateStep(2) ||
      !validateStep(3) ||
      !validateStep(4)
    ) {
      setErrorText('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setErrorText('Session expired. Please log in again.');
        router.replace('/login');
        return;
      }

      const userId = session.user.id;
      const daysPerWeek = daysPerWeekSlider >= 1 ? daysPerWeekSlider : undefined;
      const profilePayload = {
        experience_level: experience,
        days_per_week: daysPerWeek,
        workout_days: workoutDays.length === daysPerWeekSlider ? workoutDays : undefined,
        equipment_access: equipment,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : undefined,
        current_weight: currentWeight,
        use_imperial: useImperial,
        gender: gender || undefined,
        id: userId,
      };

      const existingProfile = await getUserProfileCached(userId);
      const saveOk = existingProfile
        ? await updateUserProfile(userId, profilePayload)
        : await createUserProfile(userId, profilePayload);

      if (!saveOk) {
        setErrorText('Could not save your profile. Please try again.');
        toast.error('Failed to save profile');
        return;
      }
      invalidateProfileCache(userId);
      if (currentWeight != null && currentWeight > 0) {
        await insertWeightLog(
          userId,
          currentWeight,
          { current_weight: currentWeight },
          useImperial ? 'imperial' : 'metric',
        );
        invalidateWeightCache(userId);
      }

      setProfile({
        ...existingProfile,
        ...profilePayload,
        days_per_week: profilePayload.days_per_week ?? undefined,
        workout_days: profilePayload.workout_days,
        gender: profilePayload.gender,
      });

      await rescheduleRemindersAfterProfileWorkoutDays(profilePayload.workout_days);

      const templates = await getUserTemplates(userId);
      const userTemplates = (templates || []).filter((t) => t.user_id === userId);
      let templateId: string | null = userTemplates[0]?.id ?? null;

      if (!templateId) {
        const created = await createTemplate(userId);
        templateId = created?.id ?? null;
        if (created) invalidateTemplates(userId);
      }

      if (templateId) {
        await ensureTemplateHasWeekDays(templateId);
        invalidateTemplate(templateId);
      }

      if (__DEV__) {
        devLog('onboarding-submit', {
          step: currentStep,
          equipmentCount: equipment.length,
          hasTemplate: !!templateId,
        });
      }

      toast.success('Profile saved!');
      router.replace('/(tabs)');
    } catch (error) {
      if (__DEV__) {
        devError('onboarding-submit', error);
      }
      setErrorText('Something went wrong. Please try again.');
      toast.error('Failed to save profile');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
      <View style={styles.stepIndicator}>
        <Text style={styles.stepText}>
          Step {currentStep} of {TOTAL_STEPS}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / TOTAL_STEPS) * 100}%` },
            ]}
          />
        </View>
      </View>
  );

  const renderAboutYou = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>About you</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about yourself to personalize your experience
      </Text>

      <View style={styles.sectionRow}>
        <View style={[styles.section, styles.rowItem]}>
          <Text style={styles.label}>First name *</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
          />
          {fieldErrors.firstName ? (
            <Text style={styles.errorText}>{fieldErrors.firstName}</Text>
          ) : null}
        </View>
        <View style={[styles.section, styles.rowItem]}>
          <Text style={styles.label}>Last name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Date of Birth *</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.datePickerButton}
        >
          <Text style={[styles.datePickerText, !dateOfBirth && styles.datePickerPlaceholder]}>
            {dateOfBirth ? formatDateOfBirth(dateOfBirth) : 'Select your date of birth'}
          </Text>
        </TouchableOpacity>
        {fieldErrors.dateOfBirth ? (
          <Text style={styles.errorText}>{fieldErrors.dateOfBirth}</Text>
        ) : null}
        {dateOfBirth && (
          <Text style={styles.ageDisplayText}>
            Age: {calculateAge(dateOfBirth) ?? 'N/A'} years old
          </Text>
        )}
      </View>
    </View>
  );

  const renderBodyAndUnits = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Body & units</Text>
      <Text style={styles.stepSubtitle}>
        We use this to suggest starting weights and display units
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Units *</Text>
        <View style={styles.unitsRow}>
          <Text style={styles.unitsText}>
            {useImperial ? 'Imperial (lbs)' : 'Metric (kg)'}
          </Text>
          <Switch
            value={useImperial}
            onValueChange={(value) => {
              setUseImperial(value);
              if (value) {
                setCurrentWeight(Math.round(currentWeight * 2.20462));
              } else {
                setCurrentWeight(Math.round(currentWeight / 2.20462));
              }
            }}
            thumbColor={useImperial ? colors.primary : colors.borderLight}
            trackColor={{ true: colors.primaryDark, false: colors.border }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          Current weight ({useImperial ? 'lbs' : 'kg'}) *
        </Text>
        <TouchableOpacity
          onPress={() => setShowWeightPicker(true)}
          style={styles.weightPickerButton}
        >
          <Text style={styles.weightPickerButtonText}>
            {currentWeight} {useImperial ? 'lbs' : 'kg'}
          </Text>
        </TouchableOpacity>
        {fieldErrors.currentWeight ? (
          <Text style={styles.errorText}>{fieldErrors.currentWeight}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Gender</Text>
        <TouchableOpacity
          onPress={() => setShowGenderPicker(true)}
          style={styles.datePickerButton}
        >
          <Text style={[styles.datePickerText, !gender && styles.datePickerPlaceholder]}>
            {gender || 'Select gender'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderExperienceAndTraining = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Experience & training</Text>
      <Text style={styles.stepSubtitle}>
        Help us understand your fitness level and how often you train
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Experience level *</Text>
        <View style={styles.chipGroup}>
          {EXPERIENCE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.chip,
                experience === option && styles.chipSelected,
              ]}
              onPress={() => setExperience(option)}
            >
              <Text
                style={[
                  styles.chipText,
                  experience === option && styles.chipTextSelected,
                ]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {fieldErrors.experience ? (
          <Text style={styles.errorText}>{fieldErrors.experience}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.daysSliderHeader}>
          <Text style={styles.label}>Days per week *</Text>
          <Text style={styles.daysSliderValue}>{daysPerWeekSlider} day{daysPerWeekSlider === 1 ? '' : 's'}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={7}
          step={1}
          value={daysPerWeekSlider}
          onValueChange={handleDaysPerWeekSliderChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        {fieldErrors.daysPerWeek ? (
          <Text style={styles.errorText}>{fieldErrors.daysPerWeek}</Text>
        ) : null}

        {daysPerWeekSlider > 0 && (
          <View style={styles.preferredDaysSection}>
            <Text style={styles.label}>
              {daysPerWeekSlider === 7 ? 'All days selected' : `Select ${daysPerWeekSlider} day${daysPerWeekSlider === 1 ? '' : 's'}`}
            </Text>
            <View style={styles.chipGroupPreferredDays}>
              {WEEKDAY_OPTIONS.map((day, index) => {
                const selected = workoutDays.includes(day);
                const atLimit = workoutDays.length >= daysPerWeekSlider && !selected;
                return (
                  <Animated.View
                    key={day}
                    entering={FadeIn.duration(280).delay(index * 50)}
                  >
                    <TouchableOpacity
                      style={[
                        styles.chipDay,
                        selected && styles.chipSelected,
                        atLimit && styles.chipDisabled,
                      ]}
                      onPress={() => toggleWorkoutDay(day)}
                      disabled={atLimit}
                    >
                      <Text
                        style={[
                          styles.chipTextDay,
                          selected && styles.chipTextSelected,
                          atLimit && styles.chipTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
            {fieldErrors.workoutDays ? (
              <Text style={styles.errorText}>{fieldErrors.workoutDays}</Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );

  const renderEquipmentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Equipment access</Text>
      <Text style={styles.stepSubtitle}>
        What equipment do you have available for your workouts?
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Equipment access *</Text>
        <View style={styles.chipGroup}>
          {EQUIPMENT_OPTIONS.map((option) => {
            const selected = equipment.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleEquipment(option)}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {fieldErrors.equipment ? (
          <Text style={styles.errorText}>{fieldErrors.equipment}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderReview = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review</Text>
      <Text style={styles.stepSubtitle}>
        Confirm your profile before we create your plan
      </Text>

      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Name</Text>
        <Text style={styles.reviewValue}>
          {firstName.trim()}
          {lastName.trim() ? ` ${lastName.trim()}` : ''}
        </Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Date of birth</Text>
        <Text style={styles.reviewValue}>
          {dateOfBirth ? formatDateOfBirth(dateOfBirth) : '—'}
        </Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Weight</Text>
        <Text style={styles.reviewValue}>
          {currentWeight} {useImperial ? 'lbs' : 'kg'}
        </Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Gender</Text>
        <Text style={styles.reviewValue}>{gender || '—'}</Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Experience</Text>
        <Text style={styles.reviewValue}>
          {experience ? experience.charAt(0).toUpperCase() + experience.slice(1) : '—'}
        </Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Training days</Text>
        <Text style={styles.reviewValue}>
          {daysPerWeekSlider > 0
            ? `${daysPerWeekSlider} day${daysPerWeekSlider === 1 ? '' : 's'}: ${workoutDays.join(', ') || '—'}`
            : '—'}
        </Text>
      </View>
      <View style={styles.reviewRow}>
        <Text style={styles.reviewLabel}>Equipment</Text>
        <Text style={styles.reviewValue}>{equipment.length ? equipment.join(', ') : '—'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        {renderStepIndicator()}
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {currentStep === 1 && renderAboutYou()}
          {currentStep === 2 && renderBodyAndUnits()}
          {currentStep === 3 && renderExperienceAndTraining()}
          {currentStep === 4 && renderEquipmentStep()}
          {currentStep === 5 && renderReview()}

          {errorText ? (
            <Text style={styles.errorText}>{errorText}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            {currentStep > 1 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                  disabled={submitting}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  (currentStep === 1 || isLastStep) && styles.nextButtonFullWidth,
                  submitting && styles.buttonDisabled,
                ]}
                onPress={isLastStep ? handleSubmit : handleNext}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={styles.nextButtonText}>
                    {isLastStep ? 'Complete setup' : 'Next'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
        </View>
      </ScrollView>

      <DatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={dateOfBirth}
        onChange={(date) => setDateOfBirth(date)}
        maximumDate={new Date()}
        minimumDate={new Date(1900, 0, 1)}
      />

      <BottomSheet
        visible={showWeightPicker}
        onClose={() => setShowWeightPicker(false)}
        title={`Select Weight (${useImperial ? 'lbs' : 'kg'})`}
        height={300}
      >
        <Picker
          selectedValue={currentWeight}
          onValueChange={(itemValue) => setCurrentWeight(itemValue)}
          style={styles.weightPicker}
          itemStyle={styles.weightPickerItem}
        >
          {Array.from({ length: useImperial ? 601 : 301 }, (_, i) => {
            const value = i;
            return (
              <Picker.Item
                key={value}
                label={`${value} ${useImperial ? 'lbs' : 'kg'}`}
                value={value}
              />
            );
          })}
        </Picker>
      </BottomSheet>

      <BottomSheet
        visible={showGenderPicker}
        onClose={() => setShowGenderPicker(false)}
        title="Select gender"
        height={280}
      >
        <Picker
          selectedValue={gender}
          onValueChange={(itemValue) => setGender(itemValue)}
          style={styles.weightPicker}
          itemStyle={styles.weightPickerItem}
        >
          {GENDER_OPTIONS.map((opt) => (
            <Picker.Item key={opt} label={opt} value={opt} />
          ))}
        </Picker>
      </BottomSheet>
    </View>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
  },
  safeAreaTop: {
    backgroundColor: colors.background,
  },
  stepIndicator: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  stepText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  stepContent: {
    gap: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  input: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  datePickerButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  datePickerText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  datePickerPlaceholder: {
    color: colors.textMuted,
  },
  ageDisplayText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  weightPickerButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  weightPickerButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  weightPicker: {
    height: 200,
    width: '100%',
  },
  weightPickerItem: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  unitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  unitsText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  chipTextSelected: {
    color: colors.background,
    fontWeight: typography.weights.semibold,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipTextDisabled: {
    color: colors.textMuted,
  },
  daysSliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  daysSliderValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  preferredDaysSection: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  chipGroupPreferredDays: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  chipDay: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  chipTextDay: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  reviewLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  reviewValue: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  nextButtonFullWidth: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
  },
  }); }
