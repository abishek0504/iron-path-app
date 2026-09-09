import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

const STORAGE_KEY = 'ironpath.workout_session_persist.v1';

export type PersistedWorkoutPhase =
  | { type: 'execution'; setIndex: number }
  | { type: 'timedSetRpe'; setIndex: number; elapsedDurationSec: number }
  | { type: 'rest'; nextExerciseIndex: number; nextSetIndex: number }
  | { type: 'logging' }
  | { type: 'complete' };

export type ExerciseTimerPersistPhase = 'idle' | 'prep' | 'hold';

export interface PersistedWorkoutSession {
  sessionId: string;
  workoutPhase: PersistedWorkoutPhase;
  currentExerciseIndex: number;
  restEndsAtEpoch: number | null;
  restStartedAtEpoch: number | null;
  liveWeight: string;
  liveReps: string;
  currentSetRPEs: number[];
  currentSetRIRs: number[];
  exerciseTimerPhase: ExerciseTimerPersistPhase;
  exerciseTimerPrepEndsAt: number | null;
  exerciseTimerHoldEndsAt: number | null;
}

interface WorkoutSessionPersistState {
  snapshot: PersistedWorkoutSession | null;
  hydrate: () => Promise<PersistedWorkoutSession | null>;
  persist: (snapshot: PersistedWorkoutSession) => void;
  clear: (sessionId?: string) => void;
}

async function writeSnapshot(snapshot: PersistedWorkoutSession | null): Promise<void> {
  if (snapshot == null) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export const useWorkoutSessionStore = create<WorkoutSessionPersistState>((set, get) => ({
  snapshot: null,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ snapshot: null });
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as PersistedWorkoutSession;
      if (!parsed?.sessionId || !parsed.workoutPhase) {
        set({ snapshot: null });
        return null;
      }
      set({ snapshot: parsed });
      if (__DEV__) {
        devLog('workout-persist', { action: 'hydrate', sessionId: parsed.sessionId, phase: parsed.workoutPhase.type });
      }
      return parsed;
    } catch {
      set({ snapshot: null });
      return null;
    }
  },

  persist: (snapshot) => {
    set({ snapshot });
    void writeSnapshot(snapshot);
    if (__DEV__) {
      devLog('workout-persist', {
        action: 'persist',
        sessionId: snapshot.sessionId,
        phase: snapshot.workoutPhase.type,
      });
    }
  },

  clear: (sessionId) => {
    const current = get().snapshot;
    if (sessionId && current && current.sessionId !== sessionId) return;
    set({ snapshot: null });
    void writeSnapshot(null);
    if (__DEV__) {
      devLog('workout-persist', { action: 'clear', sessionId: sessionId ?? current?.sessionId });
    }
  },
}));
