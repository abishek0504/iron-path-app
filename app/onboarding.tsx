/**
 * Multi-step Onboarding Flow
 * Step 1: Personal Information
 * Step 2: Experience & Training
 * Step 3: Equipment
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { useUserStore } from '../src/stores/userStore';
import {
  createUserProfile,
  updateUserProfile,
} from '../src/lib/supabase/queries/users';
import { getUserProfileCached, invalidateProfileCache } from '../src/lib/cache/dashboardStatsCache';
import {
  getUserTemplates,
  createTemplate,
  ensureTemplateHasWeekDays,
} from '../src/lib/supabase/queries/templates';
import { invalidateTemplates, invalidateTemplate } from '../src/lib/cache/templateCache';
import { devLog, devError } from '../src/lib/utils/logger';
import { useToast } from '../src/hooks/useToast';
import { validateDateOfBirth, calculateAge, formatDateOfBirth } from '../src/lib/utils/date';
import { BottomSheet } from '../src/components/ui/BottomSheet';
import { DatePicker } from '../src/components/ui/DatePicker';

const EXPERIENCE_OPTIONS = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT_OPTIONS = ['Full gym', 'Dumbbells', 'Bands', 'Bodyweight only'];
const TOTAL_STEPS = 3;

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const toast = useToast();

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
  const [useImperial, setUseImperial] = useState(true);
  const [currentWeight, setCurrentWeight] = useState<number>(70); // Default weight in kg
  const [experience, setExperience] = useState<string>('');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
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
        setExperience(profile.experience_level || '');
        setDaysPerWeek(profile.days_per_week || null);
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

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!firstName.trim()) errors.firstName = 'Enter your first name.';
      const dobValidation = validateDateOfBirth(dateOfBirth);
      if (!dobValidation.isValid) {
        errors.dateOfBirth = dobValidation.error || 'Enter your date of birth.';
      }
      if (!currentWeight || currentWeight <= 0) {
        errors.currentWeight = 'Enter your current weight.';
      }
    } else if (step === 2) {
      if (!experience) errors.experience = 'Select your experience level.';
      if (!daysPerWeek || daysPerWeek < 1 || daysPerWeek > 7) {
        errors.daysPerWeek = 'Choose training days between 1 and 7.';
      }
    } else if (step === 3) {
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
    
    // Final validation of all steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
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
      const profilePayload = {
        experience_level: experience,
        days_per_week: daysPerWeek,
        equipment_access: equipment,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : undefined,
        current_weight: currentWeight,
        use_imperial: useImperial,
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

      setProfile({
        ...existingProfile,
        ...profilePayload,
        days_per_week: profilePayload.days_per_week ?? undefined,
      });

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
      router.replace('/(tabs)/planner');
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

  const renderStepIndicator = () => {
    return (
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
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Personal Information</Text>
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
              // Convert weight when switching units
              if (value) {
                // Convert kg to lbs
                setCurrentWeight(Math.round(currentWeight * 2.20462));
              } else {
                // Convert lbs to kg
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
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Experience & Training</Text>
      <Text style={styles.stepSubtitle}>
        Help us understand your fitness level and goals
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
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {fieldErrors.experience ? (
          <Text style={styles.errorText}>{fieldErrors.experience}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Days per week *</Text>
        <View style={styles.chipGroup}>
          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.chip,
                daysPerWeek === day && styles.chipSelected,
              ]}
              onPress={() => setDaysPerWeek(day)}
            >
              <Text
                style={[
                  styles.chipText,
                  daysPerWeek === day && styles.chipTextSelected,
                ]}
              >
                {day}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {fieldErrors.daysPerWeek ? (
          <Text style={styles.errorText}>{fieldErrors.daysPerWeek}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Equipment Access</Text>
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

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
                currentStep === 1 && styles.nextButtonFullWidth,
                submitting && styles.buttonDisabled,
              ]}
              onPress={currentStep === TOTAL_STEPS ? handleSubmit : handleNext}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.nextButtonText}>
                  {currentStep === TOTAL_STEPS ? 'Complete' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Date Picker Bottom Sheet */}
      <DatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={dateOfBirth}
        onChange={(date) => setDateOfBirth(date)}
        maximumDate={new Date()}
        minimumDate={new Date(1900, 0, 1)}
      />

      {/* Weight Picker Bottom Sheet */}
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
            const value = i; // 0-600 lbs or 0-300 kg
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
    </View>
  );
}

const styles = StyleSheet.create({
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
});
