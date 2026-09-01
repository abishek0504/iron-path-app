import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

const SENSITIVE_KEYS = new Set([
  'email',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'sessionid',
  'session_id',
  'weight',
  'exercisename',
  'exercise_name',
]);

function scrubValue(key: string, value: unknown): unknown {
  const normalized = key.toLowerCase();
  if (SENSITIVE_KEYS.has(normalized)) return '[redacted]';
  if (typeof value === 'string' && value.length > 200) return `${value.slice(0, 200)}…`;
  return value;
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = scrubObject(value as Record<string, unknown>);
    } else {
      out[key] = scrubValue(key, value);
    }
  }
  return out;
}

/**
 * Optional crash reporting. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS env (or `extra.sentryDsn` in app config).
 * Safe to call on every native platform; no-ops on web or when DSN absent.
 */
export function initSentry(): void {
  if (Platform.OS === 'web') return;
  const dsn =
    (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ??
    process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: __DEV__ ? 0 : 0.15,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        breadcrumb.data = scrubObject(breadcrumb.data as Record<string, unknown>);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.user?.email) delete event.user.email;
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (key.toLowerCase() === 'authorization') {
            event.request.headers[key] = '[redacted]';
          }
        }
      }
      return event;
    },
  });
}
