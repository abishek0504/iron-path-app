/**
 * Toast hook
 * Convenience hook for showing toasts
 */

import { useUIStore } from '../stores/uiStore';

export function useToast() {
  const showToast = useUIStore((state) => state.showToast);

  return {
    show: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => {
      showToast(message, type, duration);
    },
    success: (message: string, duration?: number) => {
      showToast(message, 'success', duration);
    },
    error: (message: string, duration?: number) => {
      showToast(message, 'error', duration);
    },
    info: (message: string, duration?: number) => {
      showToast(message, 'info', duration);
    },
  };
}

