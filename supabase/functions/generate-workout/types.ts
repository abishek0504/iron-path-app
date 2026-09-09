/** Types for generate-workout. */

export interface GenerateRequestBody {
  idempotencyKey?: unknown;
  dayId?: unknown;
  templateId?: unknown;
  dayName?: unknown;
  sessionsPerDay?: unknown;
  constraints?: unknown;
  sessionStartIso?: unknown;
  sessionEndIsoExclusive?: unknown;
}

/** User-chosen constraints from the pre-generation form (all optional). */
export interface DayConstraints {
  dayFocus: string | null;
  exercisesPerSession: number | null;
  intensity: 'light' | 'standard' | 'hard';
  emphasizeMuscles: string[];
  avoidMuscles: string[];
  stretchCount: number;
}

export interface AllowListedExercise {
  id: string;
  name: string;
  primary_muscles: string[];
  equipment_needed: string[] | null;
  is_timed: boolean;
  is_stretch: boolean;
  movement_pattern: string | null;
  priority_order: number;
}

export interface UserContext {
  experience_level: string;
  equipment_access: string[];
  days_per_week: number | null;
  preferred_training_style: string | null;
  workout_days: string[];
  use_imperial: boolean;
  current_weight: number | null;
  goal_weight: number | null;
}

/** One exercise as prescribed by the LLM (targets may be nulled by validation). */
export interface AiExercisePlan {
  exercise_id: string;
  sets: number | null;
  reps: number | null;
  duration_sec: number | null;
  weight: number | null;
  target_rpe: number | null;
}

/** Compact per-exercise performance summary fed to the LLM. */
export interface ExerciseHistorySummary {
  last_performed: string;
  last_set: { weight: number | null; reps: number | null; duration_sec: number | null; rpe: number | null };
  top_set: { weight: number | null; reps: number | null; duration_sec: number | null };
  avg_rpe: number | null;
  recent_set_count: number;
}

export interface AuditRow {
  template_id: string | null;
  day_name: string | null;
  sessions_per_day: number | null;
  exercise_count: number | null;
  model: string | null;
  source: 'openai' | 'fallback' | 'error';
  latency_ms: number | null;
  error_code: string | null;
  generation_job_id?: string | null;
}
