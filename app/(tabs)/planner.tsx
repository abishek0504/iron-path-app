import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PlannerSkeleton } from '../../src/components/skeletons/PlannerSkeleton';

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
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `Generate a weekly workout plan in JSON format for a ${userProfile.age}-year-old ${userProfile.gender || 'person'} who weighs ${userProfile.current_weight || 'N/A'} lbs, is ${userProfile.height || 'N/A'} cm tall, with a goal of ${userProfile.goal}, training ${userProfile.days_per_week} days per week, with access to: ${userProfile.equipment_access?.join(', ') || 'Gym'}.

The response must be STRICTLY valid JSON in this exact format:
{
  "week_schedule": {
    "Monday": {
      "exercises": [
        {
          "name": "Bench Press",
          "target_sets": 3,
          "target_reps": 10,
          "rest_time_sec": 90,
          "notes": "Keep elbows tucked and squeeze scapula at top"
        }
      ]
    },
    "Tuesday": {
      "exercises": [...]
    }
  }
}

Include all 7 days (Monday through Sunday). Days with no workout should have an empty exercises array. Use exercises from common gym exercises like Bench Press, Squat, Deadlift, Overhead Press, Barbell Row, Pull Up, etc. Include technique tips and focus points in the "notes" field for each exercise.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response (handle markdown code blocks if present)
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const planData = JSON.parse(jsonText);

      // Validate structure
      if (!planData.week_schedule) {
        throw new Error('Invalid plan structure');
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
      console.error('Error generating plan:', error);
      Alert.alert("Error", error.message || "Failed to generate workout plan. Please try again.");
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

