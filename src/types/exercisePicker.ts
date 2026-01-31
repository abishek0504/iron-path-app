/**
 * Exercise type for the exercise picker (modal/list selection).
 * Matches the shape returned from v2_exercises used by ExercisePicker.
 */

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  density_score: number;
  primary_muscles: string[];
  implicit_hits: Record<string, number>;
  is_unilateral: boolean;
  setup_buffer_sec: number;
  avg_time_per_set_sec: number;
  is_timed: boolean;
  equipment_needed?: string[];
  movement_pattern?: string;
}
