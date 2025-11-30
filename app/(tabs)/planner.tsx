import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PlannerSkeleton } from '../../src/components/skeletons/PlannerSkeleton';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PlannerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(false);

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
    loadActivePlan();
    loadUserProfile();
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
      // Create empty week schedule
      const emptyPlan = {
        week_schedule: {
          Sunday: { exercises: [] },
          Monday: { exercises: [] },
          Tuesday: { exercises: [] },
          Wednesday: { exercises: [] },
          Thursday: { exercises: [] },
          Friday: { exercises: [] },
          Saturday: { exercises: [] },
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
            plan_data: planData,
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

  const getDayData = (dayName: string) => {
    if (!activePlan?.plan_data?.week_schedule) {
      return { exercises: [] };
    }
    return activePlan.plan_data.week_schedule[dayName] || { exercises: [] };
  };

  const handleDayPress = (dayName: string) => {
    router.push({
      pathname: '/planner-day',
      params: { 
        day: dayName,
        planId: activePlan.id.toString()
      }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isLoadingPlan ? (
        <PlannerSkeleton />
      ) : !activePlan ? (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <Text style={styles.title}>Workout Planner</Text>
          <Text style={styles.subtitle}>Create or generate your personalized weekly workout plan</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.buttonPrimary, styles.buttonHalf, loading && styles.buttonDisabled]}
              onPress={createEmptyPlan}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Create Workout Plan</Text>
              )}
            </TouchableOpacity>

            <View style={styles.buttonHalf}>
              <Text style={styles.helperText}>Don't know where to start?</Text>
              <Text style={styles.helperText}>Let us help!</Text>
              <TouchableOpacity
                style={[styles.buttonSecondary, styles.buttonHalf, generating && styles.buttonDisabled]}
                onPress={generateWorkoutPlan}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color="#60a5fa" />
                ) : (
                  <Text style={styles.buttonTextSecondary}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={DAYS_OF_WEEK}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.listContainer}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Weekly Plan</Text>
              <Text style={styles.subtitle}>Tap a day to edit</Text>
            </View>
          }
          renderItem={({ item: dayName }) => {
            const dayData = getDayData(dayName);
            const exerciseCount = dayData.exercises?.length || 0;
            return (
              <TouchableOpacity
                style={styles.dayCard}
                onPress={() => handleDayPress(dayName)}
              >
                <Text style={styles.dayName}>{dayName}</Text>
                <Text style={styles.dayFocus}>
                  {exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}` : "Rest"}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' }, // zinc-950
  contentContainer: { padding: 24, paddingTop: 48, paddingBottom: 120 },
  listContainer: { padding: 24, paddingTop: 48, paddingBottom: 120 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { color: '#a1a1aa', textAlign: 'center', marginBottom: 32, fontSize: 14 }, // zinc-400
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  buttonHalf: { flex: 1 },
  helperText: { color: '#71717a', fontSize: 11, textAlign: 'center', marginBottom: 4, letterSpacing: 0.5 }, // zinc-500
  dayCard: { 
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 24, 
    borderRadius: 24, // rounded-3xl
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#27272a' // zinc-800
  },
  dayName: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  dayFocus: { color: '#a1a1aa', fontSize: 14, letterSpacing: 0.5 }, // zinc-400
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

