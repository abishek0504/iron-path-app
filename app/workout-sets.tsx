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
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { computeExerciseHistoryMetrics, WorkoutLogLike } from '../src/lib/progressionMetrics';
import { computeProgressionSuggestion } from '../src/lib/progressionEngine';
import { getExercisePR } from '../src/lib/personalRecord';

type SetItem = {
  index: number;
  weight: number | null;
  reps: number | null;
  duration: number | null; // Duration in seconds for timed exercises
  rest_time_sec: number | null;
};

export default function WorkoutSetsScreen() {
  const router = useRouter();
  const { planId, day, exerciseIndex, weekStart, date } = useLocalSearchParams<{
    planId: string;
    day: string;
    exerciseIndex: string;
    weekStart?: string;
    date?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [exerciseName, setExerciseName] = useState<string>('');
  const [sets, setSets] = useState<SetItem[]>([]);
  const [originalSets, setOriginalSets] = useState<SetItem[]>([]);
  const [bodyweightFlags, setBodyweightFlags] = useState<Map<number, boolean>>(new Map());
  const [isTimed, setIsTimed] = useState<boolean>(false);
  const [durationMinutes, setDurationMinutes] = useState<Map<number, string>>(new Map());
  const [durationSeconds, setDurationSeconds] = useState<Map<number, string>>(new Map());
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const parsedExerciseIndex = Number.isFinite(Number(exerciseIndex))
    ? parseInt(exerciseIndex as string, 10)
    : NaN;

  const hasChanges = () => {
    if (sets.length !== originalSets.length) return true;
    return sets.some((set, idx) => {
      const original = originalSets[idx];
      if (!original) return true;
      return (
        set.weight !== original.weight ||
        set.reps !== original.reps ||
        set.duration !== original.duration ||
        set.rest_time_sec !== original.rest_time_sec
      );
    });
  };

  const handleBack = () => {
    if (hasChanges()) {
      setShowDiscardDialog(true);
    } else {
      try {
        router.replace({
          pathname: '/planner-day',
          params: {
            planId: planId || '',
            day: day || '',
            weekStart: weekStart || '',
            date: date || '',
          },
        });
      } catch {
        router.replace('/(tabs)/planner');
      }
    }
  };

  const handleDiscardConfirm = () => {
    setShowDiscardDialog(false);
    try {
      router.replace({
        pathname: '/planner-day',
        params: {
          planId: planId || '',
          day: day || '',
          weekStart: weekStart || '',
          date: date || '',
        },
      });
    } catch {
      router.replace('/(tabs)/planner');
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

    // Get current week start date if weekStart not provided
    let weekKey = weekStart;
    if (!weekKey) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek;
      const weekStartDate = new Date(today);
      weekStartDate.setDate(diff);
      weekStartDate.setHours(0, 0, 0, 0);
      const year = weekStartDate.getFullYear();
      const month = String(weekStartDate.getMonth() + 1).padStart(2, '0');
      const dayNum = String(weekStartDate.getDate()).padStart(2, '0');
      weekKey = `${year}-${month}-${dayNum}`;
    }
    
    // Check week-specific data first, then fall back to template
    let dayData = null;
    if (data.plan_data?.weeks?.[weekKey]?.week_schedule?.[day as string]) {
      dayData = data.plan_data.weeks[weekKey].week_schedule[day as string];
    } else if (data.plan_data?.week_schedule?.[day as string]) {
      dayData = data.plan_data.week_schedule[day as string];
    }
    
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
    
    // Pre-fill weights from progression engine if available
    if (user && exercise.name && !exerciseIsTimed) {
      try {
        // Fetch workout logs for this exercise
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('exercise_name, weight, reps, scheduled_weight, scheduled_reps, performed_at')
          .eq('user_id', user.id)
          .eq('exercise_name', exercise.name)
          .order('performed_at', { ascending: false })
          .limit(20);

        if (logs && Array.isArray(logs) && logs.length > 0) {
          const metrics = computeExerciseHistoryMetrics(logs as WorkoutLogLike[]);
          
          // Get PR for this exercise
          const pr = await getExercisePR(user.id, exercise.name);
          const prData = pr && pr.weight > 0 ? { weight: pr.weight, reps: pr.reps } : null;
          
          // Get user profile for progression
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile) {
            const suggestion = computeProgressionSuggestion({
              profile,
              exercise,
              metrics,
              personalRecord: prData,
            });

            // Pre-fill weights if suggestion is available and set weight is null/undefined
            if (suggestion.suggestedWeight != null && suggestion.suggestedWeight > 0) {
              initializedSets = initializedSets.map((set) => {
                if (set.weight === null || set.weight === undefined || Number.isNaN(set.weight)) {
                  return { ...set, weight: suggestion.suggestedWeight };
                }
                return set;
              });
              
              // Update bodyweight flags
              initializedSets.forEach((set, idx) => {
                if (set.weight === 0) {
                  bwFlagsMap.set(idx, true);
                } else if (set.weight != null && set.weight > 0) {
                  bwFlagsMap.set(idx, false);
                }
              });
              setBodyweightFlags(new Map(bwFlagsMap));
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[workout-sets] Error pre-filling weights:', error);
        }
        // Continue without pre-fill if there's an error
      }
    }
    
    setSets(initializedSets);
    setOriginalSets(JSON.parse(JSON.stringify(initializedSets))); // Deep copy for comparison
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [planId, day, exerciseIndex])
  );

  // Recalculate estimation when sets change (for display in parent screen)
  // This doesn't update the parent directly, but ensures we have current data when saving
  useEffect(() => {
    // The estimation will be recalculated in planner-day when it receives updated dayData
    // This effect just ensures we're working with the latest sets data
  }, [sets]);

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
      // Deep copy to avoid mutating original
      const updatedPlan = JSON.parse(JSON.stringify(plan));
      
      // Get week key
      let weekKey = weekStart;
      if (!weekKey) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek;
        const weekStartDate = new Date(today);
        weekStartDate.setDate(diff);
        weekStartDate.setHours(0, 0, 0, 0);
        const year = weekStartDate.getFullYear();
        const month = String(weekStartDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(weekStartDate.getDate()).padStart(2, '0');
        weekKey = `${year}-${month}-${dayNum}`;
      }
      
      // Ensure plan_data structure exists
      if (!updatedPlan.plan_data) {
        updatedPlan.plan_data = { week_schedule: {}, weeks: {} };
      }
      if (!updatedPlan.plan_data.weeks) {
        updatedPlan.plan_data.weeks = {};
      }
      if (!updatedPlan.plan_data.week_schedule) {
        updatedPlan.plan_data.week_schedule = {};
      }
      
      // Get dayData from week-specific structure or template
      let dayData = null;
      if (updatedPlan.plan_data.weeks[weekKey]?.week_schedule?.[day as string]) {
        dayData = updatedPlan.plan_data.weeks[weekKey].week_schedule[day as string];
      } else if (updatedPlan.plan_data.week_schedule?.[day as string]) {
        dayData = updatedPlan.plan_data.week_schedule[day as string];
      }
      
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
        
        // Clamp rest_time_sec to reasonable range (30-300 seconds)
        let clampedRest = set.rest_time_sec;
        if (typeof clampedRest === 'number' && clampedRest > 0) {
          clampedRest = Math.max(30, Math.min(300, Math.round(clampedRest)));
        } else {
          clampedRest = 60; // Default if null/undefined
        }
        
        return {
          index: idx + 1,
          weight: set.weight,
          reps: set.reps,
          duration: finalDuration,
          rest_time_sec: clampedRest,
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
        
        // Calculate and save user_seconds_per_rep_override if duration changed
        const { data: { user } } = await supabase.auth.getUser();
        if (user && exerciseName) {
          try {
            // Calculate total duration and total "reps" (for timed exercises, we use duration as the "work")
            const totalDuration = normalizedSets.reduce((sum, set) => {
              return sum + (set.duration || 0);
            }, 0);
            
            // For timed exercises, we treat each set as 1 "rep" of work
            // So seconds_per_rep = total_duration / number_of_sets
            const totalSets = normalizedSets.length;
            if (totalSets > 0 && totalDuration > 0) {
              const secondsPerRep = totalDuration / totalSets;
              
              // Check if user_exercise exists
              const { data: existingUserExercise } = await supabase
                .from('user_exercises')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', exerciseName)
                .maybeSingle();
              
              if (existingUserExercise) {
                // Update existing user_exercise
                await supabase
                  .from('user_exercises')
                  .update({ user_seconds_per_rep_override: secondsPerRep })
                  .eq('id', existingUserExercise.id);
              } else {
                // Create new user_exercise with override
                await supabase
                  .from('user_exercises')
                  .insert({
                    user_id: user.id,
                    name: exerciseName,
                    is_timed: true,
                    user_seconds_per_rep_override: secondsPerRep,
                  });
              }
              
              if (__DEV__) {
                console.log('[workout-sets] Saved time override', {
                  exerciseName,
                  secondsPerRep,
                  totalDuration,
                  totalSets,
                });
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.error('[workout-sets] Error saving time override:', error);
            }
            // Don't block save if time override fails
          }
        }
      }

      dayData.exercises[parsedExerciseIndex] = updatedExercise;
      
      // Save to week-specific structure if weekKey is provided
      if (weekKey) {
        if (!updatedPlan.plan_data.weeks[weekKey]) {
          updatedPlan.plan_data.weeks[weekKey] = { week_schedule: {} };
        }
        if (!updatedPlan.plan_data.weeks[weekKey].week_schedule) {
          updatedPlan.plan_data.weeks[weekKey].week_schedule = {};
        }
        updatedPlan.plan_data.weeks[weekKey].week_schedule[day as string] = dayData;
      } else {
        updatedPlan.plan_data.week_schedule[day as string] = dayData;
      }

      const { error } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', updatedPlan.id);

      if (error) {
        throw error;
      }

      setPlan(updatedPlan);
      setOriginalSets(JSON.parse(JSON.stringify(sets))); // Update original after save
      router.replace({
        pathname: '/planner-day',
        params: {
          planId: planId || '',
          day: day || '',
          weekStart: weekStart || '',
          date: date || '',
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
                  bodyweightFlags.get(index)
                    ? '0'
                    : (item.weight === null || item.weight === undefined
                        ? ''
                        : String(item.weight))
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
          <ActivityIndicator size="large" color="#a3e635" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color="#a1a1aa" size={24} />
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
              <Plus color="#a3e635" size={20} />
              <Text style={styles.addSetText}>Add set</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Floating Save Button */}
      <View style={styles.floatingSaveContainer}>
        <View style={styles.floatingSaveCapsule}>
          <TouchableOpacity
            style={[styles.floatingSaveButton, (saving || !hasChanges()) && styles.floatingSaveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || !hasChanges()}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#09090b" style={{ marginRight: 8 }} />
                <Text style={styles.floatingSaveButtonText}>Saving...</Text>
              </>
            ) : (
              <Text style={styles.floatingSaveButtonText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ConfirmDialog
        visible={showDiscardDialog}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        cancelText="Cancel"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setShowDiscardDialog(false)}
        destructive={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' }, // zinc-950
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
    color: '#a3e635', // lime-400
    flex: 1,
  },
  subtitle: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 32 : 120, // Extra padding for native tab bar
    paddingTop: 8,
  },
  setCard: {
    backgroundColor: '#18181b', // zinc-900
    padding: 32, // p-8
    borderRadius: 24, // rounded-3xl
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
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
    minHeight: 80,
  },
  fieldLabel: {
    color: '#a1a1aa', // zinc-400
    fontSize: 12,
    marginBottom: 4,
    minHeight: 16,
  },
  bodyweightCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  bodyweightCheckboxLabel: {
    fontSize: 12,
    color: '#a1a1aa', // zinc-400
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
    borderColor: '#71717a', // zinc-500
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#a3e635', // lime-400
    borderColor: '#a3e635', // lime-400
  },
  checkboxCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fieldInput: {
    backgroundColor: '#09090b', // zinc-950
    color: 'white',
    padding: 16,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    minHeight: 40,
    fontSize: 16,
  },
  fieldInputDisabled: {
    backgroundColor: '#18181b', // zinc-900
    color: '#71717a', // zinc-500
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
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#a3e635', // lime-400
    padding: 20,
    borderRadius: 24, // rounded-3xl
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
  },
  saveButtonDisabled: {
    backgroundColor: '#84cc16', // lime-500
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#09090b', // zinc-950 for contrast
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
    color: '#a1a1aa', // zinc-400
    fontSize: 12,
    marginBottom: 4,
    minHeight: 16,
  },
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'web' ? 16 : 32,
    backgroundColor: 'transparent',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  floatingSaveCapsule: {
    backgroundColor: '#18181b', // zinc-900 - capsule background
    borderRadius: 36, // Full capsule shape matching tab bar
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    padding: 4,
  },
  floatingSaveButton: {
    backgroundColor: '#a3e635', // lime-400
    padding: 18,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
  },
  floatingSaveButtonDisabled: {
    backgroundColor: '#27272a', // zinc-800
    opacity: 0.5,
  },
  floatingSaveButtonText: {
    color: '#09090b', // zinc-950 for contrast
    fontWeight: 'bold',
    fontSize: 16,
  },
});


