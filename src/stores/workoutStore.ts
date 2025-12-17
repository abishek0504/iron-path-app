/**
 * Workout Store (Zustand)
 * Manages active workout/session state
 */

import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

export interface ActiveSession {
  sessionId: string;
  templateId?: string;
  dayName?: string;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  currentExerciseIndex: number;
  currentSetIndex: number;
}

interface WorkoutState {
  activeSession: ActiveSession | null;
  isLoading: boolean;
  
  // Actions
  setActiveSession: (session: ActiveSession | null) => void;
  updateSessionProgress: (exerciseIndex: number, setIndex: number) => void;
  completeSession: () => void;
  abandonSession: () => void;
  clearSession: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  activeSession: null,
  isLoading: false,
  
  setActiveSession: (session) => {
    if (__DEV__) {
      devLog('workout-store', { 
        action: 'setActiveSession', 
        hasSession: !!session,
        sessionId: session?.sessionId,
        status: session?.status 
      });
    }
    set({ activeSession: session });
  },
  
  updateSessionProgress: (exerciseIndex, setIndex) => {
    if (__DEV__) {
      devLog('workout-store', { 
        action: 'updateSessionProgress', 
        exerciseIndex, 
        setIndex 
      });
    }
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          currentExerciseIndex: exerciseIndex,
          currentSetIndex: setIndex,
        },
      };
    });
  },
  
  completeSession: () => {
    if (__DEV__) {
      devLog('workout-store', { action: 'completeSession' });
    }
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          status: 'completed',
        },
      };
    });
  },
  
  abandonSession: () => {
    if (__DEV__) {
      devLog('workout-store', { action: 'abandonSession' });
    }
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          status: 'abandoned',
        },
      };
    });
  },
  
  clearSession: () => {
    if (__DEV__) {
      devLog('workout-store', { action: 'clearSession' });
    }
    set({ activeSession: null });
  },
}));

