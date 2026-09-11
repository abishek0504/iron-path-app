/**
 * Edit Profile modal
 * Shared route reachable from all tabs via Settings bottom sheet.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/routers';
import { X } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { supabase } from '../src/lib/supabase/client';
import { updateUserProfile } from '../src/lib/supabase/queries/users';
import { convertUserStoredWeights } from '../src/lib/supabase/queries/weight';
import {
  getUserProfileCached,
  invalidateProfileCache,
  invalidateWeightCache,
  invalidateWorkoutStatsCache,
} from '../src/lib/cache/dashboardStatsCache';
import { invalidateAnalyticsCache } from '../src/lib/cache/analyticsCache';
import { useUserStore, type UserProfile } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { devLog, devError } from '../src/lib/utils/logger';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { Button } from '../src/components/ui/Button';
import { SheetGrabber } from '../src/components/ui/ScreenHeader';
import { Chip } from '../src/components/ui/Chip';
import { calculateAge, formatDateOfBirth } from '../src/lib/utils/date';
import { rescheduleRemindersAfterProfileWorkoutDays } from '../src/lib/utils/notifications';
import { SplitPicker } from '../src/components/ui/SplitPicker';
import { DayFocusMapEditor } from '../src/components/ai/DayFocusMapEditor';
import { sanitizeCoachNotes } from '../src/lib/ai/coachNotes';
import {
  COACH_EXERCISE_COUNT_OPTIONS,
  COACH_SESSION_MINUTE_OPTIONS,
  DEFAULT_COACH_EXERCISES_PER_SESSION,
  DEFAULT_COACH_SESSION_MINUTES,
  MAX_COACH_NOTES_LENGTH,
  clampCoachExercisesPerSession,
  clampCoachSessionMinutes,
} from '../src/lib/ai/coachPrefs';
import { seedDayFocusMap, type DayFocusMap } from '../src/lib/constants/trainingSplits';
import { useModal } from '../src/hooks/useModal';
import { usePaywall } from '../src/components/paywall/PaywallProvider';
import { GENDER_PLACEHOLDER } from '../src/components/ui/GenderPickerSheet';

const EQUIPMENT_OPTIONS = ['Full gym', 'Dumbbells', 'Bands', 'Bodyweight only'];
const WEEKDAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cachedProfile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const showToast = useUIStore((state) => state.showToast);
  const { openSheet } = useModal();
  const { requestGenerateWeek } = usePaywall();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setLocalProfile] = useState<UserProfile | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [gender, setGender] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [daysPerWeekSlider, setDaysPerWeekSlider] = useState<number>(0);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [preferredSplit, setPreferredSplit] = useState<string | null>(null);
  const [useImperial, setUseImperial] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [aiCoachEnabled, setAiCoachEnabled] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_COACH_SESSION_MINUTES);
  const [exercisesPerSession, setExercisesPerSession] = useState(DEFAULT_COACH_EXERCISES_PER_SESSION);
  const [dayFocusMap, setDayFocusMap] = useState<DayFocusMap>({});
  const [coachNotes, setCoachNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [allowCloseAfterSave, setAllowCloseAfterSave] = useState(false);
  const pendingRemoveActionRef = useRef<NavigationAction | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    const load = async () => {
      try {
        if (__DEV__) {
          devLog('edit-profile', { action: 'load:start' });
        }

        let userId: string | null = null;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          showToast('Not signed in — please log in again.', 'error');
          router.replace('/login');
          return;
        }
        userId = user.id;
        setEmail(user.email ?? '');

        let p = cachedProfile;
        if (!p) {
          p = await getUserProfileCached(userId);
          if (p) {
            setProfile(p);
          }
        }

        if (!p) {
          // No profile row yet; create a minimal one
          p = {
            id: userId,
          };
          setProfile(p);
        }

        setLocalProfile(p);
        setEmail(user.email ?? '');
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        if (p.date_of_birth) {
          setDateOfBirth(new Date(p.date_of_birth));
        }
        setGender(p.gender ?? '');
        setExperienceLevel(p.experience_level ?? '');
        setDaysPerWeekSlider(p.days_per_week ?? 0);
        setWorkoutDays(p.workout_days ?? []);
        setPreferredSplit(p.preferred_training_style ?? null);
        setUseImperial(p.use_imperial ?? true);
        setEquipment((p.equipment_access ?? []).slice(0, 1));
        setAiCoachEnabled(p.ai_coach_enabled ?? false);
        setSessionMinutes(clampCoachSessionMinutes(p.ai_coach_session_minutes));
        setExercisesPerSession(clampCoachExercisesPerSession(p.ai_coach_exercises_per_session));
        setDayFocusMap(
          seedDayFocusMap(
            p.preferred_training_style,
            p.workout_days ?? [],
            p.ai_coach_day_focus,
          ),
        );
        setCoachNotes(p.ai_coach_notes ?? '');
        setNotesError(null);

        if (__DEV__) {
          devLog('edit-profile', { action: 'load:done', hasProfile: !!p });
        }
      } catch (error) {
        if (__DEV__) {
          devError('edit-profile', error);
        }
        showToast('Failed to load profile.', 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [cachedProfile, router, setProfile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const profileDob = profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : null;
    const currentDob = dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null;
    const equipChanged =
      (profile.equipment_access ?? []).join('|') !== (equipment ?? []).join('|');
    const daysNum = daysPerWeekSlider >= 1 ? daysPerWeekSlider : undefined;
    const workoutDaysMatch =
      (profile.workout_days ?? []).length === workoutDays.length &&
      (profile.workout_days ?? []).every((d, i) => d === workoutDays[i]);
    return (
      (profile.first_name ?? '') !== firstName ||
      (profile.last_name ?? '') !== lastName ||
      profileDob !== currentDob ||
      (profile.gender ?? '') !== gender ||
      (profile.experience_level ?? '') !== experienceLevel ||
      (profile.days_per_week ?? undefined) !== daysNum ||
      !workoutDaysMatch ||
      (profile.preferred_training_style ?? null) !== (preferredSplit?.trim() || null) ||
      (profile.use_imperial ?? true) !== useImperial ||
      equipChanged ||
      !!profile.ai_coach_enabled !== aiCoachEnabled ||
      clampCoachSessionMinutes(profile.ai_coach_session_minutes) !== sessionMinutes ||
      clampCoachExercisesPerSession(profile.ai_coach_exercises_per_session) !== exercisesPerSession ||
      JSON.stringify(profile.ai_coach_day_focus ?? {}) !== JSON.stringify(dayFocusMap) ||
      (profile.ai_coach_notes ?? '') !== coachNotes
    );
  }, [aiCoachEnabled, coachNotes, dateOfBirth, dayFocusMap, daysPerWeekSlider, equipment, exercisesPerSession, experienceLevel, firstName, gender, lastName, preferredSplit, profile, sessionMinutes, useImperial, workoutDays]);

  usePreventRemove(hasChanges && !allowCloseAfterSave, ({ data }) => {
    pendingRemoveActionRef.current = data.action;
    setShowDiscardConfirm(true);
  });

  const navigateBackOrTabs = useCallback(() => {
    const canGoBack = (router as any)?.canGoBack?.() ?? true;
    if (canGoBack) {
      try {
        router.back();
        return;
      } catch {
        // fall through to replace
      }
    }
    router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    if (allowCloseAfterSave) {
      navigateBackOrTabs();
    }
  }, [allowCloseAfterSave, navigateBackOrTabs]);

  const safeClose = () => {
    if (!hasChanges) {
      navigateBackOrTabs();
      return;
    }
    router.back();
  };

  useEffect(() => {
    setDayFocusMap((prev) => seedDayFocusMap(preferredSplit, workoutDays, prev));
  }, [preferredSplit, workoutDays]);

  const handleKeepEditing = () => {
    setShowDiscardConfirm(false);
    pendingRemoveActionRef.current = null;
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    const action = pendingRemoveActionRef.current;
    pendingRemoveActionRef.current = null;
    if (action) {
      navigation.dispatch(action);
    } else {
      navigateBackOrTabs();
    }
  };

  const handleSave = async (opts?: { skipCoachPaywall?: boolean }) => {
    if (!profile) return;
    if (!firstName.trim()) {
      showToast('Enter your first name.', 'error');
      return;
    }
    if (!opts?.skipCoachPaywall && aiCoachEnabled && !profile.ai_coach_enabled) {
      requestGenerateWeek(() => {
        void handleSave({ skipCoachPaywall: true });
      });
      return;
    }
    setSaving(true);
    try {
      const previousImperial = profile.use_imperial ?? true;
      const unitsChanged = previousImperial !== useImperial;

      if (unitsChanged) {
        if (__DEV__) {
          devLog('edit-profile', {
            action: 'unitsConvert:start',
            fromImperial: previousImperial,
            toImperial: useImperial,
          });
        }
        const { success: convertOk, result } = await convertUserStoredWeights(useImperial);
        if (!convertOk) {
          showToast('Failed to convert weights for the new unit.', 'error');
          return;
        }
        if (__DEV__) {
          devLog('edit-profile', {
            action: 'unitsConvert:done',
            converted: result?.converted,
            sessionSetRows: result?.session_set_rows,
            weightLogRows: result?.weight_log_rows,
            prRows: result?.pr_rows,
          });
        }
      }

      const daysNum = daysPerWeekSlider >= 1 ? daysPerWeekSlider : undefined;
      const notesResult = sanitizeCoachNotes(coachNotes);
      if (!notesResult.ok) {
        setNotesError('That note looks like an instruction to the model. Rephrase your preference.');
        showToast('Coach notes could not be saved.', 'error');
        return;
      }
      const nextFocusMap = seedDayFocusMap(preferredSplit, workoutDays, dayFocusMap);
      const updates: Partial<UserProfile> = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : undefined,
        gender: gender && gender !== GENDER_PLACEHOLDER ? gender : undefined,
        experience_level: experienceLevel.trim() || undefined,
        days_per_week: daysNum,
        workout_days: daysNum && workoutDays.length === daysNum ? workoutDays : undefined,
        preferred_training_style: preferredSplit?.trim() || undefined,
        use_imperial: useImperial,
        equipment_access: equipment,
        ai_coach_enabled: aiCoachEnabled,
        ai_coach_session_minutes: sessionMinutes,
        ai_coach_exercises_per_session: exercisesPerSession,
        ai_coach_day_focus: nextFocusMap,
        ai_coach_notes: notesResult.notes,
      };

      const splitChanged =
        (profile.preferred_training_style ?? null) !== (preferredSplit?.trim() || null);
      const daysChanged =
        (profile.days_per_week ?? undefined) !== daysNum ||
        (profile.workout_days ?? []).join('|') !== workoutDays.join('|');
      const coachPrefsChanged =
        clampCoachSessionMinutes(profile.ai_coach_session_minutes) !== sessionMinutes ||
        clampCoachExercisesPerSession(profile.ai_coach_exercises_per_session) !== exercisesPerSession ||
        JSON.stringify(profile.ai_coach_day_focus ?? {}) !== JSON.stringify(nextFocusMap) ||
        (profile.ai_coach_notes ?? '') !== (notesResult.notes ?? '');

      const success = await updateUserProfile(profile.id, updates);
      if (!success) {
        if (unitsChanged) {
          await convertUserStoredWeights(previousImperial);
        }
        showToast('Failed to save profile.', 'error');
        return;
      }

      invalidateProfileCache(profile.id);
      invalidateWeightCache(profile.id);
      invalidateWorkoutStatsCache(profile.id);
      invalidateAnalyticsCache(profile.id);

      let nextProfile: UserProfile = { ...profile, ...updates };
      if (unitsChanged) {
        const refreshed = await getUserProfileCached(profile.id);
        if (refreshed) {
          nextProfile = { ...refreshed, ...updates };
        }
      }

      setProfile(nextProfile);
      setLocalProfile(nextProfile);
      if (__DEV__) {
        devLog('edit-profile', {
          action: 'save',
          updateKeys: Object.keys(updates),
          unitsChanged,
        });
      }
      await rescheduleRemindersAfterProfileWorkoutDays(updates.workout_days);
      if (aiCoachEnabled && (splitChanged || daysChanged || coachPrefsChanged)) {
        showToast('Profile saved. Regenerate your week to apply the new split.', 'success');
      } else {
        showToast('Profile saved', 'success');
      }
      setAllowCloseAfterSave(true);
    } catch (error) {
      if (__DEV__) {
        devError('edit-profile', error);
      }
      showToast('An error occurred while saving.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {/* Header */}
      <SheetGrabber />
      <View style={styles.header}>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={safeClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close">
          <X size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.label}>Account</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{email || '—'}</Text>
          </View>
        </View>

        {/* Name */}
        <View style={styles.row}>
          <View style={[styles.card, styles.rowItem]}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>
          <View style={[styles.card, styles.rowItem]}>
            <Text style={styles.label}>Last Name</Text>
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

        {/* Date of Birth */}
        <View style={styles.card}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            onPress={() =>
              openSheet('datePicker', {
                value: dateOfBirth,
                onChange: (date: Date) => setDateOfBirth(date),
                maximumDate: new Date(),
                minimumDate: new Date(1900, 0, 1),
              })
            }
            style={styles.datePickerButton}
          >
            <Text style={[styles.datePickerText, !dateOfBirth && styles.datePickerPlaceholder]}>
              {dateOfBirth ? formatDateOfBirth(dateOfBirth) : 'Select date of birth'}
            </Text>
          </TouchableOpacity>
          {dateOfBirth && (
            <Text style={styles.ageDisplayText}>
              Age: {calculateAge(dateOfBirth) ?? 'N/A'} years old
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity
            onPress={() =>
              openSheet('genderPicker', {
                value: gender,
                onChange: (next: string) => setGender(next),
              })
            }
            style={styles.datePickerButton}
          >
            <Text style={[styles.datePickerText, !gender && styles.datePickerPlaceholder]}>
              {gender || 'Select gender'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Experience Level</Text>
          <TextInput
            value={experienceLevel}
            onChangeText={setExperienceLevel}
            placeholder="beginner, intermediate, advanced"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>

        {/* Days per week + preferred days */}
        <View style={styles.card}>
          <View style={styles.daysSliderHeader}>
            <Text style={styles.label}>Days per week</Text>
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
            onValueChange={(value) => {
              const n = Math.round(value);
              setDaysPerWeekSlider(n);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              if (n < workoutDays.length) {
                setWorkoutDays((prev) => prev.slice(0, n));
              }
            }}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
          {daysPerWeekSlider > 0 && (
            <View style={styles.preferredDaysSection}>
              <Text style={styles.label}>
                Select {daysPerWeekSlider} day{daysPerWeekSlider === 1 ? '' : 's'}
              </Text>
              <View style={styles.chipGroup}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = workoutDays.includes(day);
                  const atLimit = workoutDays.length >= daysPerWeekSlider && !selected;
                  return (
                    <Chip
                      key={day}
                      label={day.slice(0, 3)}
                      selected={selected}
                      disabled={atLimit}
                      accessibilityLabel={day}
                      onPress={() => {
                        if (selected) {
                          setWorkoutDays((prev) => prev.filter((d) => d !== day));
                        } else if (workoutDays.length < daysPerWeekSlider) {
                          setWorkoutDays((prev) => [...prev, day]);
                        }
                      }}
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Preferred split */}
        <View style={styles.card}>
          <Text style={styles.label}>Preferred Split</Text>
          <Text style={styles.helperText}>
            Suggestions match your days per week — AI Coach uses this to plan each day
          </Text>
          <SplitPicker
            daysPerWeek={daysPerWeekSlider > 0 ? daysPerWeekSlider : 3}
            value={preferredSplit}
            onChange={setPreferredSplit}
          />
          <DayFocusMapEditor
            splitValue={preferredSplit}
            workoutDays={workoutDays}
            value={dayFocusMap}
            onChange={setDayFocusMap}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.unitsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>AI Coach</Text>
              <Text style={styles.helperText}>
                Pro: AI Coach plans your training days each week from this split
              </Text>
            </View>
            <Switch
              value={aiCoachEnabled}
              onValueChange={setAiCoachEnabled}
              thumbColor={aiCoachEnabled ? colors.primary : colors.borderLight}
              trackColor={{ true: colors.primaryDark, false: colors.border }}
            />
          </View>
          <Text style={styles.label}>Session length</Text>
          <View style={styles.chipGroup}>
            {COACH_SESSION_MINUTE_OPTIONS.map((minutes) => (
              <Chip
                key={minutes}
                label={`${minutes} min`}
                selected={sessionMinutes === minutes}
                onPress={() => setSessionMinutes(minutes)}
              />
            ))}
          </View>
          <Text style={styles.label}>Exercises per session</Text>
          <View style={styles.chipGroup}>
            {COACH_EXERCISE_COUNT_OPTIONS.map((count) => (
              <Chip
                key={count}
                label={String(count)}
                selected={exercisesPerSession === count}
                onPress={() => setExercisesPerSession(count)}
              />
            ))}
          </View>
          <Text style={styles.label}>Talk to your coach</Text>
          <Text style={styles.helperText}>
            Likes, dislikes, injuries, how sessions should feel
          </Text>
          <TextInput
            value={coachNotes}
            onChangeText={(text) => {
              setCoachNotes(text);
              setNotesError(null);
            }}
            placeholder="e.g. No hip thrusts. Shoulders feel beat up."
            placeholderTextColor={colors.textMuted}
            style={styles.notesInput}
            multiline
            textAlignVertical="top"
            maxLength={MAX_COACH_NOTES_LENGTH}
          />
          <Text style={styles.helperText}>
            {coachNotes.trim().length}/{MAX_COACH_NOTES_LENGTH}
          </Text>
          {notesError ? <Text style={styles.errorText}>{notesError}</Text> : null}
        </View>

        {/* Units toggle */}
        <View style={styles.card}>
          <View style={styles.unitsRow}>
            <View>
              <Text style={styles.label}>Units</Text>
              <Text style={styles.helperText}>
                {useImperial ? 'Using lbs / inches' : 'Using kg / cm'}
              </Text>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Imperial</Text>
              <Switch
                value={useImperial}
                onValueChange={setUseImperial}
                thumbColor={useImperial ? colors.primary : colors.borderLight}
                trackColor={{ true: colors.primaryDark, false: colors.border }}
              />
            </View>
          </View>
        </View>

        {/* Equipment */}
        <View style={styles.card}>
          <Text style={styles.label}>Equipment Access</Text>
          <View style={styles.chipGroup}>
            {EQUIPMENT_OPTIONS.map((option) => {
              const selected = equipment.includes(option);
              return (
                <Chip
                  key={option}
                  label={option}
                  selected={selected}
                  onPress={() => setEquipment([option])}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.saveFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button
          label="Save"
          onPress={() => {
            void handleSave();
          }}
          disabled={saving}
          fullWidth
        >
          {saving ? <LogoEdgeLoader size="small" variant="inverted" /> : undefined}
        </Button>
      </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={showDiscardConfirm}
        title="Would you like to save changes?"
        message="Your changes will be lost if you don't save."
        confirmLabel="Keep editing"
        cancelLabel="Discard"
        cancelDestructive
        onConfirm={handleKeepEditing}
        onCancel={handleDiscard}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  saveFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  input: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
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
  unitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
  },
  }); }

// Mounted globally in this screen for reuse
export const EditProfileConfirmHost = ({ children }: { children: React.ReactNode }) => children;




