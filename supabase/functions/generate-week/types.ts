import type { AiExercisePlan } from '../generate-workout/types.ts';

export interface GenerateWeekDayInput {
  dayId: string;
  dayName: string;
  dayIndex: number;
  trainingDayIndex: number;
  dayFocus: string | null;
  sessionStartIso: string;
  sessionEndIsoExclusive: string;
}

export interface WeekSplitDayInput {
  dayName: string;
  dayFocus: string | null;
  trainingDayIndex: number;
  trainingDayPosition: string;
}

export interface GenerateWeekRequestBody {
  idempotencyKey?: unknown;
  templateId?: unknown;
  mode?: unknown;
  weekStartDate?: unknown;
  days?: unknown;
  weekSplit?: unknown;
  splitLabel?: unknown;
  sessionMinutes?: unknown;
  exercisesPerSession?: unknown;
}

export interface WeekDayPlan {
  day_id: string;
  sessions: AiExercisePlan[][];
}

export interface WeekJobRow {
  id: string;
  user_id: string;
  template_id: string;
  mode: 'auto' | 'regenerate';
  week_start_date: string;
  days_json: GenerateWeekDayInput[];
  status: 'pending' | 'generated' | 'committed' | 'failed';
  sessions_json: WeekDayPlan[] | null;
  slots_created: number;
  error_code: string | null;
  model: string | null;
  expires_at: string;
}
