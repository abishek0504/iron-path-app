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

/**
 * Get ISO date bounds for a weekday name in the current week (Sun–Sat).
 * Used to fetch sessions for a selected plan day.
 */
export function getDateBoundsForDayName(dayName: string): { startIso: string; endIsoExclusive: string } {
  const now = new Date();
  const todayIndex = now.getDay();
  const targetIndex = WEEK_DAYS.indexOf(dayName as (typeof WEEK_DAYS)[number]);
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + (targetIndex - todayIndex));
  const dateKey = targetDate.toISOString().slice(0, 10);
  const startIso = `${dateKey}T00:00:00.000Z`;
  const endIsoExclusive = new Date(new Date(startIso).getTime() + MS_PER_DAY_MS).toISOString();
  return { startIso, endIsoExclusive };
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

