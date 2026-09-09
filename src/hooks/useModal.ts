/**
 * Modal hook
 * Convenience hook for opening modals/sheets
 */

import { useUIStore } from '../stores/uiStore';
import type { BottomSheetId } from '../stores/uiStore';

export function useModal() {
  const openBottomSheet = useUIStore((state) => state.openBottomSheet);
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);
  const patchBottomSheetProps = useUIStore((state) => state.patchBottomSheetProps);
  const activeBottomSheet = useUIStore((state) => state.activeBottomSheet);

  return {
    openSheet: (id: BottomSheetId, props?: Record<string, any>) => {
      openBottomSheet(id, props);
    },
    closeSheet: closeBottomSheet,
    patchSheet: patchBottomSheetProps,
    isOpen: (id: BottomSheetId) => activeBottomSheet === id,
  };
}

