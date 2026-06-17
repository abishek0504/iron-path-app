import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  startTour: () => void;
  setStepIndex: (index: number) => void;
  nextStep: () => void;
  endTour: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,

  startTour: () => {
    if (__DEV__) {
      devLog('app-tour', { action: 'startTour' });
    }
    set({ isActive: true, currentStepIndex: 0 });
  },

  setStepIndex: (index) => {
    set({ currentStepIndex: index });
  },

  nextStep: () => {
    const { currentStepIndex } = get();
    if (__DEV__) {
      devLog('app-tour', { action: 'nextStep', fromIndex: currentStepIndex });
    }
    set({ currentStepIndex: currentStepIndex + 1 });
  },

  endTour: () => {
    if (__DEV__) {
      devLog('app-tour', { action: 'endTour' });
    }
    set({ isActive: false, currentStepIndex: 0 });
  },
}));
