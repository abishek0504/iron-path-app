import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  ScrollView,
} from 'react-native';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';

type SetItem = {
  index: number;
  weight: number | null;
  reps: number | null;
  duration: number | null;
  rest_time_sec: number | null;
};

const BODYWEIGHT_EXERCISES = [
  'Pull Up', 'Pull-Up', 'Pullup', 'Chin Up', 'Chin-Up',
  'Push Up', 'Push-Up', 'Pushup',
  'Dip', 'Dips',
  'Sit Up', 'Sit-Up', 'Situp',
  'Crunch', 'Crunches',
  'Plank', 'Planks',
  'Burpee', 'Burpees',
  'Mountain Climber', 'Mountain Climbers',
  'Bodyweight Squat', 'Air Squat',
  'Lunge', 'Lunges',
  'Jumping Jack', 'Jumping Jacks',
  'Pistol Squat',
  'Handstand Push Up', 'Handstand Push-Up',
  'Muscle Up', 'Muscle-Up'
];

const isBodyweightExercise = (exerciseName: string, detail: { is_timed?: boolean } | undefined): boolean => {
  if (detail?.is_timed) return true;
  const nameMatch = BODYWEIGHT_EXERCISES.some(bw => 
    exerciseName.toLowerCase().includes(bw.toLowerCase())
  );
  return nameMatch;
};

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { exerciseName, exerciseType, planId, day, exerciseIndex, weekStart, date, context } = useLocalSearchParams<{
    exerciseName: string;
    exerciseType?: string;
    planId?: string;
    day?: string;
    exerciseIndex?: string;
    weekStart?: string;
    date?: string;
    context?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exerciseDetail, setExerciseDetail] = useState<any>(null);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [bodyweightFlags, setBodyweightFlags] = useState<Map<number, boolean>>(new Map());
  const [isTimed, setIsTimed] = useState<boolean>(false);
  const [durationMinutes, setDurationMinutes] = useState<Map<number, string>>(new Map());
  const [durationSeconds, setDurationSeconds] = useState<Map<number, string>>(new Map());

  const getDifficultyInfo = (difficulty: string | null | undefined) => {
    if (!difficulty) return null;
    const difficultyLower = String(difficulty).toLowerCase().trim();
    if (difficultyLower === 'beginner') {
      return { label: 'Easy', color: '#a3e635', activeBars: 1 };
    } else if (difficultyLower === 'intermediate') {
      return { label: 'Medium', color: '#22d3ee', activeBars: 2 };
    } else if (difficultyLower === 'advanced') {
      return { label: 'Hard', color: '#f87171', activeBars: 3 };
    }
    return null;
  };

  const renderDifficultyIndicator = (difficulty: string | null | undefined) => {
    if (!difficulty) return null;
    const difficultyInfo = getDifficultyInfo(difficulty);
    if (!difficultyInfo) return null;
    return (
      <View style={styles.difficultyContainer}>
        <View style={styles.difficultyBars}>
          <View style={[styles.difficultyBar, styles.difficultyBar1, { backgroundColor: difficultyInfo.activeBars >= 1 ? difficultyInfo.color : '#27272a' }]} />
          <View style={[styles.difficultyBar, styles.difficultyBar2, { backgroundColor: difficultyInfo.activeBars >= 2 ? difficultyInfo.color : '#27272a' }]} />
          <View style={[styles.difficultyBar, styles.difficultyBar3, { backgroundColor: difficultyInfo.activeBars >= 3 ? difficultyInfo.color : '#27272a' }]} />
        </View>
        <Text style={[styles.difficultyText, { color: difficultyInfo.color }]}>{difficultyInfo.label}</Text>
      </View>
    );
  };

  const loadExerciseDetail = async () => {
    if (!exerciseName) {
      Alert.alert('Error', 'Exercise name is missing.');
      handleBack();
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not found');
      }

      let userExercise = null;
      let masterExercise = null;

      if (exerciseType === 'custom') {
        const { data, error } = await supabase
          .from('user_exercises')
          .select('*')
          .eq('user_id', user.id)
          .eq('name', exerciseName)
          .maybeSingle();
        
        if (error) {
          console.error('Error loading custom exercise:', error);
        } else {
          userExercise = data;
        }
      } else {
        const { data: userData, error: userError } = await supabase
          .from('user_exercises')
          .select('*')
          .eq('user_id', user.id)
          .eq('name', exerciseName)
          .maybeSingle();
        
        if (!userError && userData) {
          userExercise = userData;
        }

        const { data: masterData, error: masterError } = await supabase
          .from('exercises')
          .select('*')
          .eq('name', exerciseName)
          .maybeSingle();
        
        if (!masterError && masterData) {
          masterExercise = masterData;
        }
      }

      const detail = userExercise || masterExercise;
      if (!detail) {
        Alert.alert('Error', 'Exercise not found.');
        handleBack();
        return;
      }

      setExerciseDetail(detail);
      setIsTimed(detail.is_timed || false);

      const defaultSets = detail.default_sets || 3;
      const defaultRest = detail.default_rest_sec || 60;
      const defaultReps = typeof detail.default_reps === 'number' 
        ? detail.default_reps 
        : (typeof detail.default_reps === 'string' && Number.isFinite(Number(detail.default_reps.split('-')[0])))
        ? parseInt(detail.default_reps.split('-')[0], 10)
        : 10;
      const defaultDuration = detail.default_duration_sec || 60;

      const initialSets: SetItem[] = [];
      const bwFlagsMap = new Map<number, boolean>();
      const minsMap = new Map<number, string>();
      const secsMap = new Map<number, string>();

      for (let i = 0; i < defaultSets; i++) {
        if (detail.is_timed) {
          initialSets.push({
            index: i + 1,
            weight: null,
            reps: null,
            duration: defaultDuration,
            rest_time_sec: defaultRest,
          });
          minsMap.set(i, Math.floor(defaultDuration / 60).toString());
          secsMap.set(i, (defaultDuration % 60).toString());
        } else {
          const isBodyweight = isBodyweightExercise(exerciseName, detail);
          initialSets.push({
            index: i + 1,
            weight: isBodyweight ? 0 : null,
            reps: defaultReps,
            duration: null,
            rest_time_sec: defaultRest,
          });
          if (isBodyweight) {
            bwFlagsMap.set(i, true);
          }
        }
      }

      setSets(initialSets);
      setBodyweightFlags(bwFlagsMap);
      setDurationMinutes(minsMap);
      setDurationSeconds(secsMap);
    } catch (error: any) {
      console.error('Error loading exercise detail:', error);
      Alert.alert('Error', error.message || 'Failed to load exercise details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExerciseDetail();
  }, [exerciseName]);

  const handleBack = () => {
    router.back();
  };

  const handleChangeSetWeight = (setIndex: number, value: string) => {
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

  const handleAddWorkout = async () => {
    if (context === 'progress') {
      handleBack();
      return;
    }

    if (!planId || !day) {
      Alert.alert('Error', 'Missing plan or day information.');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not found');
      }

      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', parseInt(planId))
        .single();

      if (planError || !plan) {
        throw new Error('Failed to load plan');
      }

      const updatedPlan = JSON.parse(JSON.stringify(plan));

      if (!updatedPlan.plan_data) {
        updatedPlan.plan_data = { weeks: {} };
      }
      if (!updatedPlan.plan_data.weeks) {
        updatedPlan.plan_data.weeks = {};
      }

      let dayData: any;
      if (weekStart) {
        if (!updatedPlan.plan_data.weeks[weekStart]) {
          updatedPlan.plan_data.weeks[weekStart] = { week_schedule: {} };
        }
        dayData = updatedPlan.plan_data.weeks[weekStart].week_schedule[day] || { exercises: [] };
      } else {
        if (!updatedPlan.plan_data.week_schedule) {
          updatedPlan.plan_data.week_schedule = {};
        }
        dayData = updatedPlan.plan_data.week_schedule[day] || { exercises: [] };
      }

      const normalizedSets = sets.map((set, idx) => {
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

      const newExercise: any = {
        name: exerciseName,
        target_sets: normalizedSets.length,
        rest_time_sec: normalizedSets[0]?.rest_time_sec || 60,
        notes: exerciseDetail?.description || '',
      };

      if (isTimed) {
        newExercise.target_duration_sec = normalizedSets[0]?.duration || 60;
      } else {
        newExercise.target_reps = normalizedSets[0]?.reps || 10;
      }

      newExercise.sets = normalizedSets;

      if (exerciseIndex !== undefined) {
        const index = parseInt(exerciseIndex);
        if (!isNaN(index) && dayData.exercises && index >= 0 && index < dayData.exercises.length) {
          dayData.exercises[index] = newExercise;
        } else {
          dayData.exercises = [...(dayData.exercises || []), newExercise];
        }
      } else {
        dayData.exercises = [...(dayData.exercises || []), newExercise];
      }

      if (weekStart) {
        updatedPlan.plan_data.weeks[weekStart].week_schedule[day] = dayData;
      } else {
        updatedPlan.plan_data.week_schedule[day] = dayData;
      }

      const { error: updateError } = await supabase
        .from('workout_plans')
        .update({ plan_data: updatedPlan.plan_data })
        .eq('id', plan.id);

      if (updateError) {
        throw updateError;
      }

      const params: any = { planId: planId, day: day, exerciseAdded: 'true' };
      if (weekStart) params.weekStart = weekStart;
      if (date) params.date = date;
      router.replace({
        pathname: '/planner-day',
        params
      });
    } catch (error: any) {
      console.error('Error adding exercise:', error);
      Alert.alert('Error', error.message || 'Failed to add exercise.');
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
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {exerciseDetail?.description && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{exerciseDetail.description}</Text>
          </View>
        )}

        {exerciseDetail?.muscle_groups && Array.isArray(exerciseDetail.muscle_groups) && exerciseDetail.muscle_groups.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Muscle Groups</Text>
            <View style={styles.chipsContainer}>
              {exerciseDetail.muscle_groups.map((group: string, idx: number) => (
                <View key={idx} style={styles.chip}>
                  <Text style={styles.chipText}>{group}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {exerciseDetail?.equipment_needed && Array.isArray(exerciseDetail.equipment_needed) && exerciseDetail.equipment_needed.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Equipment Needed</Text>
            <View style={styles.chipsContainer}>
              {exerciseDetail.equipment_needed.map((equipment: string, idx: number) => (
                <View key={idx} style={styles.chip}>
                  <Text style={styles.chipText}>{equipment}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {exerciseDetail?.difficulty_level && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Difficulty</Text>
            {renderDifficultyIndicator(exerciseDetail.difficulty_level)}
          </View>
        )}

        {exerciseDetail?.how_to && Array.isArray(exerciseDetail.how_to) && exerciseDetail.how_to.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>How To</Text>
            <View style={styles.howToContainer}>
              {exerciseDetail.how_to.map((step: string, idx: number) => (
                <View key={idx} style={styles.howToStep}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.howToStepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.setsSection}>
          <Text style={styles.sectionTitle}>
            {isTimed ? 'Configure duration and rest for each set.' : 'Configure weight, reps, and rest for each set.'}
          </Text>
          <FlatList
            data={sets}
            keyExtractor={(_, index) => `set-${index}`}
            renderItem={renderSetItem}
            scrollEnabled={false}
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
        </View>
      </ScrollView>

      <View style={styles.floatingSaveContainer}>
        <View style={styles.floatingSaveCapsule}>
          <TouchableOpacity
            style={[styles.floatingSaveButton, saving && styles.floatingSaveButtonDisabled]}
            onPress={handleAddWorkout}
            disabled={saving}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#09090b" style={{ marginRight: 8 }} />
                <Text style={styles.floatingSaveButtonText}>Adding...</Text>
              </>
            ) : (
              <Text style={styles.floatingSaveButtonText}>Add Workout</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
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
    color: '#a3e635',
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 32 : 120,
    paddingTop: 8,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  descriptionText: {
    color: '#a1a1aa',
    fontSize: 16,
    lineHeight: 24,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#18181b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  chipText: {
    color: '#a3e635',
    fontSize: 14,
    fontWeight: '500',
  },
  difficultyContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  difficultyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  difficultyBar: { borderRadius: 2 },
  difficultyBar1: { width: 6, height: 8 },
  difficultyBar2: { width: 6, height: 12 },
  difficultyBar3: { width: 6, height: 16 },
  difficultyText: { fontSize: 14, fontWeight: '600' },
  howToContainer: {
    gap: 20,
  },
  howToStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#a3e635',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: '#09090b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  howToStepText: {
    color: '#a1a1aa',
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  setsSection: {
    marginBottom: 24,
  },
  setCard: {
    backgroundColor: '#18181b',
    padding: 32,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
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
    color: '#a1a1aa',
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
    color: '#a1a1aa',
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
    borderColor: '#71717a',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#a3e635',
    borderColor: '#a3e635',
  },
  checkboxCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fieldInput: {
    backgroundColor: '#09090b',
    color: 'white',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    minHeight: 40,
    fontSize: 16,
  },
  fieldInputDisabled: {
    backgroundColor: '#18181b',
    color: '#71717a',
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
    color: '#a3e635',
    fontSize: 16,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationField: {
    flex: 1,
  },
  durationLabel: {
    color: '#a1a1aa',
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
    backgroundColor: '#18181b',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    padding: 4,
  },
  floatingSaveButton: {
    backgroundColor: '#a3e635',
    padding: 18,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
  },
  floatingSaveButtonDisabled: {
    backgroundColor: '#27272a',
    opacity: 0.5,
  },
  floatingSaveButtonText: {
    color: '#09090b',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

