import { create } from 'zustand';
import { persistTourStepIndex } from '../lib/onboarding/tourBridge';
import { TOUR_STEP_COUNT } from '../lib/onboarding/tourSteps';
import { devLog } from '../lib/utils/logger';

interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  startTour: (stepIndex?: number) => void;
  setStepIndex: (index: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  endTour: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,

  startTour: (stepIndex = 0) => {
    const nextIndex = Math.min(Math.max(stepIndex, 0), TOUR_STEP_COUNT - 1);
    if (__DEV__) {
      devLog('app-tour', { action: 'startTour', stepIndex: nextIndex });
    }
    set({ isActive: true, currentStepIndex: nextIndex });
    void persistTourStepIndex(nextIndex);
  },

  setStepIndex: (index) => {
    const nextIndex = Math.min(Math.max(index, 0), TOUR_STEP_COUNT - 1);
    set({ currentStepIndex: nextIndex });
    void persistTourStepIndex(nextIndex);
  },

  nextStep: () => {
    const { currentStepIndex } = get();
    if (__DEV__) {
      devLog('app-tour', { action: 'nextStep', fromIndex: currentStepIndex });
    }
    get().setStepIndex(currentStepIndex + 1);
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex <= 0) return;
    if (__DEV__) {
      devLog('app-tour', { action: 'previousStep', fromIndex: currentStepIndex });
    }
    get().setStepIndex(currentStepIndex - 1);
  },

  endTour: () => {
    if (__DEV__) {
      devLog('app-tour', { action: 'endTour' });
    }
    set({ isActive: false, currentStepIndex: 0 });
  },
}));
