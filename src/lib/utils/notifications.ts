import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

function isExpoGo(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return true;
  }
  // Deprecated but still set in some tooling paths.
  return Constants.appOwnership === 'expo';
}

export interface ReminderSettings {
  enabled: boolean;
  days: number[];  // 0=Sun, 1=Mon, ..., 6=Sat (JS Date convention)
  hour: number;    // 0–23
  minute: number;  // 0–55 in 5-min steps
}

const STORAGE_KEY = '@iron_path_reminders';
const NOTIF_PREFIX = 'workout-reminder-';
const ANDROID_CHANNEL_ID = 'workout-reminders';

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  days: [1, 2, 3, 4, 5], // Mon–Fri
  hour: 19,
  minute: 0,
};

// Local + push token native code is not in the Expo Go binary; require() throws there.
// A dev/production binary missing the native module (e.g. built before expo-notifications)
// must also degrade gracefully instead of crashing the app.
const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web' && !isExpoGo();

function getN(): typeof import('expo-notifications') | null {
  if (!NOTIFICATIONS_SUPPORTED) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

/** Call once at app start (inside useEffect in root layout). No-ops in Expo Go. */
export function initNotifications(): void {
  const N = getN();
  if (!N) return;

  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  void ensureAndroidChannel();
}

export async function ensureAndroidChannel(): Promise<void> {
  const N = getN();
  if (!N || Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Workout Reminders',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function requestNotificationPermission(): Promise<boolean> {
  const N = getN();
  if (!N) return false;
  const { status: existing } = await N.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelWorkoutReminders(): Promise<void> {
  const N = getN();
  if (!N) return;
  const scheduled = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(NOTIF_PREFIX))
      .map((n) => N.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function scheduleWorkoutReminders(settings: ReminderSettings): Promise<void> {
  const N = getN();
  if (!N) return;

  await cancelWorkoutReminders();
  if (!settings.enabled || settings.days.length === 0) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  await ensureAndroidChannel();

  await Promise.all(
    settings.days.map((jsDay) => {
      // expo-notifications weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
      const weekday = (jsDay + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      return N.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX}${jsDay}`,
        content: {
          title: 'Time to train 💪',
          body: 'Your workout is waiting — open IronPath to get started.',
          sound: true,
          data: { screen: 'workout' },
          ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_ID }),
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: settings.hour,
          minute: settings.minute,
        },
      });
    }),
  );
}

const CANONICAL_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Map profile `workout_days` to reminder day indices (JS: 0=Sun … 6=Sat). */
export function workoutDayNamesToReminderIndices(names: string[] | null | undefined): number[] {
  if (!names?.length) return [1, 2, 3, 4, 5];
  const out: number[] = [];
  for (const n of names) {
    const i = CANONICAL_DAY_NAMES.indexOf(n as (typeof CANONICAL_DAY_NAMES)[number]);
    if (i >= 0 && !out.includes(i)) out.push(i);
  }
  return out.length ? out.sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

/** When profile training days change, reschedule local notifications if reminders are on. */
export async function rescheduleRemindersAfterProfileWorkoutDays(
  workout_day_names: string[] | null | undefined,
): Promise<void> {
  const current = await loadReminderSettings();
  if (!current.enabled) return;
  const days = workoutDayNamesToReminderIndices(workout_day_names);
  const next: ReminderSettings = { ...current, days };
  await saveReminderSettings(next);
  await scheduleWorkoutReminders(next);
}

/** Tap on a scheduled reminder → Workout tab (`/(tabs)`). */
export function setupNotificationResponseRouting(): () => void {
  const N = getN();
  if (!N) return () => {};

  const goWorkout = (): void => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { router } = require('expo-router') as typeof import('expo-router');
      router.push('/(tabs)');
    } catch {
      /* ignore */
    }
  };

  const onResponse = (response: import('expo-notifications').NotificationResponse | null | undefined) => {
    if (!response) return;
    const data = response.notification.request.content.data as { screen?: string } | undefined;
    if (data?.screen === 'workout') goWorkout();
  };

  void N.getLastNotificationResponseAsync().then((r) => onResponse(r ?? null));

  const sub = N.addNotificationResponseReceivedListener((r) => onResponse(r));
  return () => sub.remove();
}