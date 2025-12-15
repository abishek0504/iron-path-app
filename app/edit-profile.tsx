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
import { colors, spacing, borderRadius, typography } from '../src/lib/utils/theme';
import { devLog, devError } from '../src/lib/utils/logger';

export default function EditProfileScreen() {
  const router = useRouter();
  const cachedProfile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setLocalProfile] = useState<UserProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [goal, setGoal] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [useImperial, setUseImperial] = useState(true);

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
        userId = user?.id ?? null;

        if (!userId) {
          setLoading(false);
          Alert.alert('Not signed in', 'Please log in again.');
          router.replace('/login');
          return;
        }

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
        setFullName(p.full_name ?? '');
        setAge(p.age != null ? String(p.age) : '');
        setGoal(p.goal ?? '');
        setExperienceLevel(p.experience_level ?? '');
        setDaysPerWeek(p.days_per_week != null ? String(p.days_per_week) : '');
        setUseImperial(p.use_imperial ?? true);

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
    return (
      (profile.full_name ?? '') !== fullName ||
      (profile.age ?? undefined) !== ageNum ||
      (profile.goal ?? '') !== goal ||
      (profile.experience_level ?? '') !== experienceLevel ||
      (profile.days_per_week ?? undefined) !== daysNum ||
      (profile.use_imperial ?? true) !== useImperial
    );
  }, [age, daysPerWeek, experienceLevel, fullName, goal, profile, useImperial]);

  const safeClose = () => {
    if (hasChanges) {
      Alert.alert('Discard changes?', 'You have unsaved changes. Discard them?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            try {
              router.back();
            } catch {
              router.replace('/(tabs)/profile');
            }
          },
        },
      ]);
    } else {
      try {
        router.back();
      } catch {
        router.replace('/(tabs)/profile');
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updates: Partial<UserProfile> = {
        full_name: fullName.trim() || undefined,
        age: age ? parseInt(age, 10) || undefined : undefined,
        goal: goal.trim() || undefined,
        experience_level: experienceLevel.trim() || undefined,
        days_per_week: daysPerWeek ? parseInt(daysPerWeek, 10) || undefined : undefined,
        use_imperial: useImperial,
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

      Alert.alert('Saved', 'Your profile has been updated.', [
        {
          text: 'OK',
          onPress: () => {
            try {
              router.back();
            } catch {
              router.replace('/(tabs)/profile');
            }
          },
        },
      ]);
    } catch (error) {
      if (__DEV__) {
        devError('edit-profile', error);
      }
      Alert.alert('Error', 'An error occurred while saving.');
    } finally {
      setSaving(false);
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

        {/* Goal & experience */}
        <View style={styles.card}>
          <Text style={styles.label}>Goal</Text>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            placeholder="strength, hypertrophy, conditioning..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
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



