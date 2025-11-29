import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PlannerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    loadActivePlan();
    loadUserProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivePlan();
    }, [])
  );

  const loadActivePlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
  };

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
    <SafeAreaView style={styles.container}>
      {!activePlan ? (
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
  container: { flex: 1, backgroundColor: '#111827' },
  contentContainer: { padding: 24, paddingTop: 60 },
  listContainer: { padding: 24, paddingTop: 60 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#9ca3af', textAlign: 'center', marginBottom: 32 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  buttonHalf: { flex: 1 },
  helperText: { color: '#9ca3af', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  dayCard: { backgroundColor: '#1f2937', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#374151' },
  dayName: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  dayFocus: { color: '#9ca3af', fontSize: 14 },
  buttonPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52, flexDirection: 'row' },
  buttonDisabled: { backgroundColor: '#1e40af', opacity: 0.7 },
  buttonSecondary: { borderWidth: 1, borderColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
  buttonTextSecondary: { color: '#60a5fa', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
});

