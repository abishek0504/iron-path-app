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
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { useUserStore } from '../src/stores/userStore';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from '../src/lib/supabase/queries/users';
import {
  getUserTemplates,
  createTemplate,
  ensureTemplateHasWeekDays,
} from '../src/lib/supabase/queries/templates';
import { devLog, devError } from '../src/lib/utils/logger';

const EXPERIENCE_OPTIONS = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT_OPTIONS = ['Full gym', 'Dumbbells', 'Bands', 'Bodyweight only'];

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);

  const [experience, setExperience] = useState<string>('');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
   const [fullName, setFullName] = useState('');
   const [age, setAge] = useState<string>('');
   const [weight, setWeight] = useState<string>('');
   const [useImperial, setUseImperial] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const profile = await getUserProfile(userId);

      if (profile) {
        setExperience(profile.experience_level || '');
        setDaysPerWeek(profile.days_per_week || null);
        setEquipment(profile.equipment_access || []);
        setFullName(profile.full_name || '');
        setAge(profile.age != null ? String(profile.age) : '');
        setWeight(profile.current_weight != null ? String(profile.current_weight) : '');
        setUseImperial(profile.use_imperial ?? true);
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

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Enter your name.';
    const ageNum = age ? parseInt(age, 10) : null;
    if (!ageNum || Number.isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      errors.age = 'Enter a valid age (13-120).';
    }
    if (!experience) errors.experience = 'Select your experience level.';
    if (!daysPerWeek || daysPerWeek < 1 || daysPerWeek > 7) {
      errors.daysPerWeek = 'Choose training days between 1 and 7.';
    }
    const weightNum = weight ? parseFloat(weight) : null;
    if (!weightNum || Number.isNaN(weightNum) || weightNum <= 0) {
      errors.weight = 'Enter your current weight.';
    }
    if (!equipment.length) errors.equipment = 'Select at least one option.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setErrorText(null);
    if (!validate()) return;

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
        full_name: fullName.trim(),
        age: age ? parseInt(age, 10) : undefined,
        current_weight: weight ? parseFloat(weight) : undefined,
        use_imperial: useImperial,
        id: userId,
      };

      const existingProfile = await getUserProfile(userId);
      const saveOk = existingProfile
        ? await updateUserProfile(userId, profilePayload)
        : await createUserProfile(userId, profilePayload);

      if (!saveOk) {
        setErrorText('Could not save your profile. Please try again.');
        return;
      }

      setProfile({
        ...existingProfile,
        ...profilePayload,
      });

      const templates = await getUserTemplates(userId);
      const userTemplates = (templates || []).filter((t) => t.user_id === userId);
      let templateId: string | null = userTemplates[0]?.id ?? null;

      if (!templateId) {
        const created = await createTemplate(userId);
        templateId = created?.id ?? null;
      }

      if (templateId) {
        await ensureTemplateHasWeekDays(templateId);
      }

      if (__DEV__) {
        devLog('onboarding-submit', {
          equipmentCount: equipment.length,
          hasTemplate: !!templateId,
        });
      }

      router.replace('/(tabs)/planner');
    } catch (error) {
      if (__DEV__) {
        devError('onboarding-submit', error);
      }
      setErrorText('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.subtitle}>
          These help us set starting targets. You can edit them later in Settings → Edit Profile.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Full name *</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          {fieldErrors.fullName ? <Text style={styles.errorText}>{fieldErrors.fullName}</Text> : null}
        </View>

        <View style={styles.sectionRow}>
          <View style={[styles.section, styles.rowItem]}>
            <Text style={styles.label}>Age *</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="Years"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="number-pad"
            />
            {fieldErrors.age ? <Text style={styles.errorText}>{fieldErrors.age}</Text> : null}
          </View>

          <View style={[styles.section, styles.rowItem]}>
            <Text style={styles.label}>Units *</Text>
            <View style={styles.unitsRow}>
              <Text style={styles.unitsText}>{useImperial ? 'Imperial (lbs)' : 'Metric (kg)'}</Text>
              <Switch
                value={useImperial}
                onValueChange={setUseImperial}
                thumbColor={useImperial ? colors.primary : colors.borderLight}
                trackColor={{ true: colors.primaryDark, false: colors.border }}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Current weight ({useImperial ? 'lbs' : 'kg'}) *</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder={useImperial ? 'e.g. 180' : 'e.g. 82'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            keyboardType="decimal-pad"
          />
          {fieldErrors.weight ? <Text style={styles.errorText}>{fieldErrors.weight}</Text> : null}
        </View>

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

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.buttonText}>Save and continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
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
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
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
});


