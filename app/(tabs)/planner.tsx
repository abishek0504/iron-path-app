import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PlannerSkeleton } from '../../src/components/skeletons/PlannerSkeleton';
import { buildFullPlanPrompt } from '../../src/lib/aiPrompts';
import { extractJSON, JSONParseError } from '../../src/lib/jsonParser';
import { ensureAllDays, validateWeekSchedule, normalizeExercise } from '../../src/lib/workoutValidation';
import { getCachedModel, clearModelCache } from '../../src/lib/geminiModels';

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

  const loadActivePlan = useCallback(async () => {
    // Only show loading on initial load
    if (!hasInitiallyLoaded) {
      setIsLoadingPlan(true);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoadingPlan(false);
      setHasInitiallyLoaded(true);
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
    }
    
    setIsLoadingPlan(false);
    setHasInitiallyLoaded(true);
  }, [hasInitiallyLoaded]);

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
      loadActivePlan();
      loadUserProfile();
    }
  }, [loadActivePlan]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh if we've already loaded initially
      if (hasInitiallyLoaded) {
        loadActivePlan();
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

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Get the best available model dynamically
      const modelName = await getCachedModel(apiKey);
      if (__DEV__) {
        console.log('Using Gemini model:', modelName);
      }
      
      const model = genAI.getGenerativeModel({ model: modelName });

      // Load available exercises from database
      const { data: masterExercises } = await supabase
        .from('exercises')
        .select('name')
        .order('name', { ascending: true });

      const { data: userExercises } = await supabase
        .from('user_exercises')
        .select('name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      const availableExerciseNames = [
        ...(masterExercises || []).map((ex: any) => ex.name),
        ...(userExercises || []).map((ex: any) => ex.name)
      ].filter(Boolean);

      // Build comprehensive prompt using all profile data and available exercises
      const prompt = buildFullPlanPrompt(userProfile, availableExerciseNames);

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON using robust parser
      let planData;
      try {
        planData = extractJSON(text);
      } catch (error: any) {
        if (error instanceof JSONParseError) {
          if (__DEV__) {
            console.error('JSON extraction failed:', error.message);
            console.error('Original response:', error.originalText);
          }
          throw new Error('Failed to parse AI response. The response format was unexpected. Please try again.');
        }
        throw error;
      }

      // Validate structure
      if (!planData || typeof planData !== 'object' || !planData.week_schedule) {
        throw new Error('Invalid plan structure: week_schedule is missing');
      }

      // Ensure all 7 days exist
      planData.week_schedule = ensureAllDays(planData.week_schedule);

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

      // Convert exercises to format with sets array (matching manual exercise format)
      for (const day of Object.keys(planData.week_schedule)) {
        if (Array.isArray(planData.week_schedule[day].exercises)) {
          planData.week_schedule[day].exercises = planData.week_schedule[day].exercises.map((ex: any) => {
            const converted = { ...ex };
            
            // Ensure target_reps is a number (not string)
            if (typeof converted.target_reps === 'string') {
              // Try to parse string like "8-12" to a number (take first number)
              const match = converted.target_reps.match(/\d+/);
              converted.target_reps = match ? parseInt(match[0], 10) : 10;
            }
            
            // Create sets array matching manual format
            const numSets = converted.target_sets || 3;
            const targetReps = converted.target_reps || 10;
            const restTime = converted.rest_time_sec || 60;
            
            // Check if exercise is bodyweight or timed
            const exerciseName = (converted.name || '').toLowerCase();
            const isBodyweight = [
              'pull up', 'pull-up', 'pullup', 'chin up', 'chin-up',
              'push up', 'push-up', 'pushup',
              'dip', 'dips', 'sit up', 'sit-up', 'situp',
              'crunch', 'crunches', 'plank', 'planks',
              'burpee', 'burpees', 'mountain climber', 'mountain climbers',
              'bodyweight squat', 'air squat', 'lunge', 'lunges',
              'jumping jack', 'jumping jacks', 'pistol squat',
              'handstand push up', 'handstand push-up', 'muscle up', 'muscle-up'
            ].some(bw => exerciseName.includes(bw));
            
            // Check if it's a timed exercise from database
            const isTimed = availableExerciseNames.some(name => {
              const dbName = name.toLowerCase();
              return dbName === exerciseName && (
                dbName.includes('plank') || dbName.includes('hold') || 
                dbName.includes('time') || dbName.includes('duration')
              );
            });
            
            if (isTimed && converted.target_duration_sec) {
              converted.sets = Array.from({ length: numSets }, (_, i) => ({
                index: i + 1,
                duration: converted.target_duration_sec,
                rest_time_sec: restTime
              }));
            } else {
              converted.sets = Array.from({ length: numSets }, (_, i) => ({
                index: i + 1,
                reps: targetReps,
                weight: isBodyweight ? 0 : null,
                rest_time_sec: restTime
              }));
            }
            
            return converted;
          });
        }
      }

      // Create plan for current week
      const weekKey = getWeekKey(currentWeekStart);
      const weekPlan = {
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
                    <Text style={styles.dayFocus}>
                      {exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}` : "Rest"}
                    </Text>
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
  dayFocus: { color: '#a1a1aa', fontSize: 14, letterSpacing: 0.5 }, // zinc-400
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
});

