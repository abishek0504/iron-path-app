import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HomeScreen() {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [currentDay, setCurrentDay] = useState<string>('');

  useEffect(() => {
    const dayIndex = new Date().getDay();
    setCurrentDay(DAYS_OF_WEEK[dayIndex]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivePlan();
    }, [])
  );

  useEffect(() => {
    if (activePlan && currentDay) {
      const schedule = activePlan.plan_data?.week_schedule;
      if (schedule && schedule[currentDay]) {
        setTodayData(schedule[currentDay]);
      } else {
        setTodayData({ focus: "Rest", exercises: [] });
      }
    }
  }, [activePlan, currentDay]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleStartWorkout = () => {
    if (!activePlan || !currentDay) return;
    // Navigate to workout execution (to be implemented)
    router.push({
      pathname: '/workout-active',
      params: { day: currentDay, planId: activePlan.id.toString() }
    });
  };

  const isRestDay = !todayData?.exercises || todayData.exercises.length === 0 || todayData.focus === "Rest";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>{currentDay}</Text>
          <TouchableOpacity onPress={handleLogout}>
            <LogOut color="#ef4444" size={24} />
          </TouchableOpacity>
        </View>

        {!activePlan ? (
          <View style={styles.noPlanCard}>
            <Text style={styles.noPlanText}>No active workout plan</Text>
            <Text style={styles.noPlanSubtext}>
              Create a plan in the Planner tab to get started!
            </Text>
          </View>
        ) : isRestDay ? (
          <View style={styles.restDayCard}>
            <Text style={styles.restDayTitle}>Rest Day</Text>
            <Text style={styles.restDayText}>Take it easy!</Text>
            <Text style={styles.restDaySubtext}>Not the plan? Check the Planner tab!</Text>
          </View>
        ) : (
          <>
            <View style={styles.workoutCard}>
              <Text style={styles.focusText}>{todayData?.focus || "Workout"}</Text>
              <Text style={styles.exerciseCount}>
                {todayData?.exercises?.length || 0} exercise{todayData?.exercises?.length !== 1 ? 's' : ''}
              </Text>
              
              {todayData?.exercises && todayData.exercises.length > 0 && (
                <View style={styles.exercisesList}>
                  {todayData.exercises.slice(0, 3).map((exercise: any, index: number) => (
                    <Text key={index} style={styles.exerciseItem}>
                      • {exercise.name}
                    </Text>
                  ))}
                  {todayData.exercises.length > 3 && (
                    <Text style={styles.moreExercises}>
                      +{todayData.exercises.length - 3} more
                    </Text>
                  )}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartWorkout}
            >
              <Text style={styles.startButtonText}>Start Workout</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  contentContainer: { padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6' },
  noPlanCard: { backgroundColor: '#1f2937', padding: 24, borderRadius: 8, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
  noPlanText: { color: '#9ca3af', fontSize: 18, marginBottom: 8 },
  noPlanSubtext: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
  restDayCard: { backgroundColor: '#1f2937', padding: 32, borderRadius: 8, borderWidth: 1, borderColor: '#374151', alignItems: 'center' },
  restDayTitle: { color: '#3b82f6', fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  restDayText: { color: 'white', fontSize: 20, marginBottom: 16 },
  restDaySubtext: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  workoutCard: { backgroundColor: '#1f2937', padding: 24, borderRadius: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 24 },
  focusText: { color: '#3b82f6', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  exerciseCount: { color: '#9ca3af', fontSize: 16, marginBottom: 16 },
  exercisesList: { marginTop: 8 },
  exerciseItem: { color: 'white', fontSize: 16, marginBottom: 8 },
  moreExercises: { color: '#9ca3af', fontSize: 14, marginTop: 4 },
  startButton: { backgroundColor: '#2563eb', padding: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  startButtonText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
});