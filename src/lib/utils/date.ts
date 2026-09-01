/**
 * Date utility functions
 */

/** Full English weekday names (Sunday = 0 … Saturday = 6 in `Date.getDay()`). */
export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Short labels for planner strip UI. */
export const SHORT_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MS_PER_DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar key `YYYY-MM-DD` for a timestamp. */
export function getUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive start, exclusive end in UTC for a calendar day key. */
export function getUtcDayBoundsIso(dayKey: string): { startIso: string; endIsoExclusive: string } {
  const startIso = `${dayKey}T00:00:00.000Z`;
  const endIsoExclusive = new Date(new Date(startIso).getTime() + MS_PER_DAY_MS).toISOString();
  return { startIso, endIsoExclusive };
}

/** Local calendar key `YYYY-MM-DD` for a timestamp (device timezone). */
export function getLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Inclusive start, exclusive end of the LOCAL calendar day containing `date`,
 * as ISO timestamps. Sessions are timestamped with real moments (`now`), so
 * day-bucket queries must use local midnights — using the UTC date key shifts
 * the window by the timezone offset and makes evening sessions "disappear".
 * Uses setDate(+1) rather than +24h so DST transitions stay on local midnight.
 */
export function getLocalDayBoundsIso(date: Date = new Date()): { startIso: string; endIsoExclusive: string } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIsoExclusive: end.toISOString() };
}

/**
 * Get ISO date bounds for a weekday name in the current week (Sun–Sat),
 * computed from LOCAL midnight of the target day.
 * Used to fetch sessions for a selected plan day.
 */
export function getDateBoundsForDayName(dayName: string): { startIso: string; endIsoExclusive: string } {
  const now = new Date();
  const todayIndex = now.getDay();
  const targetIndex = WEEK_DAYS.indexOf(dayName as (typeof WEEK_DAYS)[number]);
  if (targetIndex < 0) {
    return getLocalDayBoundsIso(now);
  }
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + (targetIndex - todayIndex));
  return getLocalDayBoundsIso(targetDate);
}

/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date of birth in YYYY-MM-DD format or Date object
 * @returns Age in years, or null if dateOfBirth is invalid
 */
export function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null;

  try {
    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    
    if (isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // If birthday hasn't occurred this year yet, subtract 1
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

/**
 * Format date of birth for display
 * @param dateOfBirth - Date of birth in YYYY-MM-DD format or Date object
 * @returns Formatted date string (MM/DD/YYYY) or empty string
 */
export function formatDateOfBirth(dateOfBirth: string | Date | null | undefined): string {
  if (!dateOfBirth) return '';

  try {
    const date = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    
    if (isNaN(date.getTime())) {
      return '';
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Validate date of birth
 * @param dateOfBirth - Date of birth in YYYY-MM-DD format or Date object
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateDateOfBirth(
  dateOfBirth: string | Date | null | undefined
): { isValid: boolean; error?: string } {
  if (!dateOfBirth) {
    return { isValid: false, error: 'Date of birth is required' };
  }

  try {
    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    
    if (isNaN(birthDate.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }

    const today = new Date();
    if (birthDate > today) {
      return { isValid: false, error: 'Date of birth cannot be in the future' };
    }

    const age = calculateAge(birthDate);
    if (age === null || age < 13) {
      return { isValid: false, error: 'You must be at least 13 years old' };
    }

    if (age > 120) {
      return { isValid: false, error: 'Please enter a valid date of birth' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid date format' };
  }
}

