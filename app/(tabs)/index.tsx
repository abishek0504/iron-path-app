import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { 
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Circle, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Play, Dumbbell, Timer, RotateCcw } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { HomeScreenSkeleton } from '../../src/components/skeletons/HomeScreenSkeleton';
import { Toast } from '../../src/components/Toast';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Circular Button with Ripple Effect Component
const CircularButton = ({ 
  onPress, 
  disabled, 
  text, 
  isCompleted 
}: { 
  onPress: () => void; 
  disabled: boolean; 
  text: string; 
  isCompleted: boolean;
}) => {
  const ripple = useSharedValue(0);

  useEffect(() => {
    if (isCompleted || disabled) return;

    // Single ripple animation that repeats every 5 seconds
    const startRipple = () => {
      ripple.value = 0;
      ripple.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: 3000,
            easing: Easing.out(Easing.ease),
          }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    };

    startRipple();
    const interval = setInterval(startRipple, 5000); // Restart every 5 seconds

    return () => {
      clearInterval(interval);
      ripple.value = 0;
    };
  }, [isCompleted, disabled, ripple]);

  const rippleStyle = useAnimatedStyle(() => {
    const scale = interpolate(ripple.value, [0, 1], [1, 1.8]);
    const opacity = interpolate(ripple.value, [0, 0.5, 1], [0.6, 0.3, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={styles.circularButtonContainer}>
      {/* Ripple ring */}
      {!isCompleted && !disabled && (
        <Animated.View style={[styles.rippleRing, rippleStyle]}>
          <Svg width={160} height={160} style={styles.rippleSvg}>
            <Defs>
              <LinearGradient id="rippleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <Stop offset="50%" stopColor="#22d3ee" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#a3e635" stopOpacity="0.6" />
              </LinearGradient>
            </Defs>
            <Circle cx="80" cy="80" r="79" fill="none" stroke="url(#rippleGradient)" strokeWidth="2" />
          </Svg>
        </Animated.View>
      )}
      
      {/* Main button with gradient border */}
      <View style={styles.circularButtonWrapper}>
        {!isCompleted && (
          <Svg width={164} height={164} style={styles.gradientBorderSvg}>
            <Defs>
              <LinearGradient id="buttonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
                <Stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
                <Stop offset="100%" stopColor="#a3e635" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Circle cx="82" cy="82" r="80" fill="none" stroke="url(#buttonGradient)" strokeWidth="2" />
          </Svg>
        )}
        <Pressable
          style={[
            styles.circularButton,
            isCompleted && styles.circularButtonCompleted
          ]}
          onPress={onPress}
          disabled={disabled}
        >
          <View style={[
            styles.circularButtonInner,
            isCompleted && styles.circularButtonInnerCompleted
          ]}>
            {!isCompleted ? (
              <Text style={styles.circularButtonText}>{text}</Text>
            ) : (
              <Text style={styles.circularButtonTextCompleted}>✓</Text>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayData, setTodayData] = useState<any>(null);
  const [currentDay, setCurrentDay] = useState<string>('');
  const [hasActiveWorkout, setHasActiveWorkout] = useState<boolean>(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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
          // Query by date range to ensure we get sessions from the current week only
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const { data: activeSession, error: activeSessionError } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', planData.id)
            .eq('day', currentDay)
            .eq('status', 'active')
            .gte('started_at', today.toISOString())
            .lt('started_at', tomorrow.toISOString())
            .maybeSingle();
          
          // Check for completed workout session
          const { data: completedSession, error: completedSessionError } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', planData.id)
            .eq('day', currentDay)
            .eq('status', 'completed')
            .gte('started_at', today.toISOString())
            .lt('started_at', tomorrow.toISOString())
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
  }, [currentDay]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh data on focus, don't show loading if we already have data
      if (hasInitiallyLoaded && activePlan && currentDay) {
        const refresh = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Query by date range to ensure we get sessions from the current week only
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const { data: activeSession } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', activePlan.id)
            .eq('day', currentDay)
            .eq('status', 'active')
            .gte('started_at', today.toISOString())
            .lt('started_at', tomorrow.toISOString())
            .maybeSingle();
          
          const { data: completedSession } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('plan_id', activePlan.id)
            .eq('day', currentDay)
            .eq('status', 'completed')
            .gte('started_at', today.toISOString())
            .lt('started_at', tomorrow.toISOString())
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
      // Get current week start date
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day;
      const weekStart = new Date(today);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      
      // Format week key (YYYY-MM-DD)
      const year = weekStart.getFullYear();
      const month = String(weekStart.getMonth() + 1).padStart(2, '0');
      const dayNum = String(weekStart.getDate()).padStart(2, '0');
      const weekKey = `${year}-${month}-${dayNum}`;
      
      // Check for week-specific data first
      let dayData = null;
      if (activePlan.plan_data?.weeks?.[weekKey]?.week_schedule?.[currentDay]) {
        dayData = activePlan.plan_data.weeks[weekKey].week_schedule[currentDay];
      } 
      // Fallback to template week_schedule for backward compatibility
      else if (activePlan.plan_data?.week_schedule?.[currentDay]) {
        dayData = activePlan.plan_data.week_schedule[currentDay];
      }
      
      if (dayData) {
        setTodayData(dayData);
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

  const handleResetWorkout = async () => {
    if (!activePlan || !currentDay) return;

    setIsResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in.");
        setIsResetting(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Delete any active workout sessions (even if none exist, this won't error)
      const { error: deleteError } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('plan_id', activePlan.id)
        .eq('day', currentDay)
        .in('status', ['active', 'abandoned'])
        .gte('started_at', today.toISOString())
        .lt('started_at', tomorrow.toISOString());

      if (deleteError && deleteError.code !== 'PGRST116') {
        console.error('Error deleting workout session:', deleteError);
        // Don't show error if no session exists, just continue
      }

      // Clear local progress from AsyncStorage (even if it doesn't exist)
      try {
        await AsyncStorage.removeItem(`workout_session_${activePlan.id}_${currentDay}`);
      } catch (storageError) {
        // Ignore storage errors
        console.log('Storage clear error (non-critical):', storageError);
      }

      // Update state
      setHasActiveWorkout(false);
      setIsWorkoutCompleted(false);
      setShowResetModal(false);

      setToastMessage('Workout has been reset. You can now start fresh!');
      setToastVisible(true);
    } catch (error: any) {
      console.error('Error resetting workout:', error);
      setToastMessage(error.message || 'Failed to reset workout.');
      setToastVisible(true);
    } finally {
      setIsResetting(false);
    }
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
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
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
                  <View style={styles.badgeLeft}>
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
                  {hasActiveWorkout && (
                    <Pressable
                      onPress={() => setShowResetModal(true)}
                      style={styles.resetButton}
                    >
                      <RotateCcw size={20} color="#71717a" />
                    </Pressable>
                  )}
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
              style={styles.buttonContainer}
            >
              <CircularButton
                onPress={handleStartWorkout}
                disabled={isWorkoutCompleted}
                text={isWorkoutCompleted 
                  ? 'Completed' 
                  : hasActiveWorkout 
                    ? 'Continue' 
                    : 'Start'}
                isCompleted={isWorkoutCompleted}
              />
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Reset Workout Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Workout?</Text>
            <Text style={styles.modalMessage}>
              This will delete your current workout progress and allow you to start from the beginning. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalResetButton, isResetting && styles.modalResetButtonDisabled]}
                onPress={handleResetWorkout}
                disabled={isResetting}
              >
                <Text style={styles.modalResetText}>
                  {isResetting ? 'Resetting...' : 'Reset Workout'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  resetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(39, 39, 42, 0.6)', // zinc-800/60
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46', // zinc-700
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
  buttonContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  circularButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleSvg: {
    position: 'absolute',
  },
  circularButtonWrapper: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gradientBorderSvg: {
    position: 'absolute',
  },
  circularButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#a3e635',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  circularButtonCompleted: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3f3f46', // zinc-700
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  circularButtonInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // zinc-900 with 70% opacity (translucent)
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularButtonInnerCompleted: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // zinc-900 with 70% opacity
  },
  circularButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  circularButtonTextCompleted: {
    color: '#71717a', // zinc-500
    fontSize: 32,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#a1a1aa', // zinc-400
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46', // zinc-700
    backgroundColor: 'rgba(39, 39, 42, 0.5)', // zinc-800/50
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#a1a1aa', // zinc-400
    fontSize: 16,
    fontWeight: '700',
  },
  modalResetButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ef4444', // red-500
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetButtonDisabled: {
    opacity: 0.6,
  },
  modalResetText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
