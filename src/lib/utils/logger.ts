/**
 * Dev logging utility
 * All logs are wrapped in __DEV__ checks and only log aggregates/state drivers
 * Never log per-item data in loops
 * On web in __DEV__, logs are sent to the dev log server (run: node scripts/dev-log-server.js) so they appear in the Node terminal.
 */

type LogPayload = Record<string, any>;

const DEV_LOG_URL = 'http://localhost:3333/log';

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

function sendToLogServer(module: string, payload: LogPayload, level: 'log' | 'error' | 'warn'): void {
  if (!isWeb()) return;
  fetch(DEV_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module, payload, level }),
  }).catch(() => {});
}

/**
 * Structured dev logging
 * @param module - Module name (e.g., 'workout-generation', 'exercise-merge')
 * @param payload - State drivers, ranges, aggregates (not per-item data)
 */
export function devLog(module: string, payload: LogPayload): void {
  if (__DEV__) {
    if (isWeb()) sendToLogServer(module, payload, 'log');
    else console.log(`[${module}]`, payload);
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
    const payload = { error: String(error), ...context };
    if (isWeb()) sendToLogServer(module, payload, 'error');
    else console.error(`[${module}] ERROR:`, error, context || '');
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
    const payload = { message, ...context };
    if (isWeb()) sendToLogServer(module, payload, 'warn');
    else console.warn(`[${module}] WARN:`, message, context || '');
  }
}

