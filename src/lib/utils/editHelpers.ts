/**
 * Edit Helpers
 * Utilities for detecting and applying structure vs load/performance edits
 */

/**
 * Edit types for structure edits
 */
export type StructureEditType =
  | 'swapExercise'
  | 'addSlot'
  | 'removeSlot'
  | 'reorderSlots'
  | 'updateNotes'
  | 'updateSetCountIntent';

/**
 * Edit types for load/performance edits
 */
export type LoadEditType =
  | 'updateWeight'
  | 'updateReps'
  | 'updateDuration'
  | 'updateRPE'
  | 'updateRIR';

/**
 * Check if an edit is a structure edit
 */
export function isStructureEdit(editType: string): boolean {
  const structureEdits: StructureEditType[] = [
    'swapExercise',
    'addSlot',
    'removeSlot',
    'reorderSlots',
    'updateNotes',
    'updateSetCountIntent',
  ];
  return structureEdits.includes(editType as StructureEditType);
}

