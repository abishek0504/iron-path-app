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
import { WorkoutPicker } from './WorkoutPicker';
import { WorkoutHeatmap } from '../workout/WorkoutHeatmap';
import { SessionDetailSheet } from '../progress/SessionDetailSheet';
import { GenerateDayForm } from '../ai/GenerateDayForm';
import { DatePicker } from './DatePicker';
import { GenderPickerSheet } from './GenderPickerSheet';
import { WeightEntrySheet } from './WeightEntrySheet';
import { SmartRefreshConfirmationSheet } from './SmartRefreshConfirmationSheet';
import { SessionExerciseEditSheet } from '../workout/SessionExerciseEditSheet';
import { SaveWorkoutPresetSheet } from '../planner/SaveWorkoutPresetSheet';
import { WorkoutPresetPickerSheet } from '../planner/WorkoutPresetPickerSheet';
import { WorkoutPresetLoadOptionsSheet } from '../planner/WorkoutPresetLoadOptionsSheet';
import { WorkoutTargetPickerSheet } from '../planner/WorkoutTargetPickerSheet';
import { supabase } from '../../lib/supabase/client';

export const ModalManager: React.FC = () => {
  const activeBottomSheet = useUIStore((state) => state.activeBottomSheet);
  const bottomSheetProps = useUIStore((state) => state.bottomSheetProps);
  const isBottomSheetOpen = useUIStore((state) => state.isBottomSheetOpen);
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);
  const onBottomSheetClosed = useUIStore((state) => state.onBottomSheetClosed);

  const isVisible = (id: NonNullable<typeof activeBottomSheet>) =>
    isBottomSheetOpen && activeBottomSheet === id;

  return (
    <>
      {activeBottomSheet === 'exercisePicker' && (
        <BottomSheet
          visible={isVisible('exercisePicker')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Select Exercise"
          {...bottomSheetProps}
        >
          <ExercisePicker
            onSelect={bottomSheetProps.onSelect}
            onSelectMultiple={bottomSheetProps.onSelectMultiple}
            multiSelect={bottomSheetProps.multiSelect}
            suggestedIds={bottomSheetProps.suggestedIds}
          />
        </BottomSheet>
      )}

      {activeBottomSheet === 'settingsMenu' && (
        <BottomSheet
          visible={isVisible('settingsMenu')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Settings"
          height="60%"
          {...bottomSheetProps}
        >
          <SettingsMenu onClose={closeBottomSheet} />
        </BottomSheet>
      )}

      {activeBottomSheet === 'planDayPicker' && (
        <BottomSheet
          visible={isVisible('planDayPicker')}
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

      {activeBottomSheet === 'workoutPicker' && (
        <BottomSheet
          visible={isVisible('workoutPicker')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Choose workout"
          height="35%"
          {...bottomSheetProps}
        >
          <WorkoutPicker
            workouts={bottomSheetProps.workouts}
            selectedIndex={bottomSheetProps.selectedIndex}
            onSelect={bottomSheetProps.onSelect}
          />
        </BottomSheet>
      )}

      {activeBottomSheet === 'muscleStatus' && (
        <MuscleStatusSheet
          visible={isVisible('muscleStatus')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          bottomSheetProps={bottomSheetProps}
        />
      )}

      {activeBottomSheet === 'sessionDetail' && (
        <BottomSheet
          visible={isVisible('sessionDetail')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          title="Session Details"
          height="70%"
          {...bottomSheetProps}
        >
          <SessionDetailSheet
            selectedDate={bottomSheetProps.selectedDate}
            onClose={closeBottomSheet}
            onSessionDeleted={bottomSheetProps.onSessionDeleted}
          />
        </BottomSheet>
      )}

      {activeBottomSheet === 'generateDay' && (
        <GenerateDayForm
          visible={isVisible('generateDay')}
          dayName={bottomSheetProps.dayName ?? 'this day'}
          splitValue={bottomSheetProps.splitValue}
          onCancel={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onGenerate={bottomSheetProps.onGenerate}
        />
      )}

      {activeBottomSheet === 'datePicker' && (
        <DatePicker
          visible={isVisible('datePicker')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          value={bottomSheetProps.value}
          onChange={bottomSheetProps.onChange}
          maximumDate={bottomSheetProps.maximumDate}
          minimumDate={bottomSheetProps.minimumDate}
        />
      )}

      {activeBottomSheet === 'genderPicker' && (
        <GenderPickerSheet
          visible={isVisible('genderPicker')}
          value={bottomSheetProps.value ?? ''}
          onChange={bottomSheetProps.onChange}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
        />
      )}

      {activeBottomSheet === 'weightEntry' && (
        <WeightEntrySheet
          visible={isVisible('weightEntry')}
          unitsLabel={bottomSheetProps.unitsLabel ?? ''}
          initialValue={bottomSheetProps.initialValue ?? ''}
          placeholder={bottomSheetProps.placeholder ?? ''}
          onSave={bottomSheetProps.onSave}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
        />
      )}

      {activeBottomSheet === 'smartRefresh' && (
        <SmartRefreshConfirmationSheet
          visible={isVisible('smartRefresh')}
          plan={bottomSheetProps.plan}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onApply={bottomSheetProps.onApply}
          applying={bottomSheetProps.applying}
        />
      )}

      {activeBottomSheet === 'sessionExerciseEdit' && (
        <SessionExerciseEditSheet
          visible={isVisible('sessionExerciseEdit')}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onSave={bottomSheetProps.onSave}
          onDelete={bottomSheetProps.onDelete}
          sessionExerciseId={bottomSheetProps.sessionExerciseId}
          exerciseName={bottomSheetProps.exerciseName}
          mode={bottomSheetProps.mode}
          useImperial={bottomSheetProps.useImperial}
          supersetGroup={bottomSheetProps.supersetGroup}
          canAddToSuperset={bottomSheetProps.canAddToSuperset}
          onToggleSuperset={bottomSheetProps.onToggleSuperset}
          supersetToggleDisabled={bottomSheetProps.supersetToggleDisabled}
        />
      )}

      {activeBottomSheet === 'savePreset' && (
        <SaveWorkoutPresetSheet
          visible={isVisible('savePreset')}
          mode={bottomSheetProps.mode}
          defaultName={bottomSheetProps.defaultName}
          saving={bottomSheetProps.saving}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onSave={bottomSheetProps.onSave}
        />
      )}

      {activeBottomSheet === 'presetPicker' && (
        <WorkoutPresetPickerSheet
          visible={isVisible('presetPicker')}
          presets={bottomSheetProps.presets ?? []}
          selectedPreset={bottomSheetProps.selectedPreset ?? null}
          loading={bottomSheetProps.loading}
          applying={bottomSheetProps.applying}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onSelectPreset={bottomSheetProps.onSelectPreset}
          onLoadPreset={bottomSheetProps.onLoadPreset}
          onDelete={bottomSheetProps.onDelete}
        />
      )}

      {activeBottomSheet === 'presetLoadOptions' && (
        <WorkoutPresetLoadOptionsSheet
          visible={isVisible('presetLoadOptions')}
          presetName={bottomSheetProps.presetName}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onSelect={bottomSheetProps.onSelect}
        />
      )}

      {activeBottomSheet === 'presetTargetPicker' && (
        <WorkoutTargetPickerSheet
          visible={isVisible('presetTargetPicker')}
          workouts={bottomSheetProps.workouts ?? []}
          onClose={closeBottomSheet}
          onClosed={onBottomSheetClosed}
          onSelect={bottomSheetProps.onSelect}
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
};
