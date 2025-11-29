import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  Platform,
} from 'react-native';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';

type SetItem = {
  index: number;
  weight: number | null;
  reps: number | null;
  duration: number | null; // Duration in seconds for timed exercises
  rest_time_sec: number | null;
};

export default function WorkoutSetsScreen() {
  const router = useRouter();
  const { planId, day, exerciseIndex } = useLocalSearchParams<{
    planId: string;
    day: string;
    exerciseIndex: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [exerciseName, setExerciseName] = useState<string>('');
  const [sets, setSets] = useState<SetItem[]>([]);
  const [bodyweightFlags, setBodyweightFlags] = useState<Map<number, boolean>>(new Map());
  const [isTimed, setIsTimed] = useState<boolean>(false);
  const [durationMinutes, setDurationMinutes] = useState<Map<number, string>>(new Map());
  const [durationSeconds, setDurationSeconds] = useState<Map<number, string>>(new Map());

  const parsedExerciseIndex = Number.isFinite(Number(exerciseIndex))
    ? parseInt(exerciseIndex as string, 10)
    : NaN;

  const handleBack = () => {
    try {
      if (
        router.canGoBack &&
        typeof router.canGoBack === 'function' &&
        router.canGoBack()
      ) {
        router.back();
      } else {
        router.push('/(tabs)/planner');
      }
    } catch {
      router.push('/(tabs)/planner');
    }
  };

  const initializeSetsFromExercise = (exercise: any): SetItem[] => {
    if (Array.isArray(exercise.sets) && exercise.sets.length > 0) {
      return exercise.sets.map((set: any, idx: number) => ({
        index: typeof set.index === 'number' ? set.index : idx + 1,
        weight:
          typeof set.weight === 'number'
            ? set.weight
            : set.weight === null || set.weight === undefined
            ? null
            : Number.isFinite(Number(set.weight))
            ? parseFloat(String(set.weight))
            : null,
        reps:
          typeof set.reps === 'number'
            ? set.reps
            : set.reps === null || set.reps === undefined
            ? null
            : Number.isFinite(Number(set.reps))
            ? parseInt(String(set.reps), 10)
            : null,
        duration:
          typeof set.duration === 'number'
            ? set.duration
            : set.duration === null || set.duration === undefined
            ? null
            : Number.isFinite(Number(set.duration))
            ? parseInt(String(set.duration), 10)
            : null,
        rest_time_sec:
          typeof set.rest_time_sec === 'number'
            ? set.rest_time_sec
            : set.rest_time_sec === null || set.rest_time_sec === undefined
            ? null
            : Number.isFinite(Number(set.rest_time_sec))
            ? parseInt(String(set.rest_time_sec), 10)
            : null,
      }));
    }

    const targetSets =
      typeof exercise.target_sets === 'number' && exercise.target_sets > 0
        ? exercise.target_sets
        : 3;
    const baseRest =
      typeof exercise.rest_time_sec === 'number' && exercise.rest_time_sec >= 0
        ? exercise.rest_time_sec
        : 60;
    const baseReps = typeof exercise.target_reps === 'number'
      ? exercise.target_reps
      : (typeof exercise.target_reps === 'string' && Number.isFinite(Number(exercise.target_reps)))
      ? parseInt(exercise.target_reps, 10)
      : 8;
    const baseDuration = exercise.target_duration_sec !== null && exercise.target_duration_sec !== undefined
      ? exercise.target_duration_sec
      : 60;

    const created: SetItem[] = [];
    for (let i = 0; i < targetSets; i += 1) {
      created.push({
        index: i + 1,
        weight: null,
        reps: baseReps,
        duration: baseDuration,
        rest_time_sec: baseRest,
      });
    }
    return created;
  };

  const loadData = async () => {
    if (!planId || !day || Number.isNaN(parsedExerciseIndex)) {
      Alert.alert('Error', 'Missing workout information.');
      handleBack();
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', parseInt(planId as string, 10))
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Failed to load workout plan.');
      setLoading(false);
      handleBack();
      return;
    }

    const dayData = data.plan_data?.week_schedule?.[day as string];
    const exercises: any[] = dayData?.exercises || [];

    if (
      !Array.isArray(exercises) ||
      parsedExerciseIndex < 0 ||
      parsedExerciseIndex >= exercises.length
    ) {
      Alert.alert('Error', 'Workout not found for this day.');
      setLoading(false);
      handleBack();
      return;
    }

    const exercise = exercises[parsedExerciseIndex];
    const initializedSets = initializeSetsFromExercise(exercise);

    // Load exercise details to check if timed
    const { data: { user } } = await supabase.auth.getUser();
    let exerciseIsTimed = false;
    if (user && exercise.name) {
      const { data: userExercise } = await supabase
        .from('user_exercises')
        .select('is_timed')
        .eq('user_id', user.id)
        .eq('name', exercise.name)
        .maybeSingle();
      
      if (userExercise) {
        exerciseIsTimed = userExercise.is_timed || false;
      } else {
        const { data: masterExercise } = await supabase
          .from('exercises')
          .select('is_timed')
          .eq('name', exercise.name)
          .maybeSingle();
        
        if (masterExercise) {
          exerciseIsTimed = masterExercise.is_timed || false;
        }
      }
    }
    setIsTimed(exerciseIsTimed);

    // Initialize bodyweight flags for sets with weight 0 or null (only for non-timed)
    const bwFlagsMap = new Map<number, boolean>();
    if (!exerciseIsTimed) {
      initializedSets.forEach((set, idx) => {
        if (set.weight === 0 || set.weight === null) {
          bwFlagsMap.set(idx, true);
        }
      });
    }
    setBodyweightFlags(bwFlagsMap);

    // Initialize duration minutes/seconds maps for timed exercises
    const minsMap = new Map<number, string>();
    const secsMap = new Map<number, string>();
    if (exerciseIsTimed) {
      initializedSets.forEach((set, idx) => {
        // If duration is null/undefined, initialize to 60 seconds (1 min, 0 sec)
        const duration = set.duration !== null && set.duration !== undefined ? set.duration : 60;
        minsMap.set(idx, Math.floor(duration / 60).toString());
        secsMap.set(idx, (duration % 60).toString());
        // Update set duration if it was null
        if (set.duration === null || set.duration === undefined) {
          initializedSets[idx].duration = 60;
        }
      });
    }
    setDurationMinutes(minsMap);
    setDurationSeconds(secsMap);

    setPlan(data);
    setExerciseName(exercise.name || 'Workout');
    setSets(initializedSets);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [planId, day, exerciseIndex])
  );

  const handleChangeSetWeight = (setIndex: number, value: string) => {
    // If user types a value (and it's not "0"), uncheck bodyweight
    if (value && value.trim() !== '' && value !== '0') {
      setBodyweightFlags((prev) => {
        const newMap = new Map(prev);
        newMap.set(setIndex, false);
        return newMap;
      });
    }
    
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === setIndex
          ? {
              ...set,
              weight:
                value.trim() === '' || Number.isNaN(Number(value))
                  ? null
                  : parseFloat(value),
            }
          : set
      )
    );
  };

  const handleToggleBodyweight = (setIndex: number) => {
    const isChecked = bodyweightFlags.get(setIndex) || false;
    setBodyweightFlags((prev) => {
      const newMap = new Map(prev);
      newMap.set(setIndex, !isChecked);
      return newMap;
    });
    
    // Set weight to 0 if checked, clear if unchecked
    if (!isChecked) {
      setSets((prev) =>
        prev.map((set, idx) =>
          idx === setIndex ? { ...set, weight: 0 } : set
        )
      );
    } else {
      setSets((prev) =>
        prev.map((set, idx) =>
          idx === setIndex ? { ...set, weight: null } : set
        )
      );
    }
  };

  const handleChangeSetReps = (setIndex: number, value: string) => {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === setIndex
          ? {
              ...set,
              reps:
                value.trim() === '' || Number.isNaN(Number(value))
                  ? null
                  : parseInt(value, 10),
            }
          : set
      )
    );
  };

  const handleChangeSetRest = (setIndex: number, value: string) => {
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === setIndex
          ? {
              ...set,
              rest_time_sec:
                value.trim() === '' || Number.isNaN(Number(value))
                  ? null
                  : parseInt(value, 10),
            }
          : set
      )
    );
  };

  const handleRemoveSet = (setIndex: number) => {
    setSets((prev) => {
      const next = prev.filter((_, idx) => idx !== setIndex);
      return next.map((set, idx) => ({
        ...set,
        index: idx + 1,
      }));
    });
  };

  const handleChangeSetDuration = (setIndex: number, minutes: string, seconds: string) => {
    const mins = minutes === '' ? 0 : parseInt(minutes) || 0;
    const secs = seconds === '' ? 0 : parseInt(seconds) || 0;
    const totalSeconds = mins * 60 + secs;
    
    setSets((prev) =>
      prev.map((set, idx) =>
        idx === setIndex
          ? {
              ...set,
              duration: totalSeconds > 0 ? totalSeconds : null,
            }
          : set
      )
    );
  };

  const handleAddSet = () => {
    setSets((prev) => {
      const last = prev[prev.length - 1];
      const nextRest = last?.rest_time_sec ?? null;
      const nextReps = last?.reps ?? null;
      const nextDuration = last?.duration ?? null;
      const nextIndex = prev.length + 1;
      return [
        ...prev,
        {
          index: nextIndex,
          weight: null,
          reps: nextReps,
          duration: nextDuration,
          rest_time_sec: nextRest,
        },
      ];
    });
  };

  const handleSave = async () => {
    if (!plan || !day || Number.isNaN(parsedExerciseIndex)) {
      return;
    }

    setSaving(true);

    try {
      const updatedPlan = { ...plan };
      const dayData = updatedPlan.plan_data?.week_schedule?.[day as string];
      if (!dayData || !Array.isArray(dayData.exercises)) {
        throw new Error('Day data is missing.');
      }

      if (
        parsedExerciseIndex < 0 ||
        parsedExerciseIndex >= dayData.exercises.length
      ) {
        throw new Error('Exercise index is out of range.');
      }

      const normalizedSets = sets.map((set, idx) => {
        // For timed exercises, ensure duration is calculated from minutes/seconds maps if they exist
        let finalDuration = set.duration;
        if (isTimed && (durationMinutes.has(idx) || durationSeconds.has(idx))) {
          const mins = durationMinutes.has(idx) 
            ? (parseInt(durationMinutes.get(idx) || '0') || 0)
            : (set.duration ? Math.floor(set.duration / 60) : 0);
          const secs = durationSeconds.has(idx)
            ? (parseInt(durationSeconds.get(idx) || '0') || 0)
            : (set.duration ? set.duration % 60 : 0);
          finalDuration = mins * 60 + secs;
          finalDuration = finalDuration > 0 ? finalDuration : null;
        }
        
        return {
          index: idx + 1,
          weight: set.weight,
          reps: set.reps,
          duration: finalDuration,
          rest_time_sec: set.rest_time_sec,
        };
      });

      const exercise = dayData.exercises[parsedExerciseIndex];
      const updatedExercise = {
        ...exercise,
        sets: normalizedSets,
        target_sets: normalizedSets.length,
      };

      // For timed exercises, update target_duration_sec from the first set's duration
      if (isTimed && normalizedSets.length > 0 && normalizedSets[0].duration !== null && normalizedSets[0].duration !== undefined) {
        updatedExercise.target_duration_sec = normalizedSets[0].duration;
      }

      dayData.exercises[parsedExerciseIndex] = updatedExercise;
      updatedPlan.plan_data.week_schedule[day as string] = dayData;

      const { error } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', updatedPlan.id);

      if (error) {
        throw error;
      }

      setPlan(updatedPlan);
      router.replace({
        pathname: '/planner-day',
        params: {
          planId: planId || '',
          day: day || '',
        },
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save sets.');
    } finally {
      setSaving(false);
    }
  };

  const renderSetItem = ({ item, index }: { item: SetItem; index: number }) => (
    <View style={styles.setCard}>
      <View style={styles.setHeaderRow}>
        <Text style={styles.setTitle}>Set {index + 1}</Text>
        <TouchableOpacity
          onPress={() => handleRemoveSet(index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X color="#ef4444" size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.setFieldsRow}>
        {!isTimed ? (
          <>
            <View style={styles.setField}>
              <Text style={styles.fieldLabel}>Weight</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  bodyweightFlags.get(index) && styles.fieldInputDisabled
                ]}
                keyboardType="numeric"
                value={
                  item.weight === null || item.weight === undefined
                    ? ''
                    : String(item.weight)
                }
                onChangeText={(text) => handleChangeSetWeight(index, text)}
                placeholder={bodyweightFlags.get(index) ? "BW" : "e.g. 50"}
                placeholderTextColor="#6b7280"
                editable={!bodyweightFlags.get(index)}
              />
              <View style={styles.bodyweightCheckboxContainer}>
                <Text style={styles.bodyweightCheckboxLabel}>Bodyweight</Text>
                <TouchableOpacity
                  style={styles.bodyweightCheckbox}
                  onPress={() => handleToggleBodyweight(index)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    bodyweightFlags.get(index) && styles.checkboxChecked
                  ]}>
                    {bodyweightFlags.get(index) && (
                      <Text style={styles.checkboxCheckmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.setField}>
              <Text style={styles.fieldLabel}>Reps</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="numeric"
                value={
                  item.reps === null || item.reps === undefined
                    ? ''
                    : String(item.reps)
                }
                onChangeText={(text) => handleChangeSetReps(index, text)}
                placeholder="e.g. 8"
                placeholderTextColor="#6b7280"
              />
            </View>
          </>
        ) : (
          <View style={styles.setField}>
            <Text style={styles.fieldLabel}>Duration</Text>
            <View style={styles.durationRow}>
              <View style={styles.durationField}>
                <Text style={styles.durationLabel}>Min</Text>
                <TextInput
                  style={styles.fieldInput}
                  keyboardType="numeric"
                  value={durationMinutes.get(index) ?? (item.duration ? Math.floor(item.duration / 60).toString() : '')}
                  onChangeText={(text) => {
                    if (text === '' || (!isNaN(parseInt(text)) && parseInt(text) >= 0)) {
                      setDurationMinutes(prev => {
                        const newMap = new Map(prev);
                        newMap.set(index, text);
                        return newMap;
                      });
                      const secs = durationSeconds.get(index) ?? (item.duration ? (item.duration % 60).toString() : '');
                      handleChangeSetDuration(index, text, secs);
                    }
                  }}
                  onBlur={() => {
                    const mins = durationMinutes.get(index) ?? (item.duration ? Math.floor(item.duration / 60).toString() : '');
                    const secs = durationSeconds.get(index) ?? (item.duration ? (item.duration % 60).toString() : '');
                    handleChangeSetDuration(index, mins, secs);
                    setDurationMinutes(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(index);
                      return newMap;
                    });
                  }}
                  onFocus={() => {
                    if (!durationMinutes.has(index) && item.duration !== null) {
                      setDurationMinutes(prev => {
                        const newMap = new Map(prev);
                        newMap.set(index, Math.floor(item.duration! / 60).toString());
                        return newMap;
                      });
                    }
                  }}
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.durationField}>
                <Text style={styles.durationLabel}>Sec</Text>
                <TextInput
                  style={styles.fieldInput}
                  keyboardType="numeric"
                  value={durationSeconds.get(index) ?? (item.duration ? (item.duration % 60).toString() : '')}
                  onChangeText={(text) => {
                    if (text === '' || (!isNaN(parseInt(text)) && parseInt(text) >= 0 && parseInt(text) < 60)) {
                      setDurationSeconds(prev => {
                        const newMap = new Map(prev);
                        newMap.set(index, text);
                        return newMap;
                      });
                      const mins = durationMinutes.get(index) ?? (item.duration ? Math.floor(item.duration / 60).toString() : '');
                      handleChangeSetDuration(index, mins, text);
                    }
                  }}
                  onBlur={() => {
                    const mins = durationMinutes.get(index) ?? (item.duration ? Math.floor(item.duration / 60).toString() : '');
                    const secs = durationSeconds.get(index) ?? (item.duration ? (item.duration % 60).toString() : '');
                    handleChangeSetDuration(index, mins, secs);
                    setDurationSeconds(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(index);
                      return newMap;
                    });
                  }}
                  onFocus={() => {
                    if (!durationSeconds.has(index) && item.duration !== null) {
                      setDurationSeconds(prev => {
                        const newMap = new Map(prev);
                        newMap.set(index, (item.duration! % 60).toString());
                        return newMap;
                      });
                    }
                  }}
                  placeholder="0"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>
          </View>
        )}
        <View style={styles.setField}>
          <Text style={styles.fieldLabel}>Rest (sec)</Text>
          <TextInput
            style={styles.fieldInput}
            keyboardType="numeric"
            value={
              item.rest_time_sec === null || item.rest_time_sec === undefined
                ? ''
                : String(item.rest_time_sec)
            }
            onChangeText={(text) => handleChangeSetRest(index, text)}
            placeholder="60"
            placeholderTextColor="#6b7280"
          />
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color="#9ca3af" size={24} />
          </TouchableOpacity>
          <Text
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {exerciseName}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.subtitle}>
          {isTimed ? 'Configure duration and rest for each set.' : 'Configure weight, reps, and rest for each set.'}
        </Text>
      </View>

      <FlatList
        data={sets}
        keyExtractor={(_, index) => `set-${index}`}
        renderItem={renderSetItem}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.footerSection}>
            <TouchableOpacity
              style={styles.addSetButton}
              onPress={handleAddSet}
            >
              <Plus color="#3b82f6" size={20} />
              <Text style={styles.addSetText}>Add set</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>Saving...</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backButton: { marginRight: 16 },
  headerSpacer: { width: 40 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    flex: 1,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
  setCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
    ...(Platform.OS === 'web'
      ? {
          userSelect: 'none' as any,
          WebkitUserSelect: 'none' as any,
        }
      : {}),
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  setTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  setFieldsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  setField: {
    flex: 1,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  bodyweightCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  bodyweightCheckboxLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  bodyweightCheckbox: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#6b7280',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fieldInput: {
    backgroundColor: '#111827',
    color: 'white',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  fieldInputDisabled: {
    backgroundColor: '#1f2937',
    color: '#6b7280',
    opacity: 0.6,
  },
  footerSection: {
    marginTop: 16,
    gap: 12,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  addSetText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    flexDirection: 'row',
  },
  saveButtonDisabled: {
    backgroundColor: '#1e40af',
    opacity: 0.7,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationField: {
    flex: 1,
  },
  durationLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
});


