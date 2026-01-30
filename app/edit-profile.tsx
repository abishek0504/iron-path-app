/**
 * Edit Profile modal
 * Shared route reachable from all tabs via Settings bottom sheet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../src/lib/supabase/client';
import { updateUserProfile } from '../src/lib/supabase/queries/users';
import { getUserProfileCached, invalidateProfileCache } from '../src/lib/cache/dashboardStatsCache';
import { useUserStore, type UserProfile } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { devLog, devError } from '../src/lib/utils/logger';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';
import { calculateAge, formatDateOfBirth } from '../src/lib/utils/date';
import { BottomSheet } from '../src/components/ui/BottomSheet';
import { DatePicker } from '../src/components/ui/DatePicker';

const EQUIPMENT_OPTIONS = ['Full gym', 'Dumbbells', 'Bands', 'Bodyweight only'];

export default function EditProfileScreen() {
  const router = useRouter();
  const cachedProfile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const showToast = useUIStore((state) => state.showToast);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setLocalProfile] = useState<UserProfile | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [weight, setWeight] = useState<number>(70);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [useImperial, setUseImperial] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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
          Alert.alert('Not signed in', 'Please log in again.');
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
        setExperienceLevel(p.experience_level ?? '');
        setDaysPerWeek(p.days_per_week != null ? String(p.days_per_week) : '');
        setUseImperial(p.use_imperial ?? true);
        setWeight(p.current_weight != null ? p.current_weight : 70);
        setEquipment(p.equipment_access ?? []);

        if (__DEV__) {
          devLog('edit-profile', { action: 'load:done', hasProfile: !!p });
        }
      } catch (error) {
        if (__DEV__) {
          devError('edit-profile', error);
        }
        Alert.alert('Error', 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [cachedProfile, router, setProfile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const daysNum = daysPerWeek ? parseInt(daysPerWeek, 10) || undefined : undefined;
    const profileDob = profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : null;
    const currentDob = dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null;
    const equipChanged =
      (profile.equipment_access ?? []).join('|') !== (equipment ?? []).join('|');
    return (
      (profile.first_name ?? '') !== firstName ||
      (profile.last_name ?? '') !== lastName ||
      profileDob !== currentDob ||
      (profile.experience_level ?? '') !== experienceLevel ||
      (profile.days_per_week ?? undefined) !== daysNum ||
      (profile.use_imperial ?? true) !== useImperial ||
      (profile.current_weight ?? undefined) !== weight ||
      equipChanged
    );
  }, [dateOfBirth, daysPerWeek, equipment, experienceLevel, firstName, lastName, profile, useImperial, weight]);

  const navigateBackOrTabs = () => {
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
  };

  const safeClose = () => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      navigateBackOrTabs();
    }
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    navigateBackOrTabs();
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updates: Partial<UserProfile> = {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : undefined,
        experience_level: experienceLevel.trim() || undefined,
        days_per_week: daysPerWeek ? parseInt(daysPerWeek, 10) || undefined : undefined,
        use_imperial: useImperial,
        current_weight: weight,
        equipment_access: equipment,
      };

      const success = await updateUserProfile(profile.id, updates);
      if (!success) {
        Alert.alert('Error', 'Failed to save profile.');
        return;
      }
      invalidateProfileCache(profile.id);

      setProfile({ ...profile, ...updates });
      if (__DEV__) {
        devLog('edit-profile', { action: 'save', updateKeys: Object.keys(updates) });
      }
      showToast('Profile saved', 'success');
      navigateBackOrTabs();
    } catch (error) {
      if (__DEV__) {
        devError('edit-profile', error);
      }
      Alert.alert('Error', 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      router.push('/auth/forgot-password');
    } catch {
      router.replace('/auth/forgot-password');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={safeClose} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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

        {/* Date of Birth & days per week */}
        <View style={styles.row}>
          <View style={[styles.card, styles.rowItem]}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
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
          <View style={[styles.card, styles.rowItem]}>
            <Text style={styles.label}>Days / Week</Text>
            <TextInput
              value={daysPerWeek}
              onChangeText={setDaysPerWeek}
              placeholder="e.g. 3"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
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
                onValueChange={(value) => {
                  setUseImperial(value);
                  // Convert weight when switching units
                  if (value) {
                    // Convert kg to lbs
                    setWeight(Math.round(weight * 2.20462));
                  } else {
                    // Convert lbs to kg
                    setWeight(Math.round(weight / 2.20462));
                  }
                }}
                thumbColor={useImperial ? colors.primary : colors.borderLight}
                trackColor={{ true: colors.primaryDark, false: colors.border }}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Current Weight ({useImperial ? 'lbs' : 'kg'})</Text>
          <TouchableOpacity
            onPress={() => setShowWeightPicker(true)}
            style={styles.weightPickerButton}
          >
            <Text style={styles.weightPickerButtonText}>
              {weight} {useImperial ? 'lbs' : 'kg'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <Text style={styles.label}>Change Password</Text>
          <Text style={styles.helperText}>We’ll email you a reset link to set a new password.</Text>
          <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} activeOpacity={0.85}>
            <Text style={styles.saveButtonText}>Send reset link</Text>
          </TouchableOpacity>
        </View>

        {/* Equipment */}
        <View style={styles.card}>
          <Text style={styles.label}>Equipment Access</Text>
          <View style={styles.chipGroup}>
            {EQUIPMENT_OPTIONS.map((option) => {
              const selected = equipment.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() =>
                    setEquipment((prev) =>
                      prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
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
          selectedValue={weight}
          onValueChange={(itemValue) => setWeight(itemValue)}
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

      <ConfirmDialog
        visible={showDiscardConfirm}
        title="Discard changes?"
        message="You have unsaved changes. Do you want to discard them?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={handleDiscard}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
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
  saveButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
});

// Mounted globally in this screen for reuse
export const EditProfileConfirmHost = ({ children }: { children: React.ReactNode }) => children;




