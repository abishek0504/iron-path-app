/**
 * Exercise Picker hook
 * Convenience hook for opening exercise picker
 */

import { useUIStore } from '../stores/uiStore';
import type { Exercise } from '../stores/exerciseStore';

export function useExercisePicker() {
  const openBottomSheet = useUIStore((state) => state.openBottomSheet);
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);

  return {
    open: (onSelect: (exercise: Exercise) => void, multiSelect = false) => {
      openBottomSheet('exercisePicker', { onSelect, multiSelect });
    },
    close: closeBottomSheet,
  };
}

