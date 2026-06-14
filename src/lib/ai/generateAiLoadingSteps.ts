/**
 * Phase labels and timing for the AI generate loading step checklist.
 */

export const AI_LOADING_STEPS = [
  'Reading your split and preferences',
  'Picking compound movements',
  'Balancing volume and intensity',
  'Matching sets and reps to your level',
  'Putting the finishing touches on your session',
] as const;

export const AI_LOADING_STEP_INTERVAL_MS = 3000;
export const AI_LOADING_STEP_ENTRANCE_STAGGER_MS = 200;
export const AI_LOADING_STEP_ENTRANCE_SLIDE_MS = 400;
export const AI_LOADING_STEP_ROW_HEIGHT = 52;

export function getAiLoadingEntranceDurationMs(stepCount = AI_LOADING_STEPS.length): number {
  if (stepCount <= 1) return 0;
  return (stepCount - 1) * AI_LOADING_STEP_ENTRANCE_STAGGER_MS + AI_LOADING_STEP_ENTRANCE_SLIDE_MS;
}
