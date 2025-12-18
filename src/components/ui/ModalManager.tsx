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
import { WorkoutHeatmap, type MuscleStressData } from '../workout/WorkoutHeatmap';
import { supabase } from '../../lib/supabase/client';
import { getMuscleStressStats } from '../../lib/supabase/queries/workouts';
import { devLog, devError } from '../../lib/utils/logger';

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
  const [data, setData] = useState<MuscleStressData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const end = new Date();
        const start = new Date(end);
        start.setDate(end.getDate() - 30);

        const stressMap = await getMuscleStressStats(
          userId,
          start.toISOString(),
          end.toISOString()
        );

        const entries = Object.entries(stressMap);
        const heatmapData: MuscleStressData[] = entries.map(([muscle_key, stress]) => ({
          muscle_key,
          display_name: muscle_key,
          stress,
        }));

        setData(heatmapData.sort((a, b) => b.stress - a.stress));

        if (__DEV__) {
          devLog('heatmap', {
            action: 'muscleStatus_load_result',
            userId,
            muscleCount: heatmapData.length,
          });
        }
      } catch (error) {
        if (__DEV__) {
          devError('heatmap', error, { action: 'muscleStatus_load' });
        }
      } finally {
        setLoading(false);
      }
    };

    load();
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
      {loading ? null : (
        <WorkoutHeatmap
          stressData={data}
          onMuscleSelect={bottomSheetProps.onMuscleSelect}
        />
      )}
    </BottomSheet>
  );
}

