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
  
  // Toasts
  toasts: Toast[];
  
  // Actions
  openBottomSheet: (id: BottomSheetId, props?: Record<string, any>) => void;
  closeBottomSheet: () => void;
  
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeBottomSheet: null,
  bottomSheetProps: {},
  toasts: [],
  
  openBottomSheet: (id, props = {}) => {
    if (__DEV__) {
      devLog('ui-store', { action: 'openBottomSheet', id, hasProps: Object.keys(props).length > 0 });
    }
    set({ activeBottomSheet: id, bottomSheetProps: props });
  },
  
  closeBottomSheet: () => {
    if (__DEV__) {
      devLog('ui-store', { action: 'closeBottomSheet' });
    }
    set({ activeBottomSheet: null, bottomSheetProps: {} });
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

