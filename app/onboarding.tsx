/**
 * Multi-step Onboarding Flow
 * Step 1: About you (name, DOB)
 * Step 2: Body & units (weight, units, gender)
 * Step 3: Experience
 * Step 4: Training days (days slider + preferred days)
 * Step 5: Preferred split
 * Step 6: Appearance (theme)
 * Step 7: Equipment
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { supabase } from '../src/lib/supabase/client';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme, useThemeMode } from '../src/lib/utils/ThemeContext';
import { ThemePickerGrid } from '../src/components/settings/ThemePickerGrid';
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
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { setPendingAppTour } from '../src/lib/onboarding/tourBridge';
import { validateDateOfBirth, calculateAge, formatDateOfBirth } from '../src/lib/utils/date';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { BottomSheet } from '../src/components/ui/BottomSheet';
import { DatePicker } from '../src/components/ui/DatePicker';
import { SplitPicker } from '../src/components/ui/SplitPicker';
import { Button } from '../src/components/ui/Button';
import { convertBodyWeight } from '../src/lib/utils/units';

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;
const EQUIPMENT_OPTIONS = [
  { value: 'Full gym', label: 'Full Gym' },
  { value: 'Dumbbells', label: 'Dumbbells' },
  { value: 'Bands', label: 'Bands' },
  { value: 'Bodyweight only', label: 'Bodyweight Only' },
] as const;
const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Prefer not to say', label: 'Prefer Not To Say' },
] as const;
/** Sentinel for scroller placeholders — never persisted to the DB. */
const GENDER_PLACEHOLDER = '__select__';
const WEEKDAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TOTAL_STEPS = 7;
const SLIDE_DURATION_MS = 280;
const PROGRESS_DURATION_MS = 320;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const toast = useToast();
  const colors = useTheme();
  const { themeMode, setThemeMode } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const screenWidth = Dimensions.get('window').width;

  const [currentStep, setCurrentStep] = useState(1);
  const [displayedStep, setDisplayedStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [useImperial, setUseImperial] = useState(true);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightText, setWeightText] = useState('');
  const [gender, setGender] = useState<string>('');
  const [experience, setExperience] = useState<string>('');
  const [daysPerWeekSlider, setDaysPerWeekSlider] = useState<number>(0);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [preferredSplit, setPreferredSplit] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);

  const slideX = useSharedValue(0);
  const progressWidth = useSharedValue(1 / TOTAL_STEPS);
  const transitioningRef = useRef(false);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load profile once on mount
  }, []);

  useEffect(() => {
    progressWidth.value = withTiming(currentStep / TOTAL_STEPS, {
      duration: PROGRESS_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentStep, progressWidth]);

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
      // Confirm the auth user still exists (Keychain can outlive a deleted account).
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        await supabase.auth.signOut().catch(() => undefined);
        router.replace('/get-started');
        return;
      }

      const profile = await getUserProfileCached(userId);

      // No profile yet is normal right after signup — leave the form empty.
      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        if (profile.date_of_birth) {
          setDateOfBirth(new Date(profile.date_of_birth));
        }
        setUseImperial(profile.use_imperial ?? true);
        setCurrentWeight(
          profile.current_weight != null && profile.current_weight > 0
            ? profile.current_weight
            : null
        );
        setGender(profile.gender || '');
        setExperience(profile.experience_level || '');
        setDaysPerWeekSlider(profile.days_per_week ?? 0);
        setWorkoutDays(profile.workout_days || []);
        setPreferredSplit(profile.preferred_training_style || null);
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
    if (n < 1) {
      setPreferredSplit(null);
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
      } else if (currentWeight > 1000) {
        errors.currentWeight = 'Enter a weight up to 1000.';
      }
    } else if (step === 3) {
      if (!experience) errors.experience = 'Select your experience level.';
    } else if (step === 4) {
      if (daysPerWeekSlider < 1 || daysPerWeekSlider > 7) {
        errors.daysPerWeek = 'Slide to choose 1–7 training days per week.';
      } else if (workoutDays.length !== daysPerWeekSlider) {
        errors.workoutDays = `Select exactly ${daysPerWeekSlider} day${daysPerWeekSlider === 1 ? '' : 's'}.`;
      }
    } else if (step === 5) {
      if (!preferredSplit?.trim()) {
        errors.preferredSplit = 'Pick a split or describe your own.';
      }
    } else if (step === 7) {
      if (!equipment.length) errors.equipment = 'Select at least one option.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const completeEnter = useCallback(() => {
    transitioningRef.current = false;
    setTransitioning(false);
    setFieldErrors({});
  }, []);

  const swapAndEnter = useCallback((nextStep: number, direction: 1 | -1) => {
    setDisplayedStep(nextStep);
    setCurrentStep(nextStep);
    // Place incoming step off-screen, then slide in after content swaps.
    requestAnimationFrame(() => {
      slideX.value = direction * screenWidth;
      slideX.value = withTiming(
        0,
        { duration: SLIDE_DURATION_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(completeEnter)();
          } else {
            runOnJS(completeEnter)();
          }
        },
      );
    });
  }, [completeEnter, screenWidth, slideX]);

  const animateToStep = useCallback((nextStep: number, direction: 1 | -1) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);

    slideX.value = withTiming(
      -direction * screenWidth,
      { duration: SLIDE_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(swapAndEnter)(nextStep, direction);
        } else {
          runOnJS(completeEnter)();
        }
      },
    );
  }, [completeEnter, screenWidth, slideX, swapAndEnter]);

  const handleNext = () => {
    if (transitioningRef.current || submitting) return;
    if (!validateStep(currentStep)) {
      return;
    }

    if (__DEV__) {
      devLog('onboarding-step', { step: currentStep, action: 'next' });
    }

    if (currentStep < TOTAL_STEPS) {
      // Pre-position incoming content: after finishTransition, content swaps at 0.
      // Exit current to the left first.
      animateToStep(currentStep + 1, 1);
    }
  };

  const handleBack = () => {
    if (transitioningRef.current || submitting) return;
    if (currentStep > 1) {
      if (__DEV__) {
        devLog('onboarding-step', { step: currentStep, action: 'back' });
      }
      animateToStep(currentStep - 1, -1);
    }
  };

  const handleSubmit = async () => {
    setErrorText(null);

    if (
      !validateStep(1) ||
      !validateStep(2) ||
      !validateStep(3) ||
      !validateStep(4) ||
      !validateStep(5) ||
      !validateStep(7)
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
        preferred_training_style: preferredSplit?.trim() || undefined,
        equipment_access: equipment,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : undefined,
        current_weight: currentWeight != null && currentWeight > 0 ? currentWeight : undefined,
        use_imperial: useImperial,
        gender:
          gender && gender !== GENDER_PLACEHOLDER ? gender : undefined,
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
      setPendingAppTour();
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

  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: progressTrackWidth * progressWidth.value,
  }));

  const stepSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

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
              if (currentWeight != null && currentWeight > 0) {
                const converted = convertBodyWeight(currentWeight, {
                  fromImperial: useImperial,
                  toImperial: value,
                });
                setCurrentWeight(converted);
                setWeightText(String(converted));
              }
              setUseImperial(value);
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
        <TextInput
          value={weightText}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9.]/g, '');
            const parts = cleaned.split('.');
            const normalized =
              parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
            setWeightText(normalized);
            if (normalized === '' || normalized === '.') {
              setCurrentWeight(null);
              return;
            }
            const parsed = Number.parseFloat(normalized);
            setCurrentWeight(
              Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
            );
          }}
          placeholder={useImperial ? 'e.g. 150' : 'e.g. 70'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          keyboardType="decimal-pad"
          maxLength={6}
          accessibilityLabel={`Current weight in ${useImperial ? 'lbs' : 'kg'}`}
        />
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
            {GENDER_OPTIONS.find((g) => g.value === gender)?.label || gender || 'Select gender'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderExperience = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Experience level</Text>
      <Text style={styles.stepSubtitle}>
        How would you describe your training experience?
      </Text>

      <View style={styles.optionList}>
        {EXPERIENCE_OPTIONS.map((option) => {
          const selected = experience === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => setExperience(option.value)}
            >
              <Text style={[styles.optionRowText, selected && styles.optionRowTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {fieldErrors.experience ? (
        <Text style={styles.errorText}>{fieldErrors.experience}</Text>
      ) : null}
    </View>
  );

  const renderTrainingDays = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Training days</Text>
      <Text style={styles.stepSubtitle}>
        How many days per week do you want to train?
      </Text>

      <View style={styles.section}>
        <View style={styles.daysSliderHeader}>
          <Text style={styles.label}>Days per week *</Text>
          <Text style={styles.daysSliderValue}>
            {daysPerWeekSlider} day{daysPerWeekSlider === 1 ? '' : 's'}
          </Text>
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
      </View>

      {daysPerWeekSlider > 0 ? (
        <View style={styles.section}>
          <Text style={styles.label}>
            {daysPerWeekSlider === 7
              ? 'All days selected'
              : `Select ${daysPerWeekSlider} day${daysPerWeekSlider === 1 ? '' : 's'}`}
          </Text>
          <View style={styles.optionList} key={`weekdays-${daysPerWeekSlider}`}>
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
                      styles.optionRow,
                      selected && styles.optionRowSelected,
                      atLimit && styles.optionRowDisabled,
                    ]}
                    onPress={() => toggleWorkoutDay(day)}
                    disabled={atLimit}
                  >
                    <Text
                      style={[
                        styles.optionRowText,
                        selected && styles.optionRowTextSelected,
                        atLimit && styles.optionRowTextDisabled,
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
      ) : null}
    </View>
  );

  const renderPreferredSplit = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Preferred split</Text>
      <Text style={styles.stepSubtitle}>
        Suggested for {daysPerWeekSlider} day{daysPerWeekSlider === 1 ? '' : 's'} per week — or let us pick
      </Text>

      <SplitPicker
        daysPerWeek={Math.max(1, daysPerWeekSlider)}
        value={preferredSplit}
        onChange={setPreferredSplit}
      />
      {fieldErrors.preferredSplit ? (
        <Text style={styles.errorText}>{fieldErrors.preferredSplit}</Text>
      ) : null}
    </View>
  );

  const renderAppearance = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose your appearance</Text>
      <Text style={styles.stepSubtitle}>
        Pick a theme for the app. You can change this anytime in Settings.
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Theme</Text>
        <ThemePickerGrid selectedMode={themeMode} onSelect={setThemeMode} />
      </View>
    </View>
  );

  const renderEquipmentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Equipment access</Text>
      <Text style={styles.stepSubtitle}>
        What equipment do you have available for your workouts?
      </Text>

      <View style={styles.optionList}>
        {EQUIPMENT_OPTIONS.map((option) => {
          const selected = equipment.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => toggleEquipment(option.value)}
            >
              <Text style={[styles.optionRowText, selected && styles.optionRowTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {fieldErrors.equipment ? (
        <Text style={styles.errorText}>{fieldErrors.equipment}</Text>
      ) : null}
    </View>
  );

  const renderStep = (step: number) => {
    switch (step) {
      case 1:
        return renderAboutYou();
      case 2:
        return renderBodyAndUnits();
      case 3:
        return renderExperience();
      case 4:
        return renderTrainingDays();
      case 5:
        return renderPreferredSplit();
      case 6:
        return renderAppearance();
      case 7:
        return renderEquipmentStep();
      default:
        return null;
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepHeaderRow}>
            <Text style={styles.stepText}>
              Step {currentStep} of {TOTAL_STEPS}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await supabase.auth.signOut().catch(() => undefined);
                const { syncSessionAuthToWatch } = await import('../src/lib/watch/syncWatchAuth');
                await syncSessionAuthToWatch(null);
                router.replace('/get-started');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
          <View
            style={styles.progressBar}
            onLayout={(event) => setProgressTrackWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.stepSlide, stepSlideStyle]}>
            {renderStep(displayedStep)}
          </Animated.View>

          {errorText ? (
            <Text style={styles.errorText}>{errorText}</Text>
          ) : null}
        </ScrollView>
      </View>

      <SafeAreaView style={styles.safeAreaBottom} edges={['bottom']}>
        <View style={styles.buttonRow}>
          {currentStep > 1 ? (
            <Button
              label="Back"
              variant="secondary"
              onPress={handleBack}
              disabled={submitting || transitioning}
              style={styles.backButton}
            />
          ) : null}

          <Button
            label={isLastStep ? 'Complete setup' : 'Next'}
            onPress={isLastStep ? handleSubmit : handleNext}
            disabled={submitting || transitioning}
            style={[styles.nextButton, currentStep === 1 && styles.nextButtonFullWidth]}
          >
            {submitting ? <LogoEdgeLoader size="small" variant="inverted" /> : undefined}
          </Button>
        </View>
      </SafeAreaView>

      <DatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        value={dateOfBirth}
        onChange={(date) => setDateOfBirth(date)}
        maximumDate={new Date()}
        minimumDate={new Date(1900, 0, 1)}
      />

      <BottomSheet
        visible={showGenderPicker}
        onClose={() => setShowGenderPicker(false)}
        title="Select gender"
        height={280}
      >
        <Picker
          selectedValue={gender || GENDER_PLACEHOLDER}
          onValueChange={(itemValue) => {
            // Placeholder cannot be chosen — forces a real scroll onto a gender.
            if (itemValue === GENDER_PLACEHOLDER) return;
            setGender(itemValue);
          }}
          style={styles.weightPicker}
          itemStyle={styles.weightPickerItem}
        >
          <Picker.Item label="(Select)" value={GENDER_PLACEHOLDER} />
          {GENDER_OPTIONS.map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </BottomSheet>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeAreaTop: {
      backgroundColor: colors.background,
    },
    safeAreaBottom: {
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    stepIndicator: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
    },
    stepHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    stepText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    signOutText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
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
    body: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    stepSlide: {
      width: '100%',
    },
    stepContent: {
      gap: spacing.lg,
    },
    stepTitle: {
      fontSize: typography.sizes['2xl'],
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    stepSubtitle: {
      fontSize: typography.sizes.base,
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: -spacing.sm,
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
      paddingVertical: spacing.sm,
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
    optionList: {
      gap: spacing.sm,
    },
    optionRow: {
      width: '100%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    optionRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySelectedBg,
    },
    optionRowDisabled: {
      opacity: 0.45,
    },
    optionRowText: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.medium,
    },
    optionRowTextSelected: {
      color: colors.textPrimary,
      fontWeight: typography.weights.semibold,
    },
    optionRowTextDisabled: {
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
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    backButton: {
      flex: 1,
    },
    nextButton: {
      flex: 1,
    },
    nextButtonFullWidth: {
      flex: 1,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.sizes.sm,
      marginTop: spacing.sm,
    },
  });
}
