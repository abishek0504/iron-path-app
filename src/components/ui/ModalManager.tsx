/**
 * Modal Manager
 * Global manager for bottom sheets and modals
 * Prevents modal-in-modal by managing all overlays in one place
 */

import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { BottomSheet } from './BottomSheet';
import { ExercisePicker } from '../exercise/ExercisePicker';
import { SettingsMenu } from '../settings/SettingsMenu';
import { PlanDayPicker } from './PlanDayPicker';
import { WorkoutHeatmap } from '../workout/WorkoutHeatmap';
import { SessionDetailSheet } from '../progress/SessionDetailSheet';
import { supabase } from '../../lib/supabase/client';

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
  const shouldRenderPlanDayPicker = activeBottomSheet === 'planDayPicker';
  const shouldRenderMuscleStatus = activeBottomSheet === 'muscleStatus';
  const shouldRenderSessionDetail = activeBottomSheet === 'sessionDetail';

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

      {shouldRenderPlanDayPicker && (
        <BottomSheet
          visible={isBottomSheetOpen && activeBottomSheet === 'planDayPicker'}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Choose plan day"
          height="45%"
          {...bottomSheetProps}
        >
          <PlanDayPicker
            selectedDayName={bottomSheetProps.selectedDayName}
            todayDayName={bottomSheetProps.todayDayName}
            days={bottomSheetProps.days}
            onSelect={bottomSheetProps.onSelect}
            onResetToToday={bottomSheetProps.onResetToToday}
          />
        </BottomSheet>
      )}

      {shouldRenderMuscleStatus && (
        <MuscleStatusSheet
          visible={isBottomSheetOpen && activeBottomSheet === 'muscleStatus'}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          bottomSheetProps={bottomSheetProps}
        />
      )}

      {shouldRenderSessionDetail && (
        <BottomSheet
          visible={isBottomSheetOpen && activeBottomSheet === 'sessionDetail'}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Session Details"
          height="60%"
          {...bottomSheetProps}
        >
          <SessionDetailSheet
            selectedDate={bottomSheetProps.selectedDate}
            onClose={closeBottomSheet}
            onSessionDeleted={bottomSheetProps.onSessionDeleted}
          />
        </BottomSheet>
      )}
    </>
  );
};

interface MuscleStatusSheetProps {
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
  bottomSheetProps: Record<string, any>;
}

const MuscleStatusSheet: React.FC<MuscleStatusSheetProps> = ({
  visible,
  onClose,
  onClosed,
  bottomSheetProps,
}) => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    const getUserId = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };

    getUserId();
  }, [visible]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="Muscle status"
      height="60%"
      {...bottomSheetProps}
    >
      {userId && <WorkoutHeatmap userId={userId} />}
    </BottomSheet>
  );
}

