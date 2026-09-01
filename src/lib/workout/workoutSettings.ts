import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REST_SEC } from '../engine/workoutFlow';
import { devError, devLog } from '../utils/logger';

export type IntensityMode = 'rpe' | 'rir';

export interface WorkoutSettings {
  defaultRestSec: number;
  keepScreenAwake: boolean;
  intensityMode: IntensityMode;
}

export const DEFAULT_REST_OPTIONS = [30, 60, 90, 120, 180] as const;

export const DEFAULT_WORKOUT_SETTINGS: WorkoutSettings = {
  defaultRestSec: DEFAULT_REST_SEC,
  keepScreenAwake: true,
  intensityMode: 'rpe',
};

const STORAGE_KEY = '@iron_path_workout_settings';

export function parseWorkoutSettings(raw: unknown): WorkoutSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WORKOUT_SETTINGS };
  }
  const record = raw as Partial<WorkoutSettings>;
  const rest = Number(record.defaultRestSec);
  const defaultRestSec = DEFAULT_REST_OPTIONS.includes(rest as (typeof DEFAULT_REST_OPTIONS)[number])
    ? rest
    : DEFAULT_WORKOUT_SETTINGS.defaultRestSec;
  const intensityMode: IntensityMode = record.intensityMode === 'rir' ? 'rir' : 'rpe';
  return {
    defaultRestSec,
    keepScreenAwake: record.keepScreenAwake !== false,
    intensityMode,
  };
}

export async function loadWorkoutSettings(): Promise<WorkoutSettings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_WORKOUT_SETTINGS };
    const parsed = parseWorkoutSettings(JSON.parse(stored));
    if (__DEV__) {
      devLog('workout-settings', {
        action: 'load',
        defaultRestSec: parsed.defaultRestSec,
        keepScreenAwake: parsed.keepScreenAwake,
        intensityMode: parsed.intensityMode,
      });
    }
    return parsed;
  } catch (error) {
    if (__DEV__) {
      devError('workout-settings', error, { action: 'load' });
    }
    return { ...DEFAULT_WORKOUT_SETTINGS };
  }
}

export async function saveWorkoutSettings(settings: WorkoutSettings): Promise<void> {
  const normalized = parseWorkoutSettings(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  if (__DEV__) {
    devLog('workout-settings', {
      action: 'save',
      defaultRestSec: normalized.defaultRestSec,
      keepScreenAwake: normalized.keepScreenAwake,
      intensityMode: normalized.intensityMode,
    });
  }
}
