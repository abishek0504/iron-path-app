import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { PlannerSkeleton } from '../../src/components/skeletons/PlannerSkeleton';
import { extractJSON, JSONParseError } from '../../src/lib/jsonParser';
import { ensureAllDays, validateWeekSchedule, normalizeExercise } from '../../src/lib/workoutValidation';
import { clearModelCache } from '../../src/lib/geminiModels';
import { generateWeekScheduleWithAI } from '../../src/lib/adaptiveWorkoutEngine';
import { computeExerciseHistoryMetrics, WorkoutLogLike } from '../../src/lib/progressionMetrics';
import { computeProgressionSuggestion } from '../../src/lib/progressionEngine';
import { estimateExerciseDuration } from '../../src/lib/timeEstimation';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PlannerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(false);
  const [durationTargetMin, setDurationTargetMin] = useState<number | null>(45); // Default 45 minutes
  
  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });

  const loadActivePlan = useCallback(async (isInitialLoad: boolean = false) => {
    // Only show loading on initial load
    if (isInitialLoad) {
      setIsLoadingPlan(true);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoadingPlan(false);
      if (isInitialLoad) {
        setHasInitiallyLoaded(true);
      }
      return;
    }

    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading plan:', error);
    } else if (data) {
      setActivePlan(data);
      // Load duration target from plan_data if available
      if (data.plan_data?.duration_target_min != null) {
        setDurationTargetMin(data.plan_data.duration_target_min);
      }
    }
    
    setIsLoadingPlan(false);
    if (isInitialLoad) {
      setHasInitiallyLoaded(true);
    }
  }, []);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
    } else if (data) {
      setUserProfile(data);
    }
  };

  useEffect(() => {
    // Only load on initial mount
    if (!hasInitiallyLoaded) {
      loadActivePlan(true);
      loadUserProfile();
    }
  }, [hasInitiallyLoaded, loadActivePlan]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh if we've already loaded initially
      if (hasInitiallyLoaded) {
        loadActivePlan(false);
      }
    }, [hasInitiallyLoaded, loadActivePlan])
  );

  const createEmptyPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    setLoading(true);

    try {
      // Create empty plan for current week
      const weekKey = getWeekKey(currentWeekStart);
      const emptyPlan = {
        weeks: {
          [weekKey]: {
            week_schedule: {
              Sunday: { exercises: [] },
              Monday: { exercises: [] },
              Tuesday: { exercises: [] },
              Wednesday: { exercises: [] },
              Thursday: { exercises: [] },
              Friday: { exercises: [] },
              Saturday: { exercises: [] },
            }
          }
        }
      };

      // Deactivate existing plans
      await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Save new plan
      const { error: insertError } = await supabase
        .from('workout_plans')
        .insert([
          {
            user_id: user.id,
            plan_data: emptyPlan,
            is_active: true,
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      loadActivePlan();
    } catch (error: any) {
      console.error('Error creating plan:', error);
      Alert.alert("Error", error.message || "Failed to create workout plan.");
    } finally {
      setLoading(false);
    }
  };

  const generateWorkoutPlan = async () => {
    if (!userProfile) {
      Alert.alert("Error", "Please complete your profile setup first.");
      return;
    }

    if (!userProfile.age || !userProfile.goal || !userProfile.days_per_week) {
      Alert.alert("Missing Info", "Please complete your profile with age, goal, and days per week.");
      return;
    }

    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        setGenerating(false);
        return;
      }

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        Alert.alert("Error", "AI API key not configured.");
        setGenerating(false);
        return;
      }

      // Load available exercises from database
      const { data: masterExercises } = await supabase
        .from('exercises')
        .select('name, is_timed')
        .order('name', { ascending: true });

      const { data: userExercises } = await supabase
        .from('user_exercises')
        .select('name, is_timed')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      // Generate week_schedule via adaptive engine
      const { week_schedule } = await generateWeekScheduleWithAI({
        profile: userProfile,
        masterExercises: (masterExercises || []) as any,
        userExercises: (userExercises || []) as any,
        apiKey,
        durationTargetMin: durationTargetMin,
      });

      const planData = { week_schedule: ensureAllDays(week_schedule) };

      // Validate that days_per_week is respected
      const daysWithExercises = Object.keys(planData.week_schedule).filter(day => {
        const exercises = planData.week_schedule[day]?.exercises || [];
        return Array.isArray(exercises) && exercises.length > 0;
      });
      
      const daysPerWeek = userProfile.days_per_week || 3;
      if (daysWithExercises.length > daysPerWeek) {
        if (__DEV__) {
          console.warn(`Generated plan has ${daysWithExercises.length} workout days, but user wants ${daysPerWeek}. Removing excess days.`);
        }
        // Keep only the first N days with exercises
        const daysToKeep = daysWithExercises.slice(0, daysPerWeek);
        for (const day of Object.keys(planData.week_schedule)) {
          if (!daysToKeep.includes(day)) {
            planData.week_schedule[day].exercises = [];
          }
        }
      } else if (daysWithExercises.length < daysPerWeek) {
        if (__DEV__) {
          console.warn(`Generated plan has ${daysWithExercises.length} workout days, but user wants ${daysPerWeek}.`);
        }
      }

      // Validate week schedule
      const validationErrors = validateWeekSchedule(planData.week_schedule);
      if (validationErrors.length > 0) {
        if (__DEV__) {
          console.warn('Validation errors found:', validationErrors);
        }
        // Try to fix common issues: normalize exercises
        for (const day of Object.keys(planData.week_schedule)) {
          if (Array.isArray(planData.week_schedule[day].exercises)) {
            planData.week_schedule[day].exercises = planData.week_schedule[day].exercises.map((ex: any) => normalizeExercise(ex));
          }
        }
      }

      // Final validation after normalization
      const finalValidationErrors = validateWeekSchedule(planData.week_schedule);
      if (finalValidationErrors.length > 0 && __DEV__) {
        console.warn('Remaining validation errors after normalization:', finalValidationErrors);
      }

      // --- History-based progression: suggest weights for non-bodyweight exercises ---
      const exerciseNames = new Set<string>();
      for (const dayName of Object.keys(planData.week_schedule)) {
        const dayInfo = planData.week_schedule[dayName];
        const exercises = Array.isArray(dayInfo?.exercises) ? dayInfo.exercises : [];
        exercises.forEach((ex: any) => {
          if (ex?.name) {
            exerciseNames.add(ex.name);
          }
        });
      }

      let logsByExercise = new Map<string, WorkoutLogLike[]>();
      if (exerciseNames.size > 0) {
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('exercise_name, weight, reps, scheduled_weight, scheduled_reps, performed_at')
          .eq('user_id', user.id)
          .in('exercise_name', Array.from(exerciseNames));

        if (logs && Array.isArray(logs)) {
          logsByExercise = logs.reduce((map, log) => {
            const name = log.exercise_name;
            if (!name) return map;
            const list = map.get(name) || [];
            list.push(log as WorkoutLogLike);
            map.set(name, list);
            return map;
          }, new Map<string, WorkoutLogLike[]>());
        }
      }

      // Fetch PRs for all exercises
      const { data: userExercisesWithPR } = await supabase
        .from('user_exercises')
        .select('name, pr_weight, pr_reps')
        .eq('user_id', user.id)
        .in('name', Array.from(exerciseNames))
        .not('pr_weight', 'is', null);

      const prsByExercise = new Map<string, { weight: number; reps: number | null }>();
      if (userExercisesWithPR) {
        userExercisesWithPR.forEach((ue: any) => {
          if (ue.pr_weight && ue.pr_weight > 0) {
            prsByExercise.set(ue.name, {
              weight: ue.pr_weight,
              reps: ue.pr_reps || null,
            });
          }
        });
      }

      for (const dayName of Object.keys(planData.week_schedule)) {
        const dayInfo = planData.week_schedule[dayName];
        if (!dayInfo || !Array.isArray(dayInfo.exercises)) continue;

        dayInfo.exercises = dayInfo.exercises.map((ex: any) => {
          if (!ex?.name) return ex;

          const logs = logsByExercise.get(ex.name) || [];
          const metrics = computeExerciseHistoryMetrics(logs);
          const pr = prsByExercise.get(ex.name) || null;

          const suggestion = computeProgressionSuggestion({
            profile: userProfile,
            exercise: ex,
            metrics,
            personalRecord: pr,
          });

          if (suggestion.suggestedWeight != null && suggestion.suggestedWeight > 0 && Array.isArray(ex.sets)) {
            ex.sets = ex.sets.map((set: any) => {
              const currentWeight = set.weight;
              // Respect existing explicit weights and bodyweight (0); only fill blanks.
              if (
                currentWeight === null ||
                currentWeight === undefined ||
                Number.isNaN(currentWeight)
              ) {
                return { ...set, weight: suggestion.suggestedWeight };
              }
              return set;
            });
          }

          return ex;
        });
      }

      // Create plan for current week
      const weekKey = getWeekKey(currentWeekStart);
      const weekPlan = {
        duration_target_min: durationTargetMin, // Week-level duration target
        weeks: {
          [weekKey]: {
            week_schedule: planData.week_schedule
          }
        }
      };

      // Deactivate existing plans
      await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Save new plan
      const { error: insertError } = await supabase
        .from('workout_plans')
        .insert([
          {
            user_id: user.id,
            plan_data: weekPlan,
            is_active: true,
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      Alert.alert("Success", "Workout plan generated successfully!");
      loadActivePlan();
    } catch (error: any) {
      if (__DEV__) {
        console.error('Error generating plan:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      
      // If it's a model not found error, clear the cache to try a different model next time
      if (error.message && (error.message.includes('not found') || error.message.includes('404'))) {
        clearModelCache();
        if (__DEV__) {
          console.log('Cleared model cache due to model not found error');
        }
      }
      
      // Provide user-friendly error messages
      let errorMessage = "Failed to generate workout plan. Please try again.";
      if (error.message) {
        if (error.message.includes('parse') || error.message.includes('JSON')) {
          errorMessage = "The AI response was in an unexpected format. Please try generating again.";
        } else if (error.message.includes('structure') || error.message.includes('week_schedule')) {
          errorMessage = "The generated plan structure was invalid. Please try generating again.";
        } else if (error.message.includes('not found') || error.message.includes('404')) {
          errorMessage = "The AI model is not available. Please try again in a moment.";
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const getWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getWeekKey = (weekStart: Date): string => {
    const year = weekStart.getFullYear();
    const month = String(weekStart.getMonth() + 1).padStart(2, '0');
    const day = String(weekStart.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayData = (date: Date) => {
    if (!activePlan?.plan_data) {
      return { exercises: [] };
    }
    
    const weekKey = getWeekKey(currentWeekStart);
    const dayName = DAYS_OF_WEEK[date.getDay()];
    
    // Only use week-specific data (no template fallback)
    if (activePlan.plan_data.weeks?.[weekKey]?.week_schedule?.[dayName]) {
      return activePlan.plan_data.weeks[weekKey].week_schedule[dayName];
    }
    
    return { exercises: [] };
  };

  const estimateDayDuration = (exercises: any[]): number => {
    if (!Array.isArray(exercises) || exercises.length === 0) return 0;
    let total = 0;

    exercises.forEach((ex: any, idx: number) => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      const isTimed = sets.some((s: any) => s.duration != null);

      if (isTimed) {
        // For timed exercises, sum all durations and add rest only between exercises (not after each set)
        // Rest time for timed exercises is typically minimal or between exercises
        let exerciseDuration = 0;
        sets.forEach((s: any) => {
          const duration = typeof s.duration === 'number' ? s.duration : 0;
          exerciseDuration += duration;
        });
        // Add rest only once per exercise (between exercises), not per set
        const restBetweenExercises = typeof ex.rest_time_sec === 'number' ? ex.rest_time_sec : 30;
        total += exerciseDuration + restBetweenExercises;
      } else {
        const targetSets =
          typeof ex.target_sets === 'number' && ex.target_sets > 0
            ? ex.target_sets
            : sets.length > 0
            ? sets.length
            : 3;
        const targetReps =
          typeof ex.target_reps === 'number'
            ? ex.target_reps
            : typeof sets[0]?.reps === 'number'
            ? sets[0].reps
            : 8;

        const estimation = estimateExerciseDuration({
          targetSets,
          targetReps,
          movementPattern: ex.movement_pattern || null,
          tempoCategory: ex.tempo_category || null,
          setupBufferSec: ex.setup_buffer_sec || null,
          isUnilateral: ex.is_unilateral || false,
          positionIndex: idx,
        });

        const restPerSet =
          typeof ex.rest_time_sec === 'number'
            ? ex.rest_time_sec
            : typeof sets[0]?.rest_time_sec === 'number'
            ? sets[0].rest_time_sec
            : 60;

        total += estimation.estimatedDurationSec + restPerSet * targetSets;
      }
    });

    return total;
  };

  const getCurrentWeekStart = (): Date => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const isWeekInPast = (weekStart: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    // Only consider a week "in the past" if it has completely ended (weekEnd < today)
    return weekEnd < today;
  };

  const canNavigatePrev = (): boolean => {
    const prevWeek = new Date(currentWeekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    // Allow going back to any week that hasn't completely ended
    // This includes the current week and all future weeks
    return !isWeekInPast(prevWeek);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    
    // Prevent navigating to past weeks (weeks that have completely ended)
    if (direction === 'prev') {
      const prevWeek = new Date(newDate);
      if (isWeekInPast(prevWeek)) {
        return;
      }
    }
    
    setCurrentWeekStart(newDate);
  };

  const handleDayPress = (date: Date) => {
    const dayName = DAYS_OF_WEEK[date.getDay()];
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    router.push({
      pathname: '/planner-day',
      params: { 
        day: dayName,
        planId: activePlan.id.toString(),
        date: dateString,
        weekStart: getWeekKey(currentWeekStart)
      }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isLoadingPlan ? (
        <PlannerSkeleton />
      ) : !activePlan ? (
        <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Workout Planner</Text>
            <Text style={styles.subtitle}>Create or generate your personalized weekly workout plan</Text>

            {userProfile && (
              <View style={styles.preferenceCard}>
                <Text style={styles.preferenceTitle}>AI Workout Style</Text>
                <Text style={styles.preferenceText}>
                  {userProfile.preferred_training_style || 'Comprehensive'} ·{' '}
                  {(() => {
                    const comps = userProfile.include_components || {};
                    const parts: string[] = [];
                    if (comps.include_tier1_compounds) parts.push('Tier 1');
                    if (comps.include_tier2_accessories) parts.push('Tier 2');
                    if (comps.include_tier3_prehab_mobility) parts.push('Mobility');
                    if (comps.include_cardio_conditioning) parts.push('Cardio');
                    return parts.length ? parts.join(' · ') : 'No components selected';
                  })()}
                </Text>
              </View>
            )}

            <View style={styles.durationTargetCard}>
              <Text style={styles.durationTargetLabel}>Target workout duration</Text>
              <View style={styles.durationChipsRow}>
                {[30, 45, 60, 75].map((min) => (
                  <TouchableOpacity
                    key={min}
                    style={[
                      styles.durationChip,
                      durationTargetMin === min && styles.durationChipActive,
                    ]}
                    onPress={() => setDurationTargetMin(min)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        durationTargetMin === min && styles.durationChipTextActive,
                      ]}
                    >
                      {min}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
                onPress={createEmptyPlan}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Create Workout Plan</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.buttonSecondary, generating && styles.buttonDisabled]}
                onPress={generateWorkoutPlan}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color="#60a5fa" />
                ) : (
                  <Text style={styles.buttonTextSecondary}>Generate</Text>
                )}
              </TouchableOpacity>

              <View style={styles.helperTextContainer}>
                <Text style={styles.helperText}>Don't know where to start?</Text>
                <Text style={styles.helperText}>Let us help!</Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.title}>Weekly Plan</Text>
          </View>
          
          <View style={styles.weekHeader}>
            <TouchableOpacity 
              onPress={() => navigateWeek('prev')} 
              style={styles.navButton}
              disabled={!canNavigatePrev()}
            >
              <ChevronLeft 
                color={canNavigatePrev() ? '#a3e635' : '#3f3f46'} 
                size={24} 
              />
            </TouchableOpacity>
            <View style={styles.weekTitleContainer}>
              <Text style={styles.weekTitle}>
                {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
                {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <Text style={styles.weekSubtitle}>{currentWeekStart.getFullYear()}</Text>
            </View>
            <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
              <ChevronRight color="#a3e635" size={24} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={getWeekDays()}
            keyExtractor={(item, index) => `${item.getTime()}-${index}`}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item: date, index }) => {
              const dayData = getDayData(date);
              const exerciseCount = dayData.exercises?.length || 0;
              const dayName = DAYS_OF_WEEK[date.getDay()];
              const isToday = date.toDateString() === new Date().toDateString();
              const estimatedMin = exerciseCount > 0 ? Math.round(estimateDayDuration(dayData.exercises || []) / 60) : 0;
              
              return (
                <Animated.View entering={FadeIn.duration(400).delay(index * 50)}>
                  <TouchableOpacity
                    style={[styles.dayCard, isToday && styles.dayCardToday]}
                    onPress={() => handleDayPress(date)}
                  >
                    <View style={styles.dayCardHeader}>
                      <View>
                        <Text style={styles.dayName}>{dayName}</Text>
                        <Text style={styles.dayDate}>
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      {isToday && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>Today</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.dayCardContent}>
                      <Text style={styles.dayFocus}>
                        {exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}` : "Rest"}
                      </Text>
                      {estimatedMin > 0 && (
                        <Text style={styles.dayDurationEstimate}>~{estimatedMin} min</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' }, // zinc-950
  contentContainer: { padding: 24, paddingTop: 48, paddingBottom: 120 },
  listContainer: { padding: 24, paddingTop: 16, paddingBottom: 120 },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
    backgroundColor: '#09090b', // zinc-950
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#a3e635', // lime-400
    marginBottom: 16,
  },
  subtitle: { color: '#a1a1aa', textAlign: 'center', marginBottom: 32, fontSize: 14 }, // zinc-400
  preferenceCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  preferenceTitle: {
    color: '#a1a1aa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  preferenceText: {
    color: '#ffffff',
    fontSize: 14,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  navButton: {
    padding: 8,
  },
  weekTitleContainer: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.5,
  },
  weekSubtitle: {
    fontSize: 12,
    color: '#a1a1aa', // zinc-400
    marginTop: 2,
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  buttonColumn: { gap: 12, marginBottom: 16 },
  buttonHalf: { flex: 1 },
  helperTextContainer: { marginTop: 8, alignItems: 'center' },
  helperText: { color: '#71717a', fontSize: 11, textAlign: 'center', marginBottom: 4, letterSpacing: 0.5 }, // zinc-500
  dayCard: { 
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 24, 
    borderRadius: 24, // rounded-3xl
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#27272a' // zinc-800
  },
  dayCardToday: {
    borderColor: '#a3e635', // lime-400
    borderWidth: 2,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dayName: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  dayDate: { color: '#a1a1aa', fontSize: 14, letterSpacing: 0.5 }, // zinc-400
  dayCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dayFocus: { color: '#a1a1aa', fontSize: 14, letterSpacing: 0.5 }, // zinc-400
  dayDurationEstimate: { color: '#71717a', fontSize: 12, letterSpacing: 0.5 }, // zinc-500
  todayBadge: {
    backgroundColor: '#a3e635', // lime-400
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    color: '#09090b', // zinc-950
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonPrimary: { 
    backgroundColor: '#a3e635', // lime-400
    padding: 18, 
    borderRadius: 24, // rounded-3xl
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: 56, 
    flexDirection: 'row' 
  },
  buttonDisabled: { backgroundColor: '#71717a', opacity: 0.6 }, // zinc-500
  buttonSecondary: { 
    borderWidth: 1, 
    borderColor: '#a3e635', // lime-400
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
    padding: 18, 
    borderRadius: 24, // rounded-3xl
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: 56 
  },
  buttonText: { color: '#09090b', textAlign: 'center', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }, // zinc-950
  buttonTextSecondary: { color: '#a3e635', textAlign: 'center', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }, // lime-400
  durationTargetCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  durationTargetLabel: {
    color: '#a1a1aa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  durationChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: 'transparent',
  },
  durationChipActive: {
    borderColor: '#a3e635',
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  durationChipText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },
  durationChipTextActive: {
    color: '#a3e635',
  },
});

