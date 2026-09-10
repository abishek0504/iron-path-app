/**
 * Product rules for deleting a planner workout and seeding Add Workout.
 */

export function shouldClearWeeklyPlanOnWorkoutDelete(remainingSessionCount: number): boolean {
  return remainingSessionCount === 0;
}

export function shouldSeedAddWorkoutFromTemplateSlots(input: {
  sessionCount: number;
  slotCount: number;
  isMaterializeSuppressed: boolean;
}): boolean {
  return input.sessionCount === 0 && input.slotCount > 0 && !input.isMaterializeSuppressed;
}
