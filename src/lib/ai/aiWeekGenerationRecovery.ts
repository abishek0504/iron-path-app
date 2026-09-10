import { authStorage } from '../supabase/authStorage';
import type { CoachWeekDay, CoachWeekMode } from './coachWeek';

const PENDING_KEY = 'ironpath_pending_ai_week_generation';

export interface PendingAiWeekGeneration {
  generationId: string;
  templateId: string;
  mode: CoachWeekMode;
  weekStartDate: string;
  days: CoachWeekDay[];
  savedAt: string;
}

export async function savePendingAiWeekGeneration(
  pending: PendingAiWeekGeneration,
): Promise<void> {
  await authStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export async function loadPendingAiWeekGeneration(): Promise<PendingAiWeekGeneration | null> {
  const raw = await authStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAiWeekGeneration;
  } catch {
    return null;
  }
}

export async function clearPendingAiWeekGeneration(): Promise<void> {
  await authStorage.removeItem(PENDING_KEY);
}

export function matchesPendingWeekGeneration(
  pending: PendingAiWeekGeneration,
  params: {
    templateId: string;
    mode: CoachWeekMode;
    weekStartDate: string;
    days: CoachWeekDay[];
  },
): boolean {
  if (
    pending.templateId !== params.templateId ||
    pending.mode !== params.mode ||
    pending.weekStartDate !== params.weekStartDate ||
    pending.days.length !== params.days.length
  ) {
    return false;
  }
  return pending.days.every((day, index) => {
    const other = params.days[index];
    return (
      !!other &&
      day.dayId === other.dayId &&
      day.dayName === other.dayName &&
      day.sessionStartIso === other.sessionStartIso
    );
  });
}
