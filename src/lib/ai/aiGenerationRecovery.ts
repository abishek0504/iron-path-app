/**
 * Persist in-flight AI generation params so a crash can retry with the same idempotency key.
 */

import { authStorage } from '../supabase/authStorage';

const PENDING_KEY = 'ironpath_pending_ai_generation';

export interface PendingAiGeneration {
  generationId: string;
  templateId: string;
  dayId: string;
  dayName: string;
  dayIndex: number;
  sessionsPerDay: number;
  constraintsRaw: string;
  savedAt: string;
}

export async function savePendingAiGeneration(pending: PendingAiGeneration): Promise<void> {
  await authStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export async function loadPendingAiGeneration(): Promise<PendingAiGeneration | null> {
  const raw = await authStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAiGeneration;
  } catch {
    return null;
  }
}

export async function clearPendingAiGeneration(): Promise<void> {
  await authStorage.removeItem(PENDING_KEY);
}

export function matchesPendingGeneration(
  pending: PendingAiGeneration,
  params: {
    templateId: string;
    dayId: string;
    dayName: string;
    dayIndex: number;
    sessionsPerDay: number;
    constraintsRaw: string;
  },
): boolean {
  return (
    pending.templateId === params.templateId &&
    pending.dayId === params.dayId &&
    pending.dayName === params.dayName &&
    pending.dayIndex === params.dayIndex &&
    pending.sessionsPerDay === params.sessionsPerDay &&
    pending.constraintsRaw === params.constraintsRaw
  );
}
