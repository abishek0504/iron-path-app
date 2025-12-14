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
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);

  // Render bottom sheets based on active sheet ID
  // Each sheet type will be rendered conditionally
  // This prevents multiple sheets from being open simultaneously

  return (
    <>
      {activeBottomSheet === 'exercisePicker' && (
        <BottomSheet
          visible={true}
          onClose={closeBottomSheet}
          title="Select Exercise"
          {...bottomSheetProps}
        >
          <ExercisePicker
            onSelect={bottomSheetProps.onSelect}
            multiSelect={bottomSheetProps.multiSelect}
          />
        </BottomSheet>
      )}

      {activeBottomSheet === 'settingsMenu' && (
        <BottomSheet
          visible={true}
          onClose={closeBottomSheet}
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

