/**
 * UI Store (Zustand)
 * Manages global UI state: bottom sheets, modals, toasts
 * Prevents modal-in-modal issues by centralizing all UI overlays
 */

import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export type BottomSheetId =
  | 'exercisePicker'
  | 'settingsMenu'
  | 'planDayPicker'
  | 'workoutPicker'
  | 'muscleStatus'
  | 'sessionDetail'
  | null;

export type Toast = {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
};

interface UIState {
  // Bottom sheets
  activeBottomSheet: BottomSheetId;
  bottomSheetProps: Record<string, any>;
  isBottomSheetOpen: boolean;
  pendingBottomSheet: BottomSheetId | null;
  pendingBottomSheetProps: Record<string, any>;
  /** Runs after the current sheet fully unmounts (exit animation done). */
  pendingAfterClose: (() => void) | null;
  
  // Toasts
  toasts: Toast[];
  
  /** Set true when add-exercise-edit adds to routine; planner refetches on focus and clears */
  plannerNeedsRefetch: boolean;

  /** Set true after finishing a workout; workout tab refetches on focus and clears */
  workoutNeedsRefetch: boolean;
  
  // Actions
  openBottomSheet: (id: BottomSheetId, props?: Record<string, any>) => void;
  closeBottomSheet: () => void;
  onBottomSheetClosed: () => void;
  /** Queue work to run after the open sheet finishes closing (avoids nested RN Modals). */
  runAfterBottomSheetClosed: (action: () => void) => void;
  
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  setPlannerNeedsRefetch: (value: boolean) => void;
  setWorkoutNeedsRefetch: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeBottomSheet: null,
  bottomSheetProps: {},
  isBottomSheetOpen: false,
  pendingBottomSheet: null,
  pendingBottomSheetProps: {},
  pendingAfterClose: null,
  toasts: [],
  plannerNeedsRefetch: false,
  workoutNeedsRefetch: false,

  setPlannerNeedsRefetch: (value) => {
    set({ plannerNeedsRefetch: value });
  },

  setWorkoutNeedsRefetch: (value) => {
    set({ workoutNeedsRefetch: value });
  },

  openBottomSheet: (id, props = {}) => {
    if (__DEV__) {
      devLog('ui-store', { action: 'openBottomSheet', id, hasProps: Object.keys(props).length > 0 });
    }

    // Snapshot current state to decide whether to queue or open
    const wasOpen = useUIStore.getState().isBottomSheetOpen;

    set((state) => {
      if (wasOpen) {
        // Sheet is open, queue this one as pending
        return { 
          pendingBottomSheet: id,
          pendingBottomSheetProps: props,
        };
      } else {
        // No sheet open, open immediately
        return {
          activeBottomSheet: id,
          bottomSheetProps: props,
          isBottomSheetOpen: true,
          pendingBottomSheet: null,
          pendingBottomSheetProps: {},
        };
      }
    });
    
    // If there was a sheet open, close it (which will trigger animation and then open pending)
    if (wasOpen) {
      useUIStore.getState().closeBottomSheet();
    }
  },
  
  closeBottomSheet: () => {
    if (__DEV__) {
      devLog('ui-store', { action: 'closeBottomSheet' });
    }
    // Set isBottomSheetOpen to false but keep activeBottomSheet until animation completes
    set({ isBottomSheetOpen: false });
  },

  runAfterBottomSheetClosed: (action) => {
    if (__DEV__) {
      devLog('ui-store', { action: 'runAfterBottomSheetClosed' });
    }
    set({ pendingAfterClose: action });
  },
  
  onBottomSheetClosed: () => {
    if (__DEV__) {
      devLog('ui-store', { action: 'onBottomSheetClosed' });
    }
    const snapshot = useUIStore.getState();
    const queuedAfterClose = snapshot.pendingAfterClose;
    const pending = snapshot.pendingBottomSheet;
    const pendingProps = snapshot.pendingBottomSheetProps;
    const openedPendingSheet = !!pending;
    set(
      pending
        ? {
            activeBottomSheet: pending,
            bottomSheetProps: pendingProps,
            isBottomSheetOpen: true,
            pendingBottomSheet: null,
            pendingBottomSheetProps: {},
            pendingAfterClose: null,
          }
        : {
            activeBottomSheet: null,
            bottomSheetProps: {},
            pendingBottomSheet: null,
            pendingBottomSheetProps: {},
            pendingAfterClose: null,
          },
    );
    if (!openedPendingSheet) {
      queuedAfterClose?.();
    }
  },
  
  showToast: (message, type = 'success', duration = 2000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    if (__DEV__) {
      devLog('ui-store', { action: 'showToast', type, messageLength: message.length });
    }
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    
    const timer = setTimeout(() => {
      toastTimers.delete(id);
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
    toastTimers.set(id, timer);
  },
  
  removeToast: (id) => {
    const timer = toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

