/**
 * Date context for Planner: selected day drives Today vs Future.
 * Used for context-aware add/remove (Today = session, Future = template).
 * Does not replace tabs; Workout tab remains dedicated "Today" screen.
 */

const WEEK_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function getTodayDayName(): string {
  return WEEK_DAYS[new Date().getDay()];
}

export interface DateContext {
  selectedDayName: string | undefined;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Returns context for the currently selected day in the planner.
 * @param selectedDayName - Day name from template (e.g. "Monday")
 */
export function useDateContext(selectedDayName: string | undefined): DateContext {
  const todayName = getTodayDayName();
  const isToday = selectedDayName === todayName;
  const isFuture = !!selectedDayName && !isToday;
  return {
    selectedDayName,
    isToday,
    isFuture,
  };
}
