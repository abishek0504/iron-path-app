/**
 * v2_session_sets.weight is ADDED LOAD (belt/vest/DBs), never body mass.
 * 0 = bodyweight / no extra load. null = unset or timed. >0 = extra load.
 * Never write v2_profiles.current_weight onto a set.
 */

export const BODYWEIGHT_LOAD_LABEL = 'Bodyweight';

/** Preserve legitimate 0; only null/undefined become null. */
export function nullableAddedLoad(weight: number | null | undefined): number | null {
  return weight ?? null;
}

export function isBodyweightLoad(weight: number | null | undefined): boolean {
  return weight === 0;
}

/** Progressive overload may add load only when last logged extra weight was > 0. */
export function canProgressAddedLoad(lastWeight: number): boolean {
  return lastWeight > 0;
}

export function isBodyweightLoadInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === BODYWEIGHT_LOAD_LABEL.toLowerCase()) return true;
  if (trimmed === '') return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed === 0;
}

export function parseAddedLoadInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.toLowerCase() === BODYWEIGHT_LOAD_LABEL.toLowerCase()) return 0;
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function formatAddedLoadLabel(weight: number | null | undefined): string | null {
  if (weight == null) return null;
  if (weight === 0) return BODYWEIGHT_LOAD_LABEL;
  return String(weight);
}
