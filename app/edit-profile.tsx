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
import { supabase } from '../src/lib/supabase/client';
import { getUserProfile, updateUserProfile } from '../src/lib/supabase/queries/users';
import { useUserStore, type UserProfile } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { devLog, devError } from '../src/lib/utils/logger';
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog';

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
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [useImperial, setUseImperial] = useState(true);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
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
          p = await getUserProfile(userId);
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
        setFullName(p.full_name ?? '');
        setAge(p.age != null ? String(p.age) : '');
        setExperienceLevel(p.experience_level ?? '');
        setDaysPerWeek(p.days_per_week != null ? String(p.days_per_week) : '');
        setUseImperial(p.use_imperial ?? true);
        setWeight(p.current_weight != null ? String(p.current_weight) : '');
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
    const ageNum = age ? parseInt(age, 10) || undefined : undefined;
    const daysNum = daysPerWeek ? parseInt(daysPerWeek, 10) || undefined : undefined;
    const weightNum = weight ? parseFloat(weight) || undefined : undefined;
    const equipChanged =
      (profile.equipment_access ?? []).join('|') !== (equipment ?? []).join('|');
    return (
      (profile.full_name ?? '') !== fullName ||
      (profile.age ?? undefined) !== ageNum ||
      (profile.experience_level ?? '') !== experienceLevel ||
      (profile.days_per_week ?? undefined) !== daysNum ||
      (profile.use_imperial ?? true) !== useImperial ||
      (profile.current_weight ?? undefined) !== weightNum ||
      equipChanged
    );
  }, [age, daysPerWeek, equipment, experienceLevel, fullName, profile, useImperial, weight]);

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
        full_name: fullName.trim() || undefined,
        age: age ? parseInt(age, 10) || undefined : undefined,
        experience_level: experienceLevel.trim() || undefined,
        days_per_week: daysPerWeek ? parseInt(daysPerWeek, 10) || undefined : undefined,
        use_imperial: useImperial,
        current_weight: weight ? parseFloat(weight) || undefined : undefined,
        equipment_access: equipment,
      };

      const success = await updateUserProfile(profile.id, updates);
      if (!success) {
        Alert.alert('Error', 'Failed to save profile.');
        return;
      }

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
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (__DEV__) devError('edit-profile', error, { action: 'change-password' });
        Alert.alert('Error', 'Failed to change password.');
        return;
      }
      setNewPassword('');
      if (__DEV__) devLog('edit-profile', { action: 'change-password:done' });
      Alert.alert('Success', 'Password updated.');
    } catch (error) {
      if (__DEV__) devError('edit-profile', error, { action: 'change-password' });
      Alert.alert('Error', 'An error occurred while changing password.');
    } finally {
      setChangingPassword(false);
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
        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>

        {/* Age & days per week */}
        <View style={styles.row}>
          <View style={[styles.card, styles.rowItem]}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="Years"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="number-pad"
            />
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
                onValueChange={setUseImperial}
                thumbColor={useImperial ? colors.primary : colors.borderLight}
                trackColor={{ true: colors.primaryDark, false: colors.border }}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Current Weight ({useImperial ? 'lbs' : 'kg'})</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder={useImperial ? 'e.g. 180' : 'e.g. 82'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <Text style={styles.label}>Change Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.saveButton, changingPassword && styles.saveButtonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>Update Password</Text>
            )}
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




