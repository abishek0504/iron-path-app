import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { 
  FadeIn
} from 'react-native-reanimated';
import { Play, Dumbbell, Timer } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { HomeScreenSkeleton } from '../../src/components/skeletons/HomeScreenSkeleton';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HomeScreen() {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [currentDay, setCurrentDay] = useState<string>('');
  const [hasActiveWorkout, setHasActiveWorkout] = useState<boolean>(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(false);

  useEffect(() => {
    const dayIndex = new Date().getDay();
    setCurrentDay(DAYS_OF_WEEK[dayIndex]);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const check = async () => {
      // Only show loading on initial load
      if (!hasInitiallyLoaded) {
        setIsLoading(true);
      }
      
      // Load plan first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted) {
          setHasActiveWorkout(false);
          setIsLoading(false);
          setHasInitiallyLoaded(true);
        }
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (planError && planError.code !== 'PGRST116') {
        console.error('Error loading plan:', planError);
        if (isMounted) {
          setHasActiveWorkout(false);
          setIsLoading(false);
          setHasInitiallyLoaded(true);
        }
        return;
      }

      if (planData && isMounted) {
        setActivePlan(planData);
        
        // Check for active workout session
        if (currentDay) {
          const { data: activeSession, error: activeSessionError } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', planData.id)
            .eq('day', currentDay)
            .eq('status', 'active')
            .maybeSingle();
          
          // Check for completed workout session
          const { data: completedSession, error: completedSessionError } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', planData.id)
            .eq('day', currentDay)
            .eq('status', 'completed')
            .maybeSingle();
          
          // Only set based on data existence, ignore acceptable errors
          if (activeSessionError && activeSessionError.code !== 'PGRST116' && !activeSessionError.message?.includes('schema cache')) {
            console.error('Error checking active workout:', activeSessionError);
          }
          if (completedSessionError && completedSessionError.code !== 'PGRST116' && !completedSessionError.message?.includes('schema cache')) {
            console.error('Error checking completed workout:', completedSessionError);
          }
          
          // Set states based on whether data exists
          if (isMounted) {
            setHasActiveWorkout(!!activeSession);
            setIsWorkoutCompleted(!!completedSession && !activeSession);
            setIsLoading(false);
            setHasInitiallyLoaded(true);
          }
        } else {
          if (isMounted) {
            setHasActiveWorkout(false);
            setIsWorkoutCompleted(false);
            setIsLoading(false);
            setHasInitiallyLoaded(true);
          }
        }
      } else if (isMounted) {
        setActivePlan(null);
        setHasActiveWorkout(false);
        setIsWorkoutCompleted(false);
        setIsLoading(false);
        setHasInitiallyLoaded(true);
      }
    };
    
    check();
    
    return () => {
      isMounted = false;
    };
  }, [currentDay, hasInitiallyLoaded]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh data on focus, don't show loading if we already have data
      if (hasInitiallyLoaded && activePlan && currentDay) {
        const refresh = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: activeSession } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', activePlan.id)
            .eq('day', currentDay)
            .eq('status', 'active')
            .maybeSingle();
          
          const { data: completedSession } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', activePlan.id)
            .eq('day', currentDay)
            .eq('status', 'completed')
            .maybeSingle();
          
          setHasActiveWorkout(!!activeSession);
          setIsWorkoutCompleted(!!completedSession && !activeSession);
        };
        refresh();
      }
    }, [activePlan, currentDay, hasInitiallyLoaded])
  );

  useEffect(() => {
    if (activePlan && currentDay) {
      const schedule = activePlan.plan_data?.week_schedule;
      if (schedule && schedule[currentDay]) {
        setTodayData(schedule[currentDay]);
      } else {
        setTodayData({ exercises: [] });
      }
    }
  }, [activePlan, currentDay]);

  // Removed duplicate checkActiveWorkout useEffect - handled in useFocusEffect


  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      // Still try to navigate even if signOut fails
      router.replace('/login');
    }
  };

  const handleStartWorkout = () => {
    if (!activePlan || !currentDay) return;
    // Navigate to workout execution (to be implemented)
    router.push({
      pathname: '/workout-active',
      params: { day: currentDay, planId: activePlan.id.toString() }
    });
  };

  const isRestDay = !todayData?.exercises || todayData.exercises.length === 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  if (isLoading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background Ambient Glows */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          entering={FadeIn.duration(400)}
          style={styles.header}
        >
          <View>
            <Text style={styles.greetingText}>
              {getGreeting()}
            </Text>
            <Text style={styles.titleText}>
              {currentDay ? `Ready to Crush It?` : 'Loading...'}
            </Text>
          </View>
        </Animated.View>

        {!activePlan ? (
          <Animated.View 
            entering={FadeIn.duration(400).delay(50)}
            style={styles.card}
          >
            <View style={styles.iconContainer}>
              <Dumbbell size={48} color="#71717a" />
            </View>
            <Text style={styles.cardTitle}>No Active Workout Plan</Text>
            <Text style={styles.cardSubtext}>
              Create a plan in the Planner tab to get started!
            </Text>
          </Animated.View>
        ) : isRestDay ? (
          <Animated.View 
            entering={FadeIn.duration(400).delay(50)}
            style={styles.card}
          >
            <View style={styles.restDayIconContainer}>
              <Timer size={40} color="#22d3ee" />
            </View>
            <Text style={styles.restDayTitle}>Rest Day</Text>
            <Text style={styles.restDayText}>Take it easy!</Text>
            <Text style={styles.cardSubtext}>
              Not the plan? Check the Planner tab!
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Hero Workout Card */}
            <Animated.View 
              entering={FadeIn.duration(400).delay(50)}
              style={styles.workoutCard}
            >
              <View style={styles.workoutCardContent}>
                <View style={styles.badgeContainer}>
                  <View style={styles.badgePrimary}>
                    <Text style={styles.badgePrimaryText}>
                      Active Plan
                    </Text>
                  </View>
                  <View style={styles.badgeSecondary}>
                    <Text style={styles.badgeSecondaryText}>
                      {todayData?.exercises?.length || 0} Exercises
                    </Text>
                  </View>
                </View>

                <Text style={styles.workoutTitle}>
                  Today's Workout
                </Text>
                <Text style={styles.workoutSubtitle}>
                  {currentDay} • {todayData?.exercises?.length || 0} exercise{todayData?.exercises?.length !== 1 ? 's' : ''} scheduled
                </Text>

                {todayData?.exercises && todayData.exercises.length > 0 && (
                  <View style={styles.exercisesContainer}>
                    {todayData.exercises.slice(0, 3).map((exercise: any, index: number) => (
                      <Animated.View
                        key={index}
                        entering={FadeIn.duration(300).delay(100 + index * 50)}
                        style={styles.exerciseItem}
                      >
                        <View style={styles.exerciseIcon}>
                          <Dumbbell size={12} color="#a3e635" />
                        </View>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                      </Animated.View>
                    ))}
                    {todayData.exercises.length > 3 && (
                      <Animated.View
                        entering={FadeIn.duration(300).delay(250)}
                        style={styles.exerciseItem}
                      >
                        <View style={styles.exerciseIconPlaceholder} />
                        <Text style={styles.moreExercisesText}>
                          +{todayData.exercises.length - 3} more exercises
                        </Text>
                      </Animated.View>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Start Workout Button */}
            <Animated.View
              entering={FadeIn.duration(400).delay(150)}
            >
              <Pressable
                style={[
                  styles.startButton,
                  isWorkoutCompleted && styles.startButtonCompleted
                ]}
                onPress={handleStartWorkout}
                disabled={isWorkoutCompleted}
              >
              {!isWorkoutCompleted && (
                <Play size={20} fill="#09090b" color="#09090b" />
              )}
              <Text style={[
                styles.startButtonText,
                isWorkoutCompleted && styles.startButtonTextCompleted
              ]}>
                {isWorkoutCompleted 
                  ? 'Workout Completed' 
                  : hasActiveWorkout 
                    ? 'Continue Workout' 
                    : 'Start Workout'}
              </Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    marginTop: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 500,
    height: 500,
    backgroundColor: '#84cc16', // lime-500
    opacity: 0.1,
    borderRadius: 250,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 400,
    height: 400,
    backgroundColor: '#06b6d4', // cyan-500
    opacity: 0.1,
    borderRadius: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  greetingText: {
    color: '#a1a1aa', // zinc-400
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  logoutButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#18181b', // zinc-900
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    borderRadius: 24, // rounded-3xl
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardSubtext: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  restDayIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.1)', // cyan-500/10
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  restDayTitle: {
    color: '#22d3ee', // cyan-400
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  restDayText: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 8,
  },
  workoutCard: {
    width: '100%',
    borderRadius: 24, // rounded-3xl
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(39, 39, 42, 0.5)', // zinc-800/50
  },
  workoutCardContent: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 32,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  badgePrimary: {
    backgroundColor: 'rgba(163, 230, 53, 0.2)', // lime-400/20
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.2)', // lime-400/20
  },
  badgePrimaryText: {
    color: '#a3e635', // lime-400
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  badgeSecondary: {
    backgroundColor: 'rgba(39, 39, 42, 0.4)', // zinc-800/40
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(63, 63, 70, 0.3)', // zinc-700/30
  },
  badgeSecondaryText: {
    color: '#d4d4d8', // zinc-300
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 32,
    marginBottom: 8,
  },
  workoutSubtitle: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  exercisesContainer: {
    marginBottom: 24,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(163, 230, 53, 0.2)', // lime-400/20
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#27272a', // zinc-800
    marginRight: 12,
  },
  exerciseName: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  moreExercisesText: {
    color: '#a3e635', // lime-400
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
    width: '100%',
    height: 56,
    borderRadius: 24, // rounded-3xl
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#a3e635', // lime-400
  },
  startButtonCompleted: {
    backgroundColor: 'rgba(39, 39, 42, 0.5)', // zinc-800/50
    borderWidth: 1,
    borderColor: 'rgba(63, 63, 70, 0.3)', // zinc-700/30
  },
  startButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  startButtonTextCompleted: {
    color: '#71717a', // zinc-500
  },
});
