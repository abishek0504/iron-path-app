/**
 * Modal Manager
 * Global manager for bottom sheets and modals
 * Prevents modal-in-modal by managing all overlays in one place
 */

import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import { BottomSheet } from './BottomSheet';
import { ExercisePicker } from '../exercise/ExercisePicker';
import { SettingsMenu } from '../settings/SettingsMenu';

export const ModalManager: React.FC = () => {
  const activeBottomSheet = useUIStore((state) => state.activeBottomSheet);
  const bottomSheetProps = useUIStore((state) => state.bottomSheetProps);
  const isBottomSheetOpen = useUIStore((state) => state.isBottomSheetOpen);
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);
  const onBottomSheetClosed = useUIStore((state) => state.onBottomSheetClosed);

  // Keep sheet mounted while closing (isBottomSheetOpen === false but activeBottomSheet !== null)
  // This allows exit animation to complete before unmounting
  const shouldRenderExercisePicker = activeBottomSheet === 'exercisePicker';
  const shouldRenderSettingsMenu = activeBottomSheet === 'settingsMenu';

  return (
    <>
      {shouldRenderExercisePicker && (
        <BottomSheet
          visible={isBottomSheetOpen && activeBottomSheet === 'exercisePicker'}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Select Exercise"
          {...bottomSheetProps}
        >
          <ExercisePicker
            onSelect={bottomSheetProps.onSelect}
            multiSelect={bottomSheetProps.multiSelect}
          />
        </BottomSheet>
      )}

      {shouldRenderSettingsMenu && (
        <BottomSheet
          visible={isBottomSheetOpen && activeBottomSheet === 'settingsMenu'}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Settings"
          height="60%"
          {...bottomSheetProps}
        >
          <SettingsMenu onClose={closeBottomSheet} />
        </BottomSheet>
      )}
    </>
  );
};

