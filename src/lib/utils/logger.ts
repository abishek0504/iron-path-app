/**
 * Dev logging utility
 * All logs are wrapped in __DEV__ checks and only log aggregates/state drivers
 * Never log per-item data in loops
 */

type LogPayload = Record<string, any>;

/**
 * Structured dev logging
 * @param module - Module name (e.g., 'workout-generation', 'exercise-merge')
 * @param payload - State drivers, ranges, aggregates (not per-item data)
 */
export function devLog(module: string, payload: LogPayload): void {
  if (__DEV__) {
    console.log(`[${module}]`, payload);
  }
}

/**
 * Dev error logging
 * @param module - Module name
 * @param error - Error object or message
 * @param context - Additional context
 */
export function devError(module: string, error: unknown, context?: LogPayload): void {
  if (__DEV__) {
    console.error(`[${module}] ERROR:`, error, context || '');
  }
}

/**
 * Dev warning logging
 * @param module - Module name
 * @param message - Warning message
 * @param context - Additional context
 */
export function devWarn(module: string, message: string, context?: LogPayload): void {
  if (__DEV__) {
    console.warn(`[${module}] WARN:`, message, context || '');
  }
}

