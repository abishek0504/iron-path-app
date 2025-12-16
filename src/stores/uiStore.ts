/**
 * UI Store (Zustand)
 * Manages global UI state: bottom sheets, modals, toasts
 * Prevents modal-in-modal issues by centralizing all UI overlays
 */

import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

export type BottomSheetId = 
  | 'exercisePicker'
  | 'settingsMenu'
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
  
  // Toasts
  toasts: Toast[];
  
  // Actions
  openBottomSheet: (id: BottomSheetId, props?: Record<string, any>) => void;
  closeBottomSheet: () => void;
  onBottomSheetClosed: () => void;
  
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeBottomSheet: null,
  bottomSheetProps: {},
  isBottomSheetOpen: false,
  pendingBottomSheet: null,
  pendingBottomSheetProps: {},
  toasts: [],
  
  openBottomSheet: (id, props = {}) => {
    if (__DEV__) {
      devLog('ui-store', { action: 'openBottomSheet', id, hasProps: Object.keys(props).length > 0 });
    }
    set((state) => {
      if (state.isBottomSheetOpen) {
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
        };
      }
    });
    
    // If there was a sheet open, close it (which will trigger animation and then open pending)
    const currentState = useUIStore.getState();
    if (currentState.isBottomSheetOpen) {
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
  
  onBottomSheetClosed: () => {
    if (__DEV__) {
      devLog('ui-store', { action: 'onBottomSheetClosed' });
    }
    set((state) => {
      const pending = state.pendingBottomSheet;
      const pendingProps = state.pendingBottomSheetProps;
      // Clear activeBottomSheet and bottomSheetProps
      if (pending) {
        // If there's a pending sheet, open it immediately
        return {
          activeBottomSheet: pending,
          bottomSheetProps: pendingProps,
          isBottomSheetOpen: true,
          pendingBottomSheet: null,
          pendingBottomSheetProps: {},
        };
      } else {
        // No pending sheet, just clear everything
        return {
          activeBottomSheet: null,
          bottomSheetProps: {},
          pendingBottomSheet: null,
          pendingBottomSheetProps: {},
        };
      }
    });
  },
  
  showToast: (message, type = 'success', duration = 2000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    if (__DEV__) {
      devLog('ui-store', { action: 'showToast', type, messageLength: message.length });
    }
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    
    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

