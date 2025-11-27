import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, Modal, ActivityIndicator, RefreshControl, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Calendar, Clock, TrendingUp, Edit2, Save, X, Trash2, Plus } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';

type ViewMode = 'week' | 'month' | 'timeline';

interface WorkoutLog {
  id: number;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  performed_at: string;
  session_id: number | null;
  plan_id: number | null;
  day: string | null;
  notes: string | null;
}

interface WorkoutSession {
  id: number | null;
  plan_id: number;
  day: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
}

interface WorkoutData {
  date: string;
  sessions: Array<{
    session: WorkoutSession;
    exercises: Array<{
      name: string;
      sets: Array<{
        id: number | null; // Log ID for updates
        weight: number | null;
        reps: number | null;
        duration: number | null; // Duration in seconds for timed exercises
        notes: string | null;
      }>;
    }>;
    duration: number | null;
    totalVolume: number;
  }>;
}

interface DayWorkout {
  date: Date;
  workoutCount: number;
  totalVolume: number;
  exercises: string[];
}

export default function ProgressScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutData, setWorkoutData] = useState<WorkoutData[]>([]);
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, { is_timed: boolean }>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutData | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmType, setDeleteConfirmType] = useState<'set' | 'workout'>('set');
  const [deleteConfirmData, setDeleteConfirmData] = useState<{sessionIdx?: number; exerciseIdx?: number; setIdx?: number; setId?: number | null; sessionId?: number | null} | null>(null);
  const [unsavedChangesVisible, setUnsavedChangesVisible] = useState(false);
  
  // Week view state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const weekStart = new Date(today);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });

  // Month view state
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      loadWorkoutData();
    }, [])
  );

  const loadExerciseDetails = async (logs: WorkoutLog[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const exerciseNames = [...new Set(logs.map(log => log.exercise_name).filter(Boolean))];
    if (exerciseNames.length === 0) return;

    const detailsMap = new Map<string, { is_timed: boolean }>();

    // Batch query all exercises from master exercises table
    const { data: masterExercises } = await supabase
      .from('exercises')
      .select('name, is_timed')
      .in('name', exerciseNames);

    // Batch query all user exercises
    const { data: userExercises } = await supabase
      .from('user_exercises')
      .select('name, is_timed')
      .eq('user_id', user.id)
      .in('name', exerciseNames);

    // Create maps for quick lookup
    const masterExerciseMap = new Map(
      (masterExercises || []).map((ex: any) => [ex.name, ex])
    );
    const userExerciseMap = new Map(
      (userExercises || []).map((ex: any) => [ex.name, ex])
    );

    // Merge results: user exercises take precedence over master exercises
    for (const exerciseName of exerciseNames) {
      const userExercise = userExerciseMap.get(exerciseName);
      const masterExercise = masterExerciseMap.get(exerciseName);
      
      if (userExercise) {
        detailsMap.set(exerciseName, {
          is_timed: userExercise.is_timed || false
        });
      } else if (masterExercise) {
        detailsMap.set(exerciseName, {
          is_timed: masterExercise.is_timed || false
        });
      } else {
        // Default values if not found in either table
        detailsMap.set(exerciseName, {
          is_timed: false
        });
      }
    }

    setExerciseDetails(detailsMap);
  };

  const loadWorkoutData = async (startDate?: Date, endDate?: Date) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Determine date range based on view mode
      let start: Date;
      let end: Date = new Date();
      end.setHours(23, 59, 59, 999);

      if (viewMode === 'week') {
        start = new Date(currentWeekStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (viewMode === 'month') {
        start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        // Timeline: last 90 days
        start = new Date();
        start.setDate(start.getDate() - 90);
        start.setHours(0, 0, 0, 0);
      }

      if (startDate) start = startDate;
      if (endDate) end = endDate;

      // Fetch workout logs
      const { data: logs, error: logsError } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('performed_at', start.toISOString())
        .lte('performed_at', end.toISOString())
        .order('performed_at', { ascending: false });

      if (logsError) {
        console.error('Error loading logs:', logsError);
        setLoading(false);
        return;
      }

      // Fetch completed sessions
      const { data: completedSessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', start.toISOString())
        .lte('completed_at', end.toISOString())
        .order('completed_at', { ascending: false });

      // Fetch active sessions to filter out their logs
      const { data: activeSessions, error: activeSessionsError } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      // Get list of active session IDs to filter out
      const activeSessionIds = new Set((activeSessions || []).map(s => s.id));

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError);
      }
      if (activeSessionsError) {
        console.error('Error loading active sessions:', activeSessionsError);
      }

      // Filter out logs from active sessions - only show completed workouts
      const filteredLogs = (logs || []).filter(log => {
        // Include logs without a session_id (standalone logs)
        if (!log.session_id) return true;
        // Exclude logs from active sessions
        return !activeSessionIds.has(log.session_id);
      });

      // Load exercise details to determine which exercises are timed
      await loadExerciseDetails(filteredLogs);
      
      // Get exercise details for aggregation (will be available after loadExerciseDetails)
      const detailsMap = new Map<string, { is_timed: boolean }>();
      const exerciseNames = [...new Set(filteredLogs.map(log => log.exercise_name).filter(Boolean))];
      
      if (exerciseNames.length > 0) {
        const { data: masterExercises } = await supabase
          .from('exercises')
          .select('name, is_timed')
          .in('name', exerciseNames);

        const { data: userExercises } = await supabase
          .from('user_exercises')
          .select('name, is_timed')
          .eq('user_id', user.id)
          .in('name', exerciseNames);

        const masterExerciseMap = new Map(
          (masterExercises || []).map((ex: any) => [ex.name, ex])
        );
        const userExerciseMap = new Map(
          (userExercises || []).map((ex: any) => [ex.name, ex])
        );

        for (const exerciseName of exerciseNames) {
          const userExercise = userExerciseMap.get(exerciseName);
          const masterExercise = masterExerciseMap.get(exerciseName);
          
          if (userExercise) {
            detailsMap.set(exerciseName, { is_timed: userExercise.is_timed || false });
          } else if (masterExercise) {
            detailsMap.set(exerciseName, { is_timed: masterExercise.is_timed || false });
          } else {
            detailsMap.set(exerciseName, { is_timed: false });
          }
        }
      }

      // Fetch workout plans to get exercise order
      const planIds = [...new Set((completedSessions || []).map(s => s.plan_id).filter(Boolean))];
      const planExerciseOrder = new Map<number, Map<string, string[]>>();
      
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from('workout_plans')
          .select('id, plan_data')
          .in('id', planIds);
        
        if (plans) {
          plans.forEach((plan: any) => {
            const dayOrderMap = new Map<string, string[]>();
            if (plan.plan_data?.week_schedule) {
              Object.keys(plan.plan_data.week_schedule).forEach((day: string) => {
                const dayData = plan.plan_data.week_schedule[day];
                if (dayData?.exercises) {
                  dayOrderMap.set(day, dayData.exercises.map((ex: any) => ex.name).filter(Boolean));
                }
              });
            }
            planExerciseOrder.set(plan.id, dayOrderMap);
          });
        }
      }

      // Aggregate data by date (only completed sessions and standalone logs)
      const aggregated = aggregateWorkoutData(filteredLogs, completedSessions || [], detailsMap, planExerciseOrder);
      setWorkoutData(aggregated);
    } catch (error) {
      console.error('Error loading workout data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const aggregateWorkoutData = (logs: WorkoutLog[], sessions: WorkoutSession[], exerciseDetailsMap: Map<string, { is_timed: boolean }>, planExerciseOrder: Map<number, Map<string, string[]>>): WorkoutData[] => {
    const dataMap = new Map<string, WorkoutData>();

    // Group logs by date and session
    logs.forEach(log => {
      const date = new Date(log.performed_at);
      const dateKey = date.toISOString().split('T')[0];

      if (!dataMap.has(dateKey)) {
        dataMap.set(dateKey, {
          date: dateKey,
          sessions: []
        });
      }

      const dayData = dataMap.get(dateKey)!;
      const sessionId = log.session_id;

      // Find or create session entry
      let sessionEntry: any = null;
      
      if (sessionId) {
        // Log with session_id - find or create entry for that session
        sessionEntry = dayData.sessions.find(s => s.session.id === sessionId);
        if (!sessionEntry) {
          const session = sessions.find(s => s.id === sessionId);
          if (session) {
            sessionEntry = {
              session,
              exercises: [],
              duration: null,
              totalVolume: 0
            };
            dayData.sessions.push(sessionEntry);

            // Calculate duration
            if (session.completed_at && session.started_at) {
              const start = new Date(session.started_at);
              const end = new Date(session.completed_at);
              sessionEntry.duration = Math.round((end.getTime() - start.getTime()) / 1000 / 60); // minutes
            }
          }
        }
      } else {
        // Standalone log without session - group all standalone logs for this date into one entry
        sessionEntry = dayData.sessions.find(s => s.session.id === null);
        if (!sessionEntry) {
          const dummySession: WorkoutSession = {
            id: null, // Use null to indicate no real session
            plan_id: log.plan_id || -1,
            day: log.day || null,
            started_at: log.performed_at,
            completed_at: null,
            status: 'completed'
          };
          sessionEntry = {
            session: dummySession,
            exercises: [],
            duration: null,
            totalVolume: 0
          };
          dayData.sessions.push(sessionEntry);
        }
      }

      if (sessionEntry) {
        // Find or create exercise entry
        let exerciseEntry = sessionEntry.exercises.find(e => e.name === log.exercise_name);
        if (!exerciseEntry) {
          exerciseEntry = {
            name: log.exercise_name,
            sets: []
          };
          sessionEntry.exercises.push(exerciseEntry);
        }

        // Check if exercise is timed
        const isTimed = exerciseDetailsMap.get(log.exercise_name)?.is_timed || false;
        
        // For timed exercises, reps field contains duration in seconds
        // Only add sets with valid data (at least weight, reps, or duration for timed)
        if (log.weight !== null || log.reps !== null) {
          exerciseEntry.sets.push({
            id: log.id,
            weight: isTimed ? null : log.weight,
            reps: isTimed ? null : log.reps,
            duration: isTimed ? log.reps : null, // For timed exercises, reps field stores duration
            notes: log.notes
          });

          // Calculate volume (only if both weight and reps are present, and not timed)
          if (!isTimed && log.weight && log.reps) {
            sessionEntry.totalVolume += log.weight * log.reps;
          }
        }
      }
    });

    // Sort exercises within each session by their order in the workout plan
    dataMap.forEach((workout) => {
      workout.sessions.forEach((session) => {
        if (session.session.plan_id && session.session.day) {
          // Get exercise order from plan if available
          const planId = session.session.plan_id;
          const day = session.session.day;
          
          const planOrder = planExerciseOrder.get(planId);
          if (planOrder) {
            const dayOrder = planOrder.get(day);
            if (dayOrder && dayOrder.length > 0) {
              // Sort exercises by their order in the plan
              session.exercises.sort((a, b) => {
                const indexA = dayOrder.indexOf(a.name);
                const indexB = dayOrder.indexOf(b.name);
                // If not found in plan, keep original order (put at end)
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              });
            }
          }
        }
        
        // Sort sets within each exercise by their order (they should already be in order from logs)
        session.exercises.forEach((exercise) => {
          // Sets are already in order from logs, but ensure they're sorted by id or performed_at if available
          exercise.sets.sort((a, b) => {
            if (a.id && b.id) return a.id - b.id;
            return 0;
          });
        });
      });
    });

    // Sort by date descending
    return Array.from(dataMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWorkoutData();
  }, [viewMode, currentWeekStart, currentMonth]);

  useEffect(() => {
    loadWorkoutData();
  }, [viewMode, currentWeekStart, currentMonth]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds && seconds !== 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

  const getMonthDays = (): DayWorkout[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: DayWorkout[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        date: new Date(year, month, -i),
        workoutCount: 0,
        totalVolume: 0,
        exercises: []
      });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = date.toISOString().split('T')[0];
      const workout = workoutData.find(w => w.date === dateKey);

      days.push({
        date,
        workoutCount: workout ? workout.sessions.length : 0,
        totalVolume: workout ? workout.sessions.reduce((sum, s) => sum + s.totalVolume, 0) : 0,
        exercises: workout ? workout.sessions.flatMap(s => s.exercises.map(e => e.name)) : []
      });
    }

    return days;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newDate);
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isToday = (date: Date) => {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    };

    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <ChevronLeft color="#3b82f6" size={24} />
          </TouchableOpacity>
          <View style={styles.weekTitleContainer}>
            <Text style={styles.weekTitle}>
              {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
              {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.weekSubtitle}>{currentWeekStart.getFullYear()}</Text>
          </View>
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <ChevronRight color="#3b82f6" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.weekScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.weekScrollContent}
        >
          {weekDays.map((day, index) => {
            const dateKey = day.toISOString().split('T')[0];
            const workout = workoutData.find(w => w.date === dateKey);
            const hasWorkout = !!workout && workout.sessions.length > 0;
            const today = isToday(day);
            const totalExercises = workout ? workout.sessions.reduce((sum, s) => sum + s.exercises.length, 0) : 0;
            const totalVolume = workout ? workout.sessions.reduce((sum, s) => sum + s.totalVolume, 0) : 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDayCard,
                  hasWorkout && styles.weekDayCardWithWorkout,
                  today && styles.weekDayCardToday
                ]}
                onPress={() => {
                  if (workout) {
                    setSelectedWorkout(workout);
                    setEditingWorkout(JSON.parse(JSON.stringify(workout))); // Deep copy for editing
                    setIsEditing(false);
                    setModalVisible(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.weekDayLeft}>
                  <View style={styles.weekDayDateContainer}>
                    <Text style={[styles.weekDayName, today && styles.weekDayNameToday]}>
                      {shortDayNames[day.getDay()]}
                    </Text>
                    <Text style={[styles.weekDayNumber, today && styles.weekDayNumberToday]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  {today && (
                    <View style={styles.todayBadge}>
                      <Text style={styles.todayBadgeText}>Today</Text>
                    </View>
                  )}
                </View>

                {hasWorkout ? (
                  <View style={styles.weekDayWorkoutInfo}>
                    <View style={styles.weekDayWorkoutStats}>
                      <View style={styles.weekDayStatItem}>
                        <TrendingUp color="#3b82f6" size={16} />
                        <Text style={styles.weekDayStatText}>{workout.sessions.length} workout{workout.sessions.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.weekDayStatItem}>
                        <Text style={styles.weekDayStatText}>{totalExercises} exercises</Text>
                      </View>
                      {totalVolume > 0 && (
                        <View style={styles.weekDayStatItem}>
                          <Text style={styles.weekDayStatText}>{Math.round(totalVolume)} lbs</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.weekDayArrow}>
                      <ChevronRight color="#9ca3af" size={20} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.weekDayEmpty}>
                    <Text style={styles.weekDayEmptyText}>No workout</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderMonthView = () => {
    const days = getMonthDays();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <View style={styles.monthContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <ChevronLeft color="#3b82f6" size={24} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <ChevronRight color="#3b82f6" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.calendarScroll}
          contentContainerStyle={styles.calendarScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.calendarGrid}>
            {dayNames.map(day => (
              <View key={day} style={styles.calendarHeaderCell}>
                <Text style={styles.calendarHeaderText}>{day}</Text>
              </View>
            ))}
            {days.map((dayWorkout, index) => {
              const dateKey = dayWorkout.date.toISOString().split('T')[0];
              const isCurrentMonth = dayWorkout.date.getMonth() === currentMonth.getMonth();
              const hasWorkout = dayWorkout.workoutCount > 0;
              const workout = workoutData.find(w => w.date === dateKey);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.calendarCell,
                    !isCurrentMonth && styles.calendarCellOtherMonth,
                    hasWorkout && styles.calendarCellWithWorkout
                  ]}
                  onPress={() => {
                    if (workout && hasWorkout) {
                      setSelectedWorkout(workout);
                      setEditingWorkout(JSON.parse(JSON.stringify(workout))); // Deep copy for editing
                      setIsEditing(false);
                      setModalVisible(true);
                    }
                  }}
                  disabled={!hasWorkout}
                >
                  <Text style={[
                    styles.calendarDayText,
                    !isCurrentMonth && styles.calendarDayTextOtherMonth,
                    hasWorkout && styles.calendarDayTextWithWorkout
                  ]}>
                    {dayWorkout.date.getDate()}
                  </Text>
                  {hasWorkout && (
                    <View style={styles.calendarWorkoutIndicator} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.monthStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {workoutData.reduce((sum, w) => sum + w.sessions.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Math.round(workoutData.reduce((sum, w) => sum + w.sessions.reduce((s, ses) => s + ses.totalVolume, 0), 0))}
            </Text>
            <Text style={styles.statLabel}>Total Volume</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTimelineView = () => {
    return (
      <FlatList
        data={workoutData}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.timelineCard}
            onPress={() => {
              setSelectedWorkout(item);
              setEditingWorkout(JSON.parse(JSON.stringify(item))); // Deep copy for editing
              setIsEditing(false);
              setModalVisible(true);
            }}
          >
            <View style={styles.timelineHeader}>
              <View style={styles.timelineDateContainer}>
                <Calendar color="#3b82f6" size={20} />
                <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
              </View>
              {item.sessions[0]?.session.completed_at && (
                <View style={styles.timelineTimeContainer}>
                  <Clock color="#9ca3af" size={16} />
                  <Text style={styles.timelineTime}>{formatTime(item.sessions[0].session.completed_at)}</Text>
                </View>
              )}
            </View>

            {item.sessions.map((session, idx) => (
              <View key={idx} style={styles.timelineSession}>
                {session.session.day && (
                  <Text style={styles.timelineDay}>{session.session.day}</Text>
                )}
                <View style={styles.timelineExercises}>
                  {session.exercises.map((exercise, exIdx) => {
                    const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
                    // Filter out sets with no valid data
                    const validSets = exercise.sets.filter(set => {
                      if (isTimed) {
                        return set.duration !== null && set.duration !== undefined;
                      }
                      return (set.weight !== null && set.weight !== undefined) || 
                             (set.reps !== null && set.reps !== undefined);
                    });
                    
                    if (validSets.length === 0) return null;
                    
                    // Get first valid set for preview
                    const firstSet = validSets[0];
                    const hasWeightAndReps = !isTimed && firstSet.weight !== null && firstSet.reps !== null;
                    const hasDuration = isTimed && firstSet.duration !== null;
                    
                    return (
                      <View key={exIdx} style={styles.timelineExercise}>
                        <Text style={styles.timelineExerciseName}>{exercise.name}</Text>
                        <Text style={styles.timelineExerciseSets}>
                          {validSets.length} set{validSets.length !== 1 ? 's' : ''}
                          {hasWeightAndReps && (
                            ` • ${firstSet.weight}lbs × ${firstSet.reps}`
                          )}
                          {hasDuration && (
                            ` • ${formatDuration(firstSet.duration)}`
                          )}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.timelineFooter}>
                  {session.duration && (
                    <Text style={styles.timelineDuration}>{session.duration} min</Text>
                  )}
                  {session.totalVolume > 0 && (
                    <Text style={styles.timelineVolume}>{Math.round(session.totalVolume)} lbs volume</Text>
                  )}
                </View>
              </View>
            ))}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No workouts found</Text>
            <Text style={styles.emptySubtext}>Complete a workout to see your progress here</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      />
    );
  };

  const handleEdit = () => {
    if (selectedWorkout) {
      setEditingWorkout(JSON.parse(JSON.stringify(selectedWorkout))); // Deep copy
      setDeletedSetIds(new Set()); // Reset deleted sets tracking
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDeletedSetIds(new Set()); // Clear deleted sets tracking
    if (selectedWorkout) {
      setEditingWorkout(JSON.parse(JSON.stringify(selectedWorkout)));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingWorkout) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to save changes.");
        setSaving(false);
        return;
      }

      // Collect all sets that need to be updated and new sets that need to be created
      const updates: Array<{ id: number; weight: number | null; reps: number | null; notes: string | null }> = [];
      const newSets: Array<{ sessionIdx: number; exerciseName: string; weight: number | null; reps: number | null; notes: string | null; sessionId: number | null; planId: number | null; day: string | null; performedAt: string }> = [];

      editingWorkout.sessions.forEach((session, sessionIdx) => {
        session.exercises.forEach(exercise => {
          const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
          exercise.sets.forEach(set => {
            // Skip sets that are marked for deletion
            if (set.id && deletedSetIds.has(set.id)) {
              return;
            }
            
            // For timed exercises, use duration in reps field; for others, use weight/reps
            const weight = isTimed ? null : set.weight;
            const reps = isTimed ? set.duration : set.reps;
            
            if (set.id) {
              // Existing set - update it
              updates.push({
                id: set.id,
                weight: weight,
                reps: reps,
                notes: set.notes
              });
            } else {
              // New set - create it
              // Only create if it has valid data (weight or reps, or duration for timed)
              if ((!isTimed && (set.weight !== null || set.reps !== null)) || (isTimed && set.duration !== null)) {
                newSets.push({
                  sessionIdx,
                  exerciseName: exercise.name,
                  weight: weight,
                  reps: reps,
                  notes: set.notes,
                  sessionId: session.session.id,
                  planId: session.session.plan_id,
                  day: session.session.day,
                  performedAt: selectedWorkout.date // Use the workout date
                });
              }
            }
          });
        });
      });

      // Delete sets that were marked for deletion
      if (deletedSetIds.size > 0) {
        for (const setId of deletedSetIds) {
          const { error } = await supabase
            .from('workout_logs')
            .delete()
            .eq('id', setId)
            .eq('user_id', user.id);

          if (error) {
            console.error('Error deleting set:', error);
            Alert.alert("Error", `Failed to delete set: ${error.message}`);
            setSaving(false);
            return;
          }
        }
      }

      // Update existing log entries
      for (const update of updates) {
        const { error } = await supabase
          .from('workout_logs')
          .update({
            weight: update.weight,
            reps: update.reps,
            notes: update.notes
          })
          .eq('id', update.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating log:', error);
          Alert.alert("Error", `Failed to update set: ${error.message}`);
          setSaving(false);
          return;
        }
      }

      // Create new log entries
      if (newSets.length > 0) {
        const workoutDate = new Date(selectedWorkout.date);
        const inserts = newSets.map(newSet => ({
          user_id: user.id,
          exercise_name: newSet.exerciseName,
          weight: newSet.weight,
          reps: newSet.reps,
          notes: newSet.notes,
          performed_at: workoutDate.toISOString(),
          session_id: newSet.sessionId,
          plan_id: newSet.planId,
          day: newSet.day
        }));

        const { error: insertError } = await supabase
          .from('workout_logs')
          .insert(inserts);

        if (insertError) {
          console.error('Error creating new logs:', insertError);
          Alert.alert("Error", `Failed to create new sets: ${insertError.message}`);
          setSaving(false);
          return;
        }
      }

      // Reload data and exit edit mode
      await loadWorkoutData();
      setIsEditing(false);
      setDeletedSetIds(new Set()); // Clear deleted sets tracking
      setSelectedWorkout(editingWorkout);
      Alert.alert("Success", "Workout updated successfully!");
    } catch (error: any) {
      console.error('Error saving edits:', error);
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const updateSetValue = (sessionIdx: number, exerciseIdx: number, setIdx: number, field: 'weight' | 'reps' | 'notes' | 'duration', value: string) => {
    if (!editingWorkout) return;

    const updated = JSON.parse(JSON.stringify(editingWorkout));
    const set = updated.sessions[sessionIdx].exercises[exerciseIdx].sets[setIdx];
    
    if (field === 'weight' || field === 'reps' || field === 'duration') {
      set[field] = value === '' ? null : (field === 'weight' ? parseFloat(value) : parseInt(value));
    } else {
      set[field] = value;
    }

    // Recalculate total volume for the session
    let totalVolume = 0;
    updated.sessions[sessionIdx].exercises.forEach((ex: any) => {
      ex.sets.forEach((s: any) => {
        if (s.weight && s.reps) {
          totalVolume += s.weight * s.reps;
        }
      });
    });
    updated.sessions[sessionIdx].totalVolume = totalVolume;

    setEditingWorkout(updated);
  };

  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [deletedSetIds, setDeletedSetIds] = useState<Set<number>>(new Set());

  const handleAddExercise = () => {
    if (!editingWorkout || editingWorkout.sessions.length === 0) return;
    setNewExerciseName('');
    setShowAddExerciseModal(true);
  };

  const confirmAddExercise = () => {
    if (!newExerciseName || !newExerciseName.trim()) {
      Alert.alert("Error", "Please enter an exercise name.");
      return;
    }

    if (!editingWorkout || editingWorkout.sessions.length === 0) return;

    const updated = JSON.parse(JSON.stringify(editingWorkout));
    // Add to the first session (or create a new exercise in the first session)
    if (updated.sessions.length > 0) {
      const firstSession = updated.sessions[0];
      // Check if exercise already exists
      let exerciseEntry = firstSession.exercises.find((e: any) => e.name === newExerciseName.trim());
      if (!exerciseEntry) {
        exerciseEntry = {
          name: newExerciseName.trim(),
          sets: []
        };
        firstSession.exercises.push(exerciseEntry);
      }
      // Add an empty set to the exercise
      exerciseEntry.sets.push({
        id: null, // New set, no ID yet
        weight: null,
        reps: null,
        notes: null
      });
      setEditingWorkout(updated);
      setShowAddExerciseModal(false);
      setNewExerciseName('');
    }
  };

  const handleDeleteSet = async (sessionIdx: number, exerciseIdx: number, setIdx: number, setId: number | null) => {
    if (!setId) return;

    setDeleteConfirmType('set');
    setDeleteConfirmData({ sessionIdx, exerciseIdx, setIdx, setId });
    setDeleteConfirmVisible(true);
  };

  const performDeleteSet = async () => {
    if (!deleteConfirmData || !deleteConfirmData.setId) return;
    const { sessionIdx, exerciseIdx, setId } = deleteConfirmData;
    if (sessionIdx === undefined || exerciseIdx === undefined || !setId) return;

    if (isEditing) {
      // In edit mode: just mark for deletion and update local state
      setDeletedSetIds(prev => new Set(prev).add(setId));
      
      if (editingWorkout) {
        const updated = JSON.parse(JSON.stringify(editingWorkout));
        const session = updated.sessions[sessionIdx];
        if (session && session.exercises[exerciseIdx]) {
          // Remove the deleted set from local state
          session.exercises[exerciseIdx].sets = session.exercises[exerciseIdx].sets.filter((s: any) => s.id !== setId);
          
          // Remove exercise if no sets remain
          if (session.exercises[exerciseIdx].sets.length === 0) {
            session.exercises = session.exercises.filter((_: any, idx: number) => idx !== exerciseIdx);
          } else {
            // Recalculate total volume
            session.totalVolume = 0;
            session.exercises.forEach((ex: any) => {
              ex.sets.forEach((s: any) => {
                if (s.weight && s.reps) {
                  session.totalVolume += s.weight * s.reps;
                }
              });
            });
          }
          
          // Remove session if no exercises remain
          if (session.exercises.length === 0) {
            updated.sessions = updated.sessions.filter((_: any, idx: number) => idx !== sessionIdx);
          }
          
          setEditingWorkout(updated);
        }
      }
      
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
    } else {
      // Not in edit mode: delete immediately from database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert("Error", "You must be logged in to delete sets.");
          setDeleteConfirmVisible(false);
          setDeleteConfirmData(null);
          return;
        }

        const { error } = await supabase
          .from('workout_logs')
          .delete()
          .eq('id', setId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error deleting set:', error);
          Alert.alert("Error", `Failed to delete set: ${error.message}`);
          setDeleteConfirmVisible(false);
          setDeleteConfirmData(null);
          return;
        }

        // Update local state immediately
        if (selectedWorkout) {
          const updatedWorkout = JSON.parse(JSON.stringify(selectedWorkout));
          const session = updatedWorkout.sessions[sessionIdx];
          if (session && session.exercises[exerciseIdx]) {
            // Remove the deleted set
            session.exercises[exerciseIdx].sets = session.exercises[exerciseIdx].sets.filter((s: any) => s.id !== setId);
            
            // Remove exercise if no sets remain
            if (session.exercises[exerciseIdx].sets.length === 0) {
              session.exercises = session.exercises.filter((_: any, idx: number) => idx !== exerciseIdx);
            } else {
              // Recalculate total volume
              session.totalVolume = 0;
              session.exercises.forEach((ex: any) => {
                ex.sets.forEach((s: any) => {
                  if (s.weight && s.reps) {
                    session.totalVolume += s.weight * s.reps;
                  }
                });
              });
            }
            
            // Remove session if no exercises remain
            if (session.exercises.length === 0) {
              updatedWorkout.sessions = updatedWorkout.sessions.filter((_: any, idx: number) => idx !== sessionIdx);
            }
            
            setSelectedWorkout(updatedWorkout);
          }
        }

        // Reload data in background
        loadWorkoutData();
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
      } catch (error: any) {
        console.error('Error deleting set:', error);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        Alert.alert("Error", "Failed to delete set.");
      }
    }
  };

  const handleDeleteWorkout = async (sessionId: number | null) => {
    if (!selectedWorkout) return;

    setDeleteConfirmType('workout');
    setDeleteConfirmData({ sessionId });
    setDeleteConfirmVisible(true);
  };

  const performDeleteStandalone = async () => {
    if (!deleteConfirmData || !selectedWorkout) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to delete workouts.");
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Collect all log IDs from this workout
      const logIds: number[] = [];
      selectedWorkout.sessions.forEach(session => {
        session.exercises.forEach(exercise => {
          exercise.sets.forEach(set => {
            if (set.id) logIds.push(set.id);
          });
        });
      });

      if (logIds.length === 0) {
        Alert.alert("Error", "No sets to delete.");
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      const { error } = await supabase
        .from('workout_logs')
        .delete()
        .in('id', logIds)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting workout:', error);
        Alert.alert("Error", `Failed to delete workout: ${error.message}`);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Close modal and reload data
      setModalVisible(false);
      setSelectedWorkout(null);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      await loadWorkoutData();
      Alert.alert("Success", "Workout deleted successfully!");
    } catch (error: any) {
      console.error('Error deleting workout:', error);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      Alert.alert("Error", "Failed to delete workout.");
    }
  };

  const performDeleteSession = async () => {
    if (!deleteConfirmData || !deleteConfirmData.sessionId) return;
    const sessionId = deleteConfirmData.sessionId;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be logged in to delete workouts.");
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Delete all logs for this session
      const { error: logsError } = await supabase
        .from('workout_logs')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (logsError) {
        console.error('Error deleting workout logs:', logsError);
        Alert.alert("Error", `Failed to delete workout logs: ${logsError.message}`);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Delete the session
      const { error: sessionError } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (sessionError) {
        console.error('Error deleting session:', sessionError);
        Alert.alert("Error", `Failed to delete workout session: ${sessionError.message}`);
        setDeleteConfirmVisible(false);
        setDeleteConfirmData(null);
        return;
      }

      // Close modal and reload data
      setModalVisible(false);
      setSelectedWorkout(null);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      await loadWorkoutData();
      Alert.alert("Success", "Workout deleted successfully!");
    } catch (error: any) {
      console.error('Error deleting workout:', error);
      setDeleteConfirmVisible(false);
      setDeleteConfirmData(null);
      Alert.alert("Error", "Failed to delete workout.");
    }
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmType === 'set') {
      performDeleteSet();
    } else {
      // Workout deletion
      if (!deleteConfirmData || !deleteConfirmData.sessionId) {
        performDeleteStandalone();
      } else {
        performDeleteSession();
      }
    }
  };

  const renderWorkoutDetail = () => {
    if (!selectedWorkout) return null;
    const displayWorkout = isEditing ? editingWorkout : selectedWorkout;
    if (!displayWorkout) return null;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (isEditing) {
            setUnsavedChangesVisible(true);
          } else {
            setModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{formatDate(selectedWorkout.date)}</Text>
              <View style={styles.modalHeaderActions}>
                {!isEditing ? (
                  <>
                    <TouchableOpacity onPress={handleEdit} style={styles.modalActionButton}>
                      <Edit2 color="#3b82f6" size={20} />
                    </TouchableOpacity>
                    {displayWorkout.sessions.length > 0 && (
                      <TouchableOpacity 
                        onPress={() => {
                          handleDeleteWorkout(displayWorkout.sessions[0].session.id);
                        }}
                        style={styles.modalActionButton}
                        activeOpacity={0.7}
                      >
                        <Trash2 color="#ef4444" size={20} />
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <TouchableOpacity 
                    onPress={handleSaveEdit} 
                    style={[styles.modalActionButton, styles.modalSaveButton]}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                      <Save color="#3b82f6" size={20} />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    if (isEditing) {
                      setUnsavedChangesVisible(true);
                    } else {
                      setModalVisible(false);
                    }
                  }}
                  style={styles.modalActionButton}
                  activeOpacity={0.7}
                >
                  <X color="#9ca3af" size={24} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalScroll}>
              {displayWorkout.sessions.map((session, idx) => (
                <View key={idx} style={styles.modalSession}>
                  {session.session.day && (
                    <Text style={styles.modalDay}>{session.session.day}</Text>
                  )}
                  {session.duration && (
                    <View style={styles.modalStats}>
                      <Clock color="#9ca3af" size={16} />
                      <Text style={styles.modalStatText}>{session.duration} minutes</Text>
                    </View>
                  )}
                  {session.totalVolume > 0 && (
                    <View style={styles.modalStats}>
                      <TrendingUp color="#9ca3af" size={16} />
                      <Text style={styles.modalStatText}>{Math.round(session.totalVolume)} lbs total volume</Text>
                    </View>
                  )}

                  {session.exercises.map((exercise, exIdx) => {
                    const isTimed = exerciseDetails.get(exercise.name)?.is_timed || false;
                    return (
                      <View key={exIdx} style={styles.modalExercise}>
                        <Text style={styles.modalExerciseName}>{exercise.name}</Text>
                        {exercise.sets.map((set, setIdx) => (
                          <View key={setIdx} style={styles.modalSet}>
                            {isEditing ? (
                              <View style={styles.modalSetEdit}>
                                <View style={styles.modalSetEditHeader}>
                                  <Text style={styles.modalSetLabel}>Set {setIdx + 1}</Text>
                                  {set.id && (
                                    <TouchableOpacity 
                                      onPress={() => {
                                        handleDeleteSet(idx, exIdx, setIdx, set.id);
                                      }}
                                      style={styles.modalDeleteSetButton}
                                      activeOpacity={0.7}
                                    >
                                      <Trash2 color="#ef4444" size={16} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <View style={styles.modalSetInputs}>
                                  {!isTimed && (
                                    <>
                                      <View style={styles.modalSetInputGroup}>
                                        <Text style={styles.modalSetInputLabel}>Weight (lbs)</Text>
                                        <TextInput
                                          style={styles.modalSetInput}
                                          value={set.weight?.toString() || ''}
                                          onChangeText={(value) => updateSetValue(idx, exIdx, setIdx, 'weight', value)}
                                          keyboardType="numeric"
                                          placeholder="BW"
                                          placeholderTextColor="#6b7280"
                                        />
                                      </View>
                                      <View style={styles.modalSetInputGroup}>
                                        <Text style={styles.modalSetInputLabel}>Reps</Text>
                                        <TextInput
                                          style={styles.modalSetInput}
                                          value={set.reps?.toString() || ''}
                                          onChangeText={(value) => updateSetValue(idx, exIdx, setIdx, 'reps', value)}
                                          keyboardType="numeric"
                                          placeholder="0"
                                          placeholderTextColor="#6b7280"
                                        />
                                      </View>
                                    </>
                                  )}
                                  {isTimed && (
                                    <View style={styles.modalSetInputGroup}>
                                      <Text style={styles.modalSetInputLabel}>Duration (seconds)</Text>
                                      <TextInput
                                        style={styles.modalSetInput}
                                        value={set.duration?.toString() || ''}
                                        onChangeText={(value) => updateSetValue(idx, exIdx, setIdx, 'duration', value)}
                                        keyboardType="numeric"
                                        placeholder="60"
                                        placeholderTextColor="#6b7280"
                                      />
                                    </View>
                                  )}
                                </View>
                                <View style={styles.modalSetInputGroup}>
                                  <Text style={styles.modalSetInputLabel}>Notes</Text>
                                  <TextInput
                                    style={[styles.modalSetInput, styles.modalSetNotesInput]}
                                    value={set.notes || ''}
                                    onChangeText={(value) => updateSetValue(idx, exIdx, setIdx, 'notes', value)}
                                    placeholder="Optional notes..."
                                    placeholderTextColor="#6b7280"
                                    multiline
                                  />
                                </View>
                              </View>
                            ) : (
                              <View style={styles.modalSetRow}>
                                <View style={styles.modalSetContent}>
                                  <Text style={styles.modalSetText}>
                                    {isTimed ? (
                                      `Set ${setIdx + 1}: ${formatDuration(set.duration)}`
                                    ) : (
                                      `Set ${setIdx + 1}: ${set.weight ? `${set.weight}lbs` : 'BW'} × ${set.reps || 'N/A'} reps`
                                    )}
                                  </Text>
                                  {set.notes && (
                                    <Text style={styles.modalNotes}>{set.notes}</Text>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            
            {/* Add Exercise Button - Only shown in edit mode */}
            {isEditing && displayWorkout.sessions.length > 0 && (
              <View style={styles.modalAddExerciseContainer}>
                <TouchableOpacity
                  style={styles.modalAddExerciseButton}
                  onPress={handleAddExercise}
                  activeOpacity={0.7}
                >
                  <Plus color="#3b82f6" size={20} />
                  <Text style={styles.modalAddExerciseText}>Add Exercise</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Add Exercise Modal */}
          {showAddExerciseModal && (
            <View style={styles.addExerciseModalOverlay}>
              <View style={styles.addExerciseModalContent}>
                <Text style={styles.addExerciseModalTitle}>Add Exercise</Text>
                <TextInput
                  style={styles.addExerciseModalInput}
                  placeholder="Enter exercise name"
                  placeholderTextColor="#6b7280"
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  autoCapitalize="words"
                  autoFocus
                />
                <View style={styles.addExerciseModalButtons}>
                  <TouchableOpacity
                    style={[styles.addExerciseModalButton, styles.addExerciseModalButtonCancel]}
                    onPress={() => {
                      setShowAddExerciseModal(false);
                      setNewExerciseName('');
                    }}
                  >
                    <Text style={styles.addExerciseModalButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addExerciseModalButton, styles.addExerciseModalButtonAdd]}
                    onPress={confirmAddExercise}
                  >
                    <Text style={styles.addExerciseModalButtonAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Unsaved Changes Confirmation Overlay - Rendered inside workout detail modal */}
          {unsavedChangesVisible && (
            <View style={styles.deleteConfirmOverlay}>
              <View style={styles.deleteConfirmContent}>
                <Text style={styles.deleteConfirmTitle}>Unsaved Changes</Text>
                <Text style={styles.deleteConfirmMessage}>
                  You have unsaved changes. Are you sure you want to close?
                </Text>
                <View style={styles.deleteConfirmButtons}>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonCancel]}
                    onPress={() => {
                      setUnsavedChangesVisible(false);
                    }}
                  >
                    <Text style={styles.deleteConfirmButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonDelete]}
                    onPress={() => {
                      handleCancelEdit();
                      setUnsavedChangesVisible(false);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={styles.deleteConfirmButtonDeleteText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Delete Confirmation Overlay - Rendered inside workout detail modal */}
          {deleteConfirmVisible && (
            <View style={styles.deleteConfirmOverlay}>
              <View style={styles.deleteConfirmContent}>
                <Text style={styles.deleteConfirmTitle}>
                  {deleteConfirmType === 'set' ? 'Delete Set' : 'Delete Workout'}
                </Text>
                <Text style={styles.deleteConfirmMessage}>
                  {deleteConfirmType === 'set' 
                    ? isEditing 
                      ? 'Are you sure you want to delete this set? You can undo this by canceling your edits.'
                      : 'Are you sure you want to delete this set?'
                    : deleteConfirmData?.sessionId
                      ? 'Are you sure you want to delete this entire workout? This will delete all sets and the workout session.'
                      : 'Are you sure you want to delete all sets from this workout?'}
                </Text>
                <View style={styles.deleteConfirmButtons}>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonCancel]}
                    onPress={() => {
                      setDeleteConfirmVisible(false);
                      setDeleteConfirmData(null);
                    }}
                  >
                    <Text style={styles.deleteConfirmButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteConfirmButton, styles.deleteConfirmButtonDelete]}
                    onPress={handleConfirmDelete}
                  >
                    <Text style={styles.deleteConfirmButtonDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.viewModeSelector}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('week')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('month')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'timeline' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('timeline')}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewModeText, viewMode === 'timeline' && styles.viewModeTextActive]}>Timeline</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <View style={styles.content}>
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'timeline' && renderTimelineView()}
        </View>
      )}

      {renderWorkoutDetail()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    backgroundColor: '#111827',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 16,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  viewModeButtonActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  viewModeText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14,
  },
  viewModeTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Week View
  weekContainer: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  weekTitleContainer: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  weekSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  navButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  weekScroll: {
    flex: 1,
  },
  weekScrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  weekDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
    minHeight: 80,
  },
  weekDayCardWithWorkout: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
    borderWidth: 2,
  },
  weekDayCardToday: {
    borderColor: '#60a5fa',
    backgroundColor: '#1e3a5f',
  },
  weekDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekDayDateContainer: {
    alignItems: 'center',
    minWidth: 50,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  weekDayNameToday: {
    color: '#60a5fa',
  },
  weekDayNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  weekDayNumberToday: {
    color: '#3b82f6',
  },
  todayBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  weekDayWorkoutInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 16,
  },
  weekDayWorkoutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
  },
  weekDayStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekDayStatText: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
  },
  weekDayArrow: {
    marginLeft: 8,
  },
  weekDayEmpty: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  weekDayEmptyText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // Month View
  monthContainer: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  calendarScroll: {
    flex: 1,
  },
  calendarScrollContent: {
    paddingBottom: 16,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  calendarHeaderCell: {
    width: '14.28%',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    borderRadius: 6,
    margin: 1,
  },
  calendarCellOtherMonth: {
    opacity: 0.25,
  },
  calendarCellWithWorkout: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  calendarDayText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
  },
  calendarDayTextOtherMonth: {
    color: '#6b7280',
  },
  calendarDayTextWithWorkout: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  calendarWorkoutIndicator: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
  },
  monthStats: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Timeline View
  timelineCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  timelineDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineDate: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  timelineTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timelineTime: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  timelineSession: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  timelineDay: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineExercises: {
    gap: 12,
  },
  timelineExercise: {
    marginBottom: 12,
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  timelineExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 6,
  },
  timelineExerciseSets: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  timelineFooter: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  timelineDuration: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  timelineVolume: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalActionButton: {
    padding: 8,
    borderRadius: 8,
  },
  modalSaveButton: {
    backgroundColor: '#1e3a5f',
  },
  modalClose: {
    fontSize: 28,
    color: '#9ca3af',
    fontWeight: '300',
    width: 32,
    height: 32,
    textAlign: 'center',
    lineHeight: 32,
    marginLeft: 8,
  },
  modalScroll: {
    padding: 20,
  },
  modalSession: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
  },
  modalStatText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  modalExercise: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  modalExerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
  },
  modalSet: {
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#374151',
  },
  modalSetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalSetContent: {
    flex: 1,
  },
  modalDeleteSetButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalSetText: {
    fontSize: 15,
    color: '#9ca3af',
    lineHeight: 22,
  },
  modalSetEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSetEdit: {
    marginTop: 8,
  },
  modalSetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  modalSetInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalSetInputGroup: {
    flex: 1,
  },
  modalSetInputLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
    fontWeight: '500',
  },
  modalSetInput: {
    backgroundColor: '#111827',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 15,
  },
  modalSetNotesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 0,
  },
  modalNotes: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 6,
    paddingLeft: 8,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  // Delete Confirmation Overlay (rendered inside workout detail modal)
  deleteConfirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  deleteConfirmContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
  },
  deleteConfirmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  deleteConfirmMessage: {
    fontSize: 16,
    color: '#9ca3af',
    lineHeight: 24,
    marginBottom: 24,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  deleteConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  deleteConfirmButtonCancel: {
    backgroundColor: '#374151',
  },
  deleteConfirmButtonDelete: {
    backgroundColor: '#ef4444',
  },
  deleteConfirmButtonCancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButtonDeleteText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Add Exercise Button
  modalAddExerciseContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#111827',
  },
  modalAddExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    gap: 8,
  },
  modalAddExerciseText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  // Add Exercise Modal
  addExerciseModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1001,
  },
  addExerciseModalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#374151',
  },
  addExerciseModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  addExerciseModalInput: {
    backgroundColor: '#111827',
    color: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 16,
    marginBottom: 20,
  },
  addExerciseModalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  addExerciseModalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  addExerciseModalButtonCancel: {
    backgroundColor: '#374151',
  },
  addExerciseModalButtonAdd: {
    backgroundColor: '#3b82f6',
  },
  addExerciseModalButtonCancelText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  addExerciseModalButtonAddText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

